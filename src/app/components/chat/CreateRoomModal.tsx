'use client';

import React, { useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/types/events';
import { useToast } from '@/components/Toast';

interface CreateRoomModalProps {
  isVisible: boolean;
  onClose: () => void;
  onRoomCreated?: (room: any) => void;
}

export default function CreateRoomModal({ isVisible, onClose, onRoomCreated }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 1 as 0 | 1 // 0 = private, 1 = public
  });
  const [isLoading, setIsLoading] = useState(false);
  const { sendMessage, on, off } = useWebSocket();
  const { showToast } = useToast();

  React.useEffect(() => {
    if (!isVisible) {
      // Reset form when modal is closed
      setFormData({
        name: '',
        description: '',
        privacy: 1
      });
      setIsLoading(false);
      return;
    }

    const handleRoomCreated = (payload: any) => {
      console.log('✅ [CreateRoomModal] Room created:', payload.room);
      showToast({
        type: 'success',
        title: 'Room Created!',
        message: `Room "${payload.room.name}" has been created successfully.`
      });
      setIsLoading(false);
      
      // Reset form data
      setFormData({
        name: '',
        description: '',
        privacy: 1
      });
      
      onRoomCreated?.(payload.room);
      onClose();
    };

    const handleRoomError = (payload: any) => {
      console.error('❌ [CreateRoomModal] Room creation error:', payload.message);
      showToast({
        type: 'error',
        title: 'Room Creation Failed',
        message: payload.message
      });
      setIsLoading(false);
    };

    on(SERVER_EVENTS.ROOM_CREATED, handleRoomCreated);
    on(SERVER_EVENTS.ROOM_ERROR, handleRoomError);

    return () => {
      off(SERVER_EVENTS.ROOM_CREATED, handleRoomCreated);
      off(SERVER_EVENTS.ROOM_ERROR, handleRoomError);
    };
  }, [isVisible, on, off, onRoomCreated, onClose, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!formData.name.trim()) {
      showToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Room name is required'
      });
      return;
    }


    setIsLoading(true);
    sendMessage(CLIENT_EVENTS.CREATE_ROOM, {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      privacy: formData.privacy
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'privacy' ? parseInt(value) : value
    }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div 
      className="w-full max-w-sm"
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      <div className="lisa-window w-full">
        <div className="lisa-titlebar">
          <div className="lisa-title">Create Room</div>
          <div className="lisa-controls">
            <button
              onClick={onClose}
              className="lisa-close"
              disabled={isLoading}
            >
               
            </button>
          </div>
        </div>
        <div className="lisa-content" style={{ padding: '12px' }}>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-black font-mono mb-2">
                Room Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter room name"
                className="w-full px-3 py-2 bg-white border-2 border-black text-black placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                disabled={isLoading}
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black font-mono mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter room description (optional)"
                className="w-full px-3 py-2 bg-white border-2 border-black text-black placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono resize-none"
                rows={3}
                disabled={isLoading}
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black font-mono mb-2">
                Privacy
              </label>
              <select
                name="privacy"
                value={formData.privacy}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border-2 border-black text-black focus:outline-none focus:border-blue-500 font-mono"
                disabled={isLoading}
              >
                <option value={1}>Public - Anyone can join</option>
                <option value={0}>Private - Invite code required</option>
              </select>
              {formData.privacy === 0 && (
                <p className="text-xs text-gray-600 font-mono mt-1">
                  Private rooms require invite codes for others to join
                </p>
              )}
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="lisa-button flex-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="lisa-button lisa-button-primary flex-1"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}
