import { apiFetch } from './api';

// Use the same User interface as authService
export interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  walletAddress: string | null;
  avatarUrl: string | null;
  avatarBlob?: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  lastSeen: string;
  role?: string;
  bio?: string | null; // Added bio property
  email?: string | null; // Added email property
  emailVerified?: boolean; // Added emailVerified property
}

export async function checkAdminAuth(): Promise<{ user: User | null; isAdmin: boolean }> {
  try {
    const { authService } = await import('./authService');
    const userData = await authService.fetchUser();
    
    if (!userData) {
      return { user: null, isAdmin: false };
    }

    const isAdmin = Boolean(userData.isAdmin || userData.role === "0" || (userData.role && parseInt(userData.role) === 0));
    return { user: userData, isAdmin };
  } catch (error) {
    console.error("Failed to check admin auth:", error);
    return { user: null, isAdmin: false };
  }
}

export function redirectToHome() {
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}
