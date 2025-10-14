'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WebSocketClient, ConnectionState } from '@/lib/websocketClient';
import { useChatStore } from '@/stores/chatStore';
import { ClientEvent, ServerEvent, SERVER_EVENTS } from '@/types/events';
import { useToastNotifications } from '@/components/Toast';

type EventHandler = (payload: any) => void;

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: ConnectionState;
  sendMessage: (event: ClientEvent, payload: any) => void;
  on: (event: ServerEvent, handler: EventHandler) => void;
  off: (event: ServerEvent, handler: EventHandler) => void;
  reconnect: () => void;
  connectIfAuthenticated: () => Promise<void>;
  getConnectionMetrics: () => any;
  fetchChannels: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { connected, publicKey } = useWallet();
  const clientRef = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastError: null
  });
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToastNotifications();
  
  // Use refs to access current values without causing re-renders
  const connectedRef = useRef(connected);
  const publicKeyRef = useRef(publicKey);
  
  // Update refs when values change
  connectedRef.current = connected;
  publicKeyRef.current = publicKey;

  const getToken = useCallback(async (): Promise<string | null> => {
    // With the new bootstrap token approach, we don't need to get tokens from storage
    // The WebSocket client will generate bootstrap tokens and receive l4_session via user:ready
    console.log('[WebSocketProvider] 🔑 Using bootstrap token approach - no token needed from storage');
    return null;
  }, [connected, publicKey]);

  const initClient = useCallback(async () => {
    // Only create a new client if we don't have one or it's not connected
    if (clientRef.current && clientRef.current.isConnected()) {
      console.log('[WebSocketProvider] ✅ Client already connected, reusing existing client');
      return;
    }
    
    if (clientRef.current) {
      console.log('[WebSocketProvider] 🔌 Disconnecting existing client before creating new one');
      clientRef.current.disconnect();
    }
    
    clientRef.current = new WebSocketClient(getToken);
    
    // Set up storage service to use WebSocket
    try {
      const { storageService } = await import('@/lib/storageService');
      storageService.setWebSocketClient(clientRef.current);
      console.log('[WebSocketProvider] 🔌 Storage service configured to use WebSocket');
    } catch (error) {
      console.warn('[WebSocketProvider] ⚠️ Failed to configure storage service:', error);
    }
    
    // Listen to connection state changes
    const unsubscribe = clientRef.current.onConnectionStateChange(async (state) => {
      setConnectionState(state);
      setIsConnected(state.isConnected);
      setIsConnecting(state.isConnecting);
      
      // Ensure storage service is configured when WebSocket connects
      if (state.isConnected && state.lastConnectedAt) {
        try {
          const { storageService } = await import('@/lib/storageService');
          storageService.setWebSocketClient(clientRef.current);
          // Force check connection and process queued operations
          storageService.checkConnectionAndProcessQueue();
          console.log('[WebSocketProvider] 🔌 Storage service configured on WebSocket connect');
        } catch (error) {
          console.warn('[WebSocketProvider] ⚠️ Failed to configure storage service on connect:', error);
        }
        // toast.connection('Connected to chat server');
      } else if (state.lastError) {
        // toast.error('Connection Error', state.lastError);
      } else if (state.isConnecting) {
        // toast.info('Connecting...', 'Establishing connection to chat server');
      }
    });
    
    console.log('[WebSocketProvider] 🆕 New WebSocket client created');
  }, [getToken, toast]);

  const connectIfAuthenticated = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('[WebSocketProvider] ⏸️ Connection already in progress');
      return;
    }
  
    // Check if already connected
    if (clientRef.current?.isConnected()) {
      console.log('[WebSocketProvider] ✅ Already connected');
      return;
    }
  
    // Check authentication
    if (!connectedRef.current || !publicKeyRef.current) {
      console.log('[WebSocketProvider] ❌ Not authenticated');
      return;
    }
  
    console.log('[WebSocketProvider] 🚀 Initiating connection...', {
      publicKey: publicKeyRef.current.toString(),
      timestamp: new Date().toISOString()
    });
  
    isConnectingRef.current = true;
  
    try {
      // Cleanup existing client only if it exists and is not connected
      if (clientRef.current && !clientRef.current.isConnected()) {
        console.log('[WebSocketProvider] 🧹 Cleaning up previous client');
        clientRef.current.disconnect();
        // No delay needed - cleanup is synchronous
      }
  
      // Initialize new client only if we don't have one or it's not connected
      if (!clientRef.current || !clientRef.current.isConnected()) {
        await initClient();
      }
  
      // Connect if client was created and not already connected
      if (clientRef.current && !clientRef.current.isConnected()) {
        console.log('[WebSocketProvider] 🤝 Attempting connection');
        await clientRef.current.connect();
      }
    } catch (error) {
      console.error('[WebSocketProvider] 💥 Connection failed:', error);
      toast.error('Connection Failed', 'Failed to connect to chat server');
    } finally {
      isConnectingRef.current = false;
    }
  }, [initClient, toast]);

  // Sync isConnected state with client
