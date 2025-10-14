// Simple auth utilities for session-based authentication
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { authService } = await import('./authService');
    const user = await authService.fetchUser();
    return !!user;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
};

export const getSessionToken = (): string | null => {
  if (typeof window !== 'undefined') {
    // Get session token from cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'l4_session') {
        return decodeURIComponent(value);
      }
    }
  }
  return null;
};

export const getCurrentUser = async () => {
  try {
    const { authService } = await import('./authService');
    const user = await authService.fetchUser();
    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
};
