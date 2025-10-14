"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  connectMobileWallet, 
  isMobile, 
  isWalletConnected,
  getCurrentWalletAddress,
  disconnectWallet
} from '@/lib/mobileWallet';

interface MobileWalletButtonProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  className?: string;
  children?: React.ReactNode;
  showDisconnect?: boolean;
}

export default function MobileWalletButton({ 
  onConnect, 
  onDisconnect, 
  className = "",
  children,
  showDisconnect = false
}: MobileWalletButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);

  // Check wallet connection status on mount
  useEffect(() => {
    if (isMobile()) {
      if (isWalletConnected()) {
        const address = getCurrentWalletAddress();
        if (address) {
          setWalletAddress(address);
          setIsConnected(true);
          console.log('✅ [MOBILE] Wallet already connected:', address);
        }
      }
    }
  }, []);

  const handleConnect = async () => {
    if (!isMobile()) {
      console.log('⚠️ [MOBILE] This component is designed for mobile devices only');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('🔗 [MOBILE] Starting wallet connection...');
      
      const result = await connectMobileWallet();
      
      if (result.success && result.publicKey) {
        setWalletAddress(result.publicKey);
        setIsConnected(true);
        setWalletName(result.walletName || 'Mobile Wallet');
        console.log('✅ [MOBILE] Wallet connected successfully:', result.publicKey);
        
        if (onConnect) {
          onConnect(result.publicKey);
        }
      } else {
        setError(result.error || 'Failed to connect wallet');
        console.error('❌ [MOBILE] Wallet connection failed:', result.error);
      }
    } catch (error: any) {
      console.error('💥 [MOBILE] Wallet connection error:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      console.log('🔌 [MOBILE] Disconnecting wallet...');
      
      await disconnectWallet();
      
      setWalletAddress(null);
      setIsConnected(false);
      setWalletName(null);
      
      console.log('✅ [MOBILE] Wallet disconnected successfully');
      
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (error) {
      console.error('❌ [MOBILE] Error disconnecting wallet:', error);
    }
  };

  // Don't render on desktop
  if (!isMobile()) {
    return null;
  }

  const formatAddress = (address: string) => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className={`mobile-wallet-button ${className}`}>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm"
        >
          {error}
        </motion.div>
      )}
      
      {!isConnected ? (
        <motion.button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isConnecting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Connecting...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="mr-2">📱</span>
              Connect Mobile Wallet
            </div>
          )}
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-green-100 border border-green-300 rounded-lg p-3"
        >
          <div className="flex items-center">
            <span className="mr-2">✅</span>
            <div>
              <div className="text-sm font-medium text-green-800">
                {walletName || 'Mobile Wallet'}
              </div>
              <div className="text-xs text-green-600 font-mono">
                {walletAddress ? formatAddress(walletAddress) : 'Connected'}
              </div>
            </div>
          </div>
          
          {showDisconnect && (
            <motion.button
              onClick={handleDisconnect}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              Disconnect
            </motion.button>
          )}
        </motion.div>
      )}
      
      {children}
    </div>
  );
}
