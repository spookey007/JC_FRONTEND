/**
 * Client-side storage service that uses Redis via backend API
 * Provides localStorage-like interface but stores data in Redis
 */

interface StorageItem {
  value: string;
  timestamp: number;
  ttl?: number; // Time to live in seconds
}

class StorageService {
  private memoryCache = new Map<string, StorageItem>();
  private isOnline = true;
  private apiBase: string;
  private useWebSocket = false;
  private wsClient: any = null;
  private isWebSocketReady = false;
  public operationQueue: Array<() => Promise<void>> = [];
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Use environment-based API URL
    this.apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    
    // Check if we're online
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('🌐 [StorageService] Back online, syncing with Redis');
        this.syncMemoryCacheToRedis();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('🌐 [StorageService] Offline, using memory cache only');
      });
    }
  }

  /**
   * Enable WebSocket mode (call this immediately when app starts)
   */
  public enableWebSocketMode() {
    this.useWebSocket = true;
    console.log(`🔌 [StorageService] WebSocket mode enabled - operations will be queued until WebSocket client is available`);
  }

  /**
   * Set WebSocket client for WebSocket-based storage
   */
  public setWebSocketClient(wsClient: any) {
    this.wsClient = wsClient;
    this.useWebSocket = !!wsClient;
    
    if (this.useWebSocket && wsClient) {
      this.startConnectionMonitoring();
    }
    
    console.log(`🔌 [StorageService] ${this.useWebSocket ? 'Switched to WebSocket' : 'Using HTTP API'} mode`);
  }

  /**
   * Start monitoring WebSocket connection state
   */
  private startConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(() => {
      if (this.wsClient && this.wsClient.isConnected?.()) {
        if (!this.isWebSocketReady) {
          console.log('🔌 [StorageService] WebSocket is now ready, processing queued operations');
          this.isWebSocketReady = true;
          this.processOperationQueue();
        }
      } else {
        if (this.isWebSocketReady) {
          console.log('🔌 [StorageService] WebSocket disconnected, queuing operations');
          this.isWebSocketReady = false;
        }
      }
    }, 500); // Check every 500ms for faster response
  }

  /**
   * Force check WebSocket connection and process queue if ready
   */
  public checkConnectionAndProcessQueue() {
    if (this.wsClient && this.wsClient.isConnected?.()) {
      if (!this.isWebSocketReady) {
        console.log(`🔌 [StorageService] WebSocket connection detected, processing ${this.operationQueue.length} queued operations`);
        this.isWebSocketReady = true;
        this.processOperationQueue();
      }
    } else {
      if (this.isWebSocketReady) {
        console.log('🔌 [StorageService] WebSocket disconnected, queuing operations');
        this.isWebSocketReady = false;
      }
    }
  }

  /**
   * Get the current queue size
   */
  public getQueueSize(): number {
    return this.operationQueue.length;
  }

  public getWebSocketReady(): boolean {
    return this.isWebSocketReady;
  }

  /**
   * Process queued operations when WebSocket becomes ready
   */
  private async processOperationQueue() {
    if (this.operationQueue.length === 0) return;

    console.log(`🔌 [StorageService] Processing ${this.operationQueue.length} queued operations`);
    
    const operations = [...this.operationQueue];
    this.operationQueue = [];

    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        console.error('❌ [StorageService] Error processing queued operation:', error);
      }
    }
  }

  /**
   * Queue an operation to be executed when WebSocket is ready
   */
  private queueOperation(operation: () => Promise<void>) {
    this.operationQueue.push(operation);
    console.log(`🔌 [StorageService] Queued operation, queue size: ${this.operationQueue.length}`);
  }

  /**
   * Cleanup resources
   */
  public cleanup() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    this.operationQueue = [];
    this.isWebSocketReady = false;
  }

  /**
   * Check if a key should be stored in Redis (user-specific data)
   */
  private shouldUseRedis(key: string): boolean {
    // Keys that should use Redis (user-specific, persistent data)
    // Note: l4_session is no longer stored in Redis - it's obtained fresh from WebSocket auth
    // Note: audio settings use localStorage for faster access
    const redisKeys = [
      'theme',
      'userPreferences',
      'highScores',
      'gameSettings',
      'channels_last_fetch_',
      'lastFetchTime',
      'user_data'
    ];
    
    // Audio settings should use localStorage
    const localStorageKeys = [
      'audioEnabled',
      'audioVolume', 
      'audioMuted'
    ];
    
    // Check if key should use localStorage
    if (localStorageKeys.some(pattern => key.includes(pattern))) {
      return false;
    }
    
    // Check if key matches any Redis pattern
    return redisKeys.some(pattern => key.includes(pattern));
  }

  /**
   * Get item from storage (Redis or memory cache)
   */
  async getItem(key: string): Promise<string | null> {
    try {
      // Check memory cache first
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem) {
        // Check if expired
        if (memoryItem.ttl && Date.now() - memoryItem.timestamp > memoryItem.ttl * 1000) {
          this.memoryCache.delete(key);
          return null;
        }
        
        // Handle double-wrapping from Redis auto-parsing
        let actualValue = memoryItem.value;
        if (typeof memoryItem.value === 'object' && memoryItem.value !== null && 'value' in memoryItem.value) {
          console.log(`🔍 [StorageService] Detected double-wrapping in memory cache for key "${key}", extracting nested value`);
          actualValue = (memoryItem.value as any).value;
        }
        
        // Special handling for l4_session token - ensure it's always a string
        let finalValue = actualValue;
        if (key === 'l4_session' && typeof actualValue !== 'string') {
          console.warn(`⚠️ [StorageService] l4_session token from memory cache is not a string, converting:`, typeof actualValue, actualValue);
          finalValue = String(actualValue);
        }
        
        return finalValue;
      }

      // If offline, return null
      if (!this.isOnline) {
        return null;
      }

      // Check if this key should use Redis
      if (!this.shouldUseRedis(key)) {
        console.log(`🌐 [StorageService] Key "${key}" should use localStorage, not Redis`);
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      }

      // Use WebSocket if available and ready
      if (this.useWebSocket && this.wsClient) {
        if (this.isWebSocketReady && this.wsClient.isConnected?.()) {
          console.log(`🔌 [StorageService] Using WebSocket for getItem: ${key}`);
          try {
            return await this.getItemViaWebSocket(key);
          } catch (error) {
            console.warn(`⚠️ [StorageService] WebSocket getItem failed for ${key}, falling back to localStorage:`, error instanceof Error ? error.message : String(error));
            // Fallback to localStorage
            if (typeof window !== 'undefined') {
              return localStorage.getItem(key);
            }
            return null;
          }
        } else {
          console.log(`🔌 [StorageService] WebSocket not ready, queuing getItem: ${key}`);
          return new Promise((resolve) => {
            this.queueOperation(async () => {
              try {
                const result = await this.getItemViaWebSocket(key);
                resolve(result);
              } catch (error) {
                console.error(`❌ [StorageService] Queued getItem failed for ${key}, falling back to localStorage:`, error);
                // Fallback to localStorage
                if (typeof window !== 'undefined') {
                  resolve(localStorage.getItem(key));
                } else {
                  resolve(null);
                }
              }
            });
          });
        }
      }

      // If WebSocket is not configured, queue the operation anyway
      console.log(`🔌 [StorageService] WebSocket not configured, queuing getItem: ${key}`);
      return new Promise((resolve) => {
        this.queueOperation(async () => {
          try {
            if (this.wsClient && this.wsClient.isConnected?.()) {
              const result = await this.getItemViaWebSocket(key);
              resolve(result);
            } else {
              console.warn(`⚠️ [StorageService] WebSocket still not available for queued getItem: ${key}`);
              resolve(null);
            }
          } catch (error) {
            console.error(`❌ [StorageService] Queued getItem failed for ${key}:`, error);
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.warn('⚠️ [StorageService] Failed to get item from Redis:', error);
      return null;
    }
  }

  /**
   * Set item in storage (Redis and memory cache)
   */
  async setItem(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      const timestamp = Date.now();
      const item: StorageItem = {
        value,
        timestamp,
        ttl: ttlSeconds
      };

      // Always update memory cache
      this.memoryCache.set(key, item);

      // If offline, just store in memory
      if (!this.isOnline) {
        console.log('🌐 [StorageService] Offline, storing in memory cache only');
        return true;
      }

      // Check if this key should use Redis
      if (!this.shouldUseRedis(key)) {
        console.log(`🌐 [StorageService] Key "${key}" should use localStorage, not Redis`);
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return true;
      }

      // Use WebSocket if available and ready
      if (this.useWebSocket && this.wsClient) {
        if (this.isWebSocketReady && this.wsClient.isConnected?.()) {
          console.log(`🔌 [StorageService] Using WebSocket for setItem: ${key}`);
          try {
            return await this.setItemViaWebSocket(key, value, ttlSeconds);
          } catch (error) {
            console.warn(`⚠️ [StorageService] WebSocket setItem failed for ${key}, falling back to localStorage:`, error instanceof Error ? error.message : String(error));
            // Fallback to localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem(key, value);
            }
            return true;
          }
        } else {
          console.log(`🔌 [StorageService] WebSocket not ready, queuing setItem: ${key}`);
          this.queueOperation(async () => {
            try {
              await this.setItemViaWebSocket(key, value, ttlSeconds);
            } catch (error) {
              console.error(`❌ [StorageService] Queued setItem failed for ${key}, falling back to localStorage:`, error);
              // Fallback to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem(key, value);
              }
            }
          });
          return true; // Return true since we stored in memory cache
        }
      }

      // If WebSocket is not configured, queue the operation anyway
      console.log(`🔌 [StorageService] WebSocket not configured, queuing setItem: ${key}`);
      this.queueOperation(async () => {
        try {
          if (this.wsClient && this.wsClient.isConnected?.()) {
            await this.setItemViaWebSocket(key, value, ttlSeconds);
          } else {
            console.warn(`⚠️ [StorageService] WebSocket still not available for queued setItem: ${key}`);
          }
        } catch (error) {
          console.error(`❌ [StorageService] Queued setItem failed for ${key}:`, error);
        }
      });
      
      return true; // Return true since we stored in memory cache
    } catch (error) {
      console.warn('⚠️ [StorageService] Failed to set item in Redis:', error);
      return true; // Still return true since we stored in memory
    }
  }

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      // Remove from memory cache
      this.memoryCache.delete(key);

      // If offline, just remove from memory
      if (!this.isOnline) {
        return true;
      }

      // Check if this key should use Redis
      if (!this.shouldUseRedis(key)) {
        console.log(`🌐 [StorageService] Key "${key}" should use localStorage, not Redis`);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
        return true;
      }

      // Use WebSocket if available and ready
      if (this.useWebSocket && this.wsClient) {
        if (this.isWebSocketReady && this.wsClient.isConnected?.()) {
          console.log(`🔌 [StorageService] Using WebSocket for removeItem: ${key}`);
          return await this.removeItemViaWebSocket(key);
        } else {
          console.log(`🔌 [StorageService] WebSocket not ready, queuing removeItem: ${key}`);
          this.queueOperation(async () => {
            try {
              await this.removeItemViaWebSocket(key);
            } catch (error) {
              console.error(`❌ [StorageService] Queued removeItem failed for ${key}:`, error);
            }
          });
          return true; // Return true since we removed from memory cache
        }
      }

      // If WebSocket is not configured, queue the operation anyway
      console.log(`🔌 [StorageService] WebSocket not configured, queuing removeItem: ${key}`);
      this.queueOperation(async () => {
        try {
          if (this.wsClient && this.wsClient.isConnected?.()) {
            await this.removeItemViaWebSocket(key);
          } else {
            console.warn(`⚠️ [StorageService] WebSocket still not available for queued removeItem: ${key}`);
          }
        } catch (error) {
          console.error(`❌ [StorageService] Queued removeItem failed for ${key}:`, error);
        }
      });
      
      return true; // Return true since we removed from memory cache
    } catch (error) {
      console.warn('⚠️ [StorageService] Failed to remove item from Redis:', error);
      return true; // Still return true since we removed from memory
    }
  }

  /**
   * Clear all items (memory cache only for now)
   */
  async clear(): Promise<boolean> {
    try {
      this.memoryCache.clear();
      console.log('✅ [StorageService] Memory cache cleared');
      return true;
    } catch (error) {
      console.warn('⚠️ [StorageService] Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Get all keys (memory cache only for now)
   */
  async keys(): Promise<string[]> {
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Sync memory cache to Redis when coming back online
   */
  private async syncMemoryCacheToRedis() {
    if (!this.isOnline) return;

    console.log('🔄 [StorageService] Syncing memory cache to Redis...');
    
    for (const [key, item] of this.memoryCache) {
      try {
        await this.setItem(key, item.value, item.ttl);
      } catch (error) {
        console.warn(`⚠️ [StorageService] Failed to sync key ${key}:`, error);
      }
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return {
      isOnline: this.isOnline,
      memoryCacheSize: this.memoryCache.size,
      memoryCacheKeys: Array.from(this.memoryCache.keys()),
      useWebSocket: this.useWebSocket
    };
  }

  /**
   * WebSocket-based storage methods
   */
  private async getItemViaWebSocket(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error('WebSocket client not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket request timeout'));
      }, 3000); // Reduced from 10s to 3s for faster fallback

      const handleResponse = (payload: any) => {
        clearTimeout(timeout);
        this.wsClient.off('STORAGE_GET_RESPONSE', handleResponse);
        
        if (payload.error) {
          if (payload.error === 'Key not found') {
            resolve(null);
          } else {
            reject(new Error(payload.error));
          }
          return;
        }

        // Handle double-wrapping from Redis auto-parsing
        let actualValue = payload.value;
        if (typeof payload.value === 'object' && payload.value.value !== undefined) {
          actualValue = payload.value.value;
        }

        // Special handling for l4_session token - ensure it's always a string
        if (key === 'l4_session' && typeof actualValue !== 'string') {
          actualValue = String(actualValue);
        }

        // Cache in memory
        this.memoryCache.set(key, {
          value: actualValue,
          timestamp: payload.timestamp || Date.now(),
          ttl: payload.ttl
        });

        resolve(actualValue);
      };

      this.wsClient.on('STORAGE_GET_RESPONSE', handleResponse);
      this.wsClient.sendMessage('STORAGE_GET', { key });
    });
  }

  private async setItemViaWebSocket(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error('WebSocket client not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket request timeout'));
      }, 3000); // Reduced from 10s to 3s for faster fallback

      const handleResponse = (payload: any) => {
        clearTimeout(timeout);
        this.wsClient.off('STORAGE_SET_RESPONSE', handleResponse);
        
        if (payload.error) {
          reject(new Error(payload.error));
          return;
        }

        // Update memory cache
        this.memoryCache.set(key, {
          value,
          timestamp: Date.now(),
          ttl: ttlSeconds
        });

        resolve(payload.success || false);
      };

      this.wsClient.on('STORAGE_SET_RESPONSE', handleResponse);
      this.wsClient.sendMessage('STORAGE_SET', { key, value, ttl: ttlSeconds });
    });
  }

  private async removeItemViaWebSocket(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error('WebSocket client not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket request timeout'));
      }, 3000); // Reduced from 10s to 3s for faster fallback

      const handleResponse = (payload: any) => {
        clearTimeout(timeout);
        this.wsClient.off('STORAGE_DELETE_RESPONSE', handleResponse);
        
        if (payload.error) {
          reject(new Error(payload.error));
          return;
        }

        // Remove from memory cache
        this.memoryCache.delete(key);
        resolve(payload.success || false);
      };

      this.wsClient.on('STORAGE_DELETE_RESPONSE', handleResponse);
      this.wsClient.sendMessage('STORAGE_DELETE', { key });
    });
  }
}

// Create singleton instance
export const storageService = new StorageService();

// Export for backward compatibility with localStorage-like interface
export const redisStorage = {
  getItem: (key: string) => storageService.getItem(key),
  setItem: (key: string, value: string, ttl?: number) => storageService.setItem(key, value, ttl),
  removeItem: (key: string) => storageService.removeItem(key),
  clear: () => storageService.clear(),
  keys: () => storageService.keys(),
  getStats: () => storageService.getStats()
};

export default storageService;
