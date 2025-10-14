import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface User {
  id: string;
  username: string | null;
  usernameChangedAt?: string | null; // ISO date string
  displayName: string | null;
  avatarUrl: string | null;
  avatarBlob?: string | null;
  walletAddress: string | null;
  email?: string | null;
  emailVerified?: boolean;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  lastSeen: string;
  isVerified: boolean;
  isAdmin: boolean;
  role?: number; // 0=admin, 1=member, 2=moderator, 3=dev (matches database schema)
  memberSince?: string; // ISO date string
  followerCount?: number;
  followingCount?: number;
  bio?: string | null;
  twitterHandle?: string | null;
  discordHandle?: string | null;
  twitchHandle?: string | null;
  spotifyHandle?: string | null;
}

export interface Attachment {
  url: string;
  type: 'image' | 'gif' | 'video' | 'file' | 'audio';
  originalName: string;
  size: number;
  thumbnailUrl?: string;
  duration?: number; // For audio/video files
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  type: number; // 1=text, 2=image, 3=gif, 4=audio, 5=video
  attachments: Attachment[];
  repliedToMessageId?: string;
  editedAt?: string;
  deletedAt?: string;
  sentAt: string;
  isSystem: boolean;
  author: User;
  reactions: MessageReaction[];
  readReceipts: ReadReceipt[];
  repliedToMessage?: Message;
  isOptimistic?: boolean; // Flag for optimistic updates
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
  };
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface Channel {
  id: string;
  name: string | null;
  type: 'dm' | 'text-group';
  createdBy: string;
  uid?: string | null; // Other user ID for DMs
  roomId?: string | null; // Room ID for text-group channels
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
  lastMessageId: string | null;
  topic: string | null;
  members: ChannelMember[];
  uidUser?: User | null; // Other user data for DMs
  createdByUser?: User | null; // Creator user data
  lastMessage?: Message;
  messages?: Message[];
  _count: {
    members: number;
  };
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  joinedAt: string;
  user: User;
}

export interface TypingUser {
  userId: string;
  channelId: string;
  timestamp: number;
}

interface ChatState {
  // Channels
  channels: Channel[];
  currentChannelId: string | null;
  
  // Messages
  messages: Record<string, Message[]>; // channelId -> messages
  
  // Users
  users: Record<string, User>; // userId -> user
  currentUser: User | null; // Current authenticated user
  
  // Typing indicators
  typingUsers: Record<string, TypingUser[]>; // channelId -> typing users
  
  // UI state
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  
  // Actions
  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  removeChannel: (channelId: string) => void;
  setCurrentChannel: (channelId: string | null) => void;
  
  setMessages: (channelId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  clearMessages: (channelId?: string) => void;
  
  // Reaction actions
  addReaction: (messageId: string, reaction: MessageReaction) => void;
  removeReaction: (messageId: string, reactionId: string) => void;
  updateMessageReactions: (messageId: string, reactions: MessageReaction[]) => void;
  // WebSocket reaction events (backend already handled toggle logic)
  handleReactionAdded: (reaction: MessageReaction) => void;
  handleReactionRemoved: (messageId: string, reactionId: string) => void;
  
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  setCurrentUser: (user: User | null) => void;
  clearUserCache: () => void;
  
  setTypingUsers: (channelId: string, users: TypingUser[]) => void;
  addTypingUser: (channelId: string, user: TypingUser) => void;
  removeTypingUser: (channelId: string, userId: string) => void;
  
  setLoading: (loading: boolean) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed getters
  getCurrentChannel: () => Channel | null;
  getCurrentMessages: () => Message[];
  getChannelMembers: (channelId: string) => User[];
  getTypingUsers: (channelId: string) => User[];
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      channels: [],
      currentChannelId: null,
      messages: {},
      users: {},
      currentUser: null,
      typingUsers: {},
      isLoading: false,
      isConnected: false,
      error: null,

      // Channel actions
      setChannels: (channels) => set({ channels }),
      
      addChannel: (channel) => set((state) => ({
        channels: [...state.channels, channel]
      })),
      
      updateChannel: (channelId, updates) => set((state) => ({
        channels: state.channels.map(channel =>
          channel.id === channelId ? { ...channel, ...updates } : channel
        )
      })),
      
      removeChannel: (channelId) => set((state) => ({
        channels: state.channels.filter(channel => channel.id !== channelId),
        currentChannelId: state.currentChannelId === channelId ? null : state.currentChannelId
      })),
      
      setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),

