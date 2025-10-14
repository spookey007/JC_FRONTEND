'use client';

import React, { useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/types/events';
import { useToastNotifications } from '@/components/Toast';

interface RoomInviteModalProps {
  isVisible: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export default function RoomInviteModal({ isVisible, onClose, roomId, roomName }: RoomInviteModalProps) {
  const { sendMessage, on, off } = useWebSocket();
  const toast = useToastNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('');

  React.useEffect(() => {
    if (!isVisible) return;

    const handleInviteCreated = (data: any) => {
      setInviteCode(data.invite.inviteCode);
      setIsLoading(false);
      toast.success('Invite created successfully!');
    };

    const handleError = (data: any) => {
      setIsLoading(false);
      toast.error(data.message || 'Failed to create invite');
    };

    on(SERVER_EVENTS.ROOM_INVITE_CREATED, handleInviteCreated);
    on(SERVER_EVENTS.ROOM_ERROR, handleError);

    return () => {
      off(SERVER_EVENTS.ROOM_INVITE_CREATED, handleInviteCreated);
      off(SERVER_EVENTS.ROOM_ERROR, handleError);
    };
  }, [isVisible, on, off, toast]);

  const handleCreateInvite = () => {
    if (isLoading) return;
    
    console.log('🔍 [INVITE] Creating invite for room:', roomId);
    setIsLoading(true);
    sendMessage(CLIENT_EVENTS.CREATE_ROOM_INVITE, {
      roomId,
      message: customMessage || null,
      expiresInHours
    });
  };

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      toast.success('Copied!', 'Invite code copied to clipboard!');
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setCustomMessage('');
    setExpiresInHours(24);
    setIsLoading(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="lisa-window w-80 max-w-sm mx-auto">
        <div className="lisa-titlebar">
          <div className="lisa-titlebar-title">Invite to {roomName}</div>
          <button
            onClick={handleClose}
            className="lisa-close"
            disabled={isLoading}
          >
             
          </button>
        </div>
        
        <div className="lisa-content" style={{ padding: '12px' }}>
          {!inviteCode ? (
            <div className="space-y-3">              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires In
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                >
                  <option value={1}>1 Hour</option>
                  <option value={6}>6 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={72}>3 Days</option>
                  <option value={168}>1 Week</option>
                </select>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateInvite}
                  disabled={isLoading}
                  className="lisa-button lisa-button-primary flex-1"
                >
                  {isLoading ? 'Creating...' : 'Create Invite'}
                </button>
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="lisa-button flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">Invite Code Created!</div>
                <div className="bg-gray-100 border border-gray-300 rounded-md p-3 font-mono text-sm text-center break-all">
                  {inviteCode}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Share this code with users to invite them to the room
                </div>
              </div>
              
              <div className="text-xs text-gray-500 text-center">
                Expires in {expiresInHours} hour{expiresInHours !== 1 ? 's' : ''}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleCopyInviteCode}
                  className="lisa-button lisa-button-primary flex-1"
                >
                  Copy Code
                </button>
                <button
                  onClick={handleClose}
                  className="lisa-button flex-1"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
