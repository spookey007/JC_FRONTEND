// Enhanced mobile wallet detection and connection for iOS and Android

export interface WalletInfo {
  name: string;
  installed: boolean;
  mobileApp?: string;
  deepLink?: string;
  downloadUrl: string;
}

export interface WalletConnectionResult {
  success: boolean;
  publicKey?: string;
  error?: string;
  walletName?: string;
}

// Detect if we're on iOS
export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Detect if we're on Android
export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
};

// Detect if we're on mobile device
export const isMobile = (): boolean => {
  return isIOS() || isAndroid();
};

// Enhanced wallet detection for mobile devices
export const detectWallets = (): WalletInfo[] => {
  const wallets: WalletInfo[] = [
    {
      name: 'Phantom',
      installed: !!(window as any).solana?.isPhantom,
      mobileApp: 'phantom://',
      deepLink: 'phantom://browse/',
      downloadUrl: isIOS() 
        ? 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977'
        : 'https://play.google.com/store/apps/details?id=app.phantom'
    },
    {
      name: 'Solflare',
      installed: !!(window as any).solflare,
      mobileApp: 'solflare://',
      deepLink: 'solflare://browse/',
      downloadUrl: isIOS()
        ? 'https://apps.apple.com/app/solflare/id1580902717'
        : 'https://play.google.com/store/apps/details?id=com.solflare.mobile'
    },
    {
      name: 'Backpack',
      installed: !!(window as any).backpack,
      mobileApp: 'backpack://',
      deepLink: 'backpack://browse/',
      downloadUrl: isIOS()
        ? 'https://apps.apple.com/app/backpack-crypto-wallet/id6443685999'
        : 'https://play.google.com/store/apps/details?id=com.backpack.app'
    }
  ];

  return wallets;
};

// Get the best available wallet for mobile
export const getBestMobileWallet = (): WalletInfo | null => {
  const wallets = detectWallets();
  const installedWallets = wallets.filter(w => w.installed);
  
  if (installedWallets.length > 0) {
    // Prefer Phantom if available
    return installedWallets.find(w => w.name === 'Phantom') || installedWallets[0];
  }
  
  // Return Phantom as default recommendation
  return wallets.find(w => w.name === 'Phantom') || null;
};

// Enhanced wallet connection with improved mobile handling
export const connectMobileWallet = async (): Promise<WalletConnectionResult> => {
  try {
    console.log('🔗 [MOBILE] Attempting wallet connection...');
    console.log('📱 [MOBILE] Device:', { isIOS: isIOS(), isAndroid: isAndroid(), isMobile: isMobile() });

    // Check if we're in a mobile browser
    if (!isMobile()) {
      return {
        success: false,
        error: 'This function is designed for mobile devices only'
      };
    }

    // Wait for wallet to be available
    const walletAvailable = await waitForWallet(3000);
    if (!walletAvailable) {
      console.log('📱 [MOBILE] Wallet not detected, checking for installation...');
      
      const bestWallet = getBestMobileWallet();
      if (!bestWallet) {
        return {
          success: false,
          error: 'No suitable wallet found'
        };
      }

      // If wallet is not installed, redirect to app store
      console.log('📱 [MOBILE] Wallet not installed, redirecting to app store...');
      
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
        
        return {
          success: false,
          error: `Please install ${bestWallet.name} wallet to continue`,
          walletName: bestWallet.name
        };
      } else {
        // For Android, directly redirect to app store
        window.location.href = bestWallet.downloadUrl;
        return {
          success: false,
          error: `Please install ${bestWallet.name} wallet to continue`,
          walletName: bestWallet.name
        };
      }
    }

    // Wallet is available, try to connect
    console.log('👛 [MOBILE] Wallet detected, attempting connection...');

    if (window.solana) {
      try {
        // Add a small delay to ensure wallet is fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const response = await window.solana.connect();
        
        if (response.publicKey) {
          console.log('✅ [MOBILE] Wallet connected successfully:', response.publicKey.toString());
          return {
            success: true,
            publicKey: response.publicKey.toString(),
            walletName: 'Mobile Wallet'
          };
        } else {
          return {
            success: false,
            error: 'Failed to get public key from wallet',
            walletName: 'Mobile Wallet'
          };
        }
      } catch (error: any) {
        console.error('❌ [MOBILE] Wallet connection failed:', error);
        
        // If connection fails, try to open the wallet app
        if (isIOS() || isAndroid()) {
          const bestWallet = getBestMobileWallet();
          if (bestWallet && bestWallet.deepLink) {
            const deepLinkUrl = bestWallet.deepLink + encodeURIComponent(window.location.href);
            window.location.href = deepLinkUrl;
            
            return {
              success: false,
              error: 'Please complete the connection in your wallet app',
              walletName: bestWallet.name
            };
          }
        }
        
        return {
          success: false,
          error: error.message || 'Failed to connect wallet',
          walletName: 'Mobile Wallet'
        };
      }
    }

    return {
      success: false,
      error: 'Wallet not available',
      walletName: 'Mobile Wallet'
    };

  } catch (error: any) {
    console.error('💥 [MOBILE] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error occurred'
    };
  }
};

