/**
 * WebSocket Authentication Service
 * Handles token verification and user data fetching via WebSocket
 */

import { config, getWebSocketAuthUrl } from './config';

export interface UserData {
  id: string;
  walletAddress: string;
  username: string;
  role: number;
  isAdmin: boolean;
  isVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  avatarBlob: string | null;
  bio: string | null;
  email: string | null;
  emailVerified: boolean;
  followerCount?: number;
  followingCount?: number;
  twitterHandle?: string | null;
  discordHandle?: string | null;
  twitchHandle?: string | null;
  spotifyHandle?: string | null;
  status?: string;
}

export interface AuthResponse {
  token: string;
  user: UserData;
}

export class WebSocketAuth {
  private ws: WebSocket | null = null;
  private readonly protocolName = "LAYER4_AUTH";

  /**
   * Generate JWT token for WebSocket authentication
   */
  private generateJWTToken(walletAddress: string): string {
    // Simple JWT-like token generation (in production, use a proper JWT library)
    const header = {
      alg: "HS256",
      typ: "JWT"
    };
    
    const payload = {
      walletAddress,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    
    // In a real implementation, you'd sign this with JWT_SECRET
    // For now, we'll use a simple approach
    const signature = btoa(`${encodedHeader}.${encodedPayload}.${config.jwt.secret}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Authenticate wallet and get user data via WebSocket using JWT token
   */
  async authenticate(walletAddress: string): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup();
        reject(new Error('Authentication timeout'));
      }, 10000); // 10 second timeout

      try {
        // Generate JWT token and authenticate directly via WebSocket
        this.authenticateWithJWT(walletAddress, resolve, reject, timeout);
      } catch (error) {
        clearTimeout(timeout);
        this.cleanup();
        reject(error);
      }
    });
  }

  private async authenticateWithJWT(walletAddress: string, resolve: (value: AuthResponse) => void, reject: (reason?: any) => void, timeout: NodeJS.Timeout) {
    try {
      // Generate JWT token
      const jwtToken = this.generateJWTToken(walletAddress);
      const { logger } = await import('./logger');
      logger.debug(`[${this.protocolName}] 🔐 Generated JWT token for wallet:`, walletAddress);
      
      // Create WebSocket connection for authentication
      const authUrl = this.getAuthSocketUrl();
      this.ws = new WebSocket(authUrl);

      this.ws.onopen = () => {
        logger.debug(`[${this.protocolName}] 🔐 Authentication WebSocket connected`);
        
        // Send AUTH_LOGIN request with JWT token
        this.ws!.send(JSON.stringify({
          type: 'AUTH_LOGIN',
          payload: {
            walletAddress,
            jwtToken
          }
        }));
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.debug(`[${this.protocolName}] 🔐 Received auth response:`, {
            type: data.type,
            success: data.success,
            encrypted: data.encrypted,
            dataLength: data.data ? (typeof data.data === 'string' ? data.data.length : Object.keys(data.data).length) : 0
          });
          
          if (data.type === 'AUTH_LOGIN_RESPONSE') {
            if (data.success && data.data) {
              let userData = data.data;
              
              // Decrypt data if it's encrypted
              if (data.encrypted) {
                try {
                  logger.debug(`[${this.protocolName}] 🔐 Decrypting encrypted auth response...`);
                  const { decryptData } = await import('./encryption');
                  userData = await decryptData(data.data);
                  logger.debug(`[${this.protocolName}] ✅ Successfully decrypted auth response`);
                } catch (decryptError) {
                  logger.error(`[${this.protocolName}] ❌ Failed to decrypt auth response:`, decryptError);
                  clearTimeout(timeout);
                  this.cleanup();
                  reject(new Error('Failed to decrypt authentication response'));
                  return;
                }
              }
              
              clearTimeout(timeout);
              this.cleanup();
              resolve(userData);
            } else {
              clearTimeout(timeout);
              this.cleanup();
              reject(new Error(data.error || 'Authentication failed'));
            }
          }
        } catch (error) {
          logger.error(`[${this.protocolName}] 🔐 Error parsing auth response:`, error);
          clearTimeout(timeout);
          this.cleanup();
          reject(error);
        }
      };

      this.ws.onerror = (error) => {
        logger.error(`[${this.protocolName}] 🔐 Authentication WebSocket error:`, error);
        clearTimeout(timeout);
        this.cleanup();
        reject(error);
      };

      this.ws.onclose = (event) => {
        logger.debug(`[${this.protocolName}] 🔐 Authentication WebSocket closed:`, event.code, event.reason);
        if (event.code !== 1000) {
          clearTimeout(timeout);
          this.cleanup();
          reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`));
        }
      };
    } catch (error) {
      clearTimeout(timeout);
      this.cleanup();
      reject(error);
    }
  }

  /**
   * Get the authentication WebSocket URL
   */
  private getAuthSocketUrl(): string {
    return getWebSocketAuthUrl();
  }

  /**
   * Cleanup WebSocket connection
   */
  private cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export singleton instance
export const websocketAuth = new WebSocketAuth();
