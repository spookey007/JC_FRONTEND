'use client';

import React, { useState } from 'react';
import { getAllKawaiiTextEmojis, getKawaiiEmojisByType } from '@/lib/emojiUtils';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export default function EmojiPicker({ onEmojiSelect, isOpen, onClose, className = '' }: EmojiPickerProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const emojisByType = getKawaiiEmojisByType();
  const allEmojis = getAllKawaiiTextEmojis();

  // Handle emoji click
  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    onClose();
  };

  // Get emojis to display based on selected type
  const getDisplayEmojis = () => {
    if (selectedType === 'all') {
      return allEmojis;
    }
    return emojisByType[selectedType] || [];
  };

  if (!isOpen) return null;

  const displayEmojis = getDisplayEmojis();

  return (
    <div className={`absolute bottom-full left-0 mb-2 bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 w-[350px] sm:w-[350px] max-h-[300px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-black bg-pink-100">
        <h3 className="text-sm font-bold text-black font-mono">EMOJIS</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-pink-200 transition-colors border border-black bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
          title="Close"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Type Filter */}
      <div className="p-2 border-b border-black">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full p-2 text-xs border border-black bg-white focus:outline-none focus:ring-1 focus:ring-pink-400 font-mono"
        >
          <option value="all">All ({allEmojis.length})</option>
          {Object.entries(emojisByType).map(([type, emojis]) => (
            <option key={type} value={type}>
              {type} ({emojis.length})
            </option>
          ))}
        </select>
      </div>

      {/* Emoji Grid */}
      <div className="max-h-40 overflow-y-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {displayEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => handleEmojiClick(emoji)}
              className="text-[7px] p-1 w-12 h-15 hover:bg-pink-100 transition-colors border border-black bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] font-mono"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-black bg-pink-50">
        <p className="text-xs text-black font-mono text-center">
          {displayEmojis.length} emojis
        </p>
      </div>
    </div>
  );
}