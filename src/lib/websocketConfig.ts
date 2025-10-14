// WebSocket configuration - Optimized for stability
export const WEBSOCKET_CONFIG = {
  // Feature flags
  USE_DISCORD_CLIENT: process.env.NEXT_PUBLIC_USE_DISCORD_CLIENT === 'true' || process.env.NODE_ENV === 'production',
  
  // Connection settings - More aggressive for stability
  HEARTBEAT_INTERVAL: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_HEARTBEAT_INTERVAL || '15000'), // 15s - more frequent
  CONNECTION_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_CONNECTION_TIMEOUT || '120000'), // 2min - longer timeout
  PONG_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_PONG_TIMEOUT || '30000'), // 30s - pong timeout
  MAX_RECONNECT_ATTEMPTS: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_MAX_RECONNECT_ATTEMPTS || '25'), // More attempts
  MESSAGE_QUEUE_SIZE: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_MESSAGE_QUEUE_SIZE || '2000'), // Larger queue
  
  // Reconnection settings - More aggressive
  RECONNECT_BASE_DELAY: 500, // Faster initial reconnect
  RECONNECT_MAX_DELAY: 60000, // Longer max delay
  RECONNECT_JITTER: 0.1, // Add randomness to prevent thundering herd
  
  // Connection quality monitoring
  CONNECTION_QUALITY_CHECK_INTERVAL: 30000, // Check every 30s
  MAX_MISSED_HEARTBEATS: 3, // Allow 3 missed heartbeats before reconnecting
  CONNECTION_STABILITY_WINDOW: 300000, // 5min window for stability assessment
  
  // Server settings
  MAX_CONNECTIONS: parseInt(process.env.NEXT_PUBLIC_MAX_CONNECTIONS || '5000'), // Higher limit
  MESSAGE_BATCH_SIZE: parseInt(process.env.NEXT_PUBLIC_MESSAGE_BATCH_SIZE || '50'), // Smaller batches
  MESSAGE_BATCH_DELAY: parseInt(process.env.NEXT_PUBLIC_MESSAGE_BATCH_DELAY || '50'), // Faster processing
  
  // Network resilience
  NETWORK_CHECK_INTERVAL: 10000, // Check network every 10s
  OFFLINE_DETECTION_DELAY: 5000, // Detect offline after 5s
  ONLINE_DETECTION_DELAY: 2000, // Detect online after 2s
};

export default WEBSOCKET_CONFIG;
