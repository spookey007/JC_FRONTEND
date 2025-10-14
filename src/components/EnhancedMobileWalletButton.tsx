"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { 
  connectMobileWallet, 
  isMobile, 
  isIOS, 
  isAndroid, 
  getBestMobileWallet,
  waitForWallet
} from '@/lib/mobileWallet';

interface EnhancedMobileWalletButtonProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  className?: string;
  children?: React.ReactNode;
  showDisconnect?: boolean;
}

export default function EnhancedMobileWalletButton({ 
  onConnect, 
  onDisconnect, 
  className = "",
  children,
  showDisconnect = false
}: EnhancedMobileWalletButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Use wallet adapter hooks
  const { connected, publicKey, connect, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  // Sync with wallet adapter state
  useEffect(() => {
    if (connected && publicKey) {
      setWalletAddress(publicKey.toString());
      setIsConnected(true);
      setError(null);
    } else {
      setWalletAddress(null);
      setIsConnected(false);
    }
  }, [connected, publicKey]);

  const handleConnect = async () => {
    if (!isMobile()) {
      // For desktop, use wallet modal
      setVisible(true);
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      setRetryCount(0);
      
      console.log('🔗 [ENHANCED] Starting enhanced wallet connection...');
      console.log('📱 [ENHANCED] Device:', { isMobile: isMobile(), isIOS: isIOS(), isAndroid: isAndroid() });
      
      // Wait for wallet to be available with retry logic
      let walletAvailable = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!walletAvailable && attempts < maxAttempts) {
        attempts++;
        console.log(`📱 [ENHANCED] Wallet detection attempt ${attempts}/${maxAttempts}`);
        
        walletAvailable = await waitForWallet(2000);
        
        if (!walletAvailable && attempts < maxAttempts) {
          console.log('📱 [ENHANCED] Wallet not detected, retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!walletAvailable) {
        console.log('📱 [ENHANCED] Wallet not detected after retries, checking installation...');
        
        const bestWallet = getBestMobileWallet();
        if (!bestWallet) {
          setError('No suitable wallet found');
          return;
        }

        // If wallet is not installed, redirect to app store
        console.log('📱 [ENHANCED] Wallet not installed, redirecting to app store...');
        
        if (isIOS()) {
          // For iOS, try to open the app first, then fallback to app store
          const appUrl = bestWallet.mobileApp + 'browse/' + encodeURIComponent(window.location.href);
          
          // Create a temporary link to try opening the app
          const link = document.createElement('a');
          link.href = appUrl;
          link.style.display = 'none';
          document.body.appendChild(link);
          
          // Try to open the app
          link.click();
          
          // If the app doesn't open within 2 seconds, redirect to app store
          setTimeout(() => {
            window.location.href = bestWallet.downloadUrl;
          }, 2000);
          
          setError(`Please install ${bestWallet.name} wallet to continue`);
          return;
        } else {
          // For Android, directly redirect to app store
          window.location.href = bestWallet.downloadUrl;
          setError(`Please install ${bestWallet.name} wallet to continue`);
          return;
        }
      }

      // Wallet is available, try to connect
      console.log('👛 [ENHANCED] Wallet detected, attempting connection...');

      if (window.solana) {
        try {
          // Add a small delay to ensure wallet is fully loaded
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const response = await window.solana.connect();
          
          if (response.publicKey) {
            console.log('✅ [ENHANCED] Wallet connected successfully:', response.publicKey.toString());
            setWalletAddress(response.publicKey.toString());
            setIsConnected(true);
            setWalletName('Mobile Wallet');
            setError(null);
            
            if (onConnect) {
              onConnect(response.publicKey.toString());
            }
          } else {
            throw new Error('Failed to get public key from wallet');
          }
        } catch (error: any) {
          console.error('❌ [ENHANCED] Wallet connection failed:', error);
          
          // If connection fails, try to open the wallet app
          if (isIOS() || isAndroid()) {
            const bestWallet = getBestMobileWallet();
            if (bestWallet && bestWallet.deepLink) {
              const deepLinkUrl = bestWallet.deepLink + encodeURIComponent(window.location.href);
              window.location.href = deepLinkUrl;
              
              setError('Please complete the connection in your wallet app');
              return;
            }
          }
          
          // Retry logic for connection failures
          if (retryCount < 2) {
            console.log(`🔄 [ENHANCED] Retrying connection (${retryCount + 1}/2)...`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => handleConnect(), 1000);
            return;
          }
          
          setError(error.message || 'Failed to connect wallet. Please try again.');
        }
      } else {
        setError('Wallet not available');
      }
    } catch (error: any) {
      console.error('💥 [ENHANCED] Unexpected error:', error);
      setError(error.message || 'Unexpected error occurred');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      console.log('🔌 [ENHANCED] Disconnecting wallet...');
      
      if (isMobile()) {
        // For mobile, we can't programmatically disconnect
        setWalletAddress(null);
        setIsConnected(false);
        setWalletName(null);
        setError(null);
      } else {
        // For desktop, use wallet adapter
        disconnect();
      }
      
      console.log('✅ [ENHANCED] Wallet disconnected successfully');
      
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (error) {
      console.error('❌ [ENHANCED] Error disconnecting wallet:', error);
    }
  };

  // Don't render on desktop if not mobile
  if (!isMobile() && !children) {
    return null;
  }

  const formatAddress = (address: string) => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className={`enhanced-mobile-wallet-button ${className}`}>
      {children || (
        <>
          {!isConnected ? (
            <motion.button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isConnecting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </div>
              ) : (
                'Connect Wallet'
              )}
            </motion.button>
          ) : (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-green-800">
                  {walletName} • {formatAddress(walletAddress || '')}
                </span>
              </div>
              {showDisconnect && (
                <button
                  onClick={handleDisconnect}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm"
            >
              {error}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
