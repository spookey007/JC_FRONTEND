# Environment Variables Configuration

This document lists all the environment variables used in the Layer4 frontend application.

## Required Environment Variables

### Server Configuration
- `NODE_ENV` - Environment mode (development/production)
- `EXPRESS_PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `DOMAIN` - Server domain (default: localhost:3001)

### API URLs (Frontend)
- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL (default: http://localhost:3001/api)
- `NEXT_PUBLIC_SOCKET_URL` - WebSocket URL (default: ws://localhost:3001)
- `NEXT_PUBLIC_API_URL` - API URL (default: http://localhost:3001/api)

### WebSocket URLs (Frontend)
- `NEXT_PUBLIC_WEBSOCKET_AUTH_URL` - WebSocket auth URL (default: ws://localhost:3001/auth)
- `NEXT_PUBLIC_WEBSOCKET_PRODUCTION_URL` - Production WebSocket URL (default: wss://socket.lay4r.io)
- `NEXT_PUBLIC_WEBSOCKET_DEVELOPMENT_URL` - Development WebSocket URL (default: ws://localhost:3001)

### Database Configuration
- `DATABASE_URL` - PostgreSQL connection string (default: postgresql://username:password@localhost:5432/layer4)

### JWT Configuration
- `JWT_SECRET` - JWT secret key for server-side signing
- `NEXT_PUBLIC_JWT_SECRET` - JWT secret key for client-side (should match server)

### Email Configuration
- `SMTP_HOST` - SMTP server host (default: smtp.gmail.com)
- `SMTP_PORT` - SMTP server port (default: 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

### MinIO Configuration
- `MINIO_ENDPOINT` - MinIO server endpoint (default: objectstorage.lay4r.io)
- `MINIO_PORT` - MinIO server port (default: 443)
- `MINIO_USE_SSL` - Use SSL for MinIO (default: true)
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `MINIO_BUCKET_NAME` - MinIO bucket name (default: lay4rdev)

### Redis Configuration
- `REDIS_URL` - Redis server URL
- `REDIS_TOKEN` - Redis authentication token

## Example .env.local file

```bash
# Environment Configuration
NODE_ENV=development

# Server Configuration
EXPRESS_PORT=3001
HOST=0.0.0.0
DOMAIN=localhost:3001

# API URLs (for frontend) - REQUIRED
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# WebSocket URLs (for frontend) - REQUIRED
NEXT_PUBLIC_WEBSOCKET_AUTH_URL=ws://localhost:3001/auth
NEXT_PUBLIC_WEBSOCKET_PRODUCTION_URL=wss://socket.lay4r.io
NEXT_PUBLIC_WEBSOCKET_DEVELOPMENT_URL=ws://localhost:3001

# MinIO Configuration (for frontend) - REQUIRED
NEXT_PUBLIC_MINIO_ENDPOINT=https://s3.lay4r.io
NEXT_PUBLIC_MINIO_BUCKET=lay4rdev
NEXT_PUBLIC_MINIO_DOMAIN=objectstorage.lay4r.io

# Encryption (for frontend) - REQUIRED
NEXT_PUBLIC_WEBSOCKET_ENCRYPTION_KEY=your-64-character-hex-key

# Third-party APIs (for frontend)
NEXT_PUBLIC_TENOR_APIKEY=your-tenor-api-key

# CORS Configuration (for server)
ALLOWED_ORIGINS=localhost,lay4r.io

# Production URLs (automatically used when NODE_ENV=production)
# API: https://api.lay4r.io
# WebSocket: wss://socket.lay4r.io
# WebSocket Auth: wss://socket.lay4r.io/auth

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/layer4

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
NEXT_PUBLIC_JWT_SECRET=your-super-secret-jwt-key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# MinIO Configuration
MINIO_ENDPOINT=objectstorage.lay4r.io
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET_NAME=lay4rdev

# Redis Configuration
REDIS_URL=https://alert-stork-12656.upstash.io
REDIS_TOKEN=your-redis-token
```

## Usage in Code

The configuration is centralized in `src/lib/config.ts` and can be imported and used throughout the application:

```typescript
import { config, getApiUrl, getSocketUrl, getWebSocketAuthUrl } from './config';

// Use configuration values
const apiUrl = getApiUrl('/users');
const socketUrl = getSocketUrl();
const authUrl = getWebSocketAuthUrl();

// Access specific configuration
const isDev = config.isDevelopment;
const jwtSecret = config.jwt.secret;
const minioConfig = config.minio;
```
