import { getApiUrl } from './config';
import { logger } from './logger';

export const API_BASE = getApiUrl();

export async function apiFetch(path: string, init: RequestInit = {}) {
  // Don't set Content-Type for FormData (let browser set it with boundary)
  const isFormData = init.body instanceof FormData;
  
  // Get token from Redis storage as primary, localStorage as fallback
  let token = null;
  try {
    // Try Redis first
    const { redisStorage } = await import('@/lib/storageService');
    token = await redisStorage.getItem('l4_session');
  } catch (error) {
    console.warn('⚠️ [API] Could not access Redis storage, trying localStorage:', error);
    // Fallback to localStorage
    try {
      token = localStorage.getItem('l4_session');
    } catch (localError) {
      console.warn('⚠️ [API] Could not access localStorage:', localError);
    }
  }
  
  const headers = isFormData 
    ? { 
        ...(init.headers || {}),
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    : { 
        "Content-Type": "application/json", 
        ...(init.headers || {}),
        ...(token && { 'Authorization': `Bearer ${token}` })
      };

  // Debug: Log cookies before making request
  logger.debug('Cookies before request', { cookies: document.cookie }, 'API');
  logger.debug('Token from storage', { token: token ? token.substring(0, 20) + '...' : 'None' }, 'API');
  logger.api('Making request', {
    url: `${API_BASE}${path}`,
    credentials: "include",
    headers,
    method: init.method || 'GET'
  });

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
    ...init,
  });
  
  // Debug: Log response details
  logger.api('Response received', {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    url: res.url,
    headers: Object.fromEntries(res.headers.entries())
  });
  
  // Check if the response contains an error
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
    
    // For DM creation, we want to handle 409 (duplicate) as a special case
    // Return the response with error data instead of throwing
    if (res.status === 409 && path.includes('/chat/dm/create')) {
      logger.debug('Duplicate DM detected, returning response for handling', errorData, 'API');
      return { ...res, errorData, isDuplicate: true };
    }
    
    logger.error('Request failed', errorData, 'API');
    throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
  }
  
  return res;
}