      // Message actions
      setMessages: (channelId, messages) => set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: messages
        }
      })),
      
      addMessage: (message) => {

        set((state) => {
          const newMessages = {
            ...state.messages,
            [message.channelId]: [
              ...(state.messages[message.channelId] || []),
              message
            ]
          };

          return { messages: newMessages };
        });
      },
      
      updateMessage: (messageId, updates) => set((state) => {
        const newMessages = { ...state.messages };
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );
        });
        return { messages: newMessages };
      }),
      
      removeMessage: (messageId) => set((state) => {
        const newMessages = { ...state.messages };
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].filter(msg => msg.id !== messageId);
        });
        return { messages: newMessages };
      }),
      
      prependMessages: (channelId, messages) => set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: [
            ...messages,
            ...(state.messages[channelId] || [])
          ]
        }
      })),

      clearMessages: (channelId) => set((state) => {
        if (channelId) {
          // Clear messages for specific channel
          const newMessages = { ...state.messages };
          delete newMessages[channelId];
          return { messages: newMessages };
        } else {
          // Clear all messages
          return { messages: {} };
        }
      }),

      // Reaction actions
      addReaction: (messageId, reaction) => set((state) => {
        console.log('🏪 [STORE] addReaction called:', { messageId, reaction });
        const newMessages = { ...state.messages };
        let found = false;
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].map(msg => {
            if (msg.id === messageId) {
              found = true;
              console.log('🏪 [STORE] Found message, current reactions:', msg.reactions.length);
              
              // Messenger spec: Only one reaction per user per message
              // Check if user already has ANY reaction on this message
              const existingUserReaction = msg.reactions.find(r => r.userId === reaction.userId);
              
              if (existingUserReaction) {
                if (existingUserReaction.emoji === reaction.emoji) {
                  // Same emoji - remove it (toggle off)
                  console.log('🏪 [STORE] Same emoji, removing reaction (toggle off)');
                  return {
                    ...msg,
                    reactions: msg.reactions.filter(r => r.id !== existingUserReaction.id)
                  };
                } else {
                  // Different emoji - replace existing reaction
                  console.log('🏪 [STORE] Different emoji, replacing existing reaction');
                  return {
                    ...msg,
                    reactions: msg.reactions.map(r => 
                      r.id === existingUserReaction.id ? reaction : r
                    )
                  };
                }
              } else {
                // No existing reaction - add new one
                console.log('🏪 [STORE] No existing reaction, adding new one');
                return {
                  ...msg,
                  reactions: [...msg.reactions, reaction]
                };
              }
            }
            return msg;
          });
        });
        if (!found) {
          console.log('🏪 [STORE] Message not found for reaction:', messageId);
        }
        return { messages: newMessages };
      }),
      
      removeReaction: (messageId, reactionId) => set((state) => {
        console.log('🏪 [STORE] removeReaction called:', { messageId, reactionId });
        const newMessages = { ...state.messages };
        let found = false;
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].map(msg => {
            if (msg.id === messageId) {
              found = true;
              console.log('🏪 [STORE] Found message for removal, current reactions:', msg.reactions.length);
              const newReactions = msg.reactions.filter(r => r.id !== reactionId);
              console.log('🏪 [STORE] After removal, reactions:', newReactions.length);
              return {
                ...msg,
                reactions: newReactions
              };
            }
            return msg;
          });
        });
        if (!found) {
          console.log('🏪 [STORE] Message not found for reaction removal:', messageId);
        }
        return { messages: newMessages };
      }),
      
      updateMessageReactions: (messageId, reactions) => set((state) => {
        const newMessages = { ...state.messages };
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].map(msg => {
            if (msg.id === messageId) {
              return {
                ...msg,
                reactions
              };
            }
            return msg;
          });
        });
        return { messages: newMessages };
      }),

      // WebSocket reaction events (backend already handled toggle logic)
      handleReactionAdded: (reaction) => set((state) => {
        console.log('🏪 [STORE] handleReactionAdded called:', reaction);
        const newMessages = { ...state.messages };
        let found = false;
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].map(msg => {
            if (msg.id === reaction.messageId) {
              found = true;
              console.log('🏪 [STORE] Found message for reaction add, current reactions:', msg.reactions.length);
              
              // Check if this reaction already exists (to avoid duplicates)
              const existingReaction = msg.reactions.find(r => r.id === reaction.id);
              if (existingReaction) {
                console.log('🏪 [STORE] Reaction already exists, updating');
                return {
                  ...msg,
                  reactions: msg.reactions.map(r => r.id === reaction.id ? reaction : r)
                };
              } else {
                console.log('🏪 [STORE] Adding new reaction');
                return {
                  ...msg,
                  reactions: [...msg.reactions, reaction]
                };
              }
            }
            return msg;
          });
        });
        if (!found) {
          console.log('🏪 [STORE] Message not found for reaction add:', reaction.messageId);
        }
        console.log('🏪 [STORE] handleReactionAdded completed, new state:', Object.keys(newMessages).length, 'channels');
        return { messages: newMessages };
      }),

      handleReactionRemoved: (messageId, reactionId) => set((state) => {
        console.log('🏪 [STORE] handleReactionRemoved called:', { messageId, reactionId });
        const newMessages = { ...state.messages };
        let found = false;
        Object.keys(newMessages).forEach(channelId => {
          newMessages[channelId] = newMessages[channelId].map(msg => {
            if (msg.id === messageId) {
              found = true;
              console.log('🏪 [STORE] Found message for reaction removal, current reactions:', msg.reactions.length);
              const newReactions = msg.reactions.filter(r => r.id !== reactionId);
              console.log('🏪 [STORE] After removal, reactions:', newReactions.length);
              return {
                ...msg,
                reactions: newReactions
              };
            }
            return msg;
          });
        });
        if (!found) {
          console.log('🏪 [STORE] Message not found for reaction removal:', messageId);
        }
        return { messages: newMessages };
      }),

      // User actions
      setUsers: (users) => set((state) => {
        const userMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<string, User>);
        return { users: { ...state.users, ...userMap } };
      }),
      
      addUser: (user) => set((state) => ({
        users: {
          ...state.users,
          [user.id]: user
        }
      })),
      
      updateUser: (userId, updates) => set((state) => ({
        users: {
          ...state.users,
          [userId]: {
            ...state.users[userId],
            ...updates
          }
        }
      })),
      
      setCurrentUser: (user) => set({ currentUser: user }),
      
      clearUserCache: () => set((state) => ({
        currentUser: null,
        users: {},
        channels: [],
        messages: {},
        currentChannelId: null,
        typingUsers: {},
        isLoading: false,
        isConnected: false,
        error: null
      })),

      // Typing actions
      setTypingUsers: (channelId, users) => set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [channelId]: users
        }
      })),
      
      addTypingUser: (channelId, user) => set((state) => {
        const currentTyping = state.typingUsers[channelId] || [];
        const existingIndex = currentTyping.findIndex(u => u.userId === user.userId);
        
        let newTyping;
        if (existingIndex >= 0) {
          newTyping = [...currentTyping];
          newTyping[existingIndex] = user;
        } else {
          newTyping = [...currentTyping, user];
        }
        
        return {
          typingUsers: {
            ...state.typingUsers,
            [channelId]: newTyping
          }
        };
      }),
      
      removeTypingUser: (channelId, userId) => set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [channelId]: (state.typingUsers[channelId] || []).filter(u => u.userId !== userId)
        }
      })),

      // UI actions
      setLoading: (loading) => set({ isLoading: loading }),
      setConnected: (connected) => set({ isConnected: connected }),
      setError: (error) => set({ error }),

      // Computed getters
      getCurrentChannel: () => {
        const state = get();
        return state.channels.find(channel => channel.id === state.currentChannelId) || null;
      },
      
      getCurrentMessages: () => {
        const state = get();
        return state.currentChannelId ? (state.messages[state.currentChannelId] || []) : [];
      },
      
      getChannelMembers: (channelId) => {
        const state = get();
        const channel = state.channels.find(c => c.id === channelId);
        if (!channel) return [];
        
        return channel.members.map(member => member.user);
      },
      
      getTypingUsers: (channelId) => {
        const state = get();
        const typingUsers = state.typingUsers[channelId] || [];
        const now = Date.now();
        
        // Filter out users who haven't typed in the last 3 seconds
        const activeTypingUsers = typingUsers.filter(user => now - user.timestamp < 3000);
        
        // Map to user objects and filter out current user and invalid users
        return activeTypingUsers
          .map(typingUser => state.users[typingUser.userId])
          .filter(Boolean)
          .filter(user => user.id !== state.currentUser?.id); // Don't show current user typing
      }
    }),
    {
      name: 'chat-store'
    }
  )
);
