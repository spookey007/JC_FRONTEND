'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket, useChatEvents, SERVER_EVENTS } from '@/contexts/WebSocketContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { motion, AnimatePresence } from 'framer-motion';
import ChatSidebar from './chat/ChatSidebar';
import MessageList from './chat/MessageList';
import MessageInput from './chat/MessageInput';
import CreateRoomModal from './chat/CreateRoomModal';
import RoomSearchModal from './chat/RoomSearchModal';
import VoiceRecorder from './chat/VoiceRecorder';
import { useLisaSounds } from '@/lib/lisaSounds';
import { animations, createHoverAnimation, createTapAnimation } from '@/lib/animations';
import { getRoleName, getRoleColor, getRoleIcon } from '@/lib/roleUtils';
import debug from '@/lib/debug';
// Removed authService dependency - using chatStore directly

const queryClient = new QueryClient();

interface ChatWidgetProps {
  className?: string;
  twitterConnected?: boolean;
}

function ChatWidgetContent({ className = '', twitterConnected = false }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<any>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [switchingChat, setSwitchingChat] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showChatView, setShowChatView] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSearchResults, setModalSearchResults] = useState<any[]>([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  const [isCreatingDM, setIsCreatingDM] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showRoomSearchModal, setShowRoomSearchModal] = useState(false);
  const [channelsFetched, setChannelsFetched] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    isConnected: storeConnected, 
    setConnected, 
    setError,
    getCurrentChannel,
    messages,
    currentUser,
    channels,
    setCurrentChannel,
    setMessages,
    addChannel,
    addMessage
  } = useChatStore();
  
  // Use only chatStore user data (WebSocket handles authentication)
  const currentUserData = currentUser;

  const { on, off, fetchChannels } = useWebSocket();
  const { joinChannel, sendChatMessage } = useChatEvents();
  const { playButtonClick, playMenuClick, playChatSound, playChatCloseSound, playHoverSound } = useLisaSounds();
  
  // Use Solana wallet connection state
  const { connected, publicKey, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  
  // WebSocket connection state
  const { isConnected: socketConnected, isConnecting: socketConnecting } = useWebSocket();

  // WebSocket connection status
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
      setConnected(connected);
    };

    on('CONNECTION', handleConnectionChange);

    return () => {
      off('CONNECTION', handleConnectionChange);
    };
  }, [on, off, setConnected]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Auto-show sidebar on mobile when opening chat
  useEffect(() => {
    if (open && window.innerWidth < 768) {
      setShowSidebar(true); // Show sidebar on mobile when chat opens
    } else if (open && window.innerWidth >= 768) {
      setShowSidebar(true);
    }
  }, [open]);

  // Mobile navigation bar detection and adjustment
  // useEffect(() => {
  //   if (typeof window === 'undefined') return;

  //   const detectMobileNavBar = () => {
  //     const isMobile = window.innerWidth <= 768;
  //     if (!isMobile) return;

  //     // Get viewport height and screen height
  //     const vh = window.innerHeight;
  //     const screenHeight = window.screen.height;
  //     const screenWidth = window.screen.width;
      
  //     // Calculate navigation bar height based on different detection methods
  //     let navBarHeight = 0;
      
  //     // Method 1: Compare viewport height with screen height (more conservative)
  //     const heightDifference = screenHeight - vh;
  //     if (heightDifference > 0 && heightDifference < 100) { // Only if reasonable difference
  //       navBarHeight = Math.max(navBarHeight, Math.min(heightDifference, 50)); // Cap at 50px
  //     }
      
  //     // Method 2: Check for common device patterns (more conservative)
  //     const deviceRatio = screenHeight / screenWidth;
  //     if (deviceRatio > 2.0) {
  //       // Likely a modern phone with navigation bar
  //       navBarHeight = Math.max(navBarHeight, 20); // Reduced from 40
  //     }
      
  //     // Method 3: Check for iOS devices (more conservative)
  //     const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  //     if (isIOS) {
  //       // iOS devices typically have 34px home indicator
  //       navBarHeight = Math.max(navBarHeight, 20); // Reduced from 34
  //     }
      
  //     // Method 4: Check for Android devices (more conservative)
  //     const isAndroid = /Android/.test(navigator.userAgent);
  //     if (isAndroid) {
  //       // Android devices typically have 48-60px navigation bar
  //       navBarHeight = Math.max(navBarHeight, 25); // Reduced from 48
  //     }
      
  //     // Method 5: Use CSS env() as fallback
  //     const safeAreaBottom = getComputedStyle(document.documentElement)
  //       .getPropertyValue('--safe-area-inset-bottom') || '0px';
  //     const safeAreaValue = parseInt(safeAreaBottom) || 0;
  //     navBarHeight = Math.max(navBarHeight, safeAreaValue);
      
  //     // Ensure minimum height for any mobile device (reduced)
  //     navBarHeight = Math.max(navBarHeight, 15); // Reduced from 30
      
  //     // Add dynamic CSS for mobile navigation bar
  //     const style = document.createElement('style');
  //     style.id = 'mobile-nav-fix';
  //     style.textContent = `
  //       .mobile-input-container {
  //         padding-bottom: ${Math.min(navBarHeight, 25)}px !important;
  //         min-height: ${Math.max(50, navBarHeight + 10)}px !important;
  //       }
  //       .mobile-message-input {
  //         margin-bottom: ${Math.min(navBarHeight * 0.3, 8)}px !important;
  //       }
  //       .chat-widget {
  //         min-height: ${vh}px !important;
  //         max-height: ${vh}px !important;
  //       }
  //       /* Additional safety measures */
  //       .mobile-input-container form {
  //         padding-bottom: ${Math.max(5, navBarHeight * 0.3)}px !important;
  //       }
  //     `;
      
  //     // Remove existing style if present
  //     const existingStyle = document.getElementById('mobile-nav-fix');
  //     if (existingStyle) {
  //       existingStyle.remove();
  //     }
      
  //     document.head.appendChild(style);
      
  //     // Log detection for debugging (development only)
  //     debug.log('🔍 [MOBILE_NAV] Detected navigation bar height:', navBarHeight, {
  //       vh,
  //       screenHeight,
  //       heightDifference,
  //       deviceRatio,
  //       isIOS,
  //       isAndroid,
  //       safeAreaValue
  //     });
  //   };

  //   // Run detection on mount and resize
  //   detectMobileNavBar();
  //   window.addEventListener('resize', detectMobileNavBar);
  //   window.addEventListener('orientationchange', () => {
  //     setTimeout(detectMobileNavBar, 100);
  //   });
    
  //   // Also run on focus (when user returns to tab)
  //   window.addEventListener('focus', detectMobileNavBar);

  //   return () => {
  //     window.removeEventListener('resize', detectMobileNavBar);
  //     window.removeEventListener('orientationchange', detectMobileNavBar);
  //     window.removeEventListener('focus', detectMobileNavBar);
  //     const existingStyle = document.getElementById('mobile-nav-fix');
  //     if (existingStyle) {
  //       existingStyle.remove();
  //     }
  //   };
  // }, [open]);

  // Refresh messages when widget is opened and ensure channels are loaded
  useEffect(() => {
    if (open) {
      debug.log('🔄 [WIDGET] Widget opened, checking channels...');
      
      // If no channels are loaded and user is connected, fetch channels
      if (connected && channels.length === 0) {
        debug.log('🔄 [WIDGET] No channels loaded, fetching channels...');
        fetchChannels();
      }
      
      if (currentChannelId) {
        // Debug: Widget opened, will refresh messages for channel
        debug.log('🔄 [WIDGET] Widget opened, will refresh messages for channel:', currentChannelId);
        // Trigger force refresh
        setForceRefresh(true);
        setTimeout(() => setForceRefresh(false), 100);
        
        // Also check for missed messages by joining the channel
        joinChannel(currentChannelId);
      }
    }
  }, [open, currentChannelId, connected, channels.length, fetchChannels, joinChannel]);

  // Listen for custom channel switch events from MessageBubble/ProfileCard
  useEffect(() => {
    const handleSwitchToChannel = (event: CustomEvent) => {
      const { channelId } = event.detail;
      if (channelId) {
        debug.log('🔄 [ChatWidget] Received switchToChannel event:', channelId);
        handleChannelSelect(channelId);
      }
    };

    window.addEventListener('switchToChannel', handleSwitchToChannel as EventListener);
    
    return () => {
      window.removeEventListener('switchToChannel', handleSwitchToChannel as EventListener);
      // Cleanup timeout on unmount
      if (channelSwitchTimeoutRef.current) {
        clearTimeout(channelSwitchTimeoutRef.current);
      }
    };
  }, []);

  const handleChannelSelect = (channelId: string) => {
    debug.log('🔄 [ChatWidget] Channel selected:', channelId);
    
    // Clear any existing timeout
    if (channelSwitchTimeoutRef.current) {
      clearTimeout(channelSwitchTimeoutRef.current);
    }
    
    // Prevent rapid channel switching
    if (switchingChat) {
      debug.log('⏳ [ChatWidget] Already switching channels, ignoring request');
      return;
    }
    
    setSwitchingChat(true);
    setCurrentChannelId(channelId);
    setReplyToMessage(null);
    setShowMembersList(false);
    
    // Show chat view and hide sidebar on mobile
    setShowChatView(true);
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
    
    // Debounce channel joining to prevent rapid switches
    channelSwitchTimeoutRef.current = setTimeout(() => {
      // Join channel only if WebSocket is connected
      if (isConnected) {
        debug.log('🔗 [ChatWidget] Joining channel via WebSocket:', channelId);
        joinChannel(channelId);
      } else {
        debug.warn('⚠️ [ChatWidget] WebSocket not connected, cannot join channel');
        // Set a timeout to try again when connected
        const retryJoin = () => {
          if (isConnected) {
            debug.log('🔄 [ChatWidget] Retrying channel join:', channelId);
            joinChannel(channelId);
          } else {
            setTimeout(retryJoin, 1000);
          }
        };
        setTimeout(retryJoin, 1000);
      }
    }, 100); // 100ms debounce
  };

  const handleBackToChannels = () => {
    setShowChatView(false);
    setCurrentChannelId(null);
    setShowSidebar(true);
    setReplyToMessage(null);
  };

  const handleReplyToMessage = (messageId: string) => {
    setReplyToMessage({ id: messageId, content: 'Reply to message' });
  };

  const handleClearReply = () => {
    setReplyToMessage(null);
  };

  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    setShowUserInfo(true);
  };

  const handleCloseUserInfo = () => {
    setShowUserInfo(false);
    setSelectedUser(null);
  };

  const handleOpenNewMessage = () => {
    setShowUserSearch(true);
    setModalSearchQuery('');
    setModalSearchResults([]);
  };

  const handleCloseNewMessage = () => {
    setShowUserSearch(false);
    setModalSearchQuery('');
    setModalSearchResults([]);
  };

  const toggleFullscreen = () => {
    playButtonClick();
    // On mobile, fullscreen is always true, so we don't toggle
    if (window.innerWidth < 768) {
      return;
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleModalUserClick = async (user: any) => {
    // Don't allow messaging yourself
    if (user.id === currentUserData?.id) {
      return;
    }

    // Prevent multiple clicks while creating DM
    if (isCreatingDM) {
      return;
    }

    setIsCreatingDM(true);
    try {
      // First check if DM already exists locally for instant response
      const existingChannel = channels.find(channel => 
        channel.type === 'dm' && 
        channel.members?.some((member: any) => member.userId === user.id)
      );

      if (existingChannel) {
        // Switch to existing DM channel immediately
        handleChannelSelect(existingChannel.id);
        handleCloseNewMessage();
        return;
      }

      // Create new DM channel with duplicate prevention
      const { apiFetch } = await import('@/lib/api');
      const response = await apiFetch('/chat/dm/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          preventDuplicates: true // Flag for backend duplicate prevention
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        handleChannelSelect(data.channel.id);
        handleCloseNewMessage();
      } else {
        const errorData = await response.json();
        if (errorData.error === 'DUPLICATE_DM') {
          // DM already exists, find and switch to it
          const duplicateChannel = channels.find(channel => 
            channel.type === 'dm' && 
            channel.members?.some((member: any) => member.userId === user.id)
          );
          if (duplicateChannel) {
            handleChannelSelect(duplicateChannel.id);
            handleCloseNewMessage();
          }
        } else {
          debug.error('Failed to create DM channel:', errorData);
        }
      }
    } catch (error) {
      debug.error('Error creating/opening DM:', error);
    } finally {
      setIsCreatingDM(false);
    }
  };

  const searchModalUsers = async (query: string) => {
    if (!query.trim()) {
      setModalSearchResults([]);
      return;
    }

    setIsModalSearching(true);
    try {
      const { apiFetch } = await import('@/lib/api');
      const response = await apiFetch(`/chat/search-users?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      const users = data.users || [];
      
      // Filter out current user from search results with robust comparison
      const filteredUsers = users.filter((user: any) => {
        // Only filter if currentUserData exists and has an ID
        if (!currentUserData?.id) {
          return true;
        }
        
        const isCurrentUser = user.id === currentUserData.id || 
                             user.walletAddress === currentUserData.walletAddress ||
                             user.username === currentUserData.username;
        return !isCurrentUser;
      });
      setModalSearchResults(filteredUsers);
    } catch (error) {
      debug.error('Search error:', error);
      setModalSearchResults([]);
    } finally {
      setIsModalSearching(false);
    }
  };

  // Track when channels have been fetched at least once
  useEffect(() => {
    if (channels.length > 0) {
      setChannelsFetched(true);
    }
  }, [channels.length]);

  // Set channels as fetched after a timeout to prevent infinite loading
  useEffect(() => {
    if (connected && socketConnected && !channelsFetched) {
      const timeout = setTimeout(() => {
        console.log('[ChatWidget] Channels fetch timeout, marking as fetched');
        setChannelsFetched(true);
      }, 5000); // 5 second timeout

      return () => clearTimeout(timeout);
    }
  }, [connected, socketConnected, channelsFetched]);

  // Determine loading state and button status
  const isWalletConnecting = connecting;
  const isSocketConnecting = socketConnecting;
  const isAuthenticating = (connected && publicKey && !socketConnected && !socketConnecting) || (twitterConnected && !socketConnected && !socketConnecting);
  
  // Only show channels loading if we're connected but haven't received any channels yet
  // and we haven't fetched channels before (to handle empty channel lists)
  const isChannelsLoading = (connected || twitterConnected) && socketConnected && channels.length === 0 && !channelsFetched;
  
  const isLoading = isWalletConnecting || isSocketConnecting || isAuthenticating || isChannelsLoading;
  
  // Button states
  const isButtonDisabled = (!connected && !twitterConnected) || (connected && !publicKey) || isLoading;
  const buttonText = isLoading ? "Rugging People" : "Capital Chat";
  
  // Always show the chat widget, but handle wallet connection state inside
  const canShow = true;

  // Validate current user data to prevent stale cache issues
  const validateCurrentUser = () => {
    if (!currentUserData?.id) {
      debug.warn('⚠️ [USER VALIDATION] No current user data available');
      return false;
    }

    // Check if user data looks valid
    if (!currentUserData.id || currentUserData.id === 'undefined' || currentUserData.id === 'null') {
      debug.warn('⚠️ [USER VALIDATION] Invalid user ID:', currentUserData.id);
      return false;
    }
    
    debug.log('✅ [USER VALIDATION] Current user validated:', {
      id: currentUserData.id,
      username: currentUserData.username,
      displayName: currentUserData.displayName
    });
    
    return true;
  };

  // Get the other user's data for DM channels with validation
  const getOtherUser = (channel: any) => {
    if (channel.type === 'dm') {
      if (!validateCurrentUser()) {
        debug.warn('⚠️ [DM] Cannot determine other user - current user data invalid');
        return null;
      }
      
      const otherUser = channel.members?.find((member: any) => member.userId !== currentUserData?.id)?.user;
      
      if (!otherUser) {
        debug.warn('⚠️ [DM] Other user not found in channel members:', {
          channelId: channel.id,
          members: channel.members?.map((m: any) => ({ userId: m.userId, username: m.user?.username })),
          currentUserId: currentUserData?.id
        });
      }
      
      return otherUser;
    }
    return null;
  };

  // Get the appropriate display name for the channel header
  const getChannelDisplayName = () => {
    const channel = getCurrentChannel();
    if (!channel) return 'Channel';
    
    // For DMs, find the other member (not the current user)
    if (channel.type === 'dm') {
      const otherUser = getOtherUser(channel);
      if (otherUser) {
        return otherUser.displayName || otherUser.username || 'Unknown User';
      }
      return 'Unknown User';
    }
    
    // For regular channels, show the channel name
    return channel.name || 'Channel';
  };

  // Get the appropriate member count for the channel header
  const getChannelMemberCount = () => {
    const channel = getCurrentChannel();
    if (!channel) return null;
    
    // For DMs, don't show member count
    if (channel.type === 'dm') {
      return null;
    }
    
    // For regular channels, show member count
    return `${channel.members?.length || 0} members`;
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            whileHover={!isButtonDisabled ? { scale: 1.1, y: -3 } : {}}
            whileTap={!isButtonDisabled ? { scale: 0.9 } : {}}
            onClick={() => {
              if (!isButtonDisabled) {
                playButtonClick();
                setOpen(true);
              }
            }}
            onMouseEnter={() => !isButtonDisabled && playHoverSound()}
            transition={{ type: "spring", stiffness: 600, damping: 25 }}
            aria-label={isButtonDisabled ? "Chat loading..." : "Open chat"}
            disabled={isButtonDisabled}
            className={`fixed bottom-4 right-4 z-50 shadow-2xl transition-all duration-300 ${
              isButtonDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
            // style={{ 
            //   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            // }}
          >
            <div className={`flex items-center bg-black rounded-full ${!isButtonDisabled ? 'hover:bg-gray-800' : ''}`}>
              {/* Circular part */}
              <motion.div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                animate={!isButtonDisabled ? { 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                } : {}}
                transition={!isButtonDisabled ? { 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
              >
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <img 
                    src="/jaime.jpg" 
                    alt="Jaime.Capital Logo" 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  // <p>👀</p>
                )}
              </motion.div>
              
              {/* Rectangular part with text */}
              <div className="px-4 py-2 bg-black rounded-r-full">
                <span className="text-white font-medium font-mono text-sm">
                  {buttonText}
                </span>
              </div>
            </div>
            {/* Notification badge - only show when not loading */}
            {!isLoading && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white">
                3
              </div>
            )}
          </motion.button>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 500, damping: 50 }}
            className={`fixed z-50 p-0 ${
              isFullscreen 
                ? 'inset-0 w-full h-full' 
                : 'inset-0 sm:inset-2 md:inset-4 lg:inset-auto lg:bottom-4 lg:right-4 w-full h-full sm:w-[95vw] sm:h-[95vh] md:w-[90vw] md:h-[90vh] lg:w-[600px] lg:h-[600px] xl:w-[700px] xl:h-[700px] 2xl:w-[800px] 2xl:h-[800px]'
            }`}
            style={{
              // CSS handles all viewport and safe area logic
              transformOrigin: isFullscreen ? "center" : "bottom right"
            }}
          >
            <div className={`chat-widget flex flex-col bg-white shadow-2xl border-0 md:border border-gray-200 overflow-hidden ${isFullscreen ? 'chat-widget-fullscreen' : 'chat-widget-normal'}`}>
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-black text-white p-2 sm:p-3 md:p-4 flex items-center justify-between z-10 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm sm:text-lg md:text-xl">💬</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-xs sm:text-sm md:text-lg truncate">Mainnet Chat (beta)</h3>
                    {/* <div className="flex items-center gap-2 text-sm text-gray-300">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                      <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
                    </div> */}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
                  {/* Fullscreen toggle - hidden on mobile */}
                  <button 
                    onClick={toggleFullscreen}
                    onMouseEnter={() => playHoverSound()}
                    className="hidden lg:flex p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isFullscreen ? (
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    )}
                  </button>
                  {/* Mobile sidebar toggle removed - sidebar auto-opens on mobile */}
                  <button 
        onClick={() => {
          playChatCloseSound();
          setOpen(false);
          // Reset chat state when closing
          setCurrentChannelId(null);
          setReplyToMessage(null);
          setShowSidebar(true);
          setShowMembersList(false);
          setShowUserInfo(false);
          setShowUserSearch(false);
          setSelectedUser(null);
          setModalSearchQuery('');
          setModalSearchResults([]);
          setIsModalSearching(false);
          setIsCreatingDM(false);
          setIsFullscreen(false);
          // Clear chat store state
          setCurrentChannel(null);
          // Clear messages for current channel if it exists
          if (currentChannelId) {
            setMessages(currentChannelId, []);
          }
        }}
        onMouseEnter={() => playHoverSound()}
                    className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close chat"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex pt-12 sm:pt-16 md:pt-20 bg-gray-50 min-h-0">
                {/* Mobile overlay - Only show when wallet or Twitter is connected and on mobile */}
                {(connected || twitterConnected) && showSidebar && window.innerWidth < 768 && (
                  <div 
                    className="md:hidden absolute inset-0 bg-black/50 z-20 pt-12 sm:pt-16 md:pt-20"
                    onClick={() => setShowSidebar(false)}
                  />
                )}
                
                {/* Sidebar - Only show when wallet or Twitter is connected */}
                {(connected || twitterConnected) && (
                  <div className={`absolute md:relative z-30 md:z-0 transition-all duration-300 ease-in-out w-full sm:w-72 md:w-64 lg:w-72 xl:w-80 h-full ${
                    showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                  } ${!showSidebar && showChatView ? 'md:w-0 md:overflow-hidden' : ''} ${
                    isFullscreen ? 'md:w-80 lg:w-96 xl:w-[400px]' : ''
                  }`}>
                    <div className="bg-white h-full border-r border-gray-200 flex flex-col pt-0">
                      <ChatSidebar 
                        onChannelSelect={handleChannelSelect}
                        currentChannelId={currentChannelId}
                        onCreateRoom={() => setShowCreateRoomModal(true)}
                        onSearchRooms={() => setShowRoomSearchModal(true)}
                      />
                    </div>
                  </div>
                )}

                {/* Messages Area */}
                <div className="flex-1 flex flex-col min-w-0 max-w-full min-h-0">
                  {!connected && !twitterConnected ? (
                    /* Wallet Connection Required */
                    <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
                      <div className="text-center p-4 sm:p-8 max-w-md mx-auto">
                        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                          <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Wallet Connection Required</h3>
                        <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">Connect your Solana wallet to start chatting with the Jaime.Capital community</p>
                        <motion.button
                          onClick={() => {
                            playButtonClick();
                            setVisible(true);
                          }}
                          onMouseEnter={() => playHoverSound()}
                          whileHover={{ 
                            scale: 1.05, 
                            y: -2,
                            transition: { 
                              type: "tween",
                              ease: "easeOut",
                              duration: 0.2
                            }
                          }}
                          whileTap={{ 
                            scale: 0.95,
                            transition: { 
                              type: "tween", 
                              ease: "easeOut", 
                              duration: 0.1 
                            }
                          }}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200"
                        >
                          Connect Wallet
                        </motion.button>
                      </div>
                    </div>
                  ) : !showChatView ? (
                    /* Initial view - Show channels list */
                    <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
                      <div className="text-center p-4 sm:p-8 max-w-md mx-auto">
                        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                          <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Welcome to Mainnet Chat</h3>
                        <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">Select a channel from the sidebar to start chatting with the Jaime.Capital community</p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          {/* <motion.div 
                            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors md:cursor-default md:hover:bg-white"
                            onClick={() => {
                              playButtonClick();
                              handleOpenNewMessage();
                              if (window.innerWidth < 768) {
                                setShowSidebar(true);
                              }
                            }}
                            onMouseEnter={() => playHoverSound()}
                            whileHover={{ 
                              scale: 1.02, 
                              y: -2,
                              transition: { 
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.2
                              }
                            }}
                            whileTap={{ 
                              scale: 0.98,
                              transition: { 
                                type: "tween", 
                                ease: "easeOut", 
                                duration: 0.1 
                              }
                            }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 400, 
                              damping: 40,
                              delay: 0.1
                            }}
                          >
                            <div className="text-2xl mb-2">👥</div>
                            <p className="text-sm font-medium text-gray-700">Find People</p>
                            <p className="text-xs text-gray-500">Search for users to chat with</p>
                          </motion.div> */}
                          {/* <div 
                            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors md:cursor-default md:hover:bg-white"
                            onClick={() => {
                              if (window.innerWidth < 768) {
                                setShowSidebar(true);
                              }
                            }}
                          >
                            <div className="text-2xl mb-2">🏠</div>
                            <p className="text-sm font-medium text-gray-700">Join Channels</p>
                            <p className="text-xs text-gray-500">Participate in group discussions</p>
                          </div> */}
                        </div>
                      </div>
                    </div>
                  ) : showChatView && currentChannelId ? (
                    <>
                      {/* Chat Header - Compact & Modern */}
                      <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          {/* Back to channels button */}
                          <button
                            onClick={handleBackToChannels}
                            onMouseEnter={() => playHoverSound()}
                            className="p-1.5 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all duration-200 flex-shrink-0"
                            title="Back to Channels"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>

                          {/* Mobile sidebar toggle button - only show on mobile */}
                          {/* {window.innerWidth < 768 && (
                            <button
                              onClick={() => {
                                playMenuClick();
                                setShowSidebar(true);
                              }}
                              onMouseEnter={() => playHoverSound()}
                              className="p-1.5 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all duration-200 flex-shrink-0"
                              title="Show Channels"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                            </button>
                          )} */}

                          {/* Channel icon */}
                          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                            {getCurrentChannel()?.type === 'dm' ? (
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                              </svg>
                            ) : (
                              <span className="text-xs font-bold">#</span>
                            )}
                          </div>

                          {/* Channel info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <h4 className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                                {getChannelDisplayName()}
                              </h4>
                              {getChannelMemberCount() && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-1 sm:px-1.5 py-0.5 rounded-full">
                                  {getChannelMemberCount()}
                                </span>
                              )}
                            </div>
                            {getCurrentChannel()?.type === 'dm' && (
                              <div className="flex items-center gap-1">
                                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-400 rounded-full"></div>
                                <span className="text-xs text-gray-500">Online</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Search button */}
                          {/* <button
                            onMouseEnter={() => playHoverSound()}
                            className="p-1.5 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all duration-200"
                            title="Search messages"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </button> */}

                          {/* More options */}
                          {/* <button
                            onMouseEnter={() => playHoverSound()}
                            className="p-1.5 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all duration-200"
                            title="More options"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button> */}
                        </div>
                      </div>

                      {/* Main Chat Area - Flex Column Layout */}
                      <div className="flex-1 flex flex-col min-h-0">
                        {/* Messages Area */}
                        <div className="flex-1 flex min-h-0 " style={{ 
                        maxHeight: 'calc(88vh - 180px)',
                        minHeight: '200px',
                        scrollBehavior: 'smooth',
                        scrollbarWidth: 'thin',
                        // scrollbarColor: '#3b82f6 #dbeafe'
                      }}>
                          {/* Messages */}
                          <div className="flex-1 bg-gray-50 min-w-0 max-w-full">
                            <MessageList 
                              channelId={currentChannelId} 
                              messagesEndRef={messagesEndRef}
                              switchingChat={switchingChat}
                              setSwitchingChat={setSwitchingChat}
                              forceRefresh={forceRefresh}
                            />
                          </div>

                          {/* Members List */}
                          {showMembersList && (
                            <div className={`bg-white border-l border-gray-200 flex flex-col flex-shrink-0 shadow-lg ${
                              isFullscreen ? 'w-64 sm:w-80 md:w-96 min-w-64 sm:min-w-80 md:min-w-96' : 'w-60 sm:w-72 md:w-80 min-w-60 sm:min-w-72 md:min-w-80'
                            }`}>
                              <div className="p-2 sm:p-3 md:p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">Members</h3>
                                <button
                                  onClick={() => setShowMembersList(false)}
                                  onMouseEnter={() => playHoverSound()}
                                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors border-2 border-black shadow-lg flex items-center justify-center min-w-[40px] min-h-[40px]"
                                  title="Close members list"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <div className="flex-1 overflow-y-auto p-1 sm:p-2">
                                <div className="space-y-0.5 sm:space-y-1">
                                  {getCurrentChannel()?.members?.map((member: any) => (
                                    <button
                                      key={member.id}
                                      onClick={() => handleUserClick(member.user)}
                                      onMouseEnter={() => playHoverSound()}
                                      className="w-full p-2 sm:p-3 hover:bg-blue-50 rounded-lg flex items-center gap-2 sm:gap-3 transition-colors border border-transparent hover:border-blue-200"
                                    >
                                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold overflow-hidden">
                                        {member.user?.avatarUrl ? (
                                          <img 
                                            src={member.user.avatarUrl} 
                                            alt={member.user.displayName || member.user.username} 
                                            className="w-full h-full object-cover" 
                                          />
                                        ) : (
                                          member.user?.displayName?.[0]?.toUpperCase() || 
                                          member.user?.username?.[0]?.toUpperCase() || 
                                          'U'
                                        )}
                                      </div>
                                      <div className="flex-1 text-left">
                                        <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                          <div className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                                            {member.user?.displayName || member.user?.username || 'Unknown User'}
                                          </div>
                                          {/* Role Badge */}
                                          {member.user?.role !== undefined && (
                                            <span className={`text-xs font-mono px-1 sm:px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${getRoleColor(member.user.role) === '#ff6b6b' ? 'bg-red-500' : getRoleColor(member.user.role) === '#96ceb4' ? 'bg-green-500' : getRoleColor(member.user.role) === '#45b7d1' ? 'bg-blue-500' : 'bg-teal-500'} text-white`}>
                                              <span className="hidden sm:inline">{getRoleIcon(member.user.role)} </span>{getRoleName(member.user.role)}
                                            </span>
                                          )}
                                          {/* Verification Badge */}
                                          {member.user?.isVerified && (
                                            <div className="text-green-600" title="Verified wallet">
                                              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"></div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {member.user?.isVerified ? 'Verified' : 'User'}
                                        </div>
                                      </div>
                                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></div>
                                    </button>
                                  )) || []}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Message Input - Fixed at bottom with mobile safe area */}
                        <div 
                          className="bg-white border-t border-gray-200 flex-shrink-0"
                          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                        >
                          <MessageInput
                            channelId={currentChannelId}
                            replyToMessage={replyToMessage}
                            onClearReply={handleClearReply}
                            showVoiceRecorder={showVoiceRecorder}
                            setShowVoiceRecorder={setShowVoiceRecorder}
                          />
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Voice Recorder Modal - Centered in chat area */}
        {showVoiceRecorder && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <VoiceRecorder
              onRecordingComplete={async (audioBlob) => {
                if (!currentChannelId || !currentUser || isSendingVoice) return;

                try {
                  setIsSendingVoice(true);
                  // Upload audio file using MinIO
                  const { uploadFile } = await import('@/lib/upload');
                  const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                  const uploadResult = await uploadFile(audioFile);
                  
                  // Create voice message attachment
                  const voiceAttachment = {
                    id: `voice-${Date.now()}`,
                    filename: `voice-${Date.now()}.webm`,
                    url: uploadResult.url,
                    type: 'audio' as const,
                    size: audioBlob.size,
                    originalName: `voice-${Date.now()}.webm`,
                    duration: 0
                  };

                  // Create optimistic message for voice
                  const optimisticMessage = {
                    id: `temp-voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    content: '🎤 Voice message',
                    type: 4, // Audio type
                    channelId: currentChannelId,
                    authorId: currentUser.id,
                    author: {
                      id: currentUser.id,
                      username: currentUser.username,
                      displayName: currentUser.displayName,
                      avatarUrl: currentUser.avatarUrl,
                      walletAddress: currentUser.walletAddress,
                      isVerified: currentUser.isVerified,
                      isAdmin: currentUser.isAdmin,
                      status: currentUser.status,
                      lastSeen: currentUser.lastSeen
                    },
                    sentAt: new Date().toISOString(),
                    attachments: [voiceAttachment],
                    repliedToMessageId: undefined,
                    reactions: [],
                    readReceipts: [],
                    isSystem: false,
                    isOptimistic: true
                  };

                  // Add optimistic message
                  addMessage(optimisticMessage);

                  // Send voice message via WebSocket
                  sendChatMessage(
                    currentChannelId,
                    '🎤 Voice message',
                    [voiceAttachment]
                  );

                  setShowVoiceRecorder(false);
                } catch (error) {
                  console.error('Error sending voice message:', error);
                } finally {
                  setIsSendingVoice(false);
                  setShowVoiceRecorder(false);
                }
              }}
              onCancel={() => setShowVoiceRecorder(false)}
              isSending={isSendingVoice}
            />
          </div>
        )}
      </AnimatePresence>

      {/* User Info Modal */}
      {showUserInfo && selectedUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-white border-2 border-black w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-3 sm:p-4 border-b-2 border-black bg-blue-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-black font-mono">USER INFO</h3>
                <button 
                  onClick={handleCloseUserInfo}
                  onMouseEnter={() => playHoverSound()}
                  className="text-black hover:text-red-600 p-1 border border-black bg-white hover:bg-red-200 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="text-center mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg sm:text-2xl font-bold mx-auto mb-3 sm:mb-4 overflow-hidden">
                  {selectedUser?.avatarUrl ? (
                    <img 
                      src={selectedUser.avatarUrl} 
                      alt={selectedUser.displayName || selectedUser.username} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    selectedUser?.displayName?.[0]?.toUpperCase() || 
                    selectedUser?.username?.[0]?.toUpperCase() || 
                    'U'
                  )}
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-black font-mono mb-2 break-words">
                  {selectedUser?.displayName || selectedUser?.username || 'Unknown User'}
                </h4>
                {selectedUser?.isVerified && (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border border-black"></div>
                    <span className="text-xs sm:text-sm text-green-600 font-mono font-bold">VERIFIED</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-blue-100 border-2 border-black p-3 sm:p-4">
                  <h5 className="font-bold text-black font-mono mb-2 text-xs sm:text-sm">USERNAME</h5>
                  <p className="text-black font-mono text-xs sm:text-sm break-words">{selectedUser?.username || 'Not set'}</p>
                </div>
                
                <div className="bg-blue-100 border-2 border-black p-3 sm:p-4">
                  <h5 className="font-bold text-black font-mono mb-2 text-xs sm:text-sm">DISPLAY NAME</h5>
                  <p className="text-black font-mono text-xs sm:text-sm break-words">{selectedUser?.displayName || 'Not set'}</p>
                </div>
                
                {selectedUser?.walletAddress && (
                  <div className="bg-blue-100 border-2 border-black p-3 sm:p-4">
                    <h5 className="font-bold text-black font-mono mb-2 text-xs sm:text-sm">WALLET ADDRESS</h5>
                    <p className="text-black font-mono text-xs break-all">{selectedUser.walletAddress}</p>
                  </div>
                )}
                
                <div className="bg-blue-100 border-2 border-black p-3 sm:p-4">
                  <h5 className="font-bold text-black font-mono mb-2 text-xs sm:text-sm">STATUS</h5>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 border border-black"></div>
                    <span className="text-black font-mono text-xs sm:text-sm">ONLINE</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 border-t-2 border-black bg-gray-100 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {selectedUser?.id !== currentUser?.id && (
                  <button
                    onClick={async () => {
                      try {
                        // Find existing DM channel with this user
                        const existingChannel = channels.find(channel => 
                          channel.type === 'dm' && 
                          channel.members?.some((member: any) => member.userId === selectedUser.id)
                        );
                        
                        if (existingChannel) {
                          // Open existing DM
                          handleChannelSelect(existingChannel.id);
                        } else {
                          // Create new DM channel
                          const { apiFetch } = await import('@/lib/api');
                          const response = await apiFetch('/chat/channels', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              type: 'dm',
                              name: `DM with ${selectedUser.displayName || selectedUser.username}`,
                              memberIds: [selectedUser.id]
                            })
                          });
                          
                          if (response.ok) {
                            const newChannel = await response.json();
                            handleChannelSelect(newChannel.id);
                          } else {
                            debug.error('Failed to create DM channel');
                          }
                        }
                        handleCloseUserInfo();
                      } catch (error) {
                        debug.error('Error starting DM:', error);
                      }
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors font-mono"
                  >
                    START DM
                  </button>
                )}
                <button
                  onClick={handleCloseUserInfo}
                  onMouseEnter={() => playHoverSound()}
                  className={`${selectedUser?.id !== currentUser?.id ? 'flex-1' : 'w-full'} bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors font-mono`}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Search Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div 
            className="bg-white border-2 border-black w-full max-w-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          >
            <div className="p-4 border-b-2 border-black bg-blue-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-black font-mono">NEW MESSAGE</h3>
                <button 
                  onClick={handleCloseNewMessage}
                  onMouseEnter={() => playHoverSound()}
                  className="text-black hover:text-red-600 p-1 border border-black bg-white hover:bg-red-200 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 border-b-2 border-black bg-blue-100 flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 SEARCH BY USERNAME..."
                  value={modalSearchQuery}
                  onChange={(e) => {
                    setModalSearchQuery(e.target.value);
                    searchModalUsers(e.target.value);
                  }}
                  className="w-full pl-8 pr-6 py-2 text-xs border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 placeholder-black font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isModalSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-black border-t-white animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-white">
              {modalSearchResults.length > 0 ? (
                <div className="space-y-2">
                  {modalSearchResults.map((user) => (
                     <button
                       key={user.id}
                       onClick={() => handleModalUserClick(user)}
                       disabled={isCreatingDM}
                       onMouseEnter={() => !isCreatingDM && playHoverSound()}
                       className="w-full p-3 text-left hover:bg-blue-200 active:bg-blue-300 transition-colors group border border-black disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                     >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 border-2 border-black flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                          {user.avatarUrl ? (
                            <img 
                              src={user.avatarUrl} 
                              alt={user.displayName || user.username || 'User'} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (user.displayName || user.username || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-black text-sm font-mono truncate">
                            {user.displayName || user.username || 'Unknown User'}
                          </div>
                          <div className="text-xs text-gray-600 font-mono truncate">
                            @{user.username || 'unknown'}
                          </div>
                        </div>
                         <div className="flex items-center gap-1">
                           {isCreatingDM ? (
                             <>
                               <div className="w-4 h-4 border-2 border-black border-t-white animate-spin"></div>
                               <span className="text-xs text-black font-mono">OPENING...</span>
                             </>
                           ) : (
                             <>
                               <div className="w-2 h-2 bg-green-500 border border-black"></div>
                               <span className="text-xs text-black font-mono">ONLINE</span>
                             </>
                           )}
                         </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : modalSearchQuery.trim() ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 font-mono text-sm">No users found</div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 font-mono text-sm">Search for users to start a conversation</div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isVisible={showCreateRoomModal}
        onClose={() => setShowCreateRoomModal(false)}
        onRoomCreated={(room) => {
          // Add the new room channel to the channels list
          if (room.channelId) {
            const newChannel = {
              id: room.channelId,
              name: room.name,
              type: 'text-group' as const,
              createdBy: room.createdBy,
              createdAt: room.createdAt,
              updatedAt: room.createdAt,
              isPrivate: room.privacy === 0,
              lastMessageId: null,
              topic: room.description || null,
              roomId: room.id,
              room: room.room, // Include room member data
              members: [],
              _count: {
                members: 1
              }
            };
            addChannel(newChannel);
            // Switch to the new room channel
            handleChannelSelect(room.channelId);
          }
        }}
      />

      {/* Room Search Modal */}
      <RoomSearchModal
        isVisible={showRoomSearchModal}
        onClose={() => setShowRoomSearchModal(false)}
        onJoinRoom={(room) => {
          // Add the joined room channel to the channels list
          if (room.channelId) {
            const newChannel = {
              id: room.channelId,
              name: room.name,
              type: 'text-group' as const,
              createdBy: room.createdBy,
              createdAt: room.createdAt,
              updatedAt: room.createdAt,
              isPrivate: room.privacy === 0,
              lastMessageId: null,
              topic: room.description || null,
              members: [],
              _count: {
                members: room._count?.members || 1
              }
            };
            addChannel(newChannel);
            // Switch to the new channel
            handleChannelSelect(room.channelId);
          }
        }}
      />
    </>
  );
}

export default function ChatWidget(props: ChatWidgetProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatWidgetContent {...props} />
    </QueryClientProvider>
  );
}