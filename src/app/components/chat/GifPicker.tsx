'use client';

import React, { useState } from 'react';
import GifPicker from 'gif-picker-react';

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onGifSelect: (gif: any) => void;
  className?: string;
}

export default function GifPickerComponent({ 
  isOpen, 
  onClose, 
  onGifSelect, 
  className = '' 
}: GifPickerProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGifSelect = (gif: any) => {
    setIsLoading(true);
    try {
      onGifSelect(gif);
      onClose();
    } catch (error) {
      console.error('Error selecting GIF:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`absolute bottom-full left-0 mb-2 bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 w-[350px] sm:w-[400px] max-h-[400px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-black bg-cyan-100">
        <h3 className="text-sm font-bold text-black font-mono flex items-center gap-1">
          <span>🎬</span>
          <span>GIFS</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-cyan-200 transition-colors border border-black bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
          title="Close"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* GIF Picker Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
              <span className="text-xs font-mono text-black">Loading...</span>
            </div>
          </div>
        ) : (
          <GifPicker
            tenorApiKey={process.env.NEXT_PUBLIC_TENOR_APIKEY || process.env.TENOR_APIKEY || ''}
            onGifClick={handleGifSelect}
            width="100%"
            height="300px"
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-black bg-cyan-50">
        <p className="text-xs text-black font-mono text-center">
          Powered by Tenor
        </p>
      </div>
    </div>
  );
}
