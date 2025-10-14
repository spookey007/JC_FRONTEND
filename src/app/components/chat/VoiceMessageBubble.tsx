'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLisaSounds } from '@/lib/lisaSounds';

interface VoiceMessageBubbleProps {
  audioUrl: string;
  duration?: number;
  isOwn: boolean;
  timestamp: string;
  authorName: string;
  authorAvatar?: string;
}

export default function VoiceMessageBubble({
  audioUrl: url,
  duration = 0,
  isOwn,
  timestamp,
  authorName,
  authorAvatar
}: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actualDuration, setActualDuration] = useState(duration);
  const [durationCalculated, setDurationCalculated] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  
  const { playButtonClick, playHoverSound } = useLisaSounds();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set up audio element for better duration detection
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
    };
    const handleLoadedMetadata = () => {
      // Update duration when metadata loads
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        console.log('🎵 [VoiceMessageBubble] Audio metadata loaded, duration:', audio.duration);
        setActualDuration(audio.duration);
        setDurationCalculated(true);
      } else {
        console.log('🎵 [VoiceMessageBubble] Duration not available in metadata, trying alternative approach');
        // Try to get duration after a short delay
        setTimeout(() => {
          if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
            console.log('🎵 [VoiceMessageBubble] Duration found after delay:', audio.duration);
            setActualDuration(audio.duration);
            setDurationCalculated(true);
          }
        }, 100);
      }
    };

    const handleCanPlayThrough = () => {
      // Also try to get duration when audio can play through
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity && !durationCalculated) {
        console.log('🎵 [VoiceMessageBubble] Audio can play through, duration:', audio.duration);
        setActualDuration(audio.duration);
        setDurationCalculated(true);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, []);

  // Additional effect to try to get duration when URL changes
  useEffect(() => {
    if (!url) return;
    
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    
    const handleLoad = () => {
      console.log('🎵 [VoiceMessageBubble] Audio load event triggered:', {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState,
        src: audio.src
      });
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        console.log('🎵 [VoiceMessageBubble] Duration found via separate audio element:', audio.duration);
        setActualDuration(audio.duration);
        setDurationCalculated(true);
      }
    };
    
    audio.addEventListener('loadedmetadata', handleLoad);
    audio.addEventListener('canplaythrough', handleLoad);
    audio.src = url;
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoad);
      audio.removeEventListener('canplaythrough', handleLoad);
    };
  }, [url]);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      
      // Try to get duration when starting playback
      if (!durationCalculated && audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration !== Infinity) {
        console.log('🎵 [VoiceMessageBubble] Duration calculated on play:', audioRef.current.duration);
        setActualDuration(audioRef.current.duration);
        setDurationCalculated(true);
      } else if (!durationCalculated) {
        // If duration is still not available, try multiple times
        console.log('🎵 [VoiceMessageBubble] Duration not available on play, trying multiple approaches');
        const tryGetDuration = () => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration !== Infinity) {
            console.log('🎵 [VoiceMessageBubble] Duration found via retry:', audioRef.current.duration);
            setActualDuration(audioRef.current.duration);
            setDurationCalculated(true);
          }
        };
        
        // Try immediately
        tryGetDuration();
        
        // Try after 50ms
        setTimeout(tryGetDuration, 50);
        
        // Try after 200ms
        setTimeout(tryGetDuration, 200);
        
        // Try after 500ms
        setTimeout(tryGetDuration, 500);
      }
    }
    playButtonClick();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickTime = (clickX / width) * actualDuration;
    
    audioRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 max-w-xs ${isOwn ? 'ml-auto flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-gray-600">
              {authorName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Voice Message Container */}
      <div
        className={`px-4 py-3 rounded-lg ${
          isOwn
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900 border border-gray-200'
        }`}
      >
        {/* Author Name */}
        {!isOwn && (
          <div className="text-xs font-semibold mb-1 text-gray-600">
            {authorName}
          </div>
        )}

        {/* Voice Controls */}
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <motion.button
            onClick={togglePlayback}
            onMouseEnter={() => playHoverSound()}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            disabled={isLoading}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isOwn
                ? 'bg-white bg-opacity-20 hover:bg-opacity-30'
                : 'bg-blue-500 hover:bg-blue-600'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-lg">
                {isPlaying ? '⏸️' : '▶️'}
              </span>
            )}
          </motion.button>

          {/* Progress Bar */}
          <div className="flex-1 min-w-0">
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              className={`h-2 rounded-full cursor-pointer ${
                isOwn ? 'bg-white bg-opacity-30' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className={`h-full rounded-full ${
                  isOwn ? 'bg-white' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            
            {/* Time Display */}
            <div className="flex justify-between text-xs mt-1">
              <span className={isOwn ? 'text-white text-opacity-80' : 'text-gray-500'}>
                {formatTime(currentTime)}
              </span>
              <span className={isOwn ? 'text-white text-opacity-80' : 'text-gray-500'}>
                {formatTime(actualDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className={`text-xs mt-2 ${isOwn ? 'text-white text-opacity-70' : 'text-gray-500'}`}>
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
      />
    </motion.div>
  );
}