// Check if wallet is already connected
export const isWalletConnected = (): boolean => {
  return !!(window as any).solana?.isConnected && !!(window as any).solana?.publicKey;
};

// Get current wallet address
export const getCurrentWalletAddress = (): string | null => {
  if (isWalletConnected()) {
    return (window as any).solana.publicKey.toString();
  }
  return null;
};

// Disconnect wallet
export const disconnectWallet = async (): Promise<void> => {
  try {
    if (window.solana && window.solana.disconnect) {
      await window.solana.disconnect();
    }
  } catch (error) {
    console.error('❌ [MOBILE] Error disconnecting wallet:', error);
  }
};

// Enhanced wallet detection with retry logic for mobile
export const waitForWallet = (timeout: number = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if wallet is already available
    if (window.solana && (window.solana.isPhantom || window.solana.isConnected !== undefined)) {
      console.log('📱 [MOBILE] Wallet already available');
      resolve(true);
      return;
    }

    let attempts = 0;
    const maxAttempts = timeout / 200; // Check every 200ms
    
    const checkWallet = () => {
      attempts++;
      
      // Check for various wallet indicators
      if (window.solana && (window.solana.isPhantom || window.solana.isConnected !== undefined)) {
        console.log('📱 [MOBILE] Wallet detected after', attempts * 200, 'ms');
        resolve(true);
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.log('📱 [MOBILE] Wallet not detected after', timeout, 'ms');
        resolve(false);
        return;
      }
      
      setTimeout(checkWallet, 200);
    };
    
    checkWallet();
  });
};

// iOS-specific wallet connection with user gesture requirement
export const connectWalletWithUserGesture = async (): Promise<WalletConnectionResult> => {
  if (!isIOS()) {
    return connectMobileWallet();
  }

  // For iOS, we need to ensure this is called from a user gesture
  return new Promise((resolve) => {
    const handleUserGesture = async () => {
      const result = await connectMobileWallet();
      resolve(result);
    };

    // Try to connect immediately if we're in a user gesture context
    handleUserGesture().catch(() => {
      // If that fails, wait for user interaction
      const button = document.createElement('button');
      button.textContent = 'Connect Wallet';
      button.style.position = 'fixed';
      button.style.top = '50%';
      button.style.left = '50%';
      button.style.transform = 'translate(-50%, -50%)';
      button.style.zIndex = '9999';
      button.style.padding = '12px 24px';
      button.style.fontSize = '16px';
      button.style.backgroundColor = '#007AFF';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '8px';
      button.style.cursor = 'pointer';
      
      button.onclick = async () => {
        document.body.removeChild(button);
        const result = await connectMobileWallet();
        resolve(result);
      };
      
      document.body.appendChild(button);
    });
  });
};
