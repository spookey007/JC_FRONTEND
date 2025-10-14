'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WebSocketClient, ConnectionState } from '@/lib/websocketClient';
import { DiscordClient } from '@/lib/discordClient';
import { useChatStore } from '@/stores/chatStore';
import { ClientEvent, ServerEvent, SERVER_EVENTS } from '@/types/events';
import { useToastNotifications } from '@/components/Toast';
import { WEBSOCKET_CONFIG } from '@/lib/websocketConfig';

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
  getWebSocketClient: () => WebSocketClient | DiscordClient | null;
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
  useDiscordClient?: boolean; // Feature flag to enable Discord client
}

export function WebSocketProvider({ children, useDiscordClient = false }: WebSocketProviderProps) {
  const { connected, publicKey } = useWallet();
  const clientRef = useRef<WebSocketClient | DiscordClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastError: null
  });

  // No need to initialize authService - WebSocket handles authentication directly
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToastNotifications();
  
  // Use refs to access current values without causing re-renders
  const connectedRef = useRef(connected);
  const publicKeyRef = useRef(publicKey);
  
  // Update refs when values change
  connectedRef.current = connected;
  publicKeyRef.current = publicKey;

  // Cache for authentication token to prevent repeated auth requests
  const tokenCache = useRef<{ token: string | null; timestamp: number; walletAddress: string | null }>({
    token: null,
    timestamp: 0,
    walletAddress: null
  });

  // Clear token cache when wallet disconnects
  useEffect(() => {
    if (!connected || !publicKey) {
      console.log('[WebSocketProvider] 🧹 Clearing token cache - wallet disconnected');
      tokenCache.current = { token: null, timestamp: 0, walletAddress: null };
    }
  }, [connected, publicKey]);

  const getToken = useCallback(async (): Promise<string | null> => {
    console.log('[WebSocketProvider] 🔑 getToken called', { connected, publicKey: publicKey?.toString() });
    
    if (!connected || !publicKey) {
      console.log('[WebSocketProvider] ❌ Not authenticated - wallet not connected');
      return null;
    }

    const walletAddress = publicKey.toString();
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

    // Check if we have a valid cached token for this wallet
    if (tokenCache.current.token && 
        tokenCache.current.walletAddress === walletAddress &&
        (now - tokenCache.current.timestamp) < CACHE_DURATION) {
      console.log('[WebSocketProvider] ⚡ Using cached token');
      return tokenCache.current.token;
    }

    try {
      // Authenticate wallet via WebSocket and get user data + token
      const { websocketAuth } = await import('@/lib/websocketAuth');
      console.log('[WebSocketProvider] 🔐 Authenticating wallet via WebSocket...', {
        walletAddress: walletAddress
      });
      
      const authResponse = await websocketAuth.authenticate(walletAddress);
      console.log('[WebSocketProvider] 🔐 Auth response:', authResponse);
      console.log('[WebSocketProvider] ✅ Wallet authenticated successfully:', {
        userId: authResponse.user.id,
        username: authResponse.user.username,
        token: authResponse.token.substring(0, 10) + '...'
      });

      // Cache the token
      tokenCache.current = {
        token: authResponse.token,
        timestamp: now,
        walletAddress: walletAddress
      };

      // Store user data for future use
      try {
        const { redisStorage } = await import('@/lib/storageService');
        await redisStorage.setItem('user_data', JSON.stringify(authResponse.user), 86400);
        console.log('[WebSocketProvider] ✅ User data stored');
        
        // Update the chat store with the user data directly
        const { useChatStore } = await import('@/stores/chatStore');
        const { setCurrentUser } = useChatStore.getState();
        
        // Convert WebSocket UserData to chatStore User format
        const chatUser = {
          ...authResponse.user,
          role: authResponse.user.role ? parseInt(authResponse.user.role.toString(), 10) : undefined,
          isAdmin: authResponse.user.isAdmin || false,
          isVerified: authResponse.user.isVerified || false,
          followerCount: authResponse.user.followerCount || 0,
          followingCount: authResponse.user.followingCount || 0,
          status: 'online' as const,
          lastSeen: new Date().toISOString()
        };
        
        setCurrentUser(chatUser);
        console.log('[WebSocketProvider] ✅ User data synced to chat store');
        
        // Auto-fetch channels after successful authentication
        console.log('[WebSocketProvider] 🔄 Auto-fetching channels after authentication...');
        if (clientRef.current?.isConnected()) {
          console.log('[WebSocketProvider] 📡 Sending FETCH_CHANNELS request after auth...');
          clientRef.current.sendMessage('FETCH_CHANNELS', {});
          console.log('[WebSocketProvider] ✅ Channels fetch request sent after authentication');
        } else {
          console.log('[WebSocketProvider] ⚠️ WebSocket not connected, will fetch channels when connected');
        }
      } catch (error) {
        console.warn('[WebSocketProvider] ⚠️ Failed to store user data:', error instanceof Error ? error.message : String(error));
      }

      return authResponse.token;

    } catch (authError) {
      console.error('[WebSocketProvider] ❌ Wallet authentication failed:', authError);
      // Clear cache on error
      tokenCache.current = { token: null, timestamp: 0, walletAddress: null };
      return null;
    }
  }, [connected, publicKey]);

  const initClient = useCallback(async () => {
    console.log('[WebSocketProvider] 🔧 initClient called');
    
    // Only create a new client if we don't have one or it's not connected
    if (clientRef.current && clientRef.current.isConnected()) {
      console.log('[WebSocketProvider] ✅ Client already connected, reusing existing client');
      return;
    }

    // Check if client is in connecting state
    if (clientRef.current && clientRef.current.getConnectionState?.().isConnecting) {
      console.log('[WebSocketProvider] 🔄 Client already connecting, skipping creation');
      return;
    }
    
    if (clientRef.current) {
      console.log('[WebSocketProvider] 🔌 Disconnecting existing client before creating new one');
      clientRef.current.disconnect();
    }
    
    if (useDiscordClient) {
      console.log('[WebSocketProvider] 🔧 Creating new DiscordClient...');
      clientRef.current = new DiscordClient(getToken, {
        maxReconnectAttempts: WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS,
        reconnectBaseDelay: WEBSOCKET_CONFIG.RECONNECT_BASE_DELAY,
        reconnectMaxDelay: WEBSOCKET_CONFIG.RECONNECT_MAX_DELAY,
        heartbeatInterval: WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL,
        connectionTimeout: WEBSOCKET_CONFIG.CONNECTION_TIMEOUT,
        messageQueueSize: WEBSOCKET_CONFIG.MESSAGE_QUEUE_SIZE
      });
      console.log('[WebSocketProvider] ✅ DiscordClient created');
    } else {
      console.log('[WebSocketProvider] 🔧 Creating new WebSocketClient...');
      clientRef.current = new WebSocketClient(getToken);
      console.log('[WebSocketProvider] ✅ WebSocketClient created');
    }
    
    // Set up storage service to use WebSocket
    try {
      console.log('[WebSocketProvider] 🔧 Configuring storage service...');
      const { storageService } = await import('@/lib/storageService');
      storageService.setWebSocketClient(clientRef.current);
      console.log('[WebSocketProvider] 🔌 Storage service configured to use WebSocket');
    } catch (error) {
      console.warn('[WebSocketProvider] ⚠️ Failed to configure storage service:', error);
    }
    
    // Listen to connection state changes
    console.log('[WebSocketProvider] 🔧 Setting up connection state listener...');
    const unsubscribe = clientRef.current?.onConnectionStateChange(async (state) => {
      console.log('[WebSocketProvider] 🔄 Connection state changed:', state);
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
          
          // Auto-fetch channels when WebSocket connects and user is authenticated
          const { useChatStore } = await import('@/stores/chatStore');
          const { currentUser } = useChatStore.getState();
          if (currentUser?.id && clientRef.current) {
            console.log('[WebSocketProvider] 🔄 Auto-fetching channels on WebSocket connect (user authenticated)');
            clientRef.current.sendMessage('FETCH_CHANNELS', {});
            console.log('[WebSocketProvider] ✅ Channels fetch request sent on connect');
          } else {
            console.log('[WebSocketProvider] ⚠️ No authenticated user or client not available, skipping auto-fetch');
          }
        } catch (error) {
          console.warn('[WebSocketProvider] ⚠️ Failed to configure storage service on connect:', error);
        }
        // toast.connection('Connected to chat server');
      } else if (state.lastError) {
        console.log('[WebSocketProvider] ❌ Connection error:', state.lastError);
        // toast.error('Connection Error', state.lastError);
      } else if (state.isConnecting) {
        console.log('[WebSocketProvider] 🔄 Connecting...');
        // toast.info('Connecting...', 'Establishing connection to chat server');
      }
    });

    // Set up social feature event listeners
    console.log('[WebSocketProvider] 🔧 Setting up social feature event listeners...');
    
    // Follow success
    clientRef.current?.on(SERVER_EVENTS.FOLLOW_SUCCESS, (payload) => {
      console.log('[WebSocketProvider] ✅ Follow successful:', payload);
      // Toast removed as requested
    });

    // Unfollow success
    clientRef.current?.on(SERVER_EVENTS.UNFOLLOW_SUCCESS, (payload) => {
      console.log('[WebSocketProvider] ✅ Unfollow successful:', payload);
      // Toast removed as requested
    });

    // Poke sent
    clientRef.current?.on(SERVER_EVENTS.POKE_SENT, (payload) => {
      console.log('[WebSocketProvider] ✅ Poke sent successfully:', payload);
      toast.success('Poke sent!');
    });

    // Poke received
    clientRef.current?.on(SERVER_EVENTS.POKE_RECEIVED, (payload) => {
      console.log('[WebSocketProvider] 🔔 Poke received:', payload);
      toast.info('You got poked!', payload.message || 'Someone poked you!');
    });

    // User status response
    clientRef.current?.on(SERVER_EVENTS.USER_STATUS_RESPONSE, (payload) => {
      console.log('[WebSocketProvider] 📊 User status received:', payload);
      // This will be handled by the ProfileCard component
    });

    // Notification received
    clientRef.current?.on(SERVER_EVENTS.NOTIFICATION_RECEIVED, (payload) => {
      console.log('[WebSocketProvider] 🔔 Notification received:', payload);
      toast.info(payload.title, payload.message);
    });
    
    console.log('[WebSocketProvider] 🆕 New WebSocket client created');
    
    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
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

    // Check if client is in connecting state
    if (clientRef.current?.getConnectionState?.().isConnecting) {
      console.log('[WebSocketProvider] 🔄 Client already connecting');
      return;
    }
  
    // Only connect if wallet is connected
    if (!connectedRef.current || !publicKeyRef.current) {
      console.log('[WebSocketProvider] ❌ Wallet not connected - cannot connect');
      return;
    }

    console.log('[WebSocketProvider] 🚀 Initiating connection...', {
      hasWallet: !!(connectedRef.current && publicKeyRef.current),
      publicKey: publicKeyRef.current?.toString(),
      timestamp: new Date().toISOString()
    });
  
    isConnectingRef.current = true;
  
    try {
      // Only create new client if we don't have one
      if (!clientRef.current) {
        console.log('[WebSocketProvider] 🔧 Creating new client...');
        await initClient();
        console.log('[WebSocketProvider] ✅ Client created');
      }
  
      // Connect if client exists and not already connected
      if (clientRef.current && !clientRef.current.isConnected()) {
        console.log('[WebSocketProvider] 🤝 Attempting connection...');
        // Add a small delay to ensure any previous connection is fully closed
        await new Promise(resolve => setTimeout(resolve, 200));
        await clientRef.current.connect();
        console.log('[WebSocketProvider] ✅ Connection attempt completed');
      } else {
        console.log('[WebSocketProvider] ⚠️ No client available or already connected');
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

  // Auto-fetch channels when WebSocket connects and user is already authenticated
  useEffect(() => {
    if (isConnected && connected && publicKey) {
      console.log('[WebSocketProvider] 🔄 WebSocket connected and user authenticated, fetching channels...');
      // Small delay to ensure connection is fully established
      const timeoutId = setTimeout(() => {
        if (clientRef.current?.isConnected()) {
          console.log('[WebSocketProvider] 📡 Sending FETCH_CHANNELS request...');
          clientRef.current.sendMessage('FETCH_CHANNELS', {});
          console.log('[WebSocketProvider] ✅ Channels fetch request sent after connection');
        } else {
          console.warn('[WebSocketProvider] ⚠️ WebSocket client not connected when trying to fetch channels');
        }
      }, 1000); // Increased delay to 1 second
      
      return () => clearTimeout(timeoutId);
    }
  }, [isConnected, connected, publicKey]);

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
    
    // If already connected, just send a ping instead of reconnecting
    if (clientRef.current?.isConnected()) {
      console.log('[WebSocketProvider] ✅ Already connected, sending ping instead of reconnecting');
      if (clientRef.current.sendPingIfConnected) {
        clientRef.current.sendPingIfConnected();
      }
      return;
    }
    
    clientRef.current?.reconnect();
  }, []);

  const getConnectionMetrics = useCallback(() => {
    return clientRef.current?.getConnectionMetrics() || null;
  }, []);

  const fetchChannels = useCallback(() => {
    console.log('[WebSocketProvider] 🔄 Manual fetchChannels called');
    if (clientRef.current?.isConnected()) {
      console.log('[WebSocketProvider] 📡 Sending FETCH_CHANNELS request manually...');
      clientRef.current.sendMessage('FETCH_CHANNELS', {});
      console.log('[WebSocketProvider] ✅ Manual channels fetch request sent');
    } else {
      console.warn('[WebSocketProvider] ⚠️ Cannot fetch channels: WebSocket not connected');
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

  // Removed initial connection attempt - only connect when wallet is connected

  // Removed periodic check - only connect when wallet is connected

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
          // Add delay to prevent rapid connection attempts and ensure wallet is fully ready
          connectionTimeoutRef.current = setTimeout(async () => {
            const hasQueued = await hasQueuedOperations();
            if (hasQueued) {
              console.log('[WebSocketProvider] 🔄 Connecting due to queued operations');
            }
            console.log('[WebSocketProvider] 🔄 Connecting WebSocket for wallet:', publicKey.toString());
            connectIfAuthenticated();
          }, 1500); // Increased delay to ensure wallet is fully ready
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
    fetchChannels,
    getWebSocketClient: () => clientRef.current
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