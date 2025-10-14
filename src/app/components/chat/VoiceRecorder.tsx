'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLisaSounds } from '@/lib/lisaSounds';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
  isSending?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel, isSending = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { playButtonClick, playHoverSound } = useLisaSounds();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      playButtonClick();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      playButtonClick();
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const sendRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full mx-4 relative"
      style={{ 
        fontFamily: 'var(--font-primary)',
        borderRadius: '4px'
      }}
    >
      {/* Lisa GUI Title Bar */}
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between border-b-2 border-black">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 border border-white"></div>
          <div className="w-3 h-3 bg-yellow-500 border border-white"></div>
          <div className="w-3 h-3 bg-green-500 border border-white"></div>
          <span className="text-xs font-mono font-bold ml-2">VOICE RECORDER v1.0</span>
        </div>
        
        {/* Close Button */}
        <button
          onClick={onCancel}
          onMouseEnter={() => playHoverSound()}
          className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110"
          style={{ borderRadius: '2px' }}
        >
          ×
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {/* Loading Overlay */}
        {isSending && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10" style={{ borderRadius: '4px' }}>
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin mx-auto mb-2" style={{ borderRadius: '50%' }}></div>
              <p className="text-sm text-black font-mono font-bold">SENDING VOICE MESSAGE...</p>
            </div>
          </div>
        )}

      {!audioBlob ? (
        // Recording state
        <div className="text-center">
          <div className="mb-6">
            <motion.div
              className="w-16 h-16 mx-auto mb-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center cursor-pointer transition-all duration-200"
              onClick={isRecording ? stopRecording : startRecording}
              animate={{
                scale: isRecording ? [1, 1.05, 1] : 1,
                backgroundColor: isRecording ? '#ff4444' : '#0000ff'
              }}
              transition={{
                scale: { duration: 0.8, repeat: isRecording ? Infinity : 0 },
                backgroundColor: { duration: 0.2 }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ borderRadius: '4px' }}
            >
              <span className="text-white text-xl font-mono">
                {isRecording ? '⏹' : '🎤'}
              </span>
            </motion.div>
            
            <p className="text-sm text-black mb-2 font-mono font-bold">
              {isRecording ? 'RECORDING...' : 'CLICK TO RECORD'}
            </p>
            
            {isRecording && (
              <div className="bg-red-100 border-2 border-black px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block">
                <p className="text-lg font-mono font-bold text-red-600">
                  {formatTime(recordingTime)}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Playback state
        <div className="text-center">
          <div className="mb-6">
            <motion.div
              className="w-16 h-16 mx-auto mb-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center bg-blue-500 cursor-pointer transition-all duration-200"
              onClick={playRecording}
              animate={{
                scale: isPlaying ? [1, 1.05, 1] : 1
              }}
              transition={{
                scale: { duration: 0.8, repeat: isPlaying ? Infinity : 0 }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ borderRadius: '4px' }}
            >
              <span className="text-white text-xl font-mono">
                {isPlaying ? '⏸' : '▶'}
              </span>
            </motion.div>
            
            <p className="text-sm text-black mb-2 font-mono font-bold">
              {isPlaying ? 'PLAYING...' : 'CLICK TO PLAY'}
            </p>
            
            <div className="bg-blue-100 border-2 border-black px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block">
              <p className="text-sm font-mono font-bold text-blue-600">
                {formatTime(recordingTime)}
              </p>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            onEnded={handleAudioEnded}
            preload="metadata"
          />

          <div className="flex gap-2 justify-center">
            <motion.button
              onClick={sendRecording}
              onMouseEnter={() => !isSending && playHoverSound()}
              whileHover={!isSending ? { scale: 1.05 } : {}}
              whileTap={!isSending ? { scale: 0.95 } : {}}
              disabled={isSending}
              className={`px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-mono font-bold text-sm flex items-center gap-2 transition-all duration-200 ${
                isSending 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              style={{ borderRadius: '4px' }}
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" style={{ borderRadius: '50%' }}></div>
                  SENDING...
                </>
              ) : (
                'SEND'
              )}
            </motion.button>
            
            <motion.button
              onClick={deleteRecording}
              onMouseEnter={() => !isSending && playHoverSound()}
              whileHover={!isSending ? { scale: 1.05 } : {}}
              whileTap={!isSending ? { scale: 0.95 } : {}}
              disabled={isSending}
              className={`px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-mono font-bold text-sm transition-all duration-200 ${
                isSending 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              style={{ borderRadius: '4px' }}
            >
              DELETE
            </motion.button>
          </div>
        </div>
      )}
      </div>
    </motion.div>
  );
}
