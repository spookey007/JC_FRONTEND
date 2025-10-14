// Discord-inspired WebSocket client
import msgpack from 'msgpack-lite';
import { getSocketUrl } from './config';
import { ClientEvent, ServerEvent, SERVER_EVENTS } from '@/types/events';

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastConnectedAt: Date | null;
  lastError: string | null;
  shardId?: number;
  connectionId?: string;
}

export interface GatewayOptions {
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  messageQueueSize?: number;
}

export class DiscordClient {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastError: null
  };
  
  private options: Required<GatewayOptions>;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private messageQueue: Array<{ event: string; payload: any; timestamp: number }> = [];
  private eventHandlers = new Map<string, Set<(payload: any) => void>>();
  private connectionStateListeners = new Set<(state: ConnectionState) => void>();
  private isManuallyDisconnected = false;
  private lastHeartbeat = 0;
  private connectionId: string | null = null;
  private shardId: number | null = null;
  
  // Enhanced connection monitoring
  private missedHeartbeats: number = 0;
  private connectionQuality: 'excellent' | 'good' | 'poor' | 'critical' = 'excellent';
  private lastPongReceived: number = 0;
  private connectionStabilityScore: number = 100;
  private networkCheckInterval: NodeJS.Timeout | null = null;
  private qualityCheckInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor(
    private getToken: () => Promise<string | null>,
    options: GatewayOptions = {}
  ) {
    this.options = {
      maxReconnectAttempts: 25,
      reconnectBaseDelay: 500,
      reconnectMaxDelay: 60000,
      heartbeatInterval: 15000,
      connectionTimeout: 120000,
      messageQueueSize: 2000,
      ...options
    };
  }

  // Discord-style connection with shard support
  async connect(): Promise<void> {
    if (this.connectionState.isConnecting || this.isManuallyDisconnected) {
      console.log(`[DISCORD_CLIENT] ⏸️ Connection blocked - isConnecting: ${this.connectionState.isConnecting}, isManuallyDisconnected: ${this.isManuallyDisconnected}`);
      return;
    }

    // Check if we're already connected and healthy
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connectionState.isConnected) {
      console.log(`[DISCORD_CLIENT] ✅ Already connected and healthy, skipping connection`);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log(`[DISCORD_CLIENT] 🔄 Connection already in progress, state: ${this.ws.readyState}`);
      return;
    }

    // Clean up any existing connection before creating new one
    if (this.ws) {
      console.log(`[DISCORD_CLIENT] 🧹 Cleaning up existing WebSocket before new connection`);
      this.ws.close();
      this.ws = null;
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.updateConnectionState({ isConnecting: true, lastError: null });

    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const socketUrl = getSocketUrl();
      const wsUrl = `${socketUrl}?token=${encodeURIComponent(token)}`;
      
      console.log('🔗 [DISCORD_CLIENT] Connecting to gateway...', {
        url: socketUrl,
        attempt: this.connectionState.reconnectAttempts + 1
      });

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.setupEventHandlers();
      
    } catch (error) {
      console.error('❌ [DISCORD_CLIENT] Connection failed:', error);
      this.updateConnectionState({ 
        isConnecting: false, 
        lastError: error instanceof Error ? error.message : 'Connection failed' 
      });
      this.scheduleReconnect();
    }
  }

  // Discord-style event handling
  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('✅ [DISCORD_CLIENT] Gateway connection established');
      this.updateConnectionState({
        isConnected: true,
        isConnecting: false,
        lastConnectedAt: new Date(),
        lastError: null,
        reconnectAttempts: 0
      });
      
      this.startHeartbeat();
      this.flushMessageQueue();
      
      // Send initial PING immediately to keep connection alive
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendMessage('PING', {
            timestamp: Date.now(),
            clientTime: Date.now(),
            connectionId: this.connectionId,
            shardId: this.shardId,
            initialPing: true
          });
          console.log('🚀 [DISCORD_CLIENT] Sent initial PING to keep connection alive');
        }
      }, 1000); // Send after 1 second
    };

    this.ws.onmessage = (event) => {
      try {
        const data = new Uint8Array(event.data);
        const [eventType, payload, timestamp] = msgpack.decode(data) as [string, any, number];

        // Route all events through the event router
        this.routeEvent(eventType, payload);
      } catch (error) {
        console.error('❌ [DISCORD_CLIENT] Message decode error:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 [DISCORD_CLIENT] Gateway connection closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });

      this.cleanup();
      this.updateConnectionState({ isConnected: false, isConnecting: false });

      if (!this.isManuallyDisconnected && this.connectionState.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else if (this.connectionState.reconnectAttempts >= this.options.maxReconnectAttempts) {
        this.updateConnectionState({ lastError: 'Max reconnection attempts reached' });
      }
    };

    this.ws.onerror = (error) => {
      console.error('💥 [DISCORD_CLIENT] WebSocket error:', error);
      this.updateConnectionState({ lastError: 'WebSocket connection error' });
    };
  }

  // Discord-style heartbeat management with enhanced monitoring
  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Check if we've missed too many heartbeats
        if (this.missedHeartbeats >= 3) {
          console.log(`[DISCORD_CLIENT] ⚠️ Too many missed heartbeats (${this.missedHeartbeats}), reconnecting...`);
          this.scheduleReconnect();
          return;
        }

        this.sendMessage('PING', {
          timestamp: Date.now(),
          clientTime: Date.now(),
          connectionId: this.connectionId,
          shardId: this.shardId,
          missedHeartbeats: this.missedHeartbeats,
          connectionQuality: this.connectionQuality
        });
        this.lastHeartbeat = Date.now();
        
        // Increment missed heartbeats if no recent pong
        if (Date.now() - this.lastPongReceived > this.options.heartbeatInterval * 2) {
          this.missedHeartbeats++;
          this.updateConnectionQuality();
        }
      }
    }, this.options.heartbeatInterval);

    this.resetConnectionTimeout();
    this.startConnectionQualityMonitoring();
  }

  // Discord-style connection timeout
  private resetConnectionTimeout() {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    
    this.connectionTimeout = setTimeout(() => {
      console.warn('⏰ [DISCORD_CLIENT] Connection timeout');
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Connection timeout');
      }
    }, this.options.connectionTimeout);
  }

  // Discord-style reconnection with exponential backoff and jitter
  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    // Don't reconnect if we're already connected or manually disconnected
    if (this.connectionState.isConnected || this.isManuallyDisconnected) {
      console.log(`[DISCORD_CLIENT] ⏹️ Skipping reconnect - already connected or manually disconnected`);
      return;
    }

    // Calculate delay with exponential backoff and jitter
    const baseDelay = this.options.reconnectBaseDelay * Math.pow(2, this.connectionState.reconnectAttempts);
    const jitter = Math.random() * this.options.reconnectBaseDelay * 0.1; // 10% jitter
    const delay = Math.min(baseDelay + jitter, this.options.reconnectMaxDelay);

    this.connectionState.reconnectAttempts++;
    
    console.log(`🔄 [DISCORD_CLIENT] Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.connectionState.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      // Double-check before reconnecting
      if (!this.connectionState.isConnected && !this.isManuallyDisconnected) {
        this.connect();
      }
    }, delay);
  }

  // Discord-style message queuing with your existing event types
  sendMessage(event: ClientEvent, payload: any): void {
    const message = { event, payload, timestamp: Date.now() };

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const data = msgpack.encode([event, payload]);
        this.ws.send(data);
        console.log(`📤 [DISCORD_CLIENT] Sent ${event}`);
      } catch (error) {
        console.error(`❌ [DISCORD_CLIENT] Send error:`, error);
        this.queueMessage(message);
      }
    } else {
      this.queueMessage(message);
      console.warn(`⏳ [DISCORD_CLIENT] Queued ${event} - connection not ready`);
    }
  }

  private queueMessage(message: { event: ClientEvent; payload: any; timestamp: number }) {
    this.messageQueue.push(message);
    
    // Prevent queue from growing too large
    if (this.messageQueue.length > this.options.messageQueueSize) {
      console.warn('⚠️ [DISCORD_CLIENT] Message queue full, dropping old messages');
      this.messageQueue = this.messageQueue.slice(-this.options.messageQueueSize / 2);
    }
  }

  private flushMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`🚀 [DISCORD_CLIENT] Flushing ${this.messageQueue.length} queued messages`);
    
    // Filter out old messages (older than 5 minutes)
    const now = Date.now();
    const validMessages = this.messageQueue.filter(msg => now - msg.timestamp < 300000);
    this.messageQueue = validMessages;
    
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.sendMessage(msg.event as ClientEvent, msg.payload);
    }
  }

  // Discord-style event routing with your existing events
  private routeEvent(eventType: string, payload: any) {
    // Handle special events first
    if (eventType === 'CONNECTION_ESTABLISHED') {
      this.connectionId = payload.connectionId;
      this.shardId = payload.shardId;
      this.updateConnectionState({ 
        connectionId: payload.connectionId,
        shardId: payload.shardId 
      });
      console.log('🎯 [DISCORD_CLIENT] Connection established:', {
        connectionId: this.connectionId,
        shardId: this.shardId
      });
      return;
    }

    if (eventType === 'HEARTBEAT') {
      this.lastHeartbeat = Date.now();
      this.resetConnectionTimeout();
      console.log('❤️ [DISCORD_CLIENT] Server heartbeat received');
      return;
    }

    if (eventType === 'PONG') {
      this.lastPongReceived = Date.now();
      this.missedHeartbeats = 0; // Reset missed heartbeats on pong
      this.updateConnectionQuality();
      this.resetConnectionTimeout();
      console.log('🏓 [DISCORD_CLIENT] Pong received from server');
      return;
    }

    if (eventType === 'ERROR') {
      console.error('❌ [DISCORD_CLIENT] Server error:', payload.message);
      this.updateConnectionState({ lastError: payload.message });
      return;
    }

    // Route to event handlers
    const handlers = this.eventHandlers.get(eventType as ServerEvent);
    if (handlers) {
      console.log(`🔧 [DISCORD_CLIENT] Calling ${handlers.size} handlers for ${eventType}`);
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`❌ [DISCORD_CLIENT] Handler error for ${eventType}:`, error);
        }
      });
    } else {
      console.log(`⚠️ [DISCORD_CLIENT] No handlers registered for ${eventType}`);
    }
  }

  // Discord-style event management with your existing event types
  on(event: ServerEvent, handler: (payload: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    console.log(`🎯 [DISCORD_CLIENT] Registered handler for ${event}`);
  }

  off(event: ServerEvent, handler: (payload: any) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
    console.log(`🚫 [DISCORD_CLIENT] Removed handler for ${event}`);
  }

  // Discord-style connection state management
  onConnectionStateChange(listener: (state: ConnectionState) => void) {
    this.connectionStateListeners.add(listener);
    return () => this.connectionStateListeners.delete(listener);
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isConnected(): boolean {
    return this.connectionState.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Send ping if connected, don't reconnect
  sendPingIfConnected(): boolean {
    if (this.isConnected()) {
      this.sendMessage('PING', {
        timestamp: Date.now(),
        clientTime: Date.now(),
        keepAlive: true
      });
      console.log(`[DISCORD_CLIENT] 📤 Sent keep-alive ping`);
      return true;
    }
    return false;
  }

  // Get connection metrics for compatibility
  getConnectionMetrics() {
    return {
      isConnected: this.isConnected(),
      reconnectAttempts: this.connectionState.reconnectAttempts,
      lastPongReceived: this.lastPongReceived,
      queuedMessages: this.messageQueue.length,
      connectionState: this.connectionState,
      connectionId: this.connectionId,
      shardId: this.shardId,
      connectionQuality: this.connectionQuality,
      missedHeartbeats: this.missedHeartbeats,
      stabilityScore: this.connectionStabilityScore
    };
  }

  // Enhanced connection quality monitoring
  private startConnectionQualityMonitoring() {
    if (this.qualityCheckInterval) clearInterval(this.qualityCheckInterval);
    
    this.qualityCheckInterval = setInterval(() => {
      this.assessConnectionQuality();
    }, 30000); // Check every 30 seconds
  }

  private assessConnectionQuality() {
    const now = Date.now();
    const timeSinceLastPong = now - this.lastPongReceived;
    
    // Calculate stability score based on various factors
    let score = 100;
    
    // Deduct points for missed heartbeats
    score -= this.missedHeartbeats * 10;
    
    // Deduct points for delayed responses
    if (timeSinceLastPong > 30000) score -= 20;
    if (timeSinceLastPong > 60000) score -= 30;
    
    // Deduct points for connection age (older connections are more stable)
    if (this.connectionState.lastConnectedAt) {
      const connectionAge = now - this.connectionState.lastConnectedAt.getTime();
      if (connectionAge > 300000) score += 10; // Bonus for 5+ minute connections
    }
    
    this.connectionStabilityScore = Math.max(0, Math.min(100, score));
    
    // Update connection quality based on score
    if (this.connectionStabilityScore >= 90) {
      this.connectionQuality = 'excellent';
    } else if (this.connectionStabilityScore >= 70) {
      this.connectionQuality = 'good';
    } else if (this.connectionStabilityScore >= 40) {
      this.connectionQuality = 'poor';
    } else {
      this.connectionQuality = 'critical';
    }
    
    // If quality is critical, consider reconnecting
    if (this.connectionQuality === 'critical' && this.isConnected()) {
      console.log(`[DISCORD_CLIENT] 🔴 Critical connection quality, reconnecting...`);
      this.scheduleReconnect();
    }
  }

  private updateConnectionQuality() {
    // Reset missed heartbeats when we receive a pong
    if (this.lastPongReceived > this.lastHeartbeat) {
      this.missedHeartbeats = 0;
    }
    
    this.assessConnectionQuality();
  }

  private updateConnectionState(updates: Partial<ConnectionState>) {
    this.connectionState = { ...this.connectionState, ...updates };
    this.connectionStateListeners.forEach(listener => {
      try {
        listener(this.connectionState);
      } catch (error) {
        console.error('❌ [DISCORD_CLIENT] Connection state listener error:', error);
      }
    });
  }

  // Discord-style graceful disconnect
  disconnect(manual = true): void {
    this.isManuallyDisconnected = manual;
    this.cleanup();
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close(1000, manual ? 'Manual disconnect' : 'Reconnecting');
    }
    
    this.updateConnectionState({ isConnected: false, isConnecting: false });
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }

    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
  }

  // Discord-style reconnection
  reconnect(): void {
    console.log('🔄 [DISCORD_CLIENT] Manual reconnect initiated');
    this.disconnect(false);
    this.connectionState.reconnectAttempts = 0;
    this.connect();
  }

  // Discord-style connection info
  getConnectionInfo() {
    return {
      connectionId: this.connectionId,
      shardId: this.shardId,
      state: this.connectionState,
      queueSize: this.messageQueue.length,
      lastHeartbeat: this.lastHeartbeat
    };
  }

  // Check if connection is healthy for operations (compatibility with WebSocketClient)
  isConnectionHealthy(): boolean {
    if (!this.ws) return false;
    if (this.ws.readyState !== WebSocket.OPEN) return false;
    if (this.isManuallyDisconnected) return false;
    
    // Check if we've received a pong recently (within 30 seconds)
    const now = Date.now();
    const timeSinceLastPong = now - this.lastPongReceived;
    if (timeSinceLastPong > 30000) {
      console.warn(`[DISCORD_CLIENT] ⚠️ Connection unhealthy - no pong received for ${timeSinceLastPong}ms`);
      return false;
    }
    
    // Check connection quality
    if (this.connectionQuality === 'critical') {
      console.warn(`[DISCORD_CLIENT] ⚠️ Connection unhealthy - critical quality`);
      return false;
    }
    
    return true;
  }
}
