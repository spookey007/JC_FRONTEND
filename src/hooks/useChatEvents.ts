// /src/hooks/useChatEvents.ts
'use client';

import { useCallback } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { CLIENT_EVENTS } from '@/types/events';
import { fetchMessagesWithFallback } from '@/lib/chatApi';
import { useChatStore } from '@/stores/chatStore';
import { MessageReaction } from '@/stores/chatStore';

export function useChatEvents() {
  const { sendMessage, on, off, isConnected, getWebSocketClient } = useWebSocket();
  const { currentUser } = useChatStore();
  const { addReaction: addReactionToStore } = useChatStore.getState();

  const sendChatMessage = useCallback((channelId: string, content: string, attachments: any[] = [], repliedToMessageId?: string) => {
    if (!isConnected) {
      console.warn('⚠️ [useChatEvents] Cannot send message - WebSocket not connected');
      return;
    }
    
    sendMessage(CLIENT_EVENTS.SEND_MESSAGE, {
      channelId,
      content,
      attachments,
      repliedToMessageId
    });
  }, [sendMessage, isConnected]);

  const editMessage = useCallback((messageId: string, content: string) => {
    sendMessage(CLIENT_EVENTS.EDIT_MESSAGE, {
      messageId,
      content
    });
  }, [sendMessage]);

  const deleteMessage = useCallback((messageId: string) => {
    sendMessage(CLIENT_EVENTS.DELETE_MESSAGE, {
      messageId
    });
  }, [sendMessage]);

  // ✅ NEW: Optimistic reaction handler (Messenger-style)
  const addReaction = useCallback((messageId: string, emoji: string) => {
    const userId = currentUser?.id;
    if (!userId) return;

    // 🔥 OPTIMISTIC UPDATE: Create a temporary reaction and update store immediately
    const tempReaction: MessageReaction = {
      id: `temp_${messageId}_${userId}_${Date.now()}`, // Temporary ID
      messageId,
      userId,
      emoji,
      createdAt: new Date().toISOString(),
      user: {
        id: userId,
        username: currentUser.username
      }
    };

    // Update UI instantly
    addReactionToStore(messageId, tempReaction);

    // Send to server (server will send back real reaction with real ID)
    sendMessage(CLIENT_EVENTS.ADD_REACTION, {
      messageId,
      emoji
    });
  }, [sendMessage, currentUser, addReactionToStore]);

  // Keep removeReaction for backward compatibility (though not needed for Messenger logic)
  const removeReaction = useCallback((messageId: string, emoji: string) => {
    sendMessage(CLIENT_EVENTS.REMOVE_REACTION, {
      messageId,
      emoji
    });
  }, [sendMessage]);

  const startTyping = useCallback((channelId: string) => {
    sendMessage(CLIENT_EVENTS.START_TYPING, {
      channelId
    });
  }, [sendMessage]);

  const stopTyping = useCallback((channelId: string) => {
    sendMessage(CLIENT_EVENTS.STOP_TYPING, {
      channelId
    });
  }, [sendMessage]);

  const fetchMessages = useCallback(async (channelId: string, limit = 50, before?: string) => {
    await fetchMessagesWithFallback(channelId, limit, before, sendMessage, isConnected);
  }, [sendMessage, isConnected]);

  const joinChannel = useCallback((channelId: string) => {
    if (!isConnected) {
      console.warn('⚠️ [useChatEvents] Cannot join channel - WebSocket not connected');
      return;
    }
    
    // Check connection health
    const client = getWebSocketClient();
    if (client && typeof client.isConnectionHealthy === 'function' && !client.isConnectionHealthy()) {
      console.warn('⚠️ [useChatEvents] Cannot join channel - connection unhealthy');
      return;
    }
    
    console.log('🔗 [useChatEvents] Joining channel:', channelId);
    sendMessage(CLIENT_EVENTS.JOIN_CHANNEL, {
      channelId
    });
  }, [sendMessage, isConnected, getWebSocketClient]);

  const leaveChannel = useCallback((channelId: string) => {
    sendMessage(CLIENT_EVENTS.LEAVE_CHANNEL, {
      channelId
    });
  }, [sendMessage]);

  const markAsRead = useCallback((messageId: string) => {
    sendMessage(CLIENT_EVENTS.MARK_AS_READ, {
      messageId
    });
  }, [sendMessage]);

  const ping = useCallback(() => {
    sendMessage(CLIENT_EVENTS.PING, {});
  }, [sendMessage]);

  return {
    sendChatMessage,
    editMessage,
    deleteMessage,
    addReaction,      // ✅ Now does optimistic update + WebSocket
    removeReaction,   // Kept for compatibility
    startTyping,
    stopTyping,
    fetchMessages,
    joinChannel,
    leaveChannel,
    markAsRead,
    ping,
    on,
    off
  };
}