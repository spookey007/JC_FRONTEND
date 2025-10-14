"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AudioContextType {
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  toggleAudio: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Load audio state from localStorage on mount (faster than Redis)
  useEffect(() => {
    const loadAudioState = () => {
      try {
        console.log('🔊 [AudioContext] Loading audio state from localStorage...');
        const savedAudioState = localStorage.getItem('audioEnabled');
        if (savedAudioState !== null) {
          console.log('🔊 [AudioContext] Loaded audio state from localStorage:', savedAudioState);
          setAudioEnabled(JSON.parse(savedAudioState));
        } else {
          console.log('🔊 [AudioContext] No saved audio state found, using default');
        }
      } catch (error) {
        console.warn('⚠️ [AudioContext] Failed to load audio state from localStorage:', error);
      }
    };
    loadAudioState();
  }, []);

  // Save audio state to localStorage immediately and Redis as backup (with debounce)
  useEffect(() => {
    // Save to localStorage immediately for fast access
    try {
      localStorage.setItem('audioEnabled', JSON.stringify(audioEnabled));
      console.log('🔊 [AudioContext] Audio state saved to localStorage:', audioEnabled);
    } catch (error) {
      console.warn('⚠️ [AudioContext] Failed to save audio state to localStorage:', error);
    }


    // Save to Redis as backup (with debounce)
    const timeoutId = setTimeout(async () => {
      try {
        const { redisStorage } = await import('@/lib/storageService');
        console.log('🔊 [AudioContext] Saving audio state to Redis as backup:', audioEnabled);
        await redisStorage.setItem('audioEnabled', JSON.stringify(audioEnabled), 86400 * 30); // 30 days TTL
        console.log('🔊 [AudioContext] Audio state saved to Redis successfully');
      } catch (error) {
        console.warn('⚠️ [AudioContext] Failed to save audio state to Redis:', error);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [audioEnabled]);

  const toggleAudio = () => {
    setAudioEnabled(prev => !prev);
  };

  return (
    <AudioContext.Provider value={{ audioEnabled, setAudioEnabled, toggleAudio }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
