/**
 * Image Proxy Utility
 * Converts MinIO URLs to proxy URLs for reliable image access
 */

export function getImageProxyUrl(originalUrl: string): string {
  // If it's already a proxy URL, return as-is
  if (originalUrl.includes('/api/minio/image/')) {
    return originalUrl;
  }
  
  // If it's a MinIO URL, convert to proxy URL
  const minioDomain = process.env.NEXT_PUBLIC_MINIO_DOMAIN || 'objectstorage.lay4r.io';
  if (originalUrl.includes(minioDomain)) {
    // Extract filename from MinIO URL
    // URL format: https://domain/browser/bucket/users/...
    const urlParts = originalUrl.split('/');
    const fileName = urlParts.slice(4).join('/'); // Skip protocol, domain, 'browser', bucket
    
    // Return proxy URL
    return `${process.env.NEXT_PUBLIC_API_URL}/minio/image/${fileName}`;
  }
  
  // If it's a legacy URL or other format, return as-is
  return originalUrl;
}

export function isMinIOUrl(url: string): boolean {
  const minioDomain = process.env.NEXT_PUBLIC_MINIO_DOMAIN || 'objectstorage.lay4r.io';
  return url.includes(minioDomain);
}
