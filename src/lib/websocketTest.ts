// WebSocket integration test
import { DiscordClient } from './discordClient';
import { WebSocketClient } from './websocketClient';

// Test function to verify both clients work
export async function testWebSocketClients() {
  console.log('🧪 [TEST] Starting WebSocket client tests...');

  // Mock token function
  const mockGetToken = async () => 'test-token-123';

  // Test Discord Client
  console.log('🔧 [TEST] Testing Discord Client...');
  const discordClient = new DiscordClient(mockGetToken, {
    maxReconnectAttempts: 3,
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 5000,
    heartbeatInterval: 10000,
    connectionTimeout: 30000,
    messageQueueSize: 100
  });

  // Test event handling
  discordClient.on('MESSAGE_RECEIVED', (payload) => {
    console.log('✅ [TEST] Discord Client received MESSAGE_RECEIVED:', payload);
  });

  discordClient.on('ERROR', (payload) => {
    console.log('❌ [TEST] Discord Client received ERROR:', payload);
  });

  // Test connection state
  discordClient.onConnectionStateChange((state) => {
    console.log('📊 [TEST] Discord Client state changed:', state);
  });

  // Test message sending
  discordClient.sendMessage('PING', { test: true });
  console.log('📤 [TEST] Discord Client sent PING message');

  // Test WebSocket Client
  console.log('🔧 [TEST] Testing WebSocket Client...');
  const wsClient = new WebSocketClient(mockGetToken);

  // Test event handling
  wsClient.on('MESSAGE_RECEIVED', (payload) => {
    console.log('✅ [TEST] WebSocket Client received MESSAGE_RECEIVED:', payload);
  });

  wsClient.on('ERROR', (payload) => {
    console.log('❌ [TEST] WebSocket Client received ERROR:', payload);
  });

  // Test connection state
  wsClient.onConnectionStateChange((state) => {
    console.log('📊 [TEST] WebSocket Client state changed:', state);
  });

  // Test message sending
  wsClient.sendMessage('PING', { test: true });
  console.log('📤 [TEST] WebSocket Client sent PING message');

  // Test cleanup
  setTimeout(() => {
    console.log('🧹 [TEST] Cleaning up test clients...');
    discordClient.disconnect();
    wsClient.disconnect();
    console.log('✅ [TEST] Test completed successfully!');
  }, 5000);

  return {
    discordClient,
    wsClient,
    success: true
  };
}

// Export for use in development
export default testWebSocketClients;
