"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useLisaSounds } from "@/lib/lisaSounds";
import { animations, createHoverAnimation, createTapAnimation } from "@/lib/animations";
import SoundSettings from "@/components/SoundSettings";
import { useAudio } from "@/contexts/AudioContext";
import { isMobile, isIOS, isAndroid } from "@/lib/mobileWallet";
import { useNotifications } from "@/lib/notificationService";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const demo = true;
  const { setVisible } = useWalletModal();
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [user, setUser] = useState<any>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { playMenuClick, playButtonClick, playLinkClick, playHoverSound, setEnabled } = useLisaSounds();
  const { audioEnabled, toggleAudio } = useAudio();
  const { isEnabled: chatSoundsEnabled, setEnabled: setChatSoundsEnabled } = useNotifications();

  useEffect(() => {
    console.log("Header useEffect - connected:", connected, "publicKey:", publicKey?.toString());
    console.log("📱 [HEADER] Device info:", { isMobile: isMobile(), isIOS: isIOS(), isAndroid: isAndroid() });
    if (connected && publicKey) {
      login();
    } else {
      // WebSocket handles user authentication automatically
      console.log("Header: WebSocket will handle user authentication");
    }
  }, [connected, publicKey]);

  // WebSocket handles user data updates automatically

  // Sync sound system with shared audio state
  useEffect(() => {
    setEnabled(audioEnabled);
  }, [audioEnabled, setEnabled]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }

    if (showProfileDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showProfileDropdown]);

  const toggleMobileMenu = () => {
    playMenuClick();
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  async function login() {
    if (!publicKey || !signMessage) {
      setVisible(true);
      return;
    }

    const walletAddress = publicKey.toBase58();
    
    // WebSocket handles user authentication automatically
    // No need for REST API calls - WebSocket will authenticate when connected
    console.log("Wallet connected, WebSocket will handle authentication:", walletAddress);
    
    // WebSocket will handle authentication and token management
    console.log("✅ Wallet connected, WebSocket will handle authentication");
    
    // WebSocket will handle user data synchronization
    // No need to manually set user data here
  }

  async function logout() {
    // WebSocket will handle logout automatically when wallet disconnects
    console.log("Logout handled by WebSocket");
    setUser(null);
    setShowProfileDropdown(false);
  }

  async function handleCacheRefresh() {
    try {
      playButtonClick();
      
      // Clear all caches
      console.log("🧹 [HEADER] Starting cache cleanup...");
      
      // Clear localStorage
      localStorage.clear();
      console.log("✅ [HEADER] localStorage cleared");
      
      // Clear sessionStorage
      sessionStorage.clear();
      console.log("✅ [HEADER] sessionStorage cleared");
      
      // Clear IndexedDB if available
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          }
          console.log("✅ [HEADER] IndexedDB cleared");
        } catch (error) {
          console.warn("⚠️ [HEADER] IndexedDB cleanup failed:", error);
        }
      }
      
      // Clear service worker cache if available
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log("✅ [HEADER] Service worker caches cleared");
        } catch (error) {
          console.warn("⚠️ [HEADER] Service worker cache cleanup failed:", error);
        }
      }
      
      // Show success message
      toast.success("Cache cleared successfully! Refreshing page...");
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast.error("Failed to clear cache");
    }
  }

  async function handleDisconnect() {
    try {
      playButtonClick();
      
      // Disconnect the wallet
      await disconnect();
      
      // Clear localStorage
      localStorage.clear();
      
      // Also call logout to clear server session
      await logout();
      
      // Show success message
      toast.success("Wallet disconnected successfully");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast.error("Failed to disconnect wallet");
    }
  }

  // ✅ ✅ ✅ FIXED: Add data URL prefix for base64 blobs
  const getAvatarSource = () => {
    if (user?.avatarBlob) {
      // Assume PNG — works for JPEG too in most browsers
      return `${user.avatarBlob}`;
    } else if (user?.avatarUrl) {
      return user.avatarUrl;
    } else {
      return null;
    }
  };

  const handleAudioToggle = () => {
    toggleAudio();
    // Play a sound to indicate the toggle (only if not muting)
    if (audioEnabled) {
      playButtonClick();
    }
  };

  const handleChatSoundToggle = () => {
    setChatSoundsEnabled(!chatSoundsEnabled());
    playButtonClick();
  };

  return (
    <>
      <motion.header 
        className="flex items-center justify-between pb-2 mb-6 px-2 sm:px-4 lg:px-6 pt-6 bg-transparent w-full relative " 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">

        </div>

        {/* Desktop Navigation - COMMENTED OUT */}


      {/* Mobile Menu Button */}
      {/* <div className="lg:hidden flex items-center gap-2">
        <motion.button
          onClick={toggleMobileMenu}
          onMouseEnter={() => playHoverSound()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors"
          title="Menu"
        >
          <motion.span
            className="text-xl font-bold"
            animate={{ 
              rotate: isMobileMenuOpen ? 90 : 0,
              scale: isMobileMenuOpen ? 1.1 : 1
            }}
            transition={{ duration: 0.3 }}
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </motion.span>
        </motion.button>
      </div> */}

      {/* Desktop Actions */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Chat Sound Toggle */}
        {/* <motion.button
          onClick={handleChatSoundToggle}
          onMouseEnter={() => playHoverSound()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors"
          title={chatSoundsEnabled() ? "Mute chat sounds" : "Unmute chat sounds"}
        >
          <motion.span
            className="text-2xl"
            animate={{ 
              scale: !chatSoundsEnabled() ? [1, 1.2, 1] : [1, 1.1, 1],
              rotate: !chatSoundsEnabled() ? [0, 5, -5, 0] : [0, 2, -2, 0]
            }}
            transition={{ 
              duration: !chatSoundsEnabled() ? 2 : 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {chatSoundsEnabled() ? '💬' : '🔇'}
          </motion.span>
        </motion.button> */}

        {/* Global Audio Toggle */}
        <motion.button
          onClick={handleAudioToggle}
          onMouseEnter={() => audioEnabled && playHoverSound()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors"
          title={audioEnabled ? "Mute all sounds" : "Unmute all sounds"}
        >
          <motion.span
            className="text-2xl"
            animate={{ 
              scale: !audioEnabled ? [1, 1.2, 1] : [1, 1.1, 1],
              rotate: !audioEnabled ? [0, 5, -5, 0] : [0, 2, -2, 0]
            }}
            transition={{ 
              duration: !audioEnabled ? 2 : 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </motion.span>
        </motion.button>
        
        {connected && publicKey ? (
          <div className="relative" ref={dropdownRef}>
            <motion.button
              onClick={() => {
                playMenuClick();
                setShowProfileDropdown(!showProfileDropdown);
              }}
              onMouseEnter={() => playHoverSound()}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-[#f0f0f0] border-2 border-[#808080] rounded px-3 py-2 hover:bg-[#e0e0e0] transition-colors"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                {user?.avatarBlob || user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={getAvatarSource()} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="bg-[#0000ff] w-full h-full flex items-center justify-center">
                    {user?.username ? user.username.charAt(0).toUpperCase() : publicKey.toBase58().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-sm font-semibold">
                {user?.displayName || user?.username || publicKey.toBase58().slice(0, 4) + "…" + publicKey.toBase58().slice(-4)}
              </span>
              <span className="text-xs">▼</span>
            </motion.button>

            <AnimatePresence>
              {showProfileDropdown && (
                <motion.div 
                  className="absolute right-0 top-full mt-1 w-48 bg-white border-2 border-[#808080] rounded shadow-lg z-[100]"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 50 }}
                >
                <div className="p-2 border-b border-[#808080]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                      {user?.avatarBlob || user?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={getAvatarSource()} 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="bg-[#0000ff] w-full h-full flex items-center justify-center">
                          {user?.username ? user.username.charAt(0).toUpperCase() : publicKey.toBase58().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold">
                      {user?.displayName ?? user?.username ?? "User"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                  </div>
                  {user?.role && (
                    <div className="text-xs text-[#0000ff] font-semibold">
                      {user.role}
                    </div>
                  )}
                </div>
                <div className="p-1">
                  {/* <button
                    onClick={() => {
                      playMenuClick();
                      setShowProfileDropdown(false);
                      router.push("/tokenomics");
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#f0f0f0] rounded"
                  >
                    💰 Tokenomics
                  </button> */}
                  {(user?.isAdmin || user?.role === 0) && (
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        router.push("/dashboard");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#f0f0f0] rounded"
                    >
                      📊 Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => {
                      playMenuClick();
                      setShowProfileDropdown(false);
                      router.push("/settings");
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#f0f0f0] rounded"
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={() => {
                      playMenuClick();
                      setShowProfileDropdown(false);
                      handleCacheRefresh();
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-100 text-blue-600 rounded"
                  >
                    🧹 Clean Cache & Refresh
                  </button>
                  <button
                    onClick={() => {
                      playMenuClick();
                      setShowProfileDropdown(false);
                      handleDisconnect();
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-100 text-red-600 rounded"
                  >
                    🔌 Disconnect Wallet
                  </button>
                  {/* <button
                    onClick={() => {
                      playMenuClick();
                      setShowSoundSettings(!showSoundSettings);
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#f0f0f0] rounded"
                  >
                    🔊 Sound Settings
                  </button> */}
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          // <motion.button
          //   onClick={() => {
          //     playButtonClick();
          //     setVisible(true);
          //   }}
          //   onMouseEnter={() => playHoverSound()}
          //   whileHover={{ scale: 1.05, y: -2 }}
          //   whileTap={{ scale: 0.95 }}
          //   className="lisa-button lisa-button-primary"
          // >
          //   Connect Wallet
          // </motion.button>
          <div>Coming Soon</div>
        )}
      </div>

      {/* Sound Settings Modal */}
      {/* {showSoundSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b-2 border-black bg-blue-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-black font-mono">SOUND SETTINGS</h3>
                <button 
                  onClick={() => {
                    playMenuClick();
                    setShowSoundSettings(false);
                  }}
                  className="text-black hover:text-red-600 p-1 border border-black bg-white hover:bg-red-200 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <SoundSettings />
            </div>
          </div>
        </div>
      )} */}

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && demo!=true && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="lg:hidden fixed top-0 left-0 right-0 bottom-0 z-[100] bg-white shadow-lg flex flex-col"
          >
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between border-b-2 border-[#808080] pb-4 px-2 sm:px-4 lg:px-6 pt-6 bg-transparent w-full relative z-[100] flex-shrink-0">
            <div className="flex items-center gap-3">
            <div className="border-2 border-[#808080] bg-[#f0f0f0] rounded-lg p-1">
              <Image src="/jaime.jpg" alt="Jaime.Capital Logo" width={40} height={40} className="rounded" />
            </div>
            <span className="text-xl sm:text-2xl font-bold font-[Courier_New,monospace] tracking-tight">Jaime.Capital</span>
            </div>
              <motion.button
                onClick={closeMobileMenu}
                onMouseEnter={() => playHoverSound()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#f0f0f0] text-gray-700 transition-all duration-300 hover:bg-[#e0e0e0] active:scale-90 border-2 border-[#808080]"
              >
                <span className="text-xl font-bold">✕</span>
              </motion.button>
            </div>

            {/* Mobile Menu Content */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 pb-4">
              {/* Navigation Links */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-2"
              >
                <Link
                  href="/"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#0000ff] hover:text-white transition-colors ${pathname === "/" ? "bg-[#0000ff] text-blue-700" : ""}`}
                >
                  <span className="text-xl">🏠</span>
                  <span className="font-semibold">Home</span>
                </Link>
                
                <Link
                  href="/whitepaper"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#0000ff] hover:text-white transition-colors ${pathname === "/whitepaper" ? "bg-[#0000ff] text-blue-700" : ""}`}
                >
                  <span className="text-xl">📄</span>
                  <span className="font-semibold">Whitepaper</span>
                </Link>
                
                <Link
                  href="/motherboard"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#0000ff] hover:text-white transition-colors ${pathname === "/motherboard" ? "bg-[#0000ff] text-blue-700" : ""}`}
                >
                  <span className="text-xl">🖥️</span>
                  <span className="font-semibold">Motherboard</span>
                </Link>
                
                <Link
                  href="/tokenomics"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#0000ff] hover:text-white transition-colors ${pathname === "/tokenomics" ? "bg-[#0000ff] text-blue-700" : ""}`}
                >
                  <span className="text-xl">💰</span>
                  <span className="font-semibold">Tokenomics</span>
                </Link>
              </motion.div>

              {/* Mobile Actions */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="pt-4 border-t border-[#808080] space-y-2"
              >
                {/* Chat Sound Toggle */}
                <motion.button
                  onClick={handleChatSoundToggle}
                  onMouseEnter={() => playHoverSound()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors"
                >
                  <motion.span
                    className="text-xl"
                    animate={{ 
                      scale: !chatSoundsEnabled() ? [1, 1.2, 1] : [1, 1.1, 1],
                      rotate: !chatSoundsEnabled() ? [0, 5, -5, 0] : [0, 2, -2, 0]
                    }}
                    transition={{ 
                      duration: !chatSoundsEnabled() ? 2 : 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {chatSoundsEnabled() ? '💬' : '🔇'}
                  </motion.span>
                  <span className="font-semibold">
                    {chatSoundsEnabled() ? 'Mute Chat Sounds' : 'Unmute Chat Sounds'}
                  </span>
                </motion.button>

                {/* Global Audio Toggle */}
                <motion.button
                  onClick={handleAudioToggle}
                  onMouseEnter={() => audioEnabled && playHoverSound()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors"
                >
                  <motion.span
                    className="text-xl"
                    animate={{ 
                      scale: !audioEnabled ? [1, 1.2, 1] : [1, 1.1, 1],
                      rotate: !audioEnabled ? [0, 5, -5, 0] : [0, 2, -2, 0]
                    }}
                    transition={{ 
                      duration: !audioEnabled ? 2 : 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {audioEnabled ? '🔊' : '🔇'}
                  </motion.span>
                  <span className="font-semibold">
                    {audioEnabled ? 'Mute All Sounds' : 'Unmute All Sounds'}
                  </span>
                </motion.button>

                {/* Clear Cache Button (Debug) */}
                <motion.button
                  onClick={async () => {
                    try {
                      const { useChatStore } = await import('@/stores/chatStore');
                      const { clearUserCache } = useChatStore.getState();
                      clearUserCache();
                      localStorage.clear();
                      toast.success('Cache cleared, refreshing...');
                      window.location.reload();
                    } catch (error) {
                      console.error('Failed to clear cache:', error);
                      toast.error('Failed to clear cache');
                    }
                  }}
                  onMouseEnter={() => playHoverSound()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-600 transition-colors"
                >
                  <span className="text-xl">🔄</span>
                  <span className="font-semibold">Clear Cache & Refresh</span>
                </motion.button>

                {/* Wallet Connection */}
                {connected && publicKey ? (
                  <div className="space-y-2">
                    <div className="px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0]">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                          {user?.avatarBlob || user?.avatarUrl ? (
                            <img 
                              src={getAvatarSource()} 
                              alt="Avatar" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="bg-[#0000ff] w-full h-full flex items-center justify-center">
                              {user?.username ? user.username.charAt(0).toUpperCase() : publicKey.toBase58().charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">
                            {user?.displayName ?? user?.username ?? "User"}
                          </div>
                          <div className="text-xs text-gray-600">
                            {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <motion.button
                      onClick={() => {
                        closeMobileMenu();
                        router.push("/settings");
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors"
                    >
                      <span className="text-xl">⚙️</span>
                      <span className="font-semibold">Settings</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => {
                        closeMobileMenu();
                        handleDisconnect();
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-red-300 bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                    >
                      <span className="text-xl">🔌</span>
                      <span className="font-semibold">Disconnect Wallet</span>
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    onClick={() => {
                      closeMobileMenu();
                      setVisible(true);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-[#808080] bg-[#0000ff] text-white hover:bg-blue-600 transition-colors"
                  >
                    <span className="text-xl">🔗</span>
                    <span className="font-semibold">Connect Wallet</span>
                  </motion.button>
                )}
              </motion.div>
            </div>

            {/* Mobile Menu Footer */}
            <div className="flex-shrink-0 border-t-2 border-[#808080] px-4 py-3 bg-[#f0f0f0]">
              <div className="text-center text-xs text-gray-600 font-mono">
                Jaime.Capital - Wealth Creation Future
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
    </>
  );
}