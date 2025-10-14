// API Configuration
export const config = {
  // Backend API URLs
  api: {
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || '',
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || '',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  },
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // CORS configuration
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true); // allow non-browser requests (curl, Postman)

      try {
        const hostname = new URL(origin).hostname;

        // allow localhost for dev OR configured domains
        const allowedDomains = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['localhost'];
        if (
          hostname === "localhost" ||
          allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
        ) {
          return callback(null, true);
        }
      } catch (err) {
        return callback(err as Error);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
  
  // Backend server configuration
  server: {
    port: process.env.EXPRESS_PORT || process.env.PORT || '',
    host: process.env.HOST || '',
    domain: process.env.DOMAIN || '',
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  // Email configuration
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '0'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || '',
  },
  
  // WebSocket configuration
  websocket: {
    authUrl: process.env.NEXT_PUBLIC_WEBSOCKET_AUTH_URL || '',
    productionUrl: process.env.NEXT_PUBLIC_WEBSOCKET_PRODUCTION_URL || '',
    developmentUrl: process.env.NEXT_PUBLIC_WEBSOCKET_DEVELOPMENT_URL || '',
  },
  
  // MinIO configuration
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || '',
    port: parseInt(process.env.MINIO_PORT || '0'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
    bucketName: process.env.MINIO_BUCKET_NAME || '',
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || '',
    token: process.env.REDIS_TOKEN || '',
  },
};

// Helper function to get API URL
export const getApiUrl = (endpoint: string = '') => {
  // Always use the configured API URL
  return `${config.api.baseUrl}${endpoint}`;
};

// Helper function to get Socket URL
export const getSocketUrl = () => {
  // Use configured URL based on environment
  if (config.isProduction && config.websocket.productionUrl) {
    console.log('[CONFIG] Using production WebSocket URL:', config.websocket.productionUrl);
    return config.websocket.productionUrl;
  }
  if (config.isDevelopment && config.websocket.developmentUrl) {
    console.log('[CONFIG] Using development WebSocket URL:', config.websocket.developmentUrl);
    return config.websocket.developmentUrl;
  }
  // Fallback to socketUrl if specific environment URLs not set
  console.log('[CONFIG] Using fallback WebSocket URL:', config.api.socketUrl);
  return config.api.socketUrl;
};

// Helper function to get WebSocket Auth URL
export const getWebSocketAuthUrl = () => {
  return config.websocket.authUrl;
};

// Helper function to check if running in production
export const isProduction = () => {
  return config.isProduction;
};

// Helper function to check if running in development
export const isDevelopment = () => {
  return config.isDevelopment;
};
