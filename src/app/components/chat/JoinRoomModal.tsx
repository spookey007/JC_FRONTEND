'use client';

import React, { useState, useRef } from 'react';
import { useWebSocket, useChatEvents, SERVER_EVENTS } from '@/contexts/WebSocketContext';
import { CLIENT_EVENTS } from '@/types/events';
import { useToast } from '@/components/Toast';

interface JoinRoomModalProps {
  isVisible: boolean;
  onClose: () => void;
  roomData: { id: string; name: string } | null;
  onRoomJoined?: (roomId: string) => void;
}

export default function JoinRoomModal({ isVisible, onClose, roomData, onRoomJoined }: JoinRoomModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const isJoiningRef = useRef(false);
  const { sendMessage, on, off, fetchChannels } = useWebSocket();
  const { showToast } = useToast();

  // Handle joining room with invite code
  const handleJoinWithCode = () => {
    if (!inviteCode.trim() || !roomData || isJoiningRoom) return;
    
    console.log('🔍 [JoinRoomModal] Joining room with invite code:', { roomId: roomData.id, inviteCode });
    
    setIsJoiningRoom(true);
    isJoiningRef.current = true;
    sendMessage(CLIENT_EVENTS.USE_ROOM_INVITE, {
      inviteCode: inviteCode.trim()
    });
    
    // Set a timeout to prevent infinite loading
    setTimeout(() => {
      if (isJoiningRef.current) {
        console.log('⚠️ [JoinRoomModal] Timeout reached, stopping loading');
        setIsJoiningRoom(false);
        isJoiningRef.current = false;
        showToast({
          type: 'error',
          title: 'Request timeout',
          message: 'The request took too long. Please try again.'
        });
      }
    }, 10000); // 10 second timeout
  };

  // Handle closing modal
  const handleClose = () => {
    setInviteCode('');
    setIsJoiningRoom(false);
    isJoiningRef.current = false;
    onClose();
  };

  // Handle successful room join
  const handleRoomJoined = (payload: any) => {
    console.log('✅ [JoinRoomModal] Room joined successfully:', payload);
    setIsJoiningRoom(false);
    isJoiningRef.current = false;
    
    // Refresh channels to show the new room
    console.log('🔄 [JoinRoomModal] Refreshing channels after room join');
    setTimeout(() => {
      fetchChannels();
      // Notify parent component about the joined room
      if (onRoomJoined && roomData) {
        onRoomJoined(roomData.id);
      }
    }, 500); // Small delay to ensure server has processed everything
    
    showToast({
      type: 'success',
      title: 'Successfully joined room!'
    });
    handleClose();
  };

  // Handle invite code used successfully
  const handleInviteUsed = (payload: any) => {
    console.log('✅ [JoinRoomModal] Invite used successfully:', payload);
    setIsJoiningRoom(false);
    isJoiningRef.current = false;
    
    // Get the channel ID from the response
    const channelId = payload.room?.channelId || payload.room?.channel?.id;
    
    // Add the channel directly to the list if we have the channel data
    if (payload.channel) {
      console.log('🔄 [JoinRoomModal] Adding channel directly to list:', payload.channel);
      // The channel data will be added via fetchChannels() below
    }
    
    // Refresh channels to show the new room
    console.log('🔄 [JoinRoomModal] Refreshing channels after invite use');
    setTimeout(() => {
      fetchChannels();
      // Notify parent component about the joined room
      if (onRoomJoined && channelId) {
        onRoomJoined(channelId);
      }
    }, 500); // Small delay to ensure server has processed everything
    
    showToast({
      type: 'success',
      title: 'Successfully joined room!',
      message: 'You joined with an invite code.'
    });
    handleClose();
  };

  // Handle errors
  const handleError = (payload: any) => {
    console.error('❌ [JoinRoomModal] Error received:', payload);
    
    // Handle invite code errors
    if (payload.type === 'INVALID_INVITE_CODE' || payload.message?.includes('invite') || payload.message?.includes('Invalid or expired invite code')) {
      console.log('🔍 [JoinRoomModal] Handling invite code error, stopping loading');
      setIsJoiningRoom(false);
      isJoiningRef.current = false;
      showToast({
        type: 'error',
        title: 'Invalid invite code',
        message: 'Please check and try again.'
      });
      return;
    }
    
    // Handle any other room errors
    console.log('🔍 [JoinRoomModal] Handling general room error, stopping loading');
    setIsJoiningRoom(false);
    isJoiningRef.current = false;
    showToast({
      type: 'error',
      title: 'Error',
      message: payload.message || 'Something went wrong.'
    });
  };

  // Set up event listeners
  React.useEffect(() => {
    if (!isVisible) return;

    on(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
    on(SERVER_EVENTS.ROOM_INVITE_USED, handleInviteUsed);
    on(SERVER_EVENTS.ROOM_ERROR, handleError);

    return () => {
      off(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
      off(SERVER_EVENTS.ROOM_INVITE_USED, handleInviteUsed);
      off(SERVER_EVENTS.ROOM_ERROR, handleError);
    };
  }, [isVisible, on, off]);

  if (!isVisible || !roomData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-black rounded-lg p-6 w-full max-w-md mx-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-black font-mono">Join Private Room</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 font-mono font-bold text-xl"
            disabled={isJoiningRoom}
          >
            ×
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 font-mono mb-2">
            Enter invite code for:
          </p>
          <p className="text-lg font-bold text-black font-mono">
            {roomData.name}
          </p>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-bold text-black font-mono mb-2">
            INVITE CODE
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter invite code..."
            className="w-full px-3 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 placeholder-gray-400 font-mono text-sm"
            autoFocus
            disabled={isJoiningRoom}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isJoiningRoom) {
                handleJoinWithCode();
              }
            }}
          />
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isJoiningRoom}
            className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-black font-mono font-bold py-2 px-4 border-2 border-black rounded transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleJoinWithCode}
            disabled={!inviteCode.trim() || isJoiningRoom}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-mono font-bold py-2 px-4 border-2 border-black rounded transition-colors flex items-center justify-center gap-2"
          >
            {isJoiningRoom ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                JOINING...
              </>
            ) : (
              'JOIN ROOM'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}