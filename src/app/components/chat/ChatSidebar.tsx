'use client';

import React, { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket, useChatEvents, SERVER_EVENTS } from '@/contexts/WebSocketContext';
import { CLIENT_EVENTS } from '@/types/events';
import { useLisaSounds } from '@/lib/lisaSounds';
import { Channel } from '@/stores/chatStore';
import { getRoleName, getRoleColor, getRoleIcon } from '@/lib/roleUtils';
import RoomInviteModal from './RoomInviteModal';
import JoinRoomModal from './JoinRoomModal';
import ProfileCard from './ProfileCard';
import { useToast } from '@/components/Toast';
import { toast } from 'react-hot-toast';
import debug from '@/lib/debug';
// Removed authService dependency - using chatStore directly

interface ChatSidebarProps {
  onChannelSelect: (channelId: string) => void;
  currentChannelId?: string | null;
  onCreateRoom?: () => void;
  onSearchRooms?: () => void;
}

export default function ChatSidebar({ onChannelSelect, currentChannelId, onCreateRoom, onSearchRooms }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSearchResults, setModalSearchResults] = useState<any[]>([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  const [isCreatingDM, setIsCreatingDM] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedRoomName, setSelectedRoomName] = useState<string>('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomData, setJoinRoomData] = useState<{id: string, name: string} | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { playHoverSound } = useLisaSounds();
  const { showToast } = useToast();
  
  const { 
    channels, 
    setChannels, 
    addChannel, 
    updateChannel, 
    removeChannel,
    setCurrentChannel,
    currentUser
  } = useChatStore();
  
  // Use only chatStore user data (WebSocket handles authentication)
  const currentUserData = currentUser;
  
  const { joinChannel, leaveChannel } = useChatEvents();
  const { on, off, isConnected, sendMessage } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  
  debug.log('🔍 [DEBUG] Current user from chatStore:', currentUser);
  debug.log('🔍 [DEBUG] Using user:', currentUserData);
  debug.log('🔍 [DEBUG] WebSocket connection state:', { isConnected });
  debug.log('🔍 [DEBUG] Channels state:', { channelsLength: channels.length, isLoading });
  debug.log('🔌 [DEBUG] WebSocket context values:', {
    on: typeof on,
    off: typeof off,
    isConnected
  });

  // Load cache and channels when user changes (non-blocking)
  useEffect(() => {
    if (currentUserData) {
      // Load channels from localStorage first (immediate persistence)
      const channelsKey = `channels_data_${currentUserData.id}`;
      const channelsData = localStorage.getItem(channelsKey);
      if (channelsData) {
        try {
          const parsedChannels = JSON.parse(channelsData);
          if (Array.isArray(parsedChannels) && parsedChannels.length > 0) {
            debug.log('⚡ [CACHE] Loading channels from localStorage:', parsedChannels.length, 'channels');
            setChannels(parsedChannels);
            setIsLoading(false);
          }
        } catch (error) {
          debug.warn('⚠️ [CACHE] Failed to parse channels from localStorage:', error);
        }
      }
    }
  }, [currentUserData?.id, setChannels]);

  // Channel fetching is now handled by WebSocket context on auth completion
  // This useEffect is removed to prevent duplicate fetching

  // Handle channels loaded event
  useEffect(() => {
    debug.log('🔧 [CHANNELS] Registering channels loaded event handler');
    
    const handleChannelsLoaded = (payload: any) => {
      const responseTime = Date.now();
      debug.log('🔍 [CHANNELS] Channels loaded via WebSocket:', payload);
      debug.log('⏱️ [CHANNELS] Response received at:', new Date(responseTime).toISOString());
      
      if (payload.channels) {
        debug.log('✅ [CHANNELS] Setting channels in store:', payload.channels.length, 'channels');
        debug.log('📊 [CHANNELS] Channel IDs:', payload.channels.map((c: any) => c.id));
        debug.log('🔍 [DEBUG] Channel details from server:', payload.channels.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          isPrivate: c.isPrivate,
          roomId: c.roomId,
          hasRoom: !!c.room,
          roomMembers: c.room?.members?.length || 0,
          roomMemberRoles: c.room?.members?.map((m: any) => ({ userId: m.userId, role: m.role })) || []
        })));
        
        // Save channels to localStorage immediately for persistence
        if (currentUserData) {
          const channelsKey = `channels_data_${currentUserData.id}`;
          try {
            localStorage.setItem(channelsKey, JSON.stringify(payload.channels));
            debug.log('💾 [CACHE] Saved channels to localStorage for persistence');
          } catch (error) {
            debug.warn('⚠️ [CACHE] Failed to save channels to localStorage:', error);
          }
        }
        
        setChannels(payload.channels);
        setIsLoading(false);
        debug.log('🎉 [CHANNELS] Channel loading completed successfully!');
      } else {
        debug.warn('⚠️ [CHANNELS] No channels in payload:', payload);
      }
    };

    const handleError = (payload: any) => {
      debug.error('❌ [CHANNELS] Error:', payload);
      
      // Handle invite code errors (these are now handled in JoinRoomModal)
      if (payload.type === 'INVALID_INVITE_CODE' || payload.message?.includes('invite')) {
        showToast({
          type: 'error',
          title: 'Invalid invite code',
          message: 'Please check and try again.'
        });
        return;
      }
      
      // Handle other errors
      setIsLoading(false);
    };

    // Handle real-time channel updates
    const handleChannelCreated = (payload: any) => {
      debug.log('🆕 [CHANNELS] New channel created:', payload);
      if (payload.channel) {
        // Add the new channel to the existing channels
        const updatedChannels: Channel[] = [...channels, payload.channel];
        
        // Update localStorage with new channels
        if (currentUserData) {
          const channelsKey = `channels_data_${currentUserData.id}`;
          try {
            localStorage.setItem(channelsKey, JSON.stringify(updatedChannels));
            debug.log('💾 [CACHE] Updated localStorage with new channel');
          } catch (error) {
            debug.warn('⚠️ [CACHE] Failed to update localStorage with new channel:', error);
          }
        }
        
        setChannels(updatedChannels);
      }
    };

    const handleChannelUpdated = (payload: any) => {
      debug.log('🔄 [CHANNELS] Channel updated:', payload);
      if (payload.channel) {
        // Update the existing channel
        const updatedChannels: Channel[] = channels.map((channel: Channel) => 
          channel.id === payload.channel.id ? payload.channel : channel
        );
        
        // Update localStorage with updated channels
        if (currentUserData) {
          const channelsKey = `channels_data_${currentUserData.id}`;
          try {
            localStorage.setItem(channelsKey, JSON.stringify(updatedChannels));
            debug.log('💾 [CACHE] Updated localStorage with channel update');
          } catch (error) {
            debug.warn('⚠️ [CACHE] Failed to update localStorage with channel update:', error);
          }
        }
        
        setChannels(updatedChannels);
      }
    };

    const handleChannelDeleted = (payload: any) => {
      debug.log('🗑️ [CHANNELS] Channel deleted:', payload);
      if (payload.channelId) {
        // Remove the channel from the list
        const updatedChannels: Channel[] = channels.filter((channel: Channel) => channel.id !== payload.channelId);
        
        // Update localStorage with updated channels
        if (currentUserData) {
          const channelsKey = `channels_data_${currentUserData.id}`;
          try {
            localStorage.setItem(channelsKey, JSON.stringify(updatedChannels));
            debug.log('💾 [CACHE] Updated localStorage after channel deletion');
          } catch (error) {
            debug.warn('⚠️ [CACHE] Failed to update localStorage after channel deletion:', error);
          }
        }
        
        setChannels(updatedChannels);
      }
    };

    // Handle DM invitations
    const handleNewDMInvite = (payload: any) => {
      debug.log('💌 [CHANNELS] New DM invitation:', payload);
      if (payload.channel) {
        // Add the new DM channel to the existing channels
        const updatedChannels: Channel[] = [...channels, payload.channel];
        
        // Update localStorage with new DM channel
        if (currentUserData) {
          const channelsKey = `channels_data_${currentUserData.id}`;
          try {
            localStorage.setItem(channelsKey, JSON.stringify(updatedChannels));
            debug.log('💾 [CACHE] Updated localStorage with new DM channel');
          } catch (error) {
            debug.warn('⚠️ [CACHE] Failed to update localStorage with new DM channel:', error);
          }
        }
        
        setChannels(updatedChannels);
      }
    };

    // Handle user join/leave events that might affect channel membership
    const handleUserJoined = (payload: any) => {
      debug.log('👤 [CHANNELS] User joined channel:', payload);
      // If the current user joined a channel, refresh the channel list
      if (payload.userId === currentUserData?.id && payload.channelId) {
        debug.log('🔄 [CHANNELS] Current user joined channel, refreshing channel list');
        // Small delay to ensure the server has processed the join
        setTimeout(() => {
          if (isConnected) {
            // Channels will be automatically updated via WebSocket events
            debug.log('🔄 [CHANNELS] User joined, channels will be updated via WebSocket events');
          }
        }, 1000);
      }
    };

    const handleUserLeft = (payload: any) => {
      debug.log('👤 [CHANNELS] User left channel:', payload);
      // If the current user left a channel, refresh the channel list
      if (payload.userId === currentUserData?.id && payload.channelId) {
        debug.log('🔄 [CHANNELS] Current user left channel, refreshing channel list');
        // Small delay to ensure the server has processed the leave
        setTimeout(() => {
          if (isConnected) {
            // Channels will be automatically updated via WebSocket events
            debug.log('🔄 [CHANNELS] User left, channels will be updated via WebSocket events');
          }
        }, 1000);
      }
    };

    debug.log('🔗 [CHANNELS] Registering WebSocket event handlers');
    on(SERVER_EVENTS.CHANNELS_LOADED, handleChannelsLoaded);
    on(SERVER_EVENTS.CHANNEL_CREATED, handleChannelCreated);
    on(SERVER_EVENTS.NEW_DM_INVITE, handleNewDMInvite);
    on(SERVER_EVENTS.USER_JOINED, handleUserJoined);
    on(SERVER_EVENTS.USER_LEFT, handleUserLeft);
    on(SERVER_EVENTS.ERROR, handleError);
    on(SERVER_EVENTS.ROOMS_SEARCH_RESPONSE, handleRoomsSearchResponse);

    return () => {
      debug.log('🔗 [CHANNELS] Unregistering WebSocket event handlers');
      off(SERVER_EVENTS.CHANNELS_LOADED, handleChannelsLoaded);
      off(SERVER_EVENTS.CHANNEL_CREATED, handleChannelCreated);
      off(SERVER_EVENTS.NEW_DM_INVITE, handleNewDMInvite);
      off(SERVER_EVENTS.USER_JOINED, handleUserJoined);
      off(SERVER_EVENTS.USER_LEFT, handleUserLeft);
      off(SERVER_EVENTS.ERROR, handleError);
      off(SERVER_EVENTS.ROOMS_SEARCH_RESPONSE, handleRoomsSearchResponse);
    };
  }, [on, off, setChannels, currentUserData]);

  // Refresh current user data by reloading the page
  const refreshCurrentUser = async () => {
    try {
      debug.log('🔄 [USER REFRESH] Refreshing current user data...');
      // Clear cache and reload page
      const { useChatStore } = await import('@/stores/chatStore');
      const { clearUserCache } = useChatStore.getState();
      clearUserCache();
      localStorage.clear();
      window.location.reload();
    } catch (error) {
      debug.error('❌ [USER REFRESH] Failed to refresh user data:', error);
    }
  };

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

  // Get the appropriate display name for a channel
  const getChannelDisplayName = (channel: any) => {
    if (channel.type === 'dm') {
      const otherUser = getOtherUser(channel);
      if (otherUser) {
        return otherUser.displayName || otherUser.username || 'Unknown User';
      }
      return 'Unknown User';
    }
    
    // For regular channels, use the channel name
    return channel.name || 'Channel';
  };

  // Handle search response from server
  const handleRoomsSearchResponse = (payload: any) => {
    debug.log('✅ [ChatSidebar] Search response:', payload);
    debug.log('🔍 [ChatSidebar] Rooms received:', payload.rooms?.length || 0, payload.rooms?.map((r: any) => ({ name: r.name, privacy: r.privacy })));
    debug.log('🔍 [ChatSidebar] Users received:', payload.users?.length || 0);
    
    // Combine rooms and users into search results
    const combinedResults = [
      ...(payload.rooms || []).map((room: any) => ({ 
        ...room, 
        searchType: 'room',
        type: 'text-group',
        isPrivate: room.privacy === 0,
        createdByUser: room.createdByUser
      })),
      ...(payload.users || []).map((user: any) => ({ 
        ...user, 
        searchType: 'user' 
      }))
    ];
    
    debug.log('🔍 [ChatSidebar] Combined search results:', combinedResults.length);
    setSearchResults(combinedResults);
    setIsSearching(false);
  };

  // Handle room selection from search results
  const handleRoomSelect = (room: any) => {
    debug.log('🔍 [ChatSidebar] Room selected:', room);
    
    if (room.privacy === 0) {
      // Private room - show invite code modal
      setJoinRoomData({ id: room.id, name: room.name });
      setShowJoinModal(true);
    } else {
      // Public room - join directly
      sendMessage(CLIENT_EVENTS.JOIN_ROOM, {
        roomId: room.id
      });
      // Clear search
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // Handle user selection from search results
  const handleUserSelect = (user: any) => {
    debug.log('🔍 [ChatSidebar] User selected:', user);
    
    // Show ProfileCard for the selected user
    setSelectedUser(user);
    setShowProfileCard(true);
  };

  // Handle closing join modal
  const handleCloseJoinModal = () => {
    setShowJoinModal(false);
    setJoinRoomData(null);
    // Clear search when modal closes
    setSearchQuery('');
    setSearchResults([]);
  };

  // Handle room joined successfully
  const handleRoomJoined = (channelId: string) => {
    debug.log('🔍 [ChatSidebar] Room joined, navigating to channel:', channelId);
    // Navigate to the joined room
    onChannelSelect(channelId);
  };

  // Search both users and channels
  const searchAll = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    debug.log('🔍 [ChatSidebar] Starting search with query:', query);
    debug.log('🔍 [ChatSidebar] Sending WebSocket message:', CLIENT_EVENTS.SEARCH_ROOMS);
    setIsSearching(true);
    
    try {
      // Use WebSocket search instead of local filtering
      // This will search both rooms and users via the server
      sendMessage(CLIENT_EVENTS.SEARCH_ROOMS, {
        query: query.trim()
      });
      debug.log('🔍 [ChatSidebar] WebSocket message sent successfully');
    } catch (error) {
      debug.error('❌ [ChatSidebar] Error searching:', error);
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  // Modal search users function
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
      
      // Filter out current user from search results
      debug.log('🔍 [MODAL DEBUG] Current user ID:', currentUserData?.id);
      debug.log('🔍 [MODAL DEBUG] Users before filtering:', users.map((u: any) => ({ id: u.id, username: u.username })));
      const filteredUsers = users.filter((user: any) => {
        // Only filter if currentUser exists and has an ID
        if (!currentUserData?.id) {
          debug.log('🔍 [MODAL DEBUG] No current user, showing all users');
          return true;
        }
        
        const isCurrentUser = user.id === currentUserData.id || 
                             user.walletAddress === currentUserData.walletAddress ||
                             user.username === currentUserData.username;
        debug.log('🔍 [MODAL DEBUG] Checking user:', { 
          userId: user.id, 
          currentUserId: currentUserData.id,
          userWallet: user.walletAddress,
          currentWallet: currentUserData.walletAddress,
          isCurrentUser 
        });
        return !isCurrentUser;
      });
      debug.log('🔍 [MODAL DEBUG] Users after filtering:', filteredUsers.map((u: any) => ({ id: u.id, username: u.username })));
      setModalSearchResults(filteredUsers);
    } catch (error) {

      setModalSearchResults([]);
    } finally {
      setIsModalSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAll(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, channels]);

  // Debounced modal search
  useEffect(() => {
    if (showUserSearch) {
      const timer = setTimeout(() => {
        searchModalUsers(modalSearchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [modalSearchQuery, showUserSearch]);

  // WebSocket event handlers
  useEffect(() => {
    const handleChannelCreated = (payload: any) => {
      addChannel(payload.channel);
    };

    const handleUserJoined = (payload: any) => {
      updateChannel(payload.channelId, {
        _count: {
          members: (channels.find(c => c.id === payload.channelId)?._count.members || 0) + 1
        }
      });
    };

    const handleUserLeft = (payload: any) => {
      updateChannel(payload.channelId, {
        _count: {
          members: Math.max(0, (channels.find(c => c.id === payload.channelId)?._count.members || 1) - 1)
        }
      });
    };

    on(SERVER_EVENTS.CHANNEL_CREATED, handleChannelCreated);
    on(SERVER_EVENTS.USER_JOINED, handleUserJoined);
    on(SERVER_EVENTS.USER_LEFT, handleUserLeft);

    return () => {
      off(SERVER_EVENTS.CHANNEL_CREATED, handleChannelCreated);
      off(SERVER_EVENTS.USER_JOINED, handleUserJoined);
      off(SERVER_EVENTS.USER_LEFT, handleUserLeft);
    };
  }, [channels, addChannel, updateChannel, on, off]);

  const handleChannelClick = async (channelId: string) => {
    debug.log('🖱️ [ChatSidebar] Channel clicked:', channelId);
    
    // Prevent clicking on the currently selected channel
    if (currentChannelId === channelId) {
      debug.log('🚫 [ChatSidebar] Channel already selected, ignoring click');
      return;
    }
    
    const channel = channels.find(c => c.id === channelId);
    
    // If it's a text-group channel (room) and user is not a member, join the room first
    if (channel?.type === 'text-group') {
      const isMember = channel.members?.some((member: any) => member.userId === currentUserData?.id);
      
      if (!isMember) {
        // User is not a member, need to join the room
        // For public rooms, join automatically
        // For private rooms, this should not happen as they shouldn't be visible
        if (!channel.isPrivate) {
          debug.log('🏠 [ChatSidebar] Joining room:', channel.roomId);
          sendMessage(CLIENT_EVENTS.JOIN_ROOM, { roomId: channel.roomId });
        }
      }
    }

    // Only trigger channel selection, don't join here (ChatWidget will handle joining)
    debug.log('🔄 [ChatSidebar] Triggering channel selection:', channelId);
    onChannelSelect(channelId);
  };

  const handleUserClick = async (user: any) => {
    debug.log('🖱️ [DM] User clicked:', user);
    
    // Validate current user data first
    if (!validateCurrentUser()) {
      debug.error('❌ [DM] Cannot create DM - current user data invalid');
      toast.error('User data invalid, refreshing...');
      await refreshCurrentUser();
      return;
    }
    
    // Don't allow messaging yourself
    if (user.id === currentUserData?.id) {
      debug.log('🚫 [DM] Cannot message yourself');
      toast.error('Cannot message yourself');
      return;
    }

    // Prevent multiple clicks while creating DM
    if (isCreatingDM) {
      debug.log('⏳ [DM] Already creating DM, ignoring click');
      return;
    }

    setIsCreatingDM(true);
    
    try {
      debug.log('💬 [DM] Creating DM with user:', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        fullUserObject: user
      });

      // First check if DM already exists locally for instant response
      const existingChannel = channels.find(channel => 
        channel.type === 'dm' && 
        channel.members?.some((member: any) => member.userId === user.id)
      );

      if (existingChannel) {
        debug.log('💬 [DM] Found existing DM channel, switching immediately');
        
        // Prevent clicking on the currently selected DM
        if (currentChannelId === existingChannel.id) {
          debug.log('🚫 [DM] DM already selected, ignoring click');
          setShowUserSearch(false);
          setModalSearchQuery('');
          setModalSearchResults([]);
          return;
        }
        
        setCurrentChannel(existingChannel.id);
        onChannelSelect(existingChannel.id);
        setShowUserSearch(false);
        setModalSearchQuery('');
        setModalSearchResults([]);
        return;
      }

      // Create or find DM channel with this user via Express backend
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
        debug.log('💬 [DM] DM channel created/found:', data.channel);
        debug.log('💬 [DM] Channel members:', data.channel.members?.map((m: any) => ({
          userId: m.userId,
          username: m.user?.username,
          displayName: m.user?.displayName
        })));
        debug.log('💬 [DM] Current user ID:', currentUserData?.id);
        
        // Add the channel to the store if it doesn't exist
        const existingChannel = channels.find(c => c.id === data.channel.id);
        if (!existingChannel) {
          debug.log('💬 [DM] Adding new channel to store:', data.channel);
          addChannel(data.channel);
        } else {
          debug.log('💬 [DM] Channel already exists in store:', data.channel.id);
        }
        
        // Set as current channel and select it
        debug.log('💬 [DM] Setting current channel and selecting:', data.channel.id);
        setCurrentChannel(data.channel.id);
        onChannelSelect(data.channel.id);
        setShowUserSearch(false);
        setModalSearchQuery('');
        setModalSearchResults([]);
        debug.log('💬 [DM] DM setup complete');
      } else {
        const errorData = await response.json();
        debug.log('❌ [DM] DM creation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        if (errorData.error === 'DUPLICATE_DM') {
          debug.log('💬 [DM] Duplicate DM detected, finding existing channel');
          // DM already exists, find and switch to it
          const duplicateChannel = channels.find(channel => 
            channel.type === 'dm' && 
            channel.members?.some((member: any) => member.userId === user.id)
          );
          if (duplicateChannel) {
            debug.log('💬 [DM] Found duplicate channel, switching to it:', duplicateChannel.id);
            setCurrentChannel(duplicateChannel.id);
            onChannelSelect(duplicateChannel.id);
            setShowUserSearch(false);
            setModalSearchQuery('');
            setModalSearchResults([]);
          } else {
            debug.log('❌ [DM] Duplicate DM detected but channel not found in local store');
          }
        } else {
          debug.error('❌ [DM] Failed to create DM channel:', response.status, response.statusText);
          debug.error('❌ [DM] Error details:', errorData);
        }
      }
    } catch (error) {
      debug.error('❌ [DM] Error creating DM channel:', error);
    } finally {
      setIsCreatingDM(false);
    }
  };

  const handleModalUserClick = async (user: any) => {
    await handleUserClick(user);
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

  // Get all items to display (channels when no search, search results when searching)
  const allItems = searchQuery.trim()
    ? searchResults 
    : channels.map((channel: any) => ({ ...channel, searchType: 'channel' }));

  debug.log('🔍 [UI DEBUG] All items to render:', {
    searchQuery: searchQuery.trim(),
    searchResultsCount: searchResults.length,
    allItemsCount: allItems.length,
    allItems: allItems.map(item => ({
      id: item.id,
      searchType: item.searchType,
      username: item.username,
      name: item.name
    }))
  });

  // Debug: Log channels for debugging
  debug.log('🔍 [DEBUG] Channels in frontend:', channels.length);
  debug.log('🔍 [DEBUG] Channel details:', channels.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    isPrivate: c.isPrivate,
    roomId: c.roomId
  })));



  
  return (
    <div className="h-full flex flex-col bg-blue-100 border-r-2 border-black min-w-0 w-full max-w-full overflow-hidden chat-sidebar">
      {/* Header */}
      {/* <div className="p-3 border-b-2 border-black bg-blue-200">
        <h2 className="text-base font-bold text-black font-mono mb-1">MESSAGES</h2>
        <p className="text-xs text-black font-mono">CHANNELS & DIRECT MESSAGES</p>
      </div> */}

      {/* Search */}
      <div className="p-2 sm:p-3 border-b-2 border-black bg-blue-100 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 SEARCH CHANNELS & PEOPLE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-6 py-2 text-xs border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 placeholder-black font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-black border-t-white animate-spin"></div>
            </div>
          )}
        </div>
      </div>


      {/* Content - Unified View with proper height calculation and smooth scrolling */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full" style={{ 
        maxHeight: 'calc(95vh - 180px)',
        minHeight: '200px',
        scrollBehavior: 'smooth',
        scrollbarWidth: 'thin',
        scrollbarColor: '#3b82f6 #dbeafe'
      }}>
        {isLoading && !searchQuery.trim() ? (
          <div className="p-4 text-center">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-sm mt-2 text-gray-500">Loading...</p>
          </div>
        ) : allItems.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="w-16 h-6 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1">
              {searchQuery.trim() ? 'No results found' : 'No channels available'}
            </p>
            <p className="text-xs">
              {searchQuery.trim() ? 'Try a different search term' : 'Create a channel or search for people to start chatting'}
            </p>
          </div>
        ) : (
          <div className="py-2 pb-4 space-y-1 px-1">
            {allItems.map((item) => {
              if (item.searchType === 'room') {
                // Search result room - handle room selection
                return (
                  <div
                    key={`room-${item.id}`}
                    onClick={() => handleRoomSelect(item)}
                    className="w-full p-2 text-left hover:bg-blue-200 active:bg-blue-300 transition-all duration-200 group relative border-b border-black bg-white cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold bg-white text-black group-hover:bg-blue-200 group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        👥
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <h4 className="font-bold text-xs truncate transition-colors font-mono text-black group-hover:text-blue-800">
                            {item.name}
                          </h4>
                          <span className={`text-xs px-1 py-0.5 font-mono font-bold border border-black ${
                            item.privacy === 0 
                              ? 'bg-red-500 text-white' 
                              : 'bg-green-500 text-black'
                          }`}>
                            {item.privacy === 0 ? 'PRIVATE' : 'PUBLIC'}
                          </span>
                          {item.createdByUser && (
                            <span className="text-xs text-gray-600 group-hover:text-blue-500 font-mono">
                              by {item.createdByUser.displayName || item.createdByUser.username || 'Unknown'}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs truncate mb-2 font-mono text-black group-hover:text-blue-600">
                            {item.description}
                          </p>
                        )}
                        <div className="text-xs text-gray-500 font-mono">
                          {item.privacy === 0 ? 'Click to join with invite code' : 'Click to join'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else if (item.searchType === 'user') {
                // Search result user - handle user selection
                return (
                  <div
                    key={`user-${item.id}`}
                    onClick={() => handleUserSelect(item)}
                    className="w-full p-2 text-left hover:bg-blue-200 active:bg-blue-300 transition-all duration-200 group relative border-b border-black bg-white cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold bg-white text-black group-hover:bg-blue-200 group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {item.avatarUrl ? (
                          <img 
                            src={item.avatarUrl} 
                            alt={item.displayName || item.username}
                            className="w-full h-full rounded-2xl object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <h4 className="font-bold text-xs truncate transition-colors font-mono text-black group-hover:text-blue-800">
                            {item.displayName || item.username}
                          </h4>
                          <span className="text-xs px-1 py-0.5 bg-blue-300 text-black font-mono font-bold border border-black">
                            USER
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          Click to start DM
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else if (item.searchType === 'channel') {
                // Regular channel - existing logic
                return (
                        <button
                          key={`channel-${item.id}`}
                          onClick={() => handleChannelClick(item.id)}
                          className={`w-full p-2 text-left transition-all duration-200 group relative border-b border-black ${
                            currentChannelId === item.id 
                              ? 'bg-blue-200 border-r-4 border-black cursor-default' 
                              : 'bg-white hover:bg-blue-200 active:bg-blue-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                              currentChannelId === item.id 
                                ? 'bg-blue-500 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] scale-105' 
                                : 'bg-white text-black group-hover:bg-blue-200 group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            }`}>
                        {item.type === 'dm' ? (
                          (() => {
                            const otherUser = getOtherUser(item);
                            return otherUser?.avatarUrl ? (
                              <img 
                                src={otherUser.avatarUrl} 
                                alt={otherUser.displayName || otherUser.username}
                                className="w-full h-full rounded-2xl object-cover"
                              />
                            ) : (
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                              </svg>
                            );
                          })()
                        ) : item.type === 'text-group' ? '👥' : '#'}
                      </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                <h4 className={`font-bold text-xs truncate transition-colors font-mono ${
                                  currentChannelId === item.id ? 'text-blue-900' : 'text-black group-hover:text-blue-800'
                                }`}>
                                  {getChannelDisplayName(item)}
                                </h4>
                                {item.type !== 'dm' && (
                                  <span className="text-xs px-1 py-0.5 bg-blue-300 text-black font-mono font-bold border border-black">
                                    CH
                                  </span>
                                )}
                                {item.type === 'text-group' && (
                                  <span className={`text-xs px-1 py-0.5 font-mono font-bold border border-black ${
                                    item.isPrivate 
                                      ? 'bg-red-500 text-white' 
                                      : 'bg-green-500 text-black'
                                  }`}>
                                    {item.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                                  </span>
                                )}
                                {item.type === 'text-group' && (item.isPrivate || item.privacy === 0) && (() => {
                                  // Check if current user is the room owner
                                  debug.log('🔍 [INVITE] Checking ownership for channel:', item.name);
                                  debug.log('🔍 [INVITE] Channel data:', {
                                    id: item.id,
                                    name: item.name,
                                    isPrivate: item.isPrivate,
                                    privacy: item.privacy,
                                    roomId: item.roomId,
                                    room: item.room,
                                    currentUserId: currentUserData?.id
                                  });
                                  
                                  // Handle both data structures: search results vs channel list
                                  const userRoomMember = item.room?.members?.find((member: any) => member.userId === currentUserData?.id);
                                  debug.log('🔍 [INVITE] User room member found:', userRoomMember);
                                  
                                  // For search results, check if current user is the creator
                                  const isCreator = item.createdBy === currentUserData?.id;
                                  const isOwner = userRoomMember?.role === 'OWNER' || isCreator;
                                  debug.log('🔍 [INVITE] Is creator:', isCreator, 'Is owner:', isOwner);
                                  
                                  return isOwner ? (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        debug.log('🔍 [INVITE] Opening invite modal for room:', item.roomId || item.id, 'name:', item.name);
                                        setSelectedRoomId(item.roomId || item.id || '');
                                        setSelectedRoomName(item.name || '');
                                        setShowInviteModal(true);
                                      }}
                                      className="text-xs px-1 py-0.5 bg-blue-500 text-white font-mono font-bold border border-black hover:bg-blue-600 transition-colors cursor-pointer"
                                      title="Create invite"
                                    >
                                      INVITE
                                    </div>
                                  ) : null;
                                })()}
                                {item._count?.messages > 0 && (
                                  <span className={`text-xs px-1 py-0.5 font-semibold font-mono border border-black ${
                                    currentChannelId === item.id
                                      ? 'bg-blue-200 text-black'
                                      : 'bg-white text-black group-hover:bg-blue-100'
                                  }`}>
                                    {item._count.messages}
                                  </span>
                                )}
                              </div>
                        {item.topic && (
                          <p className={`text-xs truncate mb-2 font-mono ${
                            currentChannelId === item.id ? 'text-blue-700' : 'text-black group-hover:text-blue-600'
                          }`}>
                            {item.topic}
                          </p>
                        )}
                        {item.type === 'text-group' && item.createdByUser && (
                          <div className={`text-xs font-mono mb-1 ${
                            currentChannelId === item.id ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-500'
                          }`}>
                            by {item.createdByUser.displayName || item.createdByUser.username || 'Unknown'}
                          </div>
                        )}
                              <div className="flex items-center justify-between">
                                {item.type !== 'dm' && (
                                  <span className={`text-xs font-medium flex items-center gap-1 font-mono ${
                                    currentChannelId === item.id ? 'text-blue-600' : 'text-black group-hover:text-blue-500'
                                  }`}>
                                    <span className="w-1.5 h-1.5 bg-green-500 border border-black"></span>
                                    {item.members?.length || 0}M
                                  </span>
                                )}
                                {item.updatedAt && (
                                  <span className={`text-xs font-mono ${
                                    currentChannelId === item.id ? 'text-blue-600' : 'text-black group-hover:text-blue-500'
                                  }`}>
                                    {new Date(item.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                      </div>
                    </div>
                    {currentChannelId === item.id && (
                      <div className="absolute inset-0 rounded-lg ring-2 ring-blue-500/20 pointer-events-none"></div>
                    )}
                  </button>
                );
              } else {
                // User item - don't show current user (only if currentUser exists)
                if (currentUserData?.id) {
                  const isCurrentUser = item.id === currentUserData.id || 
                                       (item.walletAddress && item.walletAddress === currentUserData.walletAddress) ||
                                       item.username === currentUserData.username;
                  if (isCurrentUser) {
                    debug.log('🔍 [UI DEBUG] Hiding current user from UI:', { 
                      itemId: item.id, 
                      currentUserId: currentUserData.id,
                      itemWallet: item.walletAddress,
                      currentWallet: currentUserData.walletAddress,
                      itemUsername: item.username,
                      currentUsername: currentUserData.username
                    });
                    return null;
                  }
                }
                
                debug.log('🔍 [UI DEBUG] Rendering user card for:', {
                  id: item.id,
                  username: item.username,
                  displayName: item.displayName
                });
                
                return (
                  <div key={`user-${item.id}`} className="mx-2 mb-2">
                    <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg p-4 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-500 border-2 border-black flex items-center justify-center text-white font-bold text-lg rounded-full">
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt={item.username} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            item.username?.[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-black">
                            {item.displayName || item.username || 'Unknown User'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            @{item.username || 'unknown'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full font-bold text-white ${getRoleColor(item.role || 1) === '#ff6b6b' ? 'bg-red-500' : getRoleColor(item.role || 1) === '#96ceb4' ? 'bg-green-500' : getRoleColor(item.role || 1) === '#45b7d1' ? 'bg-blue-500' : 'bg-teal-500'}`}>
                              {getRoleIcon(item.role || 1)} {getRoleName(item.role || 1).toUpperCase()}
                            </span>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-gray-500">Online</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            debug.log('💬 [UserCard] Message clicked for user:', item);
                            handleUserClick(item);
                          }}
                          disabled={isCreatingDM}
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCreatingDM ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                              <span>Creating DM...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span>Message</span>
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* Footer - Fixed positioning to ensure Create Room button is always visible */}
      <div className="p-2 sm:p-3 border-t-2 border-black bg-blue-200 space-y-2 flex-shrink-0 relative z-10">
        {/* Room Actions */}
        <div className="flex space-x-1 sm:space-x-2">
          <button 
            onClick={() => {
              debug.log('🏠 [ChatSidebar] Create Room button clicked!');
              if (onCreateRoom) {
                onCreateRoom();
              } else {
                debug.warn('⚠️ [ChatSidebar] onCreateRoom function not provided');
              }
            }}
            onMouseEnter={() => playHoverSound()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm min-h-[44px] relative z-20"
            style={{ 
              minHeight: '44px',
              backgroundColor: '#3b82f6',
              border: '2px solid #000',
              boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)'
            }}
          >
            <span className="font-mono font-bold">🏠 CREATE ROOM</span>
          </button>
        </div>
        
        
        {/* New Message Button */}
        {/* <button 
          onClick={handleOpenNewMessage}
          onMouseEnter={() => playHoverSound()}
          className="lisa-button w-full flex items-center justify-center gap-2 text-sm"
        >
          <div className="w-4 h-4 bg-white/20 flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          💬 NEW MESSAGE
        </button> */}
      </div>

      {/* New Message Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[80vh] flex flex-col">
            <div className="p-4 border-b-2 border-black bg-blue-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-black font-mono">NEW MESSAGE</h3>
                <button 
                  onClick={handleCloseNewMessage}
                  className="text-black hover:text-red-600 p-1 border border-black bg-white hover:bg-red-200 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 min-h-0">
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="SEARCH BY USERNAME..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && modalSearchQuery.trim()) {
                        searchModalUsers(modalSearchQuery);
                      }
                    }}
                    className="w-full px-4 py-2 pr-8 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    autoFocus
                  />
                  {isModalSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-black border-t-white animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {modalSearchQuery.trim() === '' ? (
                  <div className="text-center py-8 text-black">
                    <div className="w-16 h-16 bg-blue-200 border-2 border-black flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-mono font-bold mb-2">START TYPING TO SEARCH</p>
                    <p className="text-xs font-mono">FIND PEOPLE TO START A CONVERSATION</p>
                  </div>
                ) : isModalSearching ? (
                  <div className="text-center py-8">
                    <div className="inline-block w-6 h-6 border-2 border-black border-t-white animate-spin mb-4"></div>
                    <p className="text-sm text-black font-mono font-bold">SEARCHING...</p>
                  </div>
                ) : modalSearchResults.length === 0 ? (
                  <div className="text-center py-8 text-black">
                    <div className="w-16 h-16 bg-blue-200 border-2 border-black flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-sm font-mono font-bold mb-2">NO USERS FOUND</p>
                    <p className="text-xs font-mono">TRY SEARCHING WITH A DIFFERENT TERM</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modalSearchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleModalUserClick(user)}
                        disabled={isCreatingDM}
                        className="w-full p-3 text-left hover:bg-blue-200 active:bg-blue-300 transition-colors group border border-black disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500 border-2 border-black flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover pixelated" style={{ imageRendering: 'pixelated' }} />
                            ) : (
                              user.username?.[0]?.toUpperCase() || user.walletAddress?.slice(0, 2) || 'U'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm truncate text-black font-mono">
                                {user.username || user.displayName || `${user.walletAddress?.slice(0, 6)}...${user.walletAddress?.slice(-4)}`}
                              </h4>
                              {user.isVerified && (
                                <div className="text-blue-500" title="Verified">
                                  <div className="w-3 h-3 bg-green-500 border border-black"></div>
                                </div>
                              )}
                              {isCreatingDM && (
                                <div className="text-blue-500" title="Creating chat...">
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </div>
                              )}
                            </div>
                            {user.walletAddress && (
                              <p className="text-xs text-gray-500 truncate">
                                {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}
                              </p>
                            )}
                          </div>
                          <div className="text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button 
                onClick={handleCloseNewMessage}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Invite Modal */}
      <RoomInviteModal
        isVisible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        roomId={selectedRoomId}
        roomName={selectedRoomName}
      />

      {/* Join Room Modal */}
      <JoinRoomModal
        isVisible={showJoinModal}
        onClose={handleCloseJoinModal}
        roomData={joinRoomData}
        onRoomJoined={handleRoomJoined}
      />

      {/* Profile Card Modal */}
      {selectedUser && (
        <ProfileCard
          user={selectedUser}
          isVisible={showProfileCard}
          onClose={() => {
            setShowProfileCard(false);
            setSelectedUser(null);
          }}
          onDM={(userId) => {
            debug.log('💬 [ProfileCard] DM clicked for user:', userId);
            // Create DM with selected user
            sendMessage(CLIENT_EVENTS.CREATE_DM, { 
              userId: userId 
            });
            // Close ProfileCard
            setShowProfileCard(false);
            setSelectedUser(null);
            // Clear search
            setSearchQuery('');
            setSearchResults([]);
          }}
          currentUserId={currentUser?.id}
        />
      )}

    </div>
  );
}