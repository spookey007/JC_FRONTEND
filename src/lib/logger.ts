/**
 * Centralized logging utility
 * - Development: Shows all logs including debug
 * - Production: Only shows errors and warnings
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  component?: string;
}

class Logger {
  private isDevelopment: boolean;
  private isServer: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isServer = typeof window === 'undefined';
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // Show all logs in development
    }
    
    // Production: Only show warnings and errors
    return level === 'warn' || level === 'error';
  }

  private formatMessage(level: LogLevel, message: string, data?: any, component?: string): string {
    const timestamp = new Date().toISOString();
    const prefix = component ? `[${component}]` : '';
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level];

    return `${levelEmoji} ${prefix} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any, component?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, data, component);
    
    if (this.isServer) {
      // Server-side logging
      const logEntry: LogEntry = {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        component
      };
      
      switch (level) {
        case 'debug':
          console.log(formattedMessage, data ? data : '');
          break;
        case 'info':
          console.info(formattedMessage, data ? data : '');
          break;
        case 'warn':
          console.warn(formattedMessage, data ? data : '');
          break;
        case 'error':
          console.error(formattedMessage, data ? data : '');
          break;
      }
    } else {
      // Client-side logging
      switch (level) {
        case 'debug':
          console.log(formattedMessage, data ? data : '');
          break;
        case 'info':
          console.info(formattedMessage, data ? data : '');
          break;
        case 'warn':
          console.warn(formattedMessage, data ? data : '');
          break;
        case 'error':
          console.error(formattedMessage, data ? data : '');
          break;
      }
    }
  }

  debug(message: string, data?: any, component?: string): void {
    this.log('debug', message, data, component);
  }

  info(message: string, data?: any, component?: string): void {
    this.log('info', message, data, component);
  }

  warn(message: string, data?: any, component?: string): void {
    this.log('warn', message, data, component);
  }

  error(message: string, data?: any, component?: string): void {
    this.log('error', message, data, component);
  }

  // Special method for API calls (always show in production for monitoring)
  api(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`🌐 [API] ${message}`, data ? data : '');
    } else {
      // In production, only log API errors
      if (data && (data.status >= 400 || data.error)) {
        console.error(`🌐 [API] ${message}`, data);
      }
    }
  }

  // Special method for WebSocket events (only in development)
  websocket(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`🔌 [WebSocket] ${message}`, data ? data : '');
    }
  }

  // Special method for database operations (only in development)
  database(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`🗄️ [Database] ${message}`, data ? data : '');
    }
  }

  // Special method for cache operations (only in development)
  cache(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`💾 [Cache] ${message}`, data ? data : '');
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export individual methods for convenience
export const { debug, info, warn, error, api, websocket, database, cache } = logger;
