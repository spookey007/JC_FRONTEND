/**
 * Debug utility for conditional logging based on environment
 * Works in both client-side and server-side environments
 */

// Safe environment detection for both client and server
const getIsDevelopment = (): boolean => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Client-side: check for development indicators
    return (
      process.env.NODE_ENV === 'development' ||
      process.env.NEXT_PUBLIC_NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('localhost')
    );
  }
  
  // Server-side: use process.env.NODE_ENV
  return process.env.NODE_ENV === 'development';
};

// Create a function that checks environment each time (for dynamic changes)
const isDevelopment = (): boolean => {
  try {
    return getIsDevelopment();
  } catch (error) {
    // Fallback: assume production if we can't determine
    return false;
  }
};

export const debug = {
  log: (...args: any[]) => {
    if (isDevelopment()) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment()) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment()) {
      console.error(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment()) {
      console.info(...args);
    }
  },
  
  group: (label: string) => {
    if (isDevelopment()) {
      console.group(label);
    }
  },
  
  groupEnd: () => {
    if (isDevelopment()) {
      console.groupEnd();
    }
  },
  
  time: (label: string) => {
    if (isDevelopment()) {
      console.time(label);
    }
  },
  
  timeEnd: (label: string) => {
    if (isDevelopment()) {
      console.timeEnd(label);
    }
  },
  
  // Additional utility methods
  isEnabled: () => isDevelopment(),
  
  // Force logging (useful for critical errors)
  forceLog: (...args: any[]) => {
    console.log(...args);
  },
  
  forceWarn: (...args: any[]) => {
    console.warn(...args);
  },
  
  forceError: (...args: any[]) => {
    console.error(...args);
  }
};

export default debug;
