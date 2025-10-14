/**
 * Centralized authentication service with caching
 * Prevents multiple /auth/me API calls
 */

interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  walletAddress: string | null;
  avatarUrl: string | null;
  avatarBlob?: string;
  isVerified: boolean;
  isAdmin: boolean;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  lastSeen: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  lastFetch: number | null;
  isInitialized: boolean;
}

class AuthService {
  private state: AuthState = {
    user: null,
    isLoading: false,
    lastFetch: null,
    isInitialized: false
  };

  private listeners: Set<(state: AuthState) => void> = new Set();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Notify all listeners of state changes
   */
  private notify() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  /**
   * Set user data (used internally)
   */
  setUser(user: User | null) {
    this.state.user = user;
    this.state.lastFetch = Date.now();
    this.state.isInitialized = true;
    this.notify();
  }

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean) {
    this.state.isLoading = isLoading;
    this.notify();
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.state.lastFetch) return false;
    return Date.now() - this.state.lastFetch < this.CACHE_DURATION;
  }

  /**
   * Fetch user data from WebSocket authentication (with caching)
   */
  async fetchUser(forceRefresh = false): Promise<User | null> {
    console.log('🔄 [AuthService] fetchUser called', { forceRefresh, hasCachedUser: !!this.state.user });
    
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid() && this.state.user) {
      console.log('📋 [AuthService] Using cached user data');
      return this.state.user;
    }

    // Prevent multiple simultaneous requests
    if (this.state.isLoading) {
      return new Promise((resolve) => {
        const unsubscribe = this.subscribe((state) => {
          if (!state.isLoading) {
            unsubscribe();
            resolve(state.user);
          }
        });
      });
    }

    this.setLoading(true);

    try {
      console.log('🔄 [AuthService] Attempting to fetch user data from Redis...');
      
      // Try to get user data from Redis storage (stored during WebSocket auth)
      const { redisStorage } = await import('@/lib/storageService');
      console.log('✅ [AuthService] Redis storage imported successfully');
      
      const userDataString = await redisStorage.getItem('user_data');
      console.log('🔍 [AuthService] User data string from Redis:', userDataString ? 'found' : 'not found');
      
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        console.log('✅ [AuthService] User data retrieved from WebSocket auth storage:', userData);
        
        // Ensure user has all required fields
        const userWithDefaults: User = {
          ...userData,
          username: userData.username || null,
          displayName: userData.displayName || null,
          walletAddress: userData.walletAddress || null,
          avatarUrl: userData.avatarUrl || null,
          status: (userData.status && ['online', 'idle', 'dnd', 'offline'].includes(userData.status)) 
            ? userData.status as 'online' | 'idle' | 'dnd' | 'offline'
            : 'online',
          lastSeen: userData.lastSeen || new Date().toISOString(),
          isVerified: userData.isVerified || false,
          isAdmin: userData.isAdmin || false, // Ensure isAdmin is properly set
          role: userData.role || 'user'
        };

        this.setUser(userWithDefaults);
        
        // Also update the chat store with the user data
        try {
          const { useChatStore } = await import('@/stores/chatStore');
          const { setCurrentUser } = useChatStore.getState();
          
          // Convert to chatStore User format
          const chatUser = {
            ...userWithDefaults,
            role: userWithDefaults.role ? parseInt(userWithDefaults.role, 10) : undefined,
            isAdmin: userWithDefaults.isAdmin || false
          };
          
          setCurrentUser(chatUser);
          console.log('✅ [AuthService] User data synced to chat store');
        } catch (error) {
          console.warn('⚠️ [AuthService] Failed to sync user data to chat store:', error);
        }
        
        return userWithDefaults;
      } else {
        console.log('❌ No user data in response');
        this.setUser(null);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to fetch user data:', error);
      this.setUser(null);
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Clear user data (logout)
   */
  async clearUser() {
    this.setUser(null);
    
    // Also clear the chat store
    try {
      const { useChatStore } = await import('@/stores/chatStore');
      const { setCurrentUser } = useChatStore.getState();
      setCurrentUser(null);
      console.log('✅ [AuthService] User data cleared from chat store');
    } catch (error) {
      console.warn('⚠️ [AuthService] Failed to clear user data from chat store:', error);
    }
  }

  /**
   * Initialize auth (call once on app start)
   */
  async initialize(): Promise<User | null> {
    if (this.state.isInitialized) {
      return this.state.user;
    }

    console.log('🚀 Initializing auth service...');
    return await this.fetchUser();
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export hook for React components
export function useAuth() {
  const [state, setState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    const unsubscribe = authService.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    user: state.user,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    fetchUser: authService.fetchUser.bind(authService),
    clearUser: authService.clearUser.bind(authService)
  };
}

// Import React hooks
import { useState, useEffect } from 'react';
