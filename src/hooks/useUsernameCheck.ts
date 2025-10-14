import { useState, useCallback, useRef } from 'react';

interface UsernameCheckResult {
  available: boolean;
  message: string;
}

interface UseUsernameCheckReturn {
  checkUsername: (username: string) => Promise<UsernameCheckResult>;
  isChecking: boolean;
  lastResult: UsernameCheckResult | null;
}

export const useUsernameCheck = (): UseUsernameCheckReturn => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<UsernameCheckResult | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkUsername = useCallback(async (username: string): Promise<UsernameCheckResult> => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't check empty usernames
    if (!username || username.trim().length === 0) {
      const result = { available: false, message: 'Username is required' };
      setLastResult(result);
      return result;
    }

    // Don't check if username is too short
    if (username.length < 3) {
      const result = { available: false, message: 'Username must be at least 3 characters' };
      setLastResult(result);
      return result;
    }

    // Debounce the API call
    return new Promise((resolve) => {
      timeoutRef.current = setTimeout(async () => {
        setIsChecking(true);
        
        try {
          const { apiFetch } = await import('../lib/api');
          const res = await apiFetch(`/auth/username/check/${encodeURIComponent(username)}`, {
            method: 'GET',
          });
          
          const result = await res.json();
          setLastResult(result);
          resolve(result);
        } catch (error) {
          console.error('Username check failed:', error);
          const result = { available: false, message: 'Failed to check username availability' };
          setLastResult(result);
          resolve(result);
        } finally {
          setIsChecking(false);
        }
      }, 500); // 500ms debounce
    });
  }, []);

  return {
    checkUsername,
    isChecking,
    lastResult,
  };
};
