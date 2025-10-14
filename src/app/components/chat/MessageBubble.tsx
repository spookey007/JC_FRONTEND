'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatEvents } from '@/contexts/WebSocketContext';
import { Message, MessageReaction, useChatStore } from '@/stores/chatStore';
import { useWallet } from '@solana/wallet-adapter-react';
import MessageStatus from '@/components/MessageStatus';
// Removed random emoji import - using only kawaii text emojis
import ProfileCard from './ProfileCard';
import VoiceMessageBubble from './VoiceMessageBubble';
import VideoMessageBubble from './VideoMessageBubble';
import { getImageProxyUrl } from '@/lib/imageProxy';
import { getRoleName, getRoleColor, getRoleIcon } from '@/lib/roleUtils';
import { logger } from '@/lib/logger';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236b7280'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const target = e.target as HTMLImageElement;
  if (target.src !== DEFAULT_AVATAR) {
    target.src = DEFAULT_AVATAR;
  }
};

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isConsecutive?: boolean;
}

export default function MessageBubble({ 
  message, 
  showAvatar = true, 
  showTimestamp = true,
  isConsecutive = false
}: MessageBubbleProps) {
  // Debug voice messages
  if (message.content === '🎤 Voice message') {
    console.log('🎤 [MessageBubble] Rendering voice message:', {
      id: message.id,
      type: message.type,
      attachments: message.attachments,
      hasAttachments: message.attachments && message.attachments.length > 0,
      isOptimistic: message.isOptimistic
    });
  }
  const { publicKey } = useWallet();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [profileCardPosition, setProfileCardPosition] = useState({ x: 0, y: 0 });
  const messageRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { currentUser } = useChatStore();

  const { addReaction } = useChatEvents();

  // Prevent scroll jump on reaction
  const preserveScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement || document.body;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // Within 10px of bottom
    
    // Store position before reaction
    const preReactionScrollTop = scrollTop;
    
    // After DOM update (next tick), restore position if not at bottom
    setTimeout(() => {
      if (!isAtBottom) {
        window.scrollTo(0, preReactionScrollTop);
      }
    }, 0);
  }, []);

  // Close picker and profile card on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showReactionPicker && messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setShowReactionPicker(false);
      }
      if (showProfileCard) {
        // Only close profile card if clicking outside both the message and the profile card
        const target = event.target as Node;
        const isClickOnMessage = messageRef.current && messageRef.current.contains(target);
        const isClickOnProfileCard = document.querySelector('[data-profile-card]')?.contains(target);
        
        if (!isClickOnMessage && !isClickOnProfileCard) {
          setShowProfileCard(false);
        }
      }
    };
    if (showReactionPicker || showProfileCard) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReactionPicker, showProfileCard]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const isOwnMessage = message.author?.walletAddress === publicKey?.toString() || 
                       message.authorId === currentUser?.id;
  const isBot = message.author?.username === "Jaime.Capital Bot" || 
                message.author?.username === "JaimeCapitalBot" ||
                message.author?.displayName === "Jaime.Capital Bot" ||
                (message.author?.username?.toLowerCase().includes('bot') && 
                 message.author?.username?.toLowerCase().includes('jaime'));

  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const reactionsByEmoji = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) acc[reaction.emoji] = [];
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>) || {};

  const currentUserReaction = message.reactions?.find(r => 
    r.userId === (currentUser?.id || publicKey?.toString())
  );

  const handleReactionClick = useCallback((emoji: string) => {
    // 🔥 Preserve scroll position before reaction
    preserveScrollPosition();
    addReaction(message.id, emoji);
    setShowReactionPicker(false);
  }, [message.id, addReaction, preserveScrollPosition]);

  // Removed random reaction functionality

  const startHold = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a,img,button')) return;
    e.preventDefault();
    holdTimerRef.current = setTimeout(() => setShowReactionPicker(true), 500);
  }, []);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => e.button === 0 && startHold(e);
  const handleMouseUp = () => endHold();
  const handleMouseLeave = () => {
    endHold();
    setIsHovering(false);
  };
  const handleMouseEnter = () => setIsHovering(true);
  const handleTouchStart = (e: React.TouchEvent) => startHold(e);
  const handleTouchEnd = () => endHold();
  const handleTouchCancel = () => endHold();

  const parseContent = (input: string): Array<any> => {
    const tokens: Array<any> = [];
    const markdownRegex = /(!?)\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = markdownRegex.exec(input)) !== null) {
      if (match.index > lastIndex) tokens.push({ type: 'text', text: input.slice(lastIndex, match.index) });
      const isImage = match[1] === '!';
      tokens.push(isImage ? { type: 'image', url: match[3], alt: match[2] } : { type: 'link', url: match[3], label: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < input.length) {
      const remaining = input.slice(lastIndex);
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      let urlLastIndex = 0;
      let urlMatch;
      while ((urlMatch = urlRegex.exec(remaining)) !== null) {
        if (urlMatch.index > urlLastIndex) tokens.push({ type: 'text', text: remaining.slice(urlLastIndex, urlMatch.index) });
        const url = urlMatch[0];
        tokens.push(/\.(png|jpe?g|webp|gif)$/i.test(url) ? { type: 'image', url } : { type: 'link', url });
        urlLastIndex = urlMatch.index + url.length;
      }
      if (urlLastIndex < remaining.length) tokens.push({ type: 'text', text: remaining.slice(urlLastIndex) });
    }
    return tokens;
  };

  const parts = parseContent(message.content || "");
  const author = message.author?.username || message.author?.displayName || (message.authorId ? `${message.authorId.slice(0,4)}…${message.authorId.slice(-4)}` : "Anonymous");

  const handleReactionCountClick = (emoji: string) => {
    console.log(`🎭 Show users who reacted with ${emoji} to message ${message.id}`);
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setProfileCardPosition({
      x: rect.left + rect.width / 2 - 160, // Center the card
      y: rect.top - 10 // Position above the avatar
    });
    setShowProfileCard(true);
  };

  // Helper function to get user role info
  const getUserRoleInfo = (user: any) => {
    // Handle both string and number roles
    let role = user?.role ?? 1; // Default to member (1)
    
    // Convert string to number if needed
    if (typeof role === 'string') {
      role = parseInt(role, 10);
    }
    
    // Database schema: 0=admin, 1=member, 2=moderator, 3=dev
    const roleName = getRoleName(role);
    const roleColor = getRoleColor(role);
    const roleIcon = getRoleIcon(role);

    // Convert hex color to Tailwind classes
    const getColorClasses = (hexColor: string) => {
      switch (hexColor) {
        case '#ff6b6b': // Admin - Red
          return { bg: 'bg-red-500', text: 'text-red-700' };
        case '#4ecdc4': // Dev - Teal
          return { bg: 'bg-teal-500', text: 'text-teal-700' };
        case '#45b7d1': // Moderator - Blue
          return { bg: 'bg-blue-500', text: 'text-blue-700' };
        case '#96ceb4': // Member - Green
          return { bg: 'bg-green-500', text: 'text-green-700' };
        default:
          return { bg: 'bg-gray-500', text: 'text-gray-700' };
      }
    };

    const colorClasses = getColorClasses(roleColor);

    return { 
      label: roleName.toUpperCase(), 
      color: colorClasses.bg, 
      textColor: colorClasses.text, 
      icon: roleIcon 
    };
  };

  return (
    <div 
      className={`flex gap-1 sm:gap-2 md:gap-3 group hover:bg-black/10 -mx-1 sm:-mx-2 px-1 sm:px-2 py-1 transition-all duration-200 ${isOwnMessage ? 'justify-end' : 'justify-start'} max-w-full`} 
      ref={messageRef}
    >
      {/* Avatar for received messages */}
      {!isOwnMessage && showAvatar && (
        <div className="relative">
          <div 
            className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
            onClick={handleAvatarClick}
            title="Click to view profile"
          >
            <img 
              src={message.author?.avatarUrl || DEFAULT_AVATAR} 
              alt={author} 
              className="w-full h-full object-cover pixelated" 
              onError={handleAvatarError}
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          {/* Role indicator badge */}
          {message.author && (
            <div className={`absolute -top-1 -right-1 w-4 h-4 ${getUserRoleInfo(message.author).color} border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center`}>
              <span className="text-xs font-bold text-white">
                {getUserRoleInfo(message.author).label[0]}
              </span>
            </div>
          )}
        </div>
      )}
      {!isOwnMessage && !showAvatar && (
        <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center">
          {showTimestamp && message.sentAt && (
            <span className="text-xs text-black opacity-0 group-hover:opacity-100 transition-opacity font-mono bg-yellow-300 border border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      

      <div className={`max-w-[80%] sm:max-w-[70%] md:max-w-[55%] relative ${isOwnMessage ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
        {/* Author info for non-consecutive messages */}
        {!isOwnMessage && showAvatar && (
          <div className="flex items-center gap-2 mb-1 justify-start">
            <span className={`font-bold text-xs sm:text-sm font-mono tracking-wide ${isBot ? 'text-orange-600' : 'text-black'}`}>
              {author}
            </span>
            {message.author?.isVerified && !isBot && (
              <div className="text-green-600" title="Verified wallet">
                <div className="w-3 h-3 bg-green-500 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"></div>
              </div>
            )}
            {isBot && (
              <span className="bg-yellow-300 text-black text-xs px-2 py-0.5 font-bold font-mono border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                BOT
              </span>
            )}
            {/* Role indicator for regular users */}
            {/* {!isBot && message.author && (
              <span className={`text-xs font-mono px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${getUserRoleInfo(message.author).color} text-white`}>
                {getUserRoleInfo(message.author).label}
              </span>
            )} */}
            {message.sentAt && (
              <span className="text-xs text-black font-mono bg-cyan-300 border border-black px-2 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
        
        {/* Reaction Picker - Positioned relative to message */}
        <AnimatePresence>
          {showReactionPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className={`absolute -top-16 z-1 ${isOwnMessage ? 'right-0' : 'left-0'}`}
            >
              <div className="flex gap-2 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-full border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                {reactionEmojis.map((emoji, idx) => {
                  const isSelected = currentUserReaction?.emoji === emoji;
                  return (
                    <motion.button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactionClick(emoji);
                      }}
                      whileHover={{ scale: 1.4, y: -2 }}
                      whileTap={{ scale: 1.1 }}
                      className={`text-2xl w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                        isSelected 
                          ? 'bg-yellow-300 border-2 border-yellow-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' 
                          : 'hover:bg-yellow-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                      title={isSelected ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                    >
                      {emoji}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message bubble */}
        <div 
          className={`message-bubble px-2 sm:px-3 py-1.5 sm:py-2 relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] select-none transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.02] max-w-full break-words ${
            isOwnMessage 
              ? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white' 
              : isBot 
                ? 'bg-gradient-to-br from-yellow-300 to-orange-400 text-black' 
                : 'bg-gradient-to-br from-green-300 to-cyan-400 text-black'
          } ${message.isOptimistic ? 'opacity-70' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          {/* ✅ FIXED: Show react button for OWN messages too */}
          {isHovering && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-1">
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionPicker(true);
                }}
                className="bg-white hover:bg-yellow-100 text-black px-3 py-1 text-sm font-mono border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title="React to message"
              >
                👍 React
              </motion.button>
            </div>
          )}

          {isOwnMessage && (
            <div className="absolute -top-8 right-0 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <MessageStatus
                isOptimistic={message.isOptimistic}
                isDelivered={!message.isOptimistic}
                isRead={message.readReceipts && message.readReceipts.length > 0}
                readCount={message.readReceipts?.length || 0}
                className="bg-black text-white px-2 py-1 text-xs font-mono border border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
              />
              {message.sentAt && !message.isOptimistic && (
                <span className="text-xs text-black bg-yellow-300 px-2 py-1 font-mono border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* Media Display - Show different media types based on message type */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="my-2">
              {/* GIF Display (type 3) */}
              {message.type === 3 && message.attachments
                .filter((attachment: any) => attachment.type === 'gif')
                .map((attachment: any, index: number) => (
                  <div key={index} className="max-w-full">
                    <img 
                      src={attachment.url || attachment.preview} 
                      alt="GIF" 
                      className="max-w-full max-h-64 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5m16-12V18a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z"/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                ))}

              {/* Image Display (type 2) */}
              {message.type === 2 && message.attachments
                .filter((attachment: any) => attachment.type === 'image')
                .map((attachment: any, index: number) => {
                  console.log('🖼️ [MESSAGE BUBBLE] Rendering image attachment:', {
                    messageId: message.id,
                    messageType: message.type,
                    attachment: attachment,
                    hasUrl: !!attachment.url,
                    url: attachment.url
                  });
                  return (
                  <div key={index} className="max-w-full">
                    <img 
                      src={getImageProxyUrl(attachment.url || attachment.preview)} 
                      alt="Image" 
                      className="max-w-full max-h-48 sm:max-h-64 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 object-cover" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5m16-12V18a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z"/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  );
                })}

              {/* Video Display (type 5) */}
              {message.type === 5 && message.attachments
                .filter((attachment: any) => attachment.type === 'video')
                .map((attachment: any, index: number) => (
                  <div key={index} className="max-w-full">
                    <video 
                      src={attachment.url} 
                      controls
                      className="max-w-full max-h-64 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
                      onError={(e) => {
                        console.error('Video load error:', e);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ))}

              {/* Voice Message Display (type 4) */}
              {message.type === 4 && message.attachments
                .filter((attachment: any) => attachment.type === 'audio')
                .map((attachment: any, index: number) => (
                  <VoiceMessageBubble
                    key={index}
                    audioUrl={attachment.url}
                    duration={attachment.duration || 0}
                    isOwn={message.authorId === currentUser?.id}
                    timestamp={message.sentAt}
                    authorName={message.author?.displayName || message.author?.username || 'Unknown'}
                    authorAvatar={message.author?.avatarUrl || message.author?.avatarBlob || undefined}
                  />
                ))}

              {/* Video Message Display (type 5) */}
              {message.type === 5 && message.attachments
                .filter((attachment: any) => attachment.type === 'video')
                .map((attachment: any, index: number) => (
                  <VideoMessageBubble
                    key={index}
                    url={attachment.url}
                    duration={attachment.duration || 0}
                    isOwn={message.authorId === currentUser?.id}
                    timestamp={message.sentAt}
                    authorName={message.author?.displayName || message.author?.username || 'Unknown'}
                    authorAvatar={message.author?.avatarUrl || message.author?.avatarBlob || undefined}
                  />
                ))}
              
            </div>
          )}

          {/* Regular content display */}
          <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words max-w-full overflow-hidden">
            {parts.map((p, i) => {
              if (p.type === 'image') return (
                <div key={i} className="my-3 max-w-full">
                  <img 
                    src={p.url} 
                    alt={p.alt || "Image"} 
                    className="max-w-full max-h-48 sm:max-h-64 rounded-xl border border-gray-200 shadow-sm object-cover" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5m16-12V18a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z"/%3E%3C/svg%3E';
                    }}
                  />
                </div>
              );
              if (p.type === 'link') return (
                <a 
                  key={i} 
                  href={p.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`underline break-all hover:opacity-80 font-medium ${
                    isOwnMessage ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  {p.label || p.url}
                </a>
              );
              return <span key={i}>{p.text}</span>;
            })}
          </div>
        </div>
        
        {/* Inline reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactionsByEmoji)
              .sort(([,a], [,b]) => b.length - a.length)
              .map(([emoji, reactions]) => {
                const isReacted = currentUserReaction?.emoji === emoji;
                return (
                  <motion.button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReactionCountClick(emoji);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`text-xs px-2 py-1 font-bold font-mono flex items-center gap-1 border border-black cursor-pointer ${
                      isReacted 
                        ? 'bg-yellow-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                        : 'bg-white text-black hover:bg-yellow-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                  >
                    <span className="text-sm">{emoji}</span>
                    <span className="bg-black text-white px-1 py-0.5 font-mono text-xs rounded">
                      {reactions.length}
                    </span>
                  </motion.button>
                );
              })}
          </div>
        )}

        {/* Read receipts */}
        {isOwnMessage && showTimestamp && message.readReceipts && message.readReceipts.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs justify-end">
            <div className="flex -space-x-1">
              {message.readReceipts.slice(0, 3).map((receipt, index) => (
                <div
                  key={receipt.id}
                  className="w-4 h-4 bg-green-500 border border-black flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  title={`Read at ${new Date(receipt.readAt).toLocaleTimeString()}`}
                >
                  <div className="w-2 h-2 bg-white border border-black"></div>
                </div>
              ))}
              {message.readReceipts.length > 3 && (
                <div className="w-4 h-4 bg-gray-500 border border-black flex items-center justify-center text-xs font-bold font-mono text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  +{message.readReceipts.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-black font-mono bg-cyan-300 border border-black px-2 py-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              {message.readReceipts.length} READ
            </span>
          </div>
        )}
      </div>

      {/* Profile Card */}
      {message.author && (
        <ProfileCard
          user={message.author}
          isVisible={showProfileCard}
          onClose={() => setShowProfileCard(false)}
          currentUserId={currentUser?.id}
          followerCount={message.author.followerCount || 0}
          followingCount={message.author.followingCount || 0}
          joinDate={message.author.memberSince}
          onDM={async (userId) => {
            logger.debug('DM requested for user', { userId }, 'MessageBubble');
            try {
              // First check if DM already exists locally for instant response
              const { useChatStore } = await import('@/stores/chatStore');
              const { channels, setCurrentChannel } = useChatStore.getState();
              
              const existingChannel = channels.find(channel => 
                channel.type === 'dm' && 
                channel.members?.some((member: any) => member.userId === userId)
              );

              if (existingChannel) {
                logger.debug('Found existing DM channel, switching immediately', { channelId: existingChannel.id }, 'MessageBubble');
                setCurrentChannel(existingChannel.id);
                // Dispatch custom event to trigger UI switch
                window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: existingChannel.id } }));
                return;
              }

              // Create or find DM channel with this user
              const { apiFetch } = await import('@/lib/api');
              const response = await apiFetch('/chat/dm/create', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: userId })
              });

              // Check if this is a duplicate DM response (409 with special handling)
              if ((response as any).isDuplicate) {
                logger.debug('Duplicate DM detected via special handling', null, 'MessageBubble');
                const errorData = (response as any).errorData;
                
                // DM already exists, find and switch to it
                const duplicateChannel = channels.find(channel => 
                  channel.type === 'dm' && 
                  channel.members?.some((member: any) => member.userId === userId)
                );
                if (duplicateChannel) {
                  logger.debug('Found existing DM channel, switching to it', { channelId: duplicateChannel.id }, 'MessageBubble');
                  setCurrentChannel(duplicateChannel.id);
                  // Dispatch custom event to trigger UI switch
                  window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: duplicateChannel.id } }));
                } else {
                  logger.debug('Duplicate DM detected but channel not found locally, refreshing channels', null, 'MessageBubble');
                  // Refresh channels to get the existing DM
                  const { useWebSocket } = await import('@/contexts/WebSocketContext');
                  // Note: We can't call fetchChannels here as we're not in a component context
                  // The channel will be available after the next channel refresh
                }
              } else if (response.ok) {
                const data = await response.json();
                logger.debug('DM channel created/found', { channel: data.channel }, 'MessageBubble');
                
                // Add the channel to the store if it doesn't exist
                const { addChannel } = useChatStore.getState();
                const existingChannel = channels.find(c => c.id === data.channel.id);
                if (!existingChannel) {
                  addChannel(data.channel);
                }
                
                // Set as current channel and select it
                setCurrentChannel(data.channel.id);
                // Dispatch custom event to trigger UI switch
                window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: data.channel.id } }));
                logger.debug('Switched to DM channel with user', { channelId: data.channel.id }, 'MessageBubble');
              } else {
                logger.error('Failed to create DM channel', { status: response.status, statusText: response.statusText }, 'MessageBubble');
              }
            } catch (error) {
              logger.error('Error creating DM channel', error, 'MessageBubble');
              
              // Check if it's a duplicate DM error in the catch block too
              if (error instanceof Error && error.message.includes('already exists')) {
                logger.debug('Duplicate DM detected in catch block, finding existing channel', null, 'MessageBubble');
                const { useChatStore } = await import('@/stores/chatStore');
                const { channels, setCurrentChannel } = useChatStore.getState();
                
                const duplicateChannel = channels.find(channel => 
                  channel.type === 'dm' && 
                  channel.members?.some((member: any) => member.userId === userId)
                );
                
                if (duplicateChannel) {
                  logger.debug('Found existing DM channel in catch block, switching to it', { channelId: duplicateChannel.id }, 'MessageBubble');
                  setCurrentChannel(duplicateChannel.id);
                  // Dispatch custom event to trigger UI switch
                  window.dispatchEvent(new CustomEvent('switchToChannel', { detail: { channelId: duplicateChannel.id } }));
                } else {
                  logger.debug('Duplicate DM detected in catch block but channel not found locally, refreshing channels', null, 'MessageBubble');
                  // Note: We can't call fetchChannels here as we're not in a component context
                  // The channel will be available after the next channel refresh
                }
              }
            }
          }}
          onFollow={(userId) => {
            console.log('Follow requested for user:', userId);
            // Follow functionality is handled by WebSocket
          }}
          onUnfollow={(userId) => {
            console.log('Unfollow requested for user:', userId);
            // Unfollow functionality is handled by WebSocket
          }}
          onPoke={(userId, message) => {
            console.log('Poke requested for user:', userId, 'message:', message);
            // Poke functionality is handled by WebSocket
          }}
        />
      )}
    </div>
  );
}