# MinIO Setup Guide

## Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# MinIO Configuration (Production)
MINIO_ENDPOINT=s3.lay4r.io
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=SuperSecurePass123!
MINIO_BUCKET_NAME=lay4rdev

# MinIO URLs (for client-side access)
NEXT_PUBLIC_MINIO_ENDPOINT=https://s3.lay4r.io
NEXT_PUBLIC_MINIO_BUCKET=lay4rdev
```

## Local Development (Optional)

For local development, you can still use the local MinIO setup:

```bash
# MinIO Configuration (Local Development)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=SuperSecurePass123!
MINIO_BUCKET_NAME=lay4rdev

# MinIO URLs (for client-side access)
NEXT_PUBLIC_MINIO_ENDPOINT=http://localhost:9000
NEXT_PUBLIC_MINIO_BUCKET=lay4rdev
```

## Docker Compose

Your MinIO setup looks good! Here's the configuration you're using:

```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    container_name: minio
    ports:
      - "9000:9000"   # S3 API
      - "9090:9090"   # Web Console
    volumes:
      - ./data:/data
      - ./config:/root/.minio
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=SuperSecurePass123!
    command: server /data --console-address ":9090"
    restart: unless-stopped
    networks:
      - minio-net

networks:
  minio-net:
    driver: bridge
```

## Installation

1. Install the MinIO package:
```bash
npm install minio
```

2. Add the environment variables to your `.env.local` file

3. The MinIO service will automatically initialize when you start your server

## Production Configuration

For your production setup with `https://s3.lay4r.io`:

```bash
# Production MinIO Configuration
MINIO_ENDPOINT=s3.lay4r.io
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your_production_access_key
MINIO_SECRET_KEY=your_production_secret_key
MINIO_BUCKET_NAME=lay4rdev
MINIO_REGION=us-east-1
MINIO_PATH_STYLE=false

# Client-side URLs
NEXT_PUBLIC_MINIO_ENDPOINT=https://s3.lay4r.io
NEXT_PUBLIC_MINIO_BUCKET=lay4rdev
```

## Cloudflare Tunnel Setup

Since you're using Cloudflare tunnels, make sure your tunnel is configured to:
- Forward `s3.lay4r.io` to your MinIO container
- Use HTTPS (port 443) for secure connections
- Allow the necessary S3 API endpoints

## Testing the Connection

You can test your MinIO connection by visiting:
- **MinIO Browser**: `https://s3.lay4r.io/browser/lay4rdev` ✅ (Your bucket is accessible!)
- **MinIO Console**: `https://s3.lay4r.io:9090` (if console is exposed)
- **Health Check**: `https://api.lay4r.io/api/minio/health`

## Usage

The MinIO service provides these methods:

### Core Operations
- `uploadFile(fileName, buffer, contentType, metadata)`
- `downloadFile(fileName)`
- `copyFile(sourceFileName, destFileName, metadata)`
- `deleteFile(fileName)`
- `listFiles(prefix, recursive)`
- `getFileInfo(fileName)`

### URL Generation
- `getPresignedUrl(fileName, expiry)` - Standard presigned URL
- `getPresignedUploadUrl(fileName, expiry)` - Presigned upload URL
- `generateShareableUrl(fileName, expiry)` - **NEW**: Shareable download URL using MinIO's download-shared-object API

### Shared Object Downloads
- `downloadSharedObject(encodedUrl)` - **NEW**: Download using encoded presigned URL
- `getPublicUrl(fileName)` - Direct browser access URL

## Shared Object API

Your MinIO setup supports the `download-shared-object` API for secure file sharing:

### URL Format
```
https://s3.lay4r.io/api/v1/download-shared-object/[base64-encoded-presigned-url]
```

### Example Usage
```javascript
// Generate shareable URL
const result = await minioService.generateShareableUrl('users/123/image.jpg', 3600);
console.log('Shareable URL:', result.shareableUrl);

// Download shared object
const blob = await minioService.downloadSharedObject(result.encodedUrl);
```

### API Endpoints
- `GET /api/minio/shareable/:fileName` - Generate shareable URL
- `GET /api/minio/download-shared/:encodedUrl` - Download shared object
