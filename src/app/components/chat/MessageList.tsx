'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket, SERVER_EVENTS, useChatEvents } from '@/contexts/WebSocketContext';
import { useNotifications } from '@/lib/notificationService';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface MessageListProps {
  channelId: string;
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
  switchingChat?: boolean;
  setSwitchingChat?: (value: boolean) => void;
  forceRefresh?: boolean;
}

export default function MessageList({ 
  channelId, 
  messagesEndRef: externalMessagesEndRef,
  switchingChat = false,
  setSwitchingChat,
  forceRefresh = false
}: MessageListProps) {
  
  const { currentUser } = useChatStore();
  const { on, off, isConnected } = useWebSocket();
  const { showChatNotification } = useNotifications();
  const localMessagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = externalMessagesEndRef || localMessagesEndRef;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const { 
    messages, 
    getCurrentMessages, 
    getTypingUsers,
    setMessages, 
    addMessage, 
    updateMessage, 
    removeMessage,
    prependMessages,
    clearMessages
  } = useChatStore();

  const { fetchMessages } = useChatEvents();
  const currentMessages = getCurrentMessages();
  const typingUsers = getTypingUsers(channelId);
  
  // Debug typing users
  useEffect(() => {
    if (typingUsers.length > 0) {
      console.log('👀 [TYPING] Displaying typing users:', {
        channelId,
        typingUsers: typingUsers.map(u => ({ id: u.id, username: u.username, displayName: u.displayName })),
        currentUserId: currentUser?.id
      });
    }
  }, [typingUsers, channelId, currentUser]);
  

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  };

  // Check if user is at bottom of messages
  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < threshold);
  };

  // Load more messages when scrolling to top
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || currentMessages.length === 0) return;

    setIsLoadingMore(true);
    const oldestMessage = currentMessages[0];
    const before = oldestMessage.sentAt;

    // try {
    //   const { apiFetch } = await import('@/lib/api');
    //   const response = await apiFetch(`/chat/channels/${channelId}/messages?before=${before}&limit=50`);
    //   const data = await response.json();
    //   if (data.messages.length > 0) {
    //     prependMessages(channelId, data.messages);
    //   }
    //   setHasMoreMessages(data.hasMore);
    // } catch (error) {

    // } finally {
    //   setIsLoadingMore(false);
    // }
  };

  // WebSocket event handlers for channel-specific events
  useEffect(() => {
    const handleMessageReceived = (payload: any) => {
      let messageData = payload;
      if (typeof payload === 'string') {
        try {
          messageData = JSON.parse(payload);
        } catch (error) {
          console.error('Failed to parse message payload:', error);
          return;
        }
      }
      
      console.log('📨 [MESSAGE_RECEIVED] Received message data:', {
        id: messageData.id,
        type: messageData.type,
        content: messageData.content?.substring(0, 50) + '...',
        attachments: messageData.attachments,
        attachmentsLength: messageData.attachments?.length || 0
      });
      
      if (messageData.channelId === channelId) {
        if (!messageData.isOptimistic) {
          const optimisticMessage = currentMessages.find(msg => 
            msg.isOptimistic && 
            msg.content === messageData.content && 
            msg.authorId === messageData.authorId &&
            Math.abs(new Date(msg.sentAt).getTime() - new Date(messageData.sentAt).getTime()) < 30000
          );
          
          if (optimisticMessage) {
            console.log('🔄 Replacing optimistic message with real message:', {
              optimisticId: optimisticMessage.id,
              realId: messageData.id,
              content: messageData.content.substring(0, 50) + '...',
              authorId: messageData.authorId
            });
            removeMessage(optimisticMessage.id);
            addMessage(messageData);
          } else {
            const existingMessage = currentMessages.find(msg => msg.id === messageData.id);
            if (existingMessage) {
              console.log('🔄 Message already exists, updating instead of adding:', messageData.id);
              console.log('🔄 Existing message type:', existingMessage.type, 'New message type:', messageData.type);
              console.log('🔄 Existing attachments:', existingMessage.attachments);
              console.log('🔄 New attachments:', messageData.attachments);
              console.log('🔄 Full existing message:', existingMessage);
              console.log('🔄 Full new message data:', messageData);
              
              if (messageData.attachments && messageData.attachments.length > 0) {
                updateMessage(messageData.id, messageData);
              } else {
                console.log('⚠️ Skipping update - new message has no attachments, preserving existing structure');
              }
            } else {
              const optimisticMessage = currentMessages.find(msg => 
                msg.isOptimistic && 
                msg.authorId === messageData.authorId && 
                msg.channelId === messageData.channelId &&
                Math.abs(new Date(msg.sentAt).getTime() - new Date(messageData.sentAt).getTime()) < 5000
              );
              
              if (optimisticMessage) {
                console.log('🔄 Replacing optimistic message with real message:', {
                  optimisticId: optimisticMessage.id,
                  realId: messageData.id,
                  optimisticType: optimisticMessage.type,
                  realType: messageData.type,
                  optimisticAttachments: optimisticMessage.attachments,
                  realAttachments: messageData.attachments
                });
                console.log('🔄 Full optimistic message:', optimisticMessage);
                console.log('🔄 Full real message data:', messageData);
                removeMessage(optimisticMessage.id);
              }
              console.log('➕ Adding new message to store:', {
                id: messageData.id,
                content: messageData.content.substring(0, 50) + '...',
                authorId: messageData.authorId,
                isOptimistic: messageData.isOptimistic
              });
              addMessage(messageData);
              
              if (messageData.authorId !== currentUser?.id && !messageData.isOptimistic) {
                showChatNotification({
                  messageId: messageData.id,
                  channelId: messageData.channelId,
                  authorId: messageData.authorId,
                  authorName: messageData.author?.displayName || messageData.author?.username || 'Unknown User',
                  content: messageData.content,
                  timestamp: messageData.sentAt
                });
              }
            }
          }
        } else {
          const existingMessage = currentMessages.find(msg => msg.id === messageData.id);
          if (existingMessage) {
            console.log('🔄 Optimistic message already exists, updating instead of adding:', messageData.id);
            updateMessage(messageData.id, messageData);
          } else {
            console.log('➕ Adding optimistic message to store:', {
              id: messageData.id,
              content: messageData.content.substring(0, 50) + '...',
              authorId: messageData.authorId,
              isOptimistic: messageData.isOptimistic
            });
            addMessage(messageData);
            
            if (messageData.authorId !== currentUser?.id) {
              showChatNotification({
                messageId: messageData.id,
                channelId: messageData.channelId,
                authorId: messageData.authorId,
                authorName: messageData.author?.displayName || messageData.author?.username || 'Unknown User',
                content: messageData.content,
                timestamp: messageData.sentAt
              });
            }
          }
        }
        
        if (isAtBottom) {
          setTimeout(scrollToBottom, 100);
        }
      }
    };

    const handleMessageEdited = (payload: any) => {
      if (payload.channelId === channelId) {
        updateMessage(payload.id, payload);
      }
    };

    const handleMessageDeleted = (payload: any) => {
      if (payload.channelId === channelId) {
        removeMessage(payload.messageId);
      }
    };

    const handleReactionAdded = (payload: any) => {
      console.log('🎉 [REACTIONS] Reaction added:', payload);
      console.log('🎉 [REACTIONS] Current messages before update:', currentMessages.length);
      const { handleReactionAdded: handleReactionAddedStore } = useChatStore.getState();
      handleReactionAddedStore(payload);
      console.log('🎉 [REACTIONS] Reaction added to store');
    };

    const handleReactionRemoved = (payload: any) => {
      console.log('🗑️ [REACTIONS] Reaction removed:', payload);
      const { handleReactionRemoved: handleReactionRemovedStore } = useChatStore.getState();
      handleReactionRemovedStore(payload.messageId, payload.reactionId);
    };

    const handleTypingStarted = (payload: any) => {
      if (payload.channelId === channelId) {
        console.log('👀 [TYPING] User started typing:', {
          userId: payload.userId,
          channelId: payload.channelId,
          currentChannelId: channelId
        });

        const { addTypingUser, currentUser, users, addUser } = useChatStore.getState();
        
        if (payload.userId !== currentUser?.id) {
          if (!users[payload.userId]) {
            console.log('👀 [TYPING] User data not found, fetching user:', payload.userId);
            addUser({
              id: payload.userId,
              username: `User${payload.userId.slice(-4)}`,
              displayName: `User ${payload.userId.slice(-4)}`,
              avatarUrl: null,
              walletAddress: null,
              status: 'online',
              lastSeen: new Date().toISOString(),
              isVerified: false,
              isAdmin: false
            });
          }
          
          addTypingUser(channelId, {
            userId: payload.userId,
            channelId: payload.channelId,
            timestamp: Date.now()
          });
        }
      }
    };

    const handleTypingStopped = (payload: any) => {
      if (payload.channelId === channelId) {
        console.log('👀 [TYPING] User stopped typing:', {
          userId: payload.userId,
          channelId: payload.channelId,
          currentChannelId: channelId
        });

        const { removeTypingUser } = useChatStore.getState();
        removeTypingUser(channelId, payload.userId);
      }
    };

    const handleUserJoined = (payload: any) => {
      if (payload.channelId === channelId) {
        // You might want to show a system message or update member count
      }
    };

    const handleUserLeft = (payload: any) => {
      if (payload.channelId === channelId) {
        // You might want to show a system message or update member count
      }
    };

    const handleUserStatusChanged = (payload: any) => {
      const { updateUser } = useChatStore.getState();
      updateUser(payload.userId, {
        status: payload.status,
        lastSeen: payload.lastSeen
      });
    };

    const handleReadReceiptUpdated = (payload: any) => {
      const messageIndex = currentMessages.findIndex(msg => msg.id === payload.messageId);
      if (messageIndex >= 0) {
        const updatedMessage = { ...currentMessages[messageIndex] };
        const existingReceiptIndex = updatedMessage.readReceipts.findIndex(
          r => r.userId === payload.userId
        );
        
        if (existingReceiptIndex >= 0) {
          updatedMessage.readReceipts[existingReceiptIndex] = {
            id: updatedMessage.readReceipts[existingReceiptIndex].id,
            messageId: payload.messageId,
            userId: payload.userId,
            readAt: payload.readAt
          };
        } else {
          updatedMessage.readReceipts = [...updatedMessage.readReceipts, {
            id: `${payload.messageId}-${payload.userId}`,
            messageId: payload.messageId,
            userId: payload.userId,
            readAt: payload.readAt
          }];
        }
        
        updateMessage(payload.messageId, updatedMessage);
      }
    };

    const handleMessagesLoaded = (payload: any) => {
      console.log('📚 [MESSAGELIST] handleMessagesLoaded called:', {
        payloadChannelId: payload.channelId,
        currentChannelId: channelId,
        messageCount: payload.messages.length,
        switchingChat,
        hasSetSwitchingChat: !!setSwitchingChat
      });
      
      if (payload.channelId === channelId) {
        console.log('📚 Messages loaded from server:', {
          channelId: payload.channelId,
          messageCount: payload.messages.length,
          messages: payload.messages.map((m: any) => ({ id: m.id, content: m.content.substring(0, 30) + '...', sentAt: m.sentAt }))
        });
        setMessages(channelId, payload.messages);
        setHasMoreMessages(payload.messages.length === 50);
        
        if (switchingChat && setSwitchingChat) {
          console.log('📚 Clearing switchingChat state - messages loaded');
          setSwitchingChat(false);
        }
      } else {
        console.log('📚 [MESSAGELIST] Channel ID mismatch, ignoring message load');
      }
    };

    if (isConnected) {
      on(SERVER_EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
      on(SERVER_EVENTS.MESSAGE_EDITED, handleMessageEdited);
      on(SERVER_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      on(SERVER_EVENTS.REACTION_ADDED, handleReactionAdded);
      on(SERVER_EVENTS.REACTION_REMOVED, handleReactionRemoved);
      on(SERVER_EVENTS.TYPING_STARTED, handleTypingStarted);
      on(SERVER_EVENTS.TYPING_STOPPED, handleTypingStopped);
      on(SERVER_EVENTS.USER_JOINED, handleUserJoined);
      on(SERVER_EVENTS.USER_LEFT, handleUserLeft);
      on(SERVER_EVENTS.USER_STATUS_CHANGED, handleUserStatusChanged);
      on(SERVER_EVENTS.READ_RECEIPT_UPDATED, handleReadReceiptUpdated);
      on(SERVER_EVENTS.MESSAGES_LOADED, handleMessagesLoaded);
    }

    return () => {
      off(SERVER_EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
      off(SERVER_EVENTS.MESSAGE_EDITED, handleMessageEdited);
      off(SERVER_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      off(SERVER_EVENTS.REACTION_ADDED, handleReactionAdded);
      off(SERVER_EVENTS.REACTION_REMOVED, handleReactionRemoved);
      off(SERVER_EVENTS.TYPING_STARTED, handleTypingStarted);
      off(SERVER_EVENTS.TYPING_STOPPED, handleTypingStopped);
      off(SERVER_EVENTS.USER_JOINED, handleUserJoined);
      off(SERVER_EVENTS.USER_LEFT, handleUserLeft);
      off(SERVER_EVENTS.USER_STATUS_CHANGED, handleUserStatusChanged);
      off(SERVER_EVENTS.READ_RECEIPT_UPDATED, handleReadReceiptUpdated);
      off(SERVER_EVENTS.MESSAGES_LOADED, handleMessagesLoaded);
    };
  }, [channelId, currentMessages, updateMessage, removeMessage, addMessage, setMessages, on, off, isConnected]);

  // Load initial messages
  useEffect(() => {
    if (channelId) {
      console.log('📚 Loading messages for channel:', channelId, {
        hasMessages: !!(messages[channelId] && messages[channelId].length > 0),
        messageCount: messages[channelId]?.length || 0,
        isConnected
      });
      
      fetchMessages(channelId, 50);
      
      if (!isConnected) {
        console.log('📚 WebSocket not connected, retrying message fetch in 2 seconds...');
        const retryTimeout = setTimeout(() => {
          console.log('📚 Retrying message fetch...');
          fetchMessages(channelId, 50);
        }, 2000);
        
        return () => clearTimeout(retryTimeout);
      }
      
      if (switchingChat && setSwitchingChat) {
        const fallbackTimeout = setTimeout(() => {
          console.log('📚 Fallback: Clearing switchingChat state after timeout');
          setSwitchingChat(false);
        }, 3000);
        
        return () => clearTimeout(fallbackTimeout);
      }
    }
  }, [channelId, fetchMessages, switchingChat, setSwitchingChat, isConnected]);

  // Force refresh when widget is reopened
  useEffect(() => {
    if (forceRefresh && channelId) {
      fetchMessages(channelId, 50);
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      fetchMessages(channelId, 100, recentTimestamp);
    }
  }, [forceRefresh, channelId, fetchMessages]);

  // Auto-scroll to bottom on channel change
  useEffect(() => {
    if (channelId) {
      setTimeout(scrollToBottom, 100);
      setIsAtBottom(true);
    }
  }, [channelId]);

  // Clear messages when component unmounts or channel changes
  useEffect(() => {
    return () => {
      // Clear messages for this channel when component unmounts
      if (channelId) {
        clearMessages(channelId);
      }
    };
  }, [channelId, clearMessages]);

  return (
    <div className="h-full flex flex-col relative bg-gray-50 w-full message-list-container" data-message-list >
      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-2 sm:px-3 md:px-4 py-2 sm:py-3 md:py-4 space-y-2 sm:space-y-3 md:space-y-4 w-full"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          maxHeight: '100%'
        }}
        onScroll={(e) => {
          checkIfAtBottom();
          
          const element = e.target as HTMLDivElement;
          if (element.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
            loadMoreMessages();
          }
        }}
      >
        {/* Loading indicator for older messages */}
        {isLoadingMore && (
          <div className="text-center py-4 sm:py-6 md:py-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 md:gap-4 text-sm sm:text-base md:text-lg text-black bg-blue-100 border-2 border-black px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono font-bold">
              <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 border-2 border-black border-t-white animate-spin"></div>
              LOADING OLDER MESSAGES...
            </div>
          </div>
        )}
        
        {/* Loading GIF */}
        {switchingChat && (
          <div className="flex justify-center items-center py-12 sm:py-16 md:py-20">
            <div className="text-center">
              <img 
                src="/loading.gif" 
                alt="Loading messages..." 
                className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 mx-auto mb-4 sm:mb-5 md:mb-6"
              />
              <p className="text-sm sm:text-base md:text-lg text-gray-600 font-mono font-bold">
                LOADING MESSAGES...
              </p>
            </div>
          </div>
        )}
        
        {/* Welcome message for Jaime.Capital Community Group */}
        {!switchingChat && channelId === 'cmfhetm9i0000eqxogha9gi9l' && currentMessages.length === 0 && (
          <div className="bg-blue-100 border-2 border-black p-4 sm:p-6 md:p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 sm:mb-6 md:mb-8 mx-2 sm:mx-4 md:mx-6 mt-4 sm:mt-6 md:mt-8">
            <div className="text-3xl sm:text-4xl md:text-5xl mb-3 sm:mb-4 md:mb-5">🎉</div>
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-black mb-2 sm:mb-3 md:mb-4 font-mono">WELCOME TO JAIME.CAPITAL COMMUNITY GROUP!</h3>
            <p className="text-black mb-4 sm:mb-5 md:mb-6 leading-relaxed font-mono text-sm sm:text-base md:text-lg">
              THIS IS WHERE THE LAYER4 COMMUNITY COMES TOGETHER TO DISCUSS THE FUTURE OF FINANCIAL STABILITY, 
              SHARE INSIGHTS, AND BUILD CONNECTIONS IN THE DEFI SPACE.
            </p>
            <div className="bg-white border-2 border-black p-3 sm:p-4 md:p-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-sm text-black text-left font-mono">
                <h4 className="font-semibold text-black mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-blue-500 text-lg sm:text-xl md:text-2xl">📋</span>
                  <span className="hidden sm:inline">COMMUNITY GUIDELINES</span>
                  <span className="sm:hidden">GUIDELINES</span>
                </h4>
                <ul className="space-y-1 sm:space-y-2 md:space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-sm sm:text-base">✓</span>
                    <span className="text-sm sm:text-base md:text-lg">BE RESPECTFUL AND CONSTRUCTIVE IN ALL DISCUSSIONS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-sm sm:text-base">✓</span>
                    <span className="text-sm sm:text-base md:text-lg">SHARE VALUABLE INSIGHTS AND MARKET ANALYSIS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-sm sm:text-base">✓</span>
                    <span className="text-sm sm:text-base md:text-lg">ASK QUESTIONS AND HELP FELLOW COMMUNITY MEMBERS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 text-sm sm:text-base">✓</span>
                    <span className="text-sm sm:text-base md:text-lg">STAY FOCUSED ON LAYER4 AND DEFI TOPICS</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Render messages */}
        {!switchingChat && currentMessages.map((message, index) => {
          const prevMessage = index > 0 ? currentMessages[index - 1] : null;
          const nextMessage = index < currentMessages.length - 1 ? currentMessages[index + 1] : null;
          
          const showAvatar = !prevMessage || 
            prevMessage.authorId !== message.authorId || 
            new Date(message.sentAt).getTime() - new Date(prevMessage.sentAt).getTime() > 5 * 60 * 1000;

          const showTimestamp = !nextMessage || 
            nextMessage.authorId !== message.authorId ||
            new Date(nextMessage.sentAt).getTime() - new Date(message.sentAt).getTime() > 5 * 60 * 1000;

          return (
            <div key={message.id} className="group mb-2">
              <MessageBubble
                message={message}
                showAvatar={showAvatar}
                showTimestamp={showTimestamp}
                isConsecutive={!showAvatar}
              />
            </div>
          );
        })}

        {/* Empty state */}
        {!switchingChat && currentMessages.length === 0 && channelId !== 'cmfhetm9i0000eqxogha9gi9l' && (
          <div className="flex justify-center items-center py-12 sm:py-16 md:py-20 mt-4 sm:mt-6 md:mt-8">
            <div className="bg-white p-6 sm:p-8 md:p-10 text-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-sm sm:max-w-md md:max-w-lg w-full mx-2 sm:mx-4 md:mx-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-blue-100 border-2 border-black flex items-center justify-center mx-auto mb-4 sm:mb-5 md:mb-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-black mb-2 sm:mb-3 md:mb-4 font-mono">NO MESSAGES YET</h3>
              <p className="text-black leading-relaxed font-mono text-sm sm:text-base md:text-lg">BE THE FIRST TO START THE CONVERSATION IN THIS CHANNEL!</p>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start px-2 sm:px-3 md:px-4">
            <div className="px-3 sm:px-4 md:px-5 py-2 sm:py-3 md:py-4 max-w-[80%]">
              <TypingIndicator users={typingUsers} />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <div className="absolute bottom-3 sm:bottom-4 md:bottom-6 right-3 sm:right-4 md:right-6 z-10">
          <button
            onClick={scrollToBottom}
            className="bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 p-2 sm:p-3 md:p-4 rounded-full shadow-lg border border-gray-200 transition-all hover:shadow-xl hover:scale-105"
            title="Scroll to bottom"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}