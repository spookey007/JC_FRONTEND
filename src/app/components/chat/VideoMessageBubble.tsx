'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLisaSounds } from '@/lib/lisaSounds';

interface VideoMessageBubbleProps {
  url: string;
  duration?: number;
  isOwn: boolean;
  timestamp: string;
  authorName: string;
  authorAvatar?: string;
}

export default function VideoMessageBubble({
  url,
  duration = 0,
  isOwn,
  timestamp,
  authorName,
  authorAvatar
}: VideoMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actualDuration, setActualDuration] = useState(duration);
  const [durationCalculated, setDurationCalculated] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  
  const { playButtonClick, playHoverSound } = useLisaSounds();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleLoadedMetadata = () => {
      // Update duration when metadata loads
      if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
        console.log('🎬 [VideoMessageBubble] Video metadata loaded, duration:', video.duration);
        setActualDuration(video.duration);
        setDurationCalculated(true);
      }
    };

    const handleCanPlayThrough = () => {
      // Also try to get duration when video can play through
      if (video.duration && !isNaN(video.duration) && video.duration !== Infinity && !durationCalculated) {
        console.log('🎬 [VideoMessageBubble] Video can play through, duration:', video.duration);
        setActualDuration(video.duration);
        setDurationCalculated(true);
      }
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, []);

  const togglePlayback = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      
      // Try to get duration when starting playback
      if (!durationCalculated && videoRef.current.duration && !isNaN(videoRef.current.duration) && videoRef.current.duration !== Infinity) {
        console.log('🎬 [VideoMessageBubble] Duration calculated on play:', videoRef.current.duration);
        setActualDuration(videoRef.current.duration);
        setDurationCalculated(true);
      }
    }
    playButtonClick();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickTime = (clickX / width) * actualDuration;
    
    videoRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-xs sm:max-w-sm ${isOwn ? 'order-2' : 'order-1'}`}>
        <div className="relative bg-gray-100 rounded-lg overflow-hidden shadow-lg">
          {/* Video Element */}
          <video
            ref={videoRef}
            src={url}
            className="w-full h-auto max-h-64 object-cover"
            preload="metadata"
            onClick={togglePlayback}
            onMouseEnter={playHoverSound}
            style={{ cursor: 'pointer' }}
          />
          
          {/* Play/Pause Overlay */}
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-all duration-200 cursor-pointer"
            onClick={togglePlayback}
            onMouseEnter={playHoverSound}
          >
            {isLoading ? (
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all duration-200">
                {isPlaying ? (
                  <div className="flex space-x-1">
                    <div className="w-1 h-6 bg-gray-700"></div>
                    <div className="w-1 h-6 bg-gray-700"></div>
                  </div>
                ) : (
                  <div className="w-0 h-0 border-l-[12px] border-l-gray-700 border-y-[8px] border-y-transparent ml-1"></div>
                )}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div 
            ref={progressRef}
            className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-30 cursor-pointer"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-white transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            {formatTime(currentTime)} / {formatTime(actualDuration)}
          </div>
        </div>

        {/* Video Info */}
        <div className="mt-1 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <span>🎬</span>
            <span>Video • {formatTime(actualDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
