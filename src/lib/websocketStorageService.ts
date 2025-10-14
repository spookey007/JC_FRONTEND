/**
 * WebSocket-based storage service
 * Provides storage operations through WebSocket instead of HTTP API
 */

import { useWebSocket } from '@/contexts/WebSocketContext';
import { useCallback, useContext } from 'react';
import { WebSocketClient } from './websocketClient';
import { SERVER_EVENTS } from '@/types/events';

interface StorageItem {
  value: string;
  timestamp: number;
  ttl?: number;
}

interface StorageResponse {
  success?: boolean;
  error?: string;
  value?: StorageItem;
  keys?: string[];
  count?: number;
  clearedCount?: number;
  settings?: Record<string, any>;
}

class WebSocketStorageService {
  private client: WebSocketClient | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>();
  private requestId = 0;

  constructor() {
    this.connect();
  }

  private connect() {
    // This will be called when WebSocket is available
    // The actual connection is managed by WebSocketContext
  }

  public setWebSocket(client: WebSocketClient | null) {
    this.client = client;
    if (client) {
      // Set up message handling through the WebSocketClient
      client.on(SERVER_EVENTS.STORAGE_RESPONSE, this.handleMessage.bind(this));
    }
  }

  private handleMessage(payload: any) {
    try {
      const { requestId, success, error, data } = payload;
      
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve, reject } = this.pendingRequests.get(requestId)!;
        this.pendingRequests.delete(requestId);
        
        if (success) {
          resolve(data);
        } else {
          reject(new Error(error || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('❌ [WebSocketStorage] Error handling message:', error);
    }
  }

  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  private sendRequest(eventType: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.isConnected()) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = this.generateRequestId();
      this.pendingRequests.set(requestId, { resolve, reject });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000); // 10 second timeout

      // Send the request
      try {
        this.client!.sendMessage(eventType as any, { ...payload, requestId });
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const response = await this.sendRequest('STORAGE_GET', { key });
      
      if (response.error) {
        if (response.error === 'Key not found') {
          return null;
        }
        throw new Error(response.error);
      }

      // Handle double-wrapping from Redis auto-parsing
      let actualValue = response.value;
      if (typeof response.value === 'object' && response.value.value !== undefined) {
        actualValue = response.value.value;
      }

      // Special handling for l4_session token - ensure it's always a string
      if (key === 'l4_session' && typeof actualValue !== 'string') {
        actualValue = String(actualValue);
      }

      return actualValue;
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to get item:', error);
      return null;
    }
  }

  async setItem(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      const response = await this.sendRequest('STORAGE_SET', { key, value, ttl: ttlSeconds });
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.success || false;
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to set item:', error);
      return false;
    }
  }

  async removeItem(key: string): Promise<boolean> {
    try {
      const response = await this.sendRequest('STORAGE_DELETE', { key });
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.success || false;
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to remove item:', error);
      return false;
    }
  }

  async listKeys(): Promise<string[]> {
    try {
      const response = await this.sendRequest('STORAGE_LIST', {});
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.keys || [];
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to list keys:', error);
      return [];
    }
  }

  async clear(): Promise<boolean> {
    try {
      const response = await this.sendRequest('STORAGE_CLEAR', {});
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.success || false;
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to clear storage:', error);
      return false;
    }
  }

  // Audio settings specific methods
  async getAudioSettings(): Promise<Record<string, any>> {
    try {
      const response = await this.sendRequest('AUDIO_SETTINGS_GET', {});
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.settings || {};
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to get audio settings:', error);
      return {};
    }
  }

  async setAudioSettings(settings: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.sendRequest('AUDIO_SETTINGS_SET', { settings });
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.success || false;
    } catch (error) {
      console.warn('⚠️ [WebSocketStorage] Failed to set audio settings:', error);
      return false;
    }
  }
}

// Create singleton instance
export const websocketStorage = new WebSocketStorageService();

// Hook to use WebSocket storage with context
export function useWebSocketStorage() {
  const { isConnected } = useWebSocket();
  
  // Update WebSocket reference when it changes
  useCallback(() => {
    if (isConnected) {
      // WebSocket is available, we can use it for storage operations
      console.log('WebSocket storage service initialized');
    }
  }, [isConnected])();

  return websocketStorage;
}

export default websocketStorage;
