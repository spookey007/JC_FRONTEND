'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '@/stores/chatStore';
import { getRoleName, getRoleColor, getRoleIcon } from '@/lib/roleUtils';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/types/events';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useChatStore } from '@/stores/chatStore';
import { logger } from '@/lib/logger';

interface ProfileCardProps {
  user: User;
  isVisible: boolean;
  onClose: () => void;
  currentUserId?: string;
  onFollow?: (userId: string) => void;
  onUnfollow?: (userId: string) => void;
  onPoke?: (userId: string, message?: string) => void;
  onDM?: (userId: string) => void;
  isFollowing?: boolean;
  followerCount?: number;
  followingCount?: number;
  joinDate?: string;
}

export default function ProfileCard({ 
  user, 
  isVisible, 
  onClose, 
  currentUserId,
  onFollow,
  onUnfollow,
  onPoke,
  onDM,
  isFollowing = false,
  followerCount = 0,
  followingCount = 0,
  joinDate
}: ProfileCardProps) {
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState(isFollowing);
  const [currentFollowerCount, setCurrentFollowerCount] = useState(followerCount);
  const [currentFollowingCount, setCurrentFollowingCount] = useState(followingCount);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);
  const { sendMessage, on, off, fetchChannels } = useWebSocket();
  const { currentUser } = useChatStore();

  // Role-based theme config
  const getRoleTheme = (role: number) => {
    switch (role) {
      case 4: // Developer
        return {
          bg: 'bg-gradient-to-br from-purple-900 to-indigo-900',
          text: 'text-purple-200',
          accent: 'text-purple-400',
          border: 'border-purple-500',
          glow: 'shadow-[0_0_12px_rgba(192,132,252,0.5)]',
          button: 'bg-purple-600 hover:bg-purple-700',
          badge: 'bg-purple-700 border-purple-400'
        };
      case 3: // Admin
        return {
          bg: 'bg-gradient-to-br from-yellow-900 to-amber-900',
          text: 'text-yellow-100',
          accent: 'text-yellow-300',
          border: 'border-yellow-500',
          glow: 'shadow-[0_0_12px_rgba(251,191,36,0.4)]',
          button: 'bg-amber-600 hover:bg-amber-700',
          badge: 'bg-amber-700 border-yellow-400'
        };
      case 2: // Moderator
        return {
          bg: 'bg-gradient-to-br from-blue-900 to-cyan-900',
          text: 'text-blue-100',
          accent: 'text-cyan-300',
          border: 'border-cyan-500',
          glow: 'shadow-[0_0_10px_rgba(56,189,248,0.3)]',
          button: 'bg-cyan-600 hover:bg-cyan-700',
          badge: 'bg-cyan-700 border-cyan-400'
        };
      default: // Member
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          accent: 'text-gray-600',
          border: 'border-gray-700',
          glow: '',
          button: 'bg-gray-600 hover:bg-gray-700',
          badge: 'bg-gray-700 border-gray-500'
        };
    }
  };

  const role = typeof user.role === 'string' ? parseInt(user.role, 10) : user.role ?? 1;
  const theme = getRoleTheme(role);
  const roleName = getRoleName(role);
  const roleIcon = getRoleIcon(role);

  useEffect(() => {
    const isOwn = currentUserId === user.id;
    setIsOwnProfile(isOwn);
    setFollowStatus(isFollowing);
    // Use follower counts from user data if available, otherwise use props
    setCurrentFollowerCount(user.followerCount ?? followerCount);
    setCurrentFollowingCount(user.followingCount ?? followingCount);
    // If it's own profile, mark as loaded immediately
    if (isOwn) {
      setFollowStatusLoaded(true);
    }
  }, [currentUserId, user.id, isFollowing, user.followerCount, user.followingCount, followerCount, followingCount]);

  // Fetch user stats and follow status when profile card opens
  useEffect(() => {
    if (isVisible && user.id && !isOwnProfile) {
      // Reset loaded state to prevent showing stale data
      setFollowStatusLoaded(false);
      // First check follow status to avoid flickering
      sendMessage(CLIENT_EVENTS.CHECK_FOLLOW_STATUS, { targetUserId: user.id });
      sendMessage(CLIENT_EVENTS.GET_USER_STATS, { targetUserId: user.id });
    }
  }, [isVisible, user.id, isOwnProfile, sendMessage]);

  // Handle WebSocket responses
  useEffect(() => {
    const handleFollowSuccess = (payload: any) => {
      if (payload.targetUserId === user.id) {
        setFollowStatus(true);
        setFollowStatusLoaded(true);
        if (payload.followerCount !== undefined) {
          setCurrentFollowerCount(payload.followerCount);
        }
        if (payload.followingCount !== undefined) {
          setCurrentFollowingCount(payload.followingCount);
        }
        console.log('✅ [ProfileCard] Follow success - Updated counts:', { 
          followerCount: payload.followerCount, 
          followingCount: payload.followingCount 
        });
      }
    };

    const handleUnfollowSuccess = (payload: any) => {
      if (payload.targetUserId === user.id) {
        setFollowStatus(false);
        setFollowStatusLoaded(true);
        if (payload.followerCount !== undefined) {
          setCurrentFollowerCount(payload.followerCount);
        }
        if (payload.followingCount !== undefined) {
          setCurrentFollowingCount(payload.followingCount);
        }
        console.log('✅ [ProfileCard] Unfollow success - Updated counts:', { 
          followerCount: payload.followerCount, 
          followingCount: payload.followingCount 
        });
      }
    };

    const handleFollowStatusResponse = (payload: any) => {
      if (payload.targetUserId === user.id) {
        setFollowStatus(payload.isFollowing || false);
        setFollowStatusLoaded(true); // Mark as loaded to prevent flickering
        if (payload.followerCount !== undefined) {
          setCurrentFollowerCount(payload.followerCount);
        }
        if (payload.followingCount !== undefined) {
          setCurrentFollowingCount(payload.followingCount);
        }
      }
    };

    const handleUserStatsResponse = (payload: any) => {
      if (payload.targetUserId === user.id) {
        if (payload.followerCount !== undefined) {
          setCurrentFollowerCount(payload.followerCount);
        }
        if (payload.followingCount !== undefined) {
          setCurrentFollowingCount(payload.followingCount);
        }
      }
    };

    on(SERVER_EVENTS.FOLLOW_SUCCESS, handleFollowSuccess);
    on(SERVER_EVENTS.UNFOLLOW_SUCCESS, handleUnfollowSuccess);
    on(SERVER_EVENTS.FOLLOW_STATUS_RESPONSE, handleFollowStatusResponse);
    on(SERVER_EVENTS.USER_STATS_RESPONSE, handleUserStatsResponse);

    return () => {
      off(SERVER_EVENTS.FOLLOW_SUCCESS, handleFollowSuccess);
      off(SERVER_EVENTS.UNFOLLOW_SUCCESS, handleUnfollowSuccess);
      off(SERVER_EVENTS.FOLLOW_STATUS_RESPONSE, handleFollowStatusResponse);
      off(SERVER_EVENTS.USER_STATS_RESPONSE, handleUserStatsResponse);
    };
  }, [user.id, on, off]);

  // Social Handle Component
  const SocialHandle = ({ platform, handle, icon, color }: { 
    platform: 'twitter' | 'discord' | 'twitch' | 'spotify';
    handle: string; 
    icon: string; 
    color: string;
  }) => {
    if (!handle) return null;

    return (
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${color} text-white text-xs font-mono cursor-not-allowed opacity-75`}
        title={`${platform.charAt(0).toUpperCase() + platform.slice(1)}: Coming Soon`}
      >
        <span className="text-xs">{icon}</span>
        <span className="font-bold text-xs">COMING SOON</span>
      </div>
    );
  };

  if (!isVisible) return null;

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user.id) return;
    try {
      setIsLoading(true);
      
      // Optimistic update - immediately update UI
      setFollowStatus(true);
      setCurrentFollowerCount(prev => prev + 1);
      
      sendMessage(CLIENT_EVENTS.FOLLOW_USER, { targetUserId: user.id });
      if (onFollow) onFollow(user.id);
    } catch (error) {
      console.error('Failed to follow user:', error);
      // Revert optimistic update on error
      setFollowStatus(false);
      setCurrentFollowerCount(prev => Math.max(0, prev - 1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user.id) return;
    try {
      setIsLoading(true);
      
      // Optimistic update - immediately update UI
      setFollowStatus(false);
      setCurrentFollowerCount(prev => Math.max(0, prev - 1));
      
      sendMessage(CLIENT_EVENTS.UNFOLLOW_USER, { targetUserId: user.id });
      if (onUnfollow) onUnfollow(user.id);
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      // Revert optimistic update on error
      setFollowStatus(true);
      setCurrentFollowerCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePoke = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user.id) return;
    try {
      setIsLoading(true);
      const pokerName = currentUser?.displayName || currentUser?.username || 'Someone';
      const pokeMessage = `${pokerName} poked you`;
      sendMessage(CLIENT_EVENTS.SEND_POKE, { 
        targetUserId: user.id, 
        message: pokeMessage
      });
      if (onPoke) onPoke(user.id, pokeMessage);
    } catch (error) {
      console.error('Failed to send poke:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDM = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user.id) return;
    
    try {
      setIsLoading(true);
      logger.debug('DM clicked for user', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName
      }, 'ProfileCard');

      // First check if DM already exists locally for instant response
      const { useChatStore } = await import('@/stores/chatStore');
      const { channels, setCurrentChannel } = useChatStore.getState();
      
      const existingChannel = channels.find(channel => 
        channel.type === 'dm' && 
        channel.members?.some((member: any) => member.userId === user.id)
      );

      if (existingChannel) {
        logger.debug('Found existing DM channel, switching immediately', { channelId: existingChannel.id }, 'ProfileCard');
        setCurrentChannel(existingChannel.id);
        // Dispatch custom event to trigger UI switch
        window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: existingChannel.id } }));
        if (onDM) onDM(user.id);
        return;
      }

      // Create or find DM channel with this user via Express backend
      const { apiFetch } = await import('@/lib/api');
      const response = await apiFetch('/chat/dm/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      // Check if this is a duplicate DM response (409 with special handling)
      if ((response as any).isDuplicate) {
        logger.debug('Duplicate DM detected via special handling', null, 'ProfileCard');
        const errorData = (response as any).errorData;
        
        // DM already exists, find and switch to it
        const duplicateChannel = channels.find(channel => 
          channel.type === 'dm' && 
          channel.members?.some((member: any) => member.userId === user.id)
        );
        if (duplicateChannel) {
          logger.debug('Found existing DM channel, switching to it', { channelId: duplicateChannel.id }, 'ProfileCard');
          setCurrentChannel(duplicateChannel.id);
          // Dispatch custom event to trigger UI switch
          window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: duplicateChannel.id } }));
          if (onDM) onDM(user.id);
        } else {
          logger.debug('Duplicate DM detected but channel not found locally, refreshing channels', null, 'ProfileCard');
          // Refresh channels to get the existing DM
          fetchChannels();
          if (onDM) onDM(user.id);
        }
      } else if (response.ok) {
        const data = await response.json();
        logger.debug('DM channel created/found', { channel: data.channel }, 'ProfileCard');
        
        // Add the channel to the store if it doesn't exist
        const { addChannel } = useChatStore.getState();
        const existingChannel = channels.find(c => c.id === data.channel.id);
        if (!existingChannel) {
          addChannel(data.channel);
        }
        
        // Switch to the DM channel
        setCurrentChannel(data.channel.id);
        // Dispatch custom event to trigger UI switch
        window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: data.channel.id } }));
        if (onDM) onDM(user.id);
      } else {
        const errorData = await response.json();
        logger.debug('Server response', { status: response.status, errorData }, 'ProfileCard');
        
        if (errorData.error === 'DUPLICATE_DM' || 
            errorData.message?.includes('already exists') ||
            errorData.message?.includes('DM channel already exists')) {
          logger.debug('Duplicate DM detected, finding existing channel', null, 'ProfileCard');
          // DM already exists, find and switch to it
          const duplicateChannel = channels.find(channel => 
            channel.type === 'dm' && 
            channel.members?.some((member: any) => member.userId === user.id)
          );
          if (duplicateChannel) {
            logger.debug('Found existing DM channel, switching to it', { channelId: duplicateChannel.id }, 'ProfileCard');
            setCurrentChannel(duplicateChannel.id);
            // Dispatch custom event to trigger UI switch
            window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: duplicateChannel.id } }));
            if (onDM) onDM(user.id);
          } else {
            logger.debug('Duplicate DM detected but channel not found locally, refreshing channels', null, 'ProfileCard');
            // Refresh channels to get the existing DM
            fetchChannels();
            if (onDM) onDM(user.id);
          }
        } else {
          logger.error('Failed to create DM channel', { status: response.status, statusText: response.statusText, errorData }, 'ProfileCard');
        }
      }
    } catch (error) {
      logger.error('Error creating DM channel', error, 'ProfileCard');
      
      // Check if it's a duplicate DM error in the catch block too
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.debug('Duplicate DM detected in catch block, finding existing channel', null, 'ProfileCard');
        const { useChatStore } = await import('@/stores/chatStore');
        const { channels, setCurrentChannel } = useChatStore.getState();
        
        const duplicateChannel = channels.find(channel => 
          channel.type === 'dm' && 
          channel.members?.some((member: any) => member.userId === user.id)
        );
        
        if (duplicateChannel) {
          logger.debug('Found existing DM channel in catch block, switching to it', { channelId: duplicateChannel.id }, 'ProfileCard');
          setCurrentChannel(duplicateChannel.id);
          // Dispatch custom event to trigger UI switch
          window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: duplicateChannel.id } }));
          if (onDM) onDM(user.id);
        } else {
          logger.debug('Duplicate DM detected in catch block but channel not found locally, refreshing channels', null, 'ProfileCard');
          fetchChannels();
          if (onDM) onDM(user.id);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyWallet = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ 
          type: "spring", 
          damping: 25, 
          stiffness: 300,
          duration: 0.3 
        }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        onClick={onClose}
      >
        {/* Lisa GUI Window */}
        <div 
          className="relative bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Lisa GUI Title Bar */}
          <div className="bg-black text-white px-3 py-2 flex items-center justify-between border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full border border-white"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full border border-white"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full border border-white"></div>
              <span className="text-xs font-mono font-bold ml-2">USER PROFILE v2.1</span>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full border border-white flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110"
              title="Close profile"
            >
              ×
            </button>
          </div>
          
          {/* Content Area */}
          <div className="p-3 sm:p-4">
            {/* Compact Layout: Avatar Left, Info Right */}
            <div className="flex items-start gap-3 mb-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 border-3 border-black bg-gray-200 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={user.displayName || user.username || 'User avatar'} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <div className="text-white text-lg sm:text-xl font-bold">
                        {user.displayName?.[0]?.toUpperCase() || 
                         user.username?.[0]?.toUpperCase() || 
                         'U'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* User Info */}
              <div className="flex-1 min-w-0">
                {/* Name and Role */}
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base sm:text-lg font-bold text-black font-mono truncate">
                    {user.displayName || user.username || 'ANONYMOUS'}
                  </h2>
                  {/* Role Badge - Compact */}
                  <div className={`${theme.bg} ${theme.text} border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${theme.glow} flex-shrink-0`}>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{roleIcon}</span>
                      <span className="text-xs font-bold font-mono">{roleName.toUpperCase()}</span>
                    </div>
                  </div>
                  {user.isVerified && (
                    <div className="flex items-center gap-1 bg-green-500 border-2 border-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      <span className="text-xs font-bold font-mono text-white">✓</span>
                    </div>
                  )}
                </div>
                
                {/* Username */}
                <p className="text-xs text-gray-600 font-mono mb-2 truncate">
                  @{user.username || 'unknown'}
                </p>
                
                {/* Bio */}
                {user.bio && (
                  <p className="text-xs text-gray-700 font-mono mb-2 line-clamp-2 break-words">
                    {user.bio}
                  </p>
                )}
                
                {/* Wallet Address */}
                {user.walletAddress && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-600 font-mono flex-shrink-0">WALLET:</span>
                    <p className="text-xs font-mono text-black truncate flex-1 min-w-0">
                      {user.walletAddress}
                    </p>
                    <button
                      onClick={handleCopyWallet}
                      className="flex-shrink-0 p-1 bg-white hover:bg-gray-100 text-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
                      title="Copy wallet address"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Stats - Compact */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">FOLLOWERS:</span>
                    <span className="font-bold text-black">{currentFollowerCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">FOLLOWING:</span>
                    <span className="font-bold text-black">{currentFollowingCount.toLocaleString()}</span>
                  </div>
                  {joinDate && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">SINCE:</span>
                      <span className="font-bold text-black">
                        {new Date(joinDate).toLocaleDateString('en-US', {
                          year: '2-digit',
                          month: 'short'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            
            {/* Social Handles - Coming Soon */}
            {(user.twitterHandle || user.discordHandle || user.twitchHandle || user.spotifyHandle) && (
              <div className="pb-4">
                <h3 className="text-xs sm:text-sm font-bold text-black font-mono mb-2">SOCIAL LINKS</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {user.twitterHandle && (
                    <SocialHandle
                      platform="twitter"
                      handle={user.twitterHandle}
                      icon="🐦"
                      color="bg-blue-500"
                    />
                  )}
                  {user.discordHandle && (
                    <SocialHandle
                      platform="discord"
                      handle={user.discordHandle}
                      icon="💬"
                      color="bg-indigo-500"
                    />
                  )}
                  {user.twitchHandle && (
                    <SocialHandle
                      platform="twitch"
                      handle={user.twitchHandle}
                      icon="📺"
                      color="bg-purple-500"
                    />
                  )}
                  {user.spotifyHandle && (
                    <SocialHandle
                      platform="spotify"
                      handle={user.spotifyHandle}
                      icon="🎵"
                      color="bg-green-500"
                    />
                  )}
                </div>
              </div>
            )}
            
            {/* Action Buttons - Compact */}
            <div className="flex gap-2 mb-4">
              {!isOwnProfile && followStatusLoaded && (
                <>
                  {followStatus ? (
                    <button
                      onClick={handleUnfollow}
                      disabled={isLoading}
                      className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white font-mono font-bold py-2 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 text-xs disabled:cursor-not-allowed"
                    >
                      {isLoading ? '...' : 'Unfollow'}
                    </button>
                  ) : (
                    <button
                      onClick={handleFollow}
                      disabled={isLoading}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-mono font-bold py-2 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 text-xs disabled:cursor-not-allowed"
                    >
                      {isLoading ? '...' : 'Follow'}
                    </button>
                  )}
                  
                  <button
                    onClick={handleDM}
                    disabled={isLoading}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white font-mono font-bold py-2 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 text-xs disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating...' : 'DM'}
                  </button>
                </>
              )}
              
              {/* Show loading state for follow buttons when status not loaded */}
              {!isOwnProfile && !followStatusLoaded && (
                <div className="flex-1 bg-gray-300 text-gray-600 font-mono font-bold py-2 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs flex items-center justify-center">
                  Loading...
                </div>
              )}
              
              <button
                onClick={handlePoke}
                disabled={isLoading}
                className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 text-white font-mono font-bold py-2 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 text-xs disabled:cursor-not-allowed"
              >
                {isLoading ? 'Poking...' : 'Poke'}
              </button>
            </div>
            
            
            {/* Circuit Board Background Elements */}
            <div className="absolute bottom-4 right-4 opacity-20">
              <div className="flex flex-col gap-1">
                <div className="w-8 h-0.5 bg-black"></div>
                <div className="w-6 h-0.5 bg-black"></div>
                <div className="w-10 h-0.5 bg-black"></div>
                <div className="w-4 h-0.5 bg-black"></div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}