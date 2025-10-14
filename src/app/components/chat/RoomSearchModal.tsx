'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/types/events';
import { useToast } from '@/components/Toast';
import { getRoleName, getRoleColor, getRoleIcon } from '@/lib/roleUtils';

interface RoomSearchModalProps {
  isVisible: boolean;
  onClose: () => void;
  onJoinRoom?: (room: any) => void;
}

interface Room {
  id: string;
  name: string;
  description?: string;
  privacy: 'PUBLIC' | 'PRIVATE';
  uniqueId?: string;
  createdAt: string;
  createdByUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    role: number;
  };
  _count: {
    members: number;
  };
}

interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: number;
  status: string;
  lastSeen: string;
}

export default function RoomSearchModal({ isVisible, onClose, onJoinRoom }: RoomSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [joinPasscode, setJoinPasscode] = useState('');
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const { sendMessage, on, off } = useWebSocket();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isVisible) return;

    const handleRoomsSearchResponse = (payload: any) => {
      console.log('✅ [RoomSearchModal] Search response:', payload);
      console.log('🔍 [FRONTEND] Rooms received:', payload.rooms?.length || 0, payload.rooms?.map((r: any) => ({ name: r.name, privacy: r.privacy })));
      console.log('🔍 [FRONTEND] Users received:', payload.users?.length || 0);
      setRooms(payload.rooms || []);
      setUsers(payload.users || []);
      setIsLoading(false);
    };

    const handleRoomJoined = (payload: any) => {
      console.log('✅ [RoomSearchModal] Room joined:', payload.room);
      showToast({
        type: 'success',
        title: 'Room Joined!',
        message: `You have joined "${payload.room.name}" successfully.`
      });
      setJoiningRoomId(null);
      setJoinPasscode('');
      onJoinRoom?.(payload.room);
      onClose();
    };

    const handleInviteUsed = (payload: any) => {
      console.log('✅ [RoomSearchModal] Invite used response:', payload);
      showToast({
        type: 'success',
        title: 'Room Joined!',
        message: `You have joined "${payload.room.name}" via invite.`
      });
      setIsLoading(false);
      onJoinRoom?.(payload.room);
      onClose();
    };

    const handleDMCreated = (payload: any) => {
      console.log('✅ [RoomSearchModal] DM created:', payload.channel);
      showToast({
        type: 'success',
        title: 'DM Created!',
        message: `Started conversation with ${payload.channel.uidUser?.displayName || payload.channel.uidUser?.username || 'User'}.`
      });
      onJoinRoom?.(payload.channel);
      onClose();
    };

    const handleRoomError = (payload: any) => {
      console.error('❌ [RoomSearchModal] Room error:', payload.message);
      showToast({
        type: 'error',
        title: 'Room Error',
        message: payload.message
      });
      setJoiningRoomId(null);
      setIsLoading(false);
    };

    on(SERVER_EVENTS.ROOMS_SEARCH_RESPONSE, handleRoomsSearchResponse);
    on(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
    on(SERVER_EVENTS.ROOM_INVITE_USED, handleInviteUsed);
    on(SERVER_EVENTS.DM_CREATED, handleDMCreated);
    on(SERVER_EVENTS.ROOM_ERROR, handleRoomError);

    return () => {
      off(SERVER_EVENTS.ROOMS_SEARCH_RESPONSE, handleRoomsSearchResponse);
      off(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
      off(SERVER_EVENTS.ROOM_INVITE_USED, handleInviteUsed);
      off(SERVER_EVENTS.DM_CREATED, handleDMCreated);
      off(SERVER_EVENTS.ROOM_ERROR, handleRoomError);
    };
  }, [isVisible, on, off, onJoinRoom, onClose, showToast]);

  useEffect(() => {
    if (isVisible) {
      searchRooms();
    }
  }, [isVisible]);

  const searchRooms = () => {
    console.log('🔍 [FRONTEND] Starting search with query:', searchQuery);
    setIsLoading(true);
    
    // Check if search query looks like an invite code (alphanumeric, 20+ chars)
    const isInviteCode = /^[a-zA-Z0-9]{20,}$/.test(searchQuery.trim());
    
    if (isInviteCode) {
      console.log('🔍 [FRONTEND] Detected invite code, using USE_ROOM_INVITE');
      // Search for room by invite code
      sendMessage(CLIENT_EVENTS.USE_ROOM_INVITE, {
        inviteCode: searchQuery.trim()
      });
    } else {
      console.log('🔍 [FRONTEND] Regular search, using SEARCH_ROOMS');
      // Regular room search - show both public and private rooms
      sendMessage(CLIENT_EVENTS.SEARCH_ROOMS, {
        query: searchQuery.trim() || null
      });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchRooms();
  };

  const handleJoinRoom = (room: Room) => {
    if (String(room.privacy) === '0' || room.privacy === 'PRIVATE') {
      setJoiningRoomId(room.id);
      setJoinPasscode('');
      setSelectedRoom(room);
    } else {
      sendMessage(CLIENT_EVENTS.JOIN_ROOM, { roomId: room.id });
    }
  };

  const handleJoinWithInviteCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joiningRoomId || !joinPasscode.trim()) return;

    sendMessage(CLIENT_EVENTS.JOIN_ROOM, {
      roomId: joiningRoomId,
      inviteCode: joinPasscode.trim()
    });
  };

  const handleUserSelect = (user: User) => {
    // Create DM with selected user
    sendMessage(CLIENT_EVENTS.CREATE_DM, { 
      userId: user.id 
    });
    onClose();
  };

  const cancelJoin = () => {
    setJoiningRoomId(null);
    setJoinPasscode('');
    setSelectedRoom(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="lisa-window w-80 max-w-md max-h-[70vh] overflow-hidden mx-auto">
        <div className="lisa-titlebar">
          <div className="lisa-title">Search Rooms</div>
          <div className="lisa-controls">
            <button
              onClick={onClose}
              className="lisa-close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="lisa-content" style={{ padding: '12px' }}>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-4 space-y-3">
            <div className="flex space-x-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms by name, description, or invite code..."
                className="flex-1 px-3 py-2 bg-white border-2 border-black text-black placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="lisa-button lisa-button-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-black font-mono">Searching...</div>
              </div>
            ) : rooms.length === 0 && users.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-black font-mono">No results found</div>
              </div>
            ) : (
              <>
                {/* Users Section */}
                {users.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-700 font-mono mb-2">Users</h3>
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className="lisa-card cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 border-2 border-black flex items-center justify-center text-sm font-bold bg-white">
                              {user.avatarUrl ? (
                                <img 
                                  src={user.avatarUrl} 
                                  alt={user.displayName || user.username || 'User'}
                                  className="w-full h-full rounded-2xl object-cover"
                                />
                              ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-black font-mono">
                                {user.displayName || user.username || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-600 font-mono">
                                @{user.username || 'no-username'}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {user.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rooms Section */}
                {rooms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 font-mono mb-2">Rooms</h3>
                    <div className="space-y-2">
                      {rooms.map((room) => (
                <div
                  key={room.id}
                  className="lisa-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-bold text-black font-mono">{room.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                          (String(room.privacy) === '1' || room.privacy === 'PUBLIC') 
                            ? 'bg-green-500 text-black' 
                            : 'bg-red-500 text-white'
                        }`}>
                          {(String(room.privacy) === '1' || room.privacy === 'PUBLIC') ? 'PUBLIC' : 'PRIVATE'}
                        </span>
                      </div>
                      
                      {room.description && (
                        <p className="text-gray-700 text-sm font-mono mb-2">{room.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 font-mono">
                        <div className="flex items-center space-x-1">
                          <span>👥</span>
                          <span>{room._count.members} members</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>👤</span>
                          <span>by {room.createdByUser.displayName || room.createdByUser.username}</span>
                          <span className={`px-1 py-0.5 rounded text-xs ${getRoleColor(room.createdByUser.role)}`}>
                            {getRoleName(room.createdByUser.role)}
                          </span>
                        </div>
                        {room.privacy === 'PRIVATE' && room.uniqueId && (
                          <div className="flex items-center space-x-1">
                            <span>🔑</span>
                            <span className="font-mono text-xs">ID: {room.uniqueId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleJoinRoom(room)}
                      className="lisa-button lisa-button-primary text-sm"
                    >
                      Join
                    </button>
                  </div>
                </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invite Code Modal */}
      {joiningRoomId && selectedRoom && (
        <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4">
          <div className="lisa-window w-72 max-w-sm mx-auto">
            <div className="lisa-titlebar">
              <div className="lisa-title">Enter Invite Code</div>
            </div>
            <div className="lisa-content">
              <div className="mb-3">
                <div className="text-sm font-mono text-gray-700 mb-1">
                  <strong>{selectedRoom.name}</strong>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  by {selectedRoom.createdByUser.displayName || selectedRoom.createdByUser.username}
                </div>
              </div>
              <form onSubmit={handleJoinWithInviteCode} className="space-y-4">
                <input
                  type="text"
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value)}
                  placeholder="Enter invite code"
                  className="w-full px-3 py-2 bg-white border-2 border-black text-black placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                  autoFocus
                />
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={cancelJoin}
                    className="lisa-button flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="lisa-button lisa-button-primary flex-1"
                  >
                    Join Room
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
