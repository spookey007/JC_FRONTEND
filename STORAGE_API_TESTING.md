# Storage API Testing Guide

## Overview
The Storage API now requires authentication via the `l4_session` cookie. This guide shows you how to test it properly.

## Quick Test (Server Must Be Running)

```bash
# Test authentication requirements
npm run test-storage-auth

# Test basic functionality (requires server)
npm run test-storage-api
```

## Manual Testing Steps

### 1. Start the Server
```bash
npm run start:websocket
```

### 2. Test Without Authentication
```bash
# This should return 401 Unauthorized
curl http://localhost:3001/api/storage

# This should also return 401 Unauthorized  
curl http://localhost:3001/api/storage/l4_session
```

### 3. Test With Authentication

#### Option A: Using Browser
1. Open your frontend application
2. Login to get a session
3. Open browser dev tools → Network tab
4. Look for requests to `/api/storage`
5. Copy the `l4_session` cookie value

#### Option B: Using curl with session cookie
```bash
# Replace YOUR_SESSION_TOKEN with actual token from browser
curl -H "Cookie: l4_session=YOUR_SESSION_TOKEN" http://localhost:3001/api/storage
```

### 4. Test Storage Operations

#### Get all storage keys
```bash
curl -H "Cookie: l4_session=YOUR_SESSION_TOKEN" http://localhost:3001/api/storage
```

#### Get specific storage item
```bash
curl -H "Cookie: l4_session=YOUR_SESSION_TOKEN" http://localhost:3001/api/storage/audioEnabled
```

#### Set storage item
```bash
curl -X POST \
  -H "Cookie: l4_session=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "test_key", "value": "test_value", "ttl": 3600}' \
  http://localhost:3001/api/storage
```

#### Delete storage item
```bash
curl -X DELETE \
  -H "Cookie: l4_session=YOUR_SESSION_TOKEN" \
  http://localhost:3001/api/storage/test_key
```

## Expected Responses

### Without Authentication
```json
{
  "error": "Authentication required"
}
```

### With Valid Authentication
```json
{
  "keys": ["audioEnabled", "channels_last_fetch_123"],
  "count": 2
}
```

## Troubleshooting

### Server Not Running
- Error: `request to http://localhost:3001/api/storage failed, reason:`
- Solution: Run `npm run start:websocket`

### Invalid Session Token
- Error: `{"error": "Authentication required"}`
- Solution: Get a fresh session by logging in through the frontend

### Session Expired
- Error: `{"error": "Authentication required"}`
- Solution: Login again to get a new session

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/storage` | List all storage keys | ✅ |
| GET | `/api/storage/:key` | Get storage item | ✅ |
| POST | `/api/storage` | Set storage item | ✅ |
| DELETE | `/api/storage/:key` | Delete storage item | ✅ |
| DELETE | `/api/storage` | Clear all storage | ✅ |

## Storage Key Format
- User-specific: `storage:{userId}:{key}`
- Example: `storage:123:audioEnabled`
- TTL: Default 24 hours (86400 seconds)