// ✅ ADD THIS — Sync connection state IMMEDIATELY and on tab focus
  useEffect(() => {
    const syncConnectionState = () => {
      if (clientRef.current) {
        const connected = clientRef.current.isConnected();
        setIsConnected(connected);
        if (connected) {
          isConnectingRef.current = false;
        }
      }
    };

    // Listen to tab visibility change (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncConnectionState();
      }
    };

    // Listen to window focus (user clicks back into browser)
    const handleWindowFocus = () => {
      syncConnectionState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // Initial sync on mount
    syncConnectionState();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []); // ✅ Empty dependency array — runs once on mount

  const sendMessage = useCallback((event: ClientEvent, payload: any) => {
    clientRef.current?.sendMessage(event, payload);
  }, []);

  const on = useCallback((event: ServerEvent, handler: EventHandler) => {
    clientRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: ServerEvent, handler: EventHandler) => {
    clientRef.current?.off(event, handler);
  }, []);

  const reconnect = useCallback(() => {
    isConnectingRef.current = false;
    clientRef.current?.reconnect();
  }, []);

  const getConnectionMetrics = useCallback(() => {
    return clientRef.current?.getConnectionMetrics() || null;
  }, []);

  const fetchChannels = useCallback(() => {
    if (clientRef.current?.isConnected()) {
      clientRef.current.sendMessage('FETCH_CHANNELS', {});
    } else {
      console.warn('[WebSocketProvider] Cannot fetch channels: not connected');
    }
  }, []);

  // Enable WebSocket mode for storage service immediately on mount
  useEffect(() => {
    const enableStorageWebSocketMode = async () => {
      try {
        const { storageService } = await import('@/lib/storageService');
        storageService.enableWebSocketMode();
        console.log('[WebSocketProvider] 🔌 Storage service WebSocket mode enabled');
      } catch (error) {
        console.warn('[WebSocketProvider] ⚠️ Failed to enable storage WebSocket mode:', error);
      }
    };
    
    enableStorageWebSocketMode();
  }, []);

  // Auto-connect on wallet connect with improved state management
  useEffect(() => {
    const handleWalletStateChange = async () => {
      console.log('[WebSocketProvider] 🔄 Wallet state changed', {
        connected,
        publicKey: publicKey?.toString(),
        timestamp: new Date().toISOString()
      });

      // Clear any existing timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      if (connected && publicKey) {
        // Check if we have queued operations that need processing
        const hasQueuedOperations = async () => {
          try {
            const { storageService } = await import('@/lib/storageService');
            const queueSize = storageService.getQueueSize();
            return queueSize > 0;
          } catch {
            return false;
          }
        };

        // Connect if not connected, or if we have queued operations that need processing
        if (!clientRef.current?.isConnected() && !isConnectingRef.current) {
          // Add delay to prevent rapid connection attempts
          connectionTimeoutRef.current = setTimeout(async () => {
            const hasQueued = await hasQueuedOperations();
            if (hasQueued) {
              console.log('[WebSocketProvider] 🔄 Connecting due to queued operations');
            }
            connectIfAuthenticated();
          }, 1000);
        } else if (clientRef.current?.isConnected()) {
          // If already connected, check if we need to process queued operations
          try {
            const { storageService } = await import('@/lib/storageService');
            storageService.checkConnectionAndProcessQueue();
          } catch (error) {
            console.warn('[WebSocketProvider] ⚠️ Failed to check queued operations:', error);
          }
        } else {
          console.log('[WebSocketProvider] ⏸️ Skipping connection - already connecting');
        }
      } else {
        console.log('[WebSocketProvider] 🔌 Disconnecting due to wallet disconnect');
        isConnectingRef.current = false;
        clientRef.current?.disconnect();
      }
    };

    handleWalletStateChange();

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [connected, publicKey, connectIfAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[WebSocketProvider] 🧹 Cleaning up WebSocket provider');
      isConnectingRef.current = false;
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      clientRef.current?.disconnect();
    };
  }, []);

  const value = {
    isConnected,
    isConnecting,
    connectionState,
    sendMessage,
    on,
    off,
    reconnect,
    connectIfAuthenticated,
    getConnectionMetrics,
    fetchChannels
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Re-export for convenience
export { useChatEvents } from '@/hooks/useChatEvents';
export { SERVER_EVENTS } from '@/types/events';