"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import CircularGallery from './components/CircularGallery';
import { useAudio } from "@/contexts/AudioContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { isMobile, isIOS, isAndroid } from "@/lib/mobileWallet";
import EnhancedMobileWalletButton from "@/components/EnhancedMobileWalletButton";
import ChatWidget from "@/app/components/ChatWidget";

// Typewriter Text Component
const TypewriterText = ({ text, speed = 100 }: { text: string; speed?: number }) => {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  return (
    <span>
      {displayText}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="ml-1"
      >
        |
      </motion.span>
    </span>
  );
};

export default function Loader({ children }: { children: React.ReactNode }) {
  
  // Wallet and WebSocket state
  const { connected, publicKey, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { isConnected: socketConnected, isConnecting: socketConnecting, connectIfAuthenticated } = useWebSocket();
  
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const { audioEnabled, toggleAudio } = useAudio();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Twitter auth state
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [twitterUser, setTwitterUser] = useState<any>(null);
  
  // Audio functionality - commented out for future use
  // const [audioStarted, setAudioStarted] = useState(false);
  // const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  // const [currentMusic, setCurrentMusic] = useState<string | null>(null);
  // const currentMusicRef = useRef<string | null>(null);
  // const audioRef = useRef<HTMLAudioElement>(null);
  // const musicRef = useRef<HTMLAudioElement>(null);
  
  // Loading state management
  const [walletConnected, setWalletConnected] = useState(false);
  const [socketAuthenticated, setSocketAuthenticated] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Music selection functionality - commented out for future use
  // const handleMusicSelection = useCallback((item: { image: string; text: string; music?: string }, index: number) => {
  //   console.log('🎵 [LOADER MUSIC SELECTION]', {
  //     item: item,
  //     index: index,
  //     music: item.music,
  //     image: item.image,
  //     text: item.text
  //   });
  //   
  //   if (item.music) {
  //     setCurrentMusic(item.music);
  //     currentMusicRef.current = item.music;
  //     console.log('🎵 [MUSIC SET]', {
  //       previousMusic: currentMusicRef.current,
  //       newMusic: item.music
  //     });
  //     
  //     // Set up the audio file for the loader
  //     if (musicRef.current) {
  //       musicRef.current.src = item.music;
  //       musicRef.current.load(); // Load the audio file
  //       
  //       // If audio is enabled and we're in loading state, start playing
  //       if (audioEnabled && audioStarted) {
  //         musicRef.current.play().catch(e => console.log("Audio play failed:", e));
  //       }
  //       
  //       console.log('🎵 [AUDIO LOADED]', {
  //         src: musicRef.current.src,
  //         readyState: musicRef.current.readyState,
  //         audioEnabled: audioEnabled,
  //         audioStarted: audioStarted
  //       });
  //     }
  //   } else {
  //     console.log('🎵 [NO MUSIC]', 'Item has no music property');
  //   }
  // }, [audioEnabled, audioStarted]);

  // Handle wallet connection - COMMENTED OUT FOR NOW
  // const handleWalletConnect = useCallback(async () => {
  //   console.log('🔗 [LOADER] Opening wallet modal');
  //   
  //   if (isMobile()) {
  //     console.log('📱 [LOADER] Mobile wallet connection initiated');
  //     // For mobile, we'll use the standard wallet modal which should work better
  //     // The mobile detection and connection logic is handled by the wallet adapter
  //   }
  //   
  //   setVisible(true);
  // }, [setVisible]);

  // Handle Twitter OAuth connection
  const handleTwitterConnect = useCallback(async () => {
    console.log('🐦 [LOADER] Initiating Twitter OAuth');
    
    try {
      // Redirect to Twitter OAuth
      const twitterAuthUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://jaime.capital/api'}/auth/twitter`;
      window.location.href = twitterAuthUrl;
    } catch (error) {
      console.error('❌ [LOADER] Twitter OAuth failed:', error);
    }
  }, []);

  // Handle Twitter disconnect
  const handleTwitterDisconnect = useCallback(() => {
    console.log('🐦 [LOADER] Disconnecting Twitter');
    setTwitterConnected(false);
    localStorage.removeItem('jaime_twitter_connected');
  }, []);

  // Handle WebSocket authentication
  const handleSocketAuth = useCallback(async () => {
    if (connected && publicKey && !socketConnected) {
      console.log('🔌 [LOADER] Initiating WebSocket authentication');
      try {
        await connectIfAuthenticated();
        setSocketAuthenticated(true);
        console.log('✅ [LOADER] WebSocket authentication successful');
      } catch (error) {
        console.error('❌ [LOADER] WebSocket authentication failed:', error);
      }
    }
  }, [connected, publicKey, socketConnected, connectIfAuthenticated]);

  // Monitor wallet connection state
  useEffect(() => {
    console.log('🔗 [LOADER] Wallet state changed', {
      connected,
      publicKey: publicKey?.toString(),
      walletConnected,
      socketAuthenticated
    });
    
    if (connected && publicKey) {
      setWalletConnected(true);
      // Trigger WebSocket authentication
      handleSocketAuth();
    } else {
      setWalletConnected(false);
      setSocketAuthenticated(false);
    }
  }, [connected, publicKey, handleSocketAuth, walletConnected, socketAuthenticated]);

  // Check for Twitter OAuth success and restore state from localStorage
  useEffect(() => {
    // Check if Twitter was previously connected
    const savedTwitterState = localStorage.getItem('jaime_twitter_connected');
    if (savedTwitterState === 'true') {
      console.log('🐦 [LOADER] Restoring Twitter connection from localStorage');
      setTwitterConnected(true);
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      console.log('🐦 [LOADER] Twitter OAuth successful!');
      setTwitterConnected(true);
      
      // Save to localStorage for persistence
      localStorage.setItem('jaime_twitter_connected', 'true');
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // You can fetch user data here if needed
      // fetchTwitterUserData();
    } else if (authStatus === 'error') {
      const errorMessage = urlParams.get('message');
      console.error('❌ [LOADER] Twitter OAuth failed:', errorMessage);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Monitor WebSocket connection state
  useEffect(() => {
    if (socketConnected) {
      setSocketAuthenticated(true);
    }
  }, [socketConnected]);

  // Check if loading is complete
  useEffect(() => {
    if (walletConnected && socketAuthenticated && !loadingComplete) {
      console.log('🎉 [LOADER] All systems ready!');
      setLoadingComplete(true);
      // Complete the loading process
      setTimeout(() => {
        setLoading(false);
      }, 1000); // Reduced to 1 second
    }
  }, [walletConnected, socketAuthenticated, loadingComplete]);

  // Fallback: Complete loading after maximum time even if socket not connected
  useEffect(() => {
    if (started && walletConnected && !loadingComplete) {
      const fallbackTimer = setTimeout(() => {
        console.log('⏰ [LOADER] Fallback timer - completing loading');
        setLoadingComplete(true);
        setTimeout(() => {
          setLoading(false);
        }, 1000);
      }, 8000); // Complete after 8 seconds maximum

      return () => clearTimeout(fallbackTimer);
    }
  }, [started, walletConnected, loadingComplete]);

  const startLoading = useCallback(() => {
    console.log('🚀 [LOADER] startLoading called', {
      started,
      connected,
      publicKey: publicKey?.toString(),
      walletConnected,
      socketAuthenticated
    });
    
    if (!started) {
      setStarted(true);
      setLoading(true);
      
      // Wallet or Twitter should be connected at this point
      if (connected && publicKey) {
        console.log('✅ [LOADER] Wallet connected, proceeding with loading');
        setWalletConnected(true);
        handleSocketAuth();
      } else if (twitterConnected) {
        console.log('✅ [LOADER] Twitter connected, proceeding with loading');
        setWalletConnected(true); // Set as connected for loading purposes
        // Skip WebSocket auth for Twitter-only users for now
        setSocketAuthenticated(true);
      } else {
        console.log('❌ [LOADER] Neither wallet nor Twitter connected, cannot start loading');
        return; // Don't start loading if neither connected
      }
      
      // Audio handling - commented out for future use
      // if (audioEnabled && audioRef.current) {
      //   // Use selected music if available, otherwise default to aceofbase.mp3
      //   const musicToPlay = currentMusicRef.current || "/aceofbase.mp3";
      //   audioRef.current.src = musicToPlay;
      //   audioRef.current.loop = true;
      //   audioRef.current.volume = 0.3;
      //   audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      //   setAudioStarted(true);
      // }
    } else {
      console.log('⚠️ [LOADER] Loading already started, ignoring call');
    }
  }, [started, audioEnabled, connected, publicKey, handleSocketAuth, walletConnected, socketAuthenticated]);

  const handleToggleAudio = useCallback(() => {
    toggleAudio();
  }, [toggleAudio]);

  // Audio state handling - commented out for future use
  // useEffect(() => {
  //   if (audioRef.current && audioStarted) {
  //     if (audioEnabled) {
  //       // Resume music if it was paused
  //       if (audioRef.current.paused) {
  //         audioRef.current.play().catch(e => console.log("Audio resume failed:", e));
  //       }
  //     } else {
  //       // Pause music if it's playing
  //       if (!audioRef.current.paused) {
  //         audioRef.current.pause();
  //       }
  //     }
  //   }
  // }, [audioEnabled, audioStarted]);

  // useEffect(() => {
  //   if (audioRef.current && audioStarted && !audioEnabled) {
  //     // If audio is disabled, make sure music is paused
  //     audioRef.current.pause();
  //   }
  // }, [audioStarted, audioEnabled]);

  // Audio start functionality - commented out for future use
  // const startAudio = useCallback(async () => {
  //   if (audioRef.current && audioEnabled) {
  //     try {
  //       // Use selected music if available, otherwise default to aceofbase.mp3
  //       const musicToPlay = currentMusicRef.current || "/aceofbase.mp3";
  //       audioRef.current.src = musicToPlay;
  //       audioRef.current.loop = true;
  //       audioRef.current.volume = 0.3;
  //       await audioRef.current.play();
  //       setAudioStarted(true);
  //       setShowAudioPrompt(false);
  //     } catch (error) {
  //       console.log("Audio autoplay failed:", error);
  //       setShowAudioPrompt(true);
  //     }
  //   }
  // }, [audioEnabled]);

  const handleVideoLoad = useCallback(() => {
    setVideoLoaded(true);
  }, []);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.log("Video failed to load:", e);
    const videoElement = e.target as HTMLVideoElement;
    videoElement.style.display = 'none';
  }, []);

  // Simple loading completion logic
  useEffect(() => {
    if (started && walletConnected && socketAuthenticated) {
      // Both connected, complete loading after a short delay
      setTimeout(() => {
        setLoadingComplete(true);
        setTimeout(() => {
          setLoading(false);
        }, 1000);
      }, 2000); // 2 second delay for smooth transition
    }
  }, [started, walletConnected, socketAuthenticated]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        console.log('🔍 [LOADER] Enter key pressed', {
          started,
          loading,
          loadingComplete,
          walletConnected,
          socketAuthenticated
        });
        
        // Check if user is typing in an input field
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true'
        );
        
        // Only trigger if not in an input field and not in any loading state
        if (!isInputField && !started && !loading && !loadingComplete) {
          console.log('🚀 [LOADER] Enter key triggering startLoading');
          startLoading();
        } else {
          console.log('🚫 [LOADER] Enter key ignored', {
            isInputField,
            started,
            loading,
            loadingComplete
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [started, loading, loadingComplete]);

  if (!started) {
    return (
      <>
        <motion.div
          className="flex flex-col items-center justify-center min-h-screen bg-white p-2 sm:p-4 relative"
          style={{
            height: '100dvh',
            overflow: 'auto'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {/* Sound Icon - Top Right Corner for Mobile */}
          {/* {isMobile() && (
            <motion.button
              onClick={handleToggleAudio}
              className="fixed top-4 right-4 z-2 w-12 h-12 bg-gray-900/80 backdrop-blur-sm border-2 border-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_12px_#00ffff]"
              whileHover={{ 
                scale: 1.1,
                backgroundColor: "#00ffff",
                boxShadow: "0 0 25px #00ffff"
              }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <motion.span 
                className="text-xl text-cyan-400"
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {audioEnabled ? '🔊' : '🔇'}
              </motion.span>
            </motion.button>
          )} */}
          {/* Video Background - Smooth Loading Only */}
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-2000 ease-in-out ${
              videoLoaded ? 'opacity-100' : 'opacity-100'
            }`}
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
          >
            <source src="/as02.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

    {/* Main Terminal Window */}
    <motion.div 
      className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl w-full bg-transparent relative z-30 flex flex-col items-center justify-center"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.8 }}
      style={{ maxHeight: '100%' }}
    >
      {/* Terminal Content */}
      <motion.div 
        className="p-3 sm:p-6 text-center space-y-3 sm:space-y-6 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        {/* Circular Gallery Disk Selection - commented out for future use */}
        {/* <motion.div 
          className="relative mx-auto"
          initial={{ scale: 0.8, opacity: 0, rotateY: -15 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ 
            delay: 0.7, 
            duration: 1,
            type: "spring",
            stiffness: 200,
            damping: 15
          }}
        >
          <div className="h-64 sm:h-80 md:h-96 lg:h-[600px] w-full relative">
            <CircularGallery 
              bend={3} 
              textColor="#ffffff" 
              borderRadius={0.05} 
              scrollEase={0.02}
              onSelectionChange={handleMusicSelection}
            />
          </div>
        </motion.div> */}


        {/* Audio Toggle - positioned right below the image (Desktop only) */}
        {/* {!isMobile() && (
          <motion.div 
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
          >
            <motion.button
              onClick={handleToggleAudio}
              className="flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-mono border-2 border-cyan-400 bg-gray-900/80 backdrop-blur-sm text-cyan-400 font-bold shadow-[0_0_12px_#00ffff] rounded-lg"
              whileHover={{ 
                scale: 1.05,
                backgroundColor: "#00ffff",
                color: "#000000",
                boxShadow: "0 0 25px #00ffff"
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span 
                className="text-lg"
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {audioEnabled ? '🔊' : '🔇'}
              </motion.span>
              <span>Sound: {audioEnabled ? 'ON' : 'OFF'}</span>
            </motion.button>
          </motion.div>
        )} */}

        {/* Chat Widget */}
        {/* <div className="mb-6">
          <ChatWidget twitterConnected={twitterConnected} />
        </div> */}

        {/* Main Action Button */}
        {isMobile() ? (
          // Mobile Wallet Button - Positioned above mobile navigation bars
          <div className="fixed top-8 left-4 right-4 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <motion.button
              onClick={() => {
                console.log('🖱️ [LOADER] Mobile button clicked', {
                  connected,
                  publicKey: publicKey?.toString(),
                  twitterConnected,
                  willStartLoading: connected && publicKey,
                  willConnectTwitter: !twitterConnected && !connected
                });
                if (connected && publicKey) {
                  startLoading();
                } else if (twitterConnected) {
                  startLoading(); // Allow chat to open with Twitter auth
                } else if (!twitterConnected) {
                  handleTwitterConnect();
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (twitterConnected) {
                  handleTwitterDisconnect();
                }
              }}
              className="w-full py-2 mt-12 bg-blue-500  text-white font-bold uppercase tracking-wider text-lg font-mono group shadow-[0_0_15px_#3b82f6] font-extrabold  relative overflow-hidden touch-manipulation select-none active:scale-95 transition-transform duration-75"
              whileHover={{ 
                scale: 1.02,
                boxShadow: "0 0 30px #3b82f6",
                backgroundColor: "#2563eb"
              }}
              whileTap={{ 
                scale: 0.98,
                boxShadow: "0 0 20px #3b82f6"
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 20,
                delay: 0.5
              }}
            >
              <motion.span 
                className="relative z-10"
                whileHover={{ scale: 1.05 }}
                animate={{ 
                  textShadow: [
                    "0 0 0px #ffffff",
                    "0 0 10px #3b82f6",
                    "0 0 0px #ffffff"
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {(connected && publicKey) || twitterConnected ? "💰 Wanna Get Rich ?" : (
                  <div className="flex items-center justify-center gap-2">
                    
                         <span>Connect using <img src="/x.png" alt="X" className="w-4 h-4 inline align-middle" /></span>
                  </div>
                )}
              </motion.span>
              
              {/* Animated glow effect */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-blue-300 to-blue-500"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 0.3 }}
                animate={{
                  background: [
                    "linear-gradient(90deg, #60a5fa, #3b82f6)",
                    "linear-gradient(90deg, #3b82f6, #60a5fa)",
                    "linear-gradient(90deg, #60a5fa, #3b82f6)"
                  ]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  opacity: { duration: 0.3 }
                }}
              />
              
              {/* Ripple effect on click */}
              <motion.div
                className="absolute inset-0 bg-white opacity-0"
                whileTap={{ 
                  opacity: 0.3,
                  scale: 1.1
                }}
                transition={{ duration: 0.1 }}
              />
            </motion.button>
          </div>
        ) : (
          // Desktop Wallet Button
          <motion.button
            onClick={() => {
              if (loading || started) {
                console.log('🖱️ [LOADER] Button click ignored - loading in progress');
                return;
              }
              console.log('🖱️ [LOADER] Button clicked', {
                connected,
                publicKey: publicKey?.toString(),
                twitterConnected,
                willStartLoading: connected && publicKey,
                willConnectTwitter: !twitterConnected && !connected
              });
              if (connected && publicKey) {
                startLoading();
              } else if (twitterConnected) {
                startLoading(); // Allow chat to open with Twitter auth
              } else if (!twitterConnected) {
                handleTwitterConnect();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (twitterConnected) {
                handleTwitterDisconnect();
              }
            }}
            disabled={loading || started}
            className={`w-full py-2 mt-12 font-bold uppercase tracking-wider text-lg sm:text-xl font-mono group font-extrabold relative overflow-hidden ${
              loading || started 
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed shadow-none' 
                : 'bg-blue-500 text-white shadow-[0_0_15px_#3b82f6]'
            }`}
            whileHover={loading || started ? {} : { 
              scale: 1.02,
              boxShadow: "0 0 30px #3b82f6",
              backgroundColor: "#2563eb"
            }}
            whileTap={loading || started ? {} : { 
              scale: 0.98,
              boxShadow: "0 0 20px #3b82f6"
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 20,
              delay: 0.5
            }}
          >
            <motion.span 
              className="relative z-10"
              whileHover={loading || started ? {} : { scale: 1.05 }}
              animate={loading || started ? {} : { 
                textShadow: [
                  "0 0 0px #ffffff",
                  "0 0 10px #3b82f6",
                  "0 0 0px #ffffff"
                ]
              }}
              transition={loading || started ? {} : { 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {loading || started 
                ? "⏳ Loading..." 
                : (connected && publicKey) || twitterConnected
                  ? "💰 Wanna Get Rich ?" 
                  : (
                      <div className="flex items-center justify-center gap-2">
                        
                         <span>Connect using <img src="/x.png" alt="X" className="w-4 h-4 inline align-middle" /></span>
                        </div>
                    )
              }
            </motion.span>
            
            {/* Animated glow effect */}
            {!loading && !started && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-blue-300 to-blue-500"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 0.3 }}
                animate={{
                  background: [
                    "linear-gradient(90deg, #60a5fa, #3b82f6)",
                    "linear-gradient(90deg, #3b82f6, #60a5fa)",
                    "linear-gradient(90deg, #60a5fa, #3b82f6)"
                  ]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  opacity: { duration: 0.3 }
                }}
              />
            )}
            
            {/* Ripple effect on click */}
            {!loading && !started && (
              <motion.div
                className="absolute inset-0 bg-white opacity-0"
                whileTap={{ 
                  opacity: 0.3,
                  scale: 1.1
                }}
                transition={{ duration: 0.1 }}
              />
            )}
          </motion.button>
        )}

      </motion.div>
    </motion.div>

    {/* Enhanced Glitch Effect */}
    <style jsx>{`
      @keyframes glitch {
        0% { opacity: 1; transform: translateX(0); }
        2% { opacity: 0.8; transform: translateX(-1px); }
        4% { opacity: 1; transform: translateX(1px); }
        6% { opacity: 0.9; transform: translateX(-1px); }
        8% { opacity: 1; transform: translateX(0); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100vh); }
      }
      .glitch-active {
        animation: glitch 0.3s ease-in-out;
      }
      .scanline {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 0, 0.3), transparent);
        animation: scanline 3s linear infinite;
        pointer-events: none;
        z-index: 25;
      }
    `}</style>
      </motion.div>
    </>
  );
  }

  if (loading) {
    return (
      <>
        {/* Audio elements - commented out for future use */}
        {/* <audio ref={audioRef} preload="auto">
          <source src="/aceofbase.mp3" type="audio/mpeg" />
        </audio> */}
        <div
          className="flex flex-col items-center justify-center min-h-screen bg-white p-4 relative"
        >
          {/* Video Background - Smooth Loading Only */}
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-2000 ease-in-out ${
              videoLoaded ? 'opacity-100' : 'opacity-100'
            }`}
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
          >
            <source src="/as01.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          
        </div>
      </>
    );
  }

  return (
    <>
      {/* Audio elements - commented out for future use */}
      {/* <audio ref={audioRef} preload="auto">
        <source src="/aceofbase.mp3" type="audio/mpeg" />
      </audio> */}
      {children}
    </>
  );
}
