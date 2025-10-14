'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket, useChatEvents } from '@/contexts/WebSocketContext';
import { useChatStore } from '@/stores/chatStore';
import { useToastNotifications } from '@/components/Toast';
import EmojiPicker from './EmojiPicker';
import GifPickerComponent from './GifPicker';
import VoiceRecorder from './VoiceRecorder';

interface MessageInputProps {
  channelId: string | null;
  onReplyTo?: (messageId: string) => void;
  replyToMessage?: any;
  onClearReply?: () => void;
  showVoiceRecorder?: boolean;
  setShowVoiceRecorder?: (show: boolean) => void;
}

export default function MessageInput({ 
  channelId, 
  onReplyTo, 
  replyToMessage, 
  onClearReply,
  showVoiceRecorder = false,
  setShowVoiceRecorder
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendChatMessage, startTyping, stopTyping } = useChatEvents();
  const { getCurrentChannel, currentChannelId, channels, setCurrentChannel, setMessages, addMessage, removeMessage, currentUser } = useChatStore();
  const { isConnected, isConnecting } = useWebSocket();
  const toast = useToastNotifications();
  const channel = getCurrentChannel();
  
  // Debug current user and wait for it to be loaded
  useEffect(() => {
    if (!currentUser) {
      // Try to reload user from store
      const storeState = useChatStore.getState();
      
      // If still no user, wait for WebSocket authentication
      if (!storeState.currentUser) {
        console.log('⏳ [MessageInput] Waiting for WebSocket authentication...');
        // WebSocket will handle user loading automatically
      }
    }
  }, [currentUser]);
  
  // Sync store with channelId prop and load messages (workaround for channel selection issue)
  useEffect(() => {
    if (channelId && currentChannelId !== channelId) {
      setCurrentChannel(channelId);
      
      // Load messages for this channel
      const loadMessages = async () => {
        try {
          const { apiFetch } = await import('@/lib/api');
          const response = await apiFetch(`/chat/channels/${channelId}/messages?limit=50`);
          
          if (!response.ok) {
            return;
          }
          
          const data = await response.json();
          
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(channelId, data.messages); // No reverse needed - backend returns in correct order
          } else {
          }
        } catch (error) {
        }
      };
      
      // loadMessages();
    }
  }, [channelId, currentChannelId, setCurrentChannel, setMessages]);
  const maxLength = 2000;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  // Prevent iOS zoom on focus
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const preventZoom = (e: FocusEvent) => {
      // Set font size to 16px to prevent zoom
      textarea.style.fontSize = '16px';
      textarea.style.transform = 'scale(1)';
      textarea.style.webkitTransform = 'scale(1)';
    };

    const handleFocus = (e: FocusEvent) => {
      preventZoom(e);
      // Force viewport to stay at 1.0 scale
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      }
    };

    const handleBlur = () => {
      // Restore original viewport settings
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      }
    };

    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('blur', handleBlur);

    return () => {
      textarea.removeEventListener('focus', handleFocus);
      textarea.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Handle typing indicators (only when WebSocket is connected)
  useEffect(() => {
    
    if (!isConnected || !channelId) {
      return; // Don't send typing events if not connected or no channel
    }
    
    if (content.trim()) {
      if (!isTyping) {
        console.log('👀 [TYPING] Current user started typing:', {
          channelId,
          currentUserId: currentUser?.id,
          content: content.trim()
        });
        setIsTyping(true);
        startTyping(channelId);
      }
      
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Set new timeout to stop typing (reduced from 3s to 2s for better responsiveness)
      const newTimeout = setTimeout(() => {
        setIsTyping(false);
        stopTyping(channelId);
      }, 2000); // Stop typing after 2 seconds of inactivity
      
      setTypingTimeout(newTimeout);
    } else {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      if (isTyping) {
        setIsTyping(false);
        stopTyping(channelId);
      }
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [content, channelId, startTyping, stopTyping, isConnected]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    
    if (!content.trim() && attachments.length === 0) {
      return;
    }
    if (!channelId) {
      return;
    }
    
    if (!isConnected) {
      if (isConnecting) {
        toast.warning('Connecting...', 'Please wait for the connection to be established');
      } else {
        toast.error('Not Connected', 'Please check your connection and try again');
      }
      return;
    }

    // Check if current user is available
    if (!currentUser) {
      toast.error('Session Error', 'Please refresh the page to reload your session');
      return;
    }

    // Create optimistic message for immediate display
    // Determine message type based on attachments (only images and GIFs allowed)
    let messageType = 1; // Default to text
    if (attachments.some(attachment => attachment.type === 'gif')) {
      messageType = 3; // GIF
    } else if (attachments.some(attachment => attachment.type === 'image')) {
      messageType = 2; // Image
    }
    
    const optimisticMessage = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      type: messageType,
      channelId: channelId,
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
      attachments: attachments.map(att => ({
        ...att,
        uploading: true // Show uploading state
      })),
      repliedToMessageId: replyToMessage?.id || null,
      reactions: [],
      readReceipts: [],
      isSystem: false,
      isOptimistic: true // Flag to identify optimistic messages
    };

    // Add optimistic message immediately
    console.log('🚀 Adding optimistic message:', {
      id: optimisticMessage.id,
      content: optimisticMessage.content.substring(0, 50) + '...',
      authorId: optimisticMessage.authorId,
      isOptimistic: optimisticMessage.isOptimistic
    });
    addMessage(optimisticMessage);
    
    // Upload files to MinIO first, then send message
    const uploadAndSendMessage = async () => {
      try {
        console.log('🚀 Starting file upload and message send...');
        const startTime = Date.now();
        
        // Upload files to MinIO if there are any
        const uploadedAttachments = [];
        if (attachments.length > 0) {
          console.log('📤 Uploading files to MinIO...', attachments.length, 'files');
          setIsUploading(true);
          
          for (const attachment of attachments) {
            if (attachment.file) {
              try {
                console.log('📤 Uploading file:', attachment.filename);
                const { uploadFile } = await import('@/lib/upload');
                const uploadResult = await uploadFile(attachment.file);
                
                console.log('✅ File uploaded successfully:', uploadResult);
                uploadedAttachments.push({
                  id: attachment.id,
                  filename: attachment.filename,
                  url: uploadResult.url,
                  type: uploadResult.type,
                  size: uploadResult.size,
                  originalName: uploadResult.originalName,
                  thumbnailUrl: uploadResult.thumbnailUrl
                });
              } catch (uploadError) {
                console.error('❌ File upload failed:', uploadError);
                toast.error('Upload Failed', `Failed to upload ${attachment.filename}`);
                // Continue with other files
              }
            } else {
              // For GIFs or already uploaded files, use existing data
              uploadedAttachments.push(attachment);
            }
          }
          
          setIsUploading(false);
        }
        
        // Send message with uploaded attachments
        console.log('📤 Sending message with attachments:', uploadedAttachments);
        sendChatMessage(
          channelId,
          content.trim(),
          uploadedAttachments,
          replyToMessage?.id
        );
        
        const endTime = Date.now();
        console.log(`✅ Message sent successfully in ${endTime - startTime}ms`);
      } catch (error) {
        console.error('❌ Error uploading files or sending message:', error);
        toast.error('Send Failed', 'Failed to upload files or send message. Please try again.');
        setIsUploading(false);
      }
    };
    
    // Execute upload and send
    uploadAndSendMessage();
    
    
    // Clear input
    setContent('');
    setAttachments([]);
    if (onClearReply) {
      onClearReply();
    }
    
    // Stop typing when message is sent
    if (isConnected && channelId) {
      stopTyping(channelId);
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
    setIsTyping(false);
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    if (!channelId || !currentUser) return;

    try {
      setIsUploading(true);
      
      // Upload audio file using MinIO (now fixed for webm files)
      const { uploadFile } = await import('@/lib/upload');
      // Create a File object from the Blob
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const uploadResult = await uploadFile(audioFile);
      
      // Create voice message attachment
      const voiceAttachment = {
        id: `voice-${Date.now()}`,
        filename: `voice-${Date.now()}.webm`,
        url: uploadResult.url,
        type: 'audio' as const, // Use 'audio' type for voice messages
        size: audioBlob.size,
        originalName: `voice-${Date.now()}.webm`,
        duration: 0 // Will be updated when audio loads
      };

      // Create optimistic message for voice
      const optimisticMessage = {
        id: `temp-voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: '🎤 Voice message',
        type: 4, // Audio type
        channelId: channelId,
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
        repliedToMessageId: replyToMessage?.id || null,
        reactions: [],
        readReceipts: [],
        isSystem: false,
        isOptimistic: true
      };

      // Add optimistic message
      addMessage(optimisticMessage);

      // Send voice message
      sendChatMessage(
        channelId,
        '🎤 Voice message',
        [voiceAttachment],
        replyToMessage?.id
      );

      // Clear reply if exists
      if (onClearReply) {
        onClearReply();
      }

      // Stop typing
      if (isConnected && channelId) {
        stopTyping(channelId);
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      setIsTyping(false);

      toast.success('Voice message sent!');
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Send Failed', 'Failed to send voice message. Please try again.');
    } finally {
      setIsUploading(false);
      setShowVoiceRecorder?.(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleGifSelect = (gif: any) => {
    console.log('🎬 [GIF SELECT] Selected GIF object:', gif);
    
    // Tenor API provides different size options: tinygif, gif, mediumgif, etc.
    // Use the smallest available for preview, fallback to main gif
    const previewUrl = gif.tinygif?.url || gif.preview || gif.url;
    
    // Add GIF as an attachment
    const gifAttachment = {
      id: gif.id,
      filename: `gif_${gif.id}.gif`,
      url: gif.url,
      type: 'gif',
      size: 0, // GIF size not available from Tenor
      preview: previewUrl
    };
    
    console.log('🎬 [GIF SELECT] Created attachment:', gifAttachment);
    
    setAttachments(prev => [...prev, gifAttachment]);
    setShowGifPicker(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      // Check file type - allow images and audio files
      const fileType = file.type;
      let attachmentType = 'unknown';
      
      if (fileType.startsWith('image/')) {
        attachmentType = 'image';
      } else if (fileType.startsWith('audio/')) {
        attachmentType = 'audio';
      } else {
        console.warn('File type not supported:', fileType);
        toast.warning('File Type Not Allowed', 'Only image files (JPG, PNG, GIF, etc.) and audio files (MP3, WAV, etc.) are currently supported');
        return;
      }

      // Create object URL for preview
      const previewUrl = URL.createObjectURL(file);
      
      const attachment = {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        url: previewUrl, // Temporary preview URL, will be replaced after upload
        type: attachmentType,
        size: file.size,
        preview: previewUrl,
        file: file, // Store the actual file for upload
        uploading: false,
        uploadError: null
      };

      setAttachments(prev => [...prev, attachment]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    
    // Filter to allow image and video files
    const mediaFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (mediaFiles.length === 0) {
      toast.warning('File Type Not Allowed', 'Only image and video files are currently supported');
      return;
    }

    // Validate video files for duration and size
    for (const file of mediaFiles) {
      if (file.type.startsWith('video/')) {
        const { validateVideoFile } = await import('@/lib/upload');
        const validation = await validateVideoFile(file);
        
        if (!validation.valid) {
          toast.error('Video Validation Failed', validation.error || 'Invalid video file');
          return;
        }
      }
    }
    
    if (mediaFiles.length !== files.length) {
      toast.warning('Some Files Skipped', 'Only image and video files are currently supported. Some files were skipped.');
    }
    
    setIsUploading(true);
    try {
      const { uploadMultipleFiles } = await import('@/lib/upload');
      const uploadedFiles = await uploadMultipleFiles(mediaFiles);
      
      // Convert to attachment format
      const attachments = uploadedFiles.map(result => ({
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: result.originalName,
        url: result.url,
        type: result.type,
        size: result.size,
        preview: result.thumbnailUrl || result.url,
        fileName: result.fileName
      }));
      
      setAttachments(prev => [...prev, ...attachments]);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload Failed', 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const quickEmojis = ['⸜(｡˃ ᵕ ˂ )⸝♡', '♡(˃͈ દ ˂͈ ༶ )', '(´｡• ᵕ •｡`) ♡', '( ˶ᵔ ᵕ ᵔ˶ )', '(◕‿◕)♡', '(◡ ‿ ◡)', '(◕‿◕)', '(´▽`)'];
  
  // Import emoji utilities - removed random emoji functionality

  // Don't render if currentUser is not available
  if (!currentUser) {
    // WebSocket handles user authentication automatically
    console.log('⏳ [MessageInput] Waiting for WebSocket authentication...');

    return (
      <div className="bg-white border-t-4 border-black shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)] p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-black border-t-transparent"></div>
            <span className="text-sm sm:text-base font-bold font-mono text-black">LOADING SESSION...</span>
          </div>
          <div className="text-center">
            <div className="text-xs sm:text-sm text-black font-bold font-mono bg-yellow-300 px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              WebSocket will handle authentication
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-input-container border-t-4 border-black shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)] mobile-input-container">
      {/* Reply indicator */}
      {replyToMessage && (
        <div className="px-3 py-2 bg-green-100 border-b border-black">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs font-mono text-black mb-1">
                Replying to {replyToMessage.author?.username || 'Unknown'}
              </div>
              <div className="text-sm text-black truncate bg-white px-2 py-1 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] font-mono">
                {replyToMessage.content}
              </div>
            </div>
            <button
              onClick={onClearReply}
              className="ml-2 text-black hover:text-red-600 p-1 hover:bg-red-100 transition-colors border border-black bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              aria-label="Clear reply"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 bg-cyan-100 border-b border-black">
          <div className="flex flex-wrap gap-1 justify-center">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative bg-white border border-black p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                {attachment.type === 'gif' ? (
                  <div className="flex items-center gap-1">
                    <img 
                      src={attachment.preview || attachment.url} 
                      alt="GIF" 
                      className="w-6 h-6 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = attachment.url;
                      }}
                    />
                    <span className="text-xs font-mono">GIF</span>
                  </div>
                ) : attachment.type === 'image' ? (
                  <div className="flex items-center gap-1">
                    <img 
                      src={attachment.preview || attachment.url} 
                      alt="IMG" 
                      className="w-6 h-6 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5m16-12V18a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z"/%3E%3C/svg%3E';
                      }}
                    />
                    <span className="text-xs font-mono">IMG</span>
                  </div>
                ) : attachment.type === 'audio' ? (
                  <div className="flex items-center gap-1">
                    <span className="text-lg">🎵</span>
                    <span className="text-xs font-mono">AUDIO</span>
                  </div>
                ) : (
                  <div className="text-xs font-mono truncate max-w-[80px]">
                    {attachment.filename}
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs hover:bg-red-600 flex items-center justify-center border border-black"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        {/* Minimal action buttons */}
        <div className="flex justify-center items-center mb-2">
          <div className="flex gap-1">
            <button
              onClick={() => setShowEmojis(!showEmojis)}
              className="p-2 bg-yellow-300 hover:bg-yellow-400 transition-colors border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
              title="Emojis"
            >
              <span className="text-lg">😀</span>
            </button>
            <button
              onClick={() => setShowGifPicker(true)}
              className="p-2 bg-pink-300 hover:bg-pink-400 transition-colors border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
              title="GIFs"
            >
              <span className="text-lg">🎬</span>
            </button>
            <button
              onClick={() => setShowVoiceRecorder?.(true)}
              className="p-2 bg-purple-300 hover:bg-purple-400 transition-colors border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
              title="Voice"
            >
              <span className="text-lg">🎤</span>
            </button>
            <button
              onClick={triggerFileSelect}
              className="p-2 bg-green-300 hover:bg-green-400 transition-colors border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
              title="Files"
            >
              <span className="text-lg">📎</span>
            </button>
          </div>
        </div>

        {/* Quick emoji reactions */}
        {showEmojis && (
          <div className="flex flex-wrap gap-1 mb-2 justify-center">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className="text-lg p-1 hover:bg-yellow-200 transition-colors border border-black bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
                title={`Add ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-sm px-2 py-1 bg-cyan-300 hover:bg-cyan-400 transition-colors border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]"
            >
              <span>🎭</span>
            </button>
          </div>
        )}

        {/* Random Emoji Picker */}
        <EmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
          className="relative"
        />

        {/* GIF Picker */}
        <GifPickerComponent
          isOpen={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onGifSelect={handleGifSelect}
          className="relative"
        />


        {/* Main input area */}
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full px-3 py-2 pr-16 border border-black bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none text-base placeholder-gray-500 font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              style={{ 
                minHeight: '40px',
                maxHeight: '100px',
                fontSize: '16px'
              }}
              maxLength={maxLength}
              disabled={isUploading}
            />
            
            {/* Status indicators */}
            <div className="absolute bottom-1 right-1 flex items-center gap-1">
              {!isConnected && (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title={isConnecting ? "Connecting..." : "Disconnected"}></div>
              )}
              <span className="text-xs text-gray-500 font-mono">
                {content.length}/{maxLength}
              </span>
            </div>
          </div>
          
          {/* Send button */}
          <button
            type="submit"
            disabled={(!content.trim() && attachments.length === 0) || isUploading}
            className={`px-3 py-2 transition-colors flex items-center justify-center min-w-[40px] h-[40px] border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
              !isConnected 
                ? 'bg-red-500 text-white' 
                : (!content.trim() && attachments.length === 0) || isUploading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-400 hover:bg-green-500 text-black'
            }`}
            title={!isConnected ? (isConnecting ? "Connecting..." : "Disconnected") : (!content.trim() && attachments.length === 0) ? "Type a message" : "Send message (Enter)"}
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>

        {/* Channel info */}
        {/* <div className="mt-3 text-xs text-black flex items-center gap-2 font-mono font-bold">
          <span className="flex items-center gap-1 bg-cyan-300 px-2 py-1 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-sm">{channel?.type === 'text-group' ? '🏠' : '#'}</span>
            <span className="font-bold">{channel?.name}</span>
          </span>
          <span className="bg-yellow-300 px-2 py-1 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            {channel?.members?.length || 0} MEMBERS
          </span>
          <span className="bg-green-300 px-2 py-1 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            ENTER TO SEND • SHIFT+ENTER FOR NEW LINE
          </span>
        </div> */}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}