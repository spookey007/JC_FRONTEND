import { minioClient } from './minioClient';

export interface UploadResult {
  url: string;
  type: 'image' | 'gif' | 'video' | 'audio' | 'file';
  originalName: string;
  size: number;
  thumbnailUrl?: string;
  fileName?: string;
}

export async function uploadFile(file: File, mimeType?: string): Promise<UploadResult> {
  console.log('📤 [Upload] Starting file upload:', {
    name: file.name,
    size: file.size,
    type: file.type
  });

  try {
    console.log('📤 [Upload] Attempting MinIO upload...');
    // Use MinIO client for upload
    const result = await minioClient.uploadFile(file);
    
    console.log('✅ [Upload] MinIO upload successful:', {
      url: result.url,
      fileName: result.fileName,
      originalName: result.originalName,
      size: result.size,
      contentType: result.contentType
    });
    
    return {
      url: result.url, // This will be the direct MinIO URL
      type: result.contentType.startsWith('image/') ? 
            (result.contentType === 'image/gif' ? 'gif' : 'image') :
            result.contentType.startsWith('video/') ? 'video' :
            result.contentType.startsWith('audio/') ? 'audio' : 'file',
      originalName: result.originalName,
      size: result.size,
      fileName: result.fileName,
      thumbnailUrl: result.contentType.startsWith('image/') ? result.url : undefined
    };
  } catch (error) {
    console.error('❌ [Upload] MinIO upload failed, falling back to legacy upload:', error);
    console.error('❌ [Upload] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Fallback to legacy upload
    console.log('🔄 [Upload] Using legacy upload fallback...');
    const formData = new FormData();
    formData.append('file', file);

    const sessionToken = localStorage.getItem('l4_session') || '';
    console.log('🔑 [Upload] Session token for legacy upload:', sessionToken ? `${sessionToken.substring(0, 20)}...` : 'NO TOKEN');

    const { getApiUrl } = await import('./config');
    const response = await fetch(`${getApiUrl()}/chat/media/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: formData
    });

    if (!response.ok) {
      console.error('❌ [Upload] Legacy upload failed:', response.status, response.statusText);
      throw new Error('Upload failed');
    }

    const result = await response.json();
    console.log('✅ [Upload] Legacy upload successful:', result);
    return result.attachment;
  }
}

export async function uploadMultipleFiles(files: File[]): Promise<UploadResult[]> {
  const uploadPromises = files.map(file => uploadFile(file));
  return Promise.all(uploadPromises);
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024; // 100MB for videos
  const minSize = 30 * 1024; // 30KB minimum
  const allowedTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime', // .mov files
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // Check file size
  if (file.size < minSize) {
    return { valid: false, error: 'File too small (minimum 30KB)' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large (max 100MB)' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not supported' };
  }

  return { valid: true };
}

export function validateVideoFile(file: File): Promise<{ valid: boolean; error?: string; duration?: number }> {
  return new Promise((resolve) => {
    // Basic file validation first
    const basicValidation = validateFile(file);
    if (!basicValidation.valid) {
      resolve(basicValidation);
      return;
    }

    // Check if it's a video file
    if (!file.type.startsWith('video/')) {
      resolve({ valid: false, error: 'File is not a video' });
      return;
    }

    // Create video element to check duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      console.log('🎬 [Video Validation] Duration:', duration);
      
      if (isNaN(duration) || duration === Infinity) {
        resolve({ valid: false, error: 'Could not determine video duration' });
        return;
      }

      // Check duration (max 1 minute = 60 seconds)
      if (duration > 60) {
        resolve({ valid: false, error: 'Video too long (max 1 minute)' });
        return;
      }

      if (duration < 1) {
        resolve({ valid: false, error: 'Video too short (minimum 1 second)' });
        return;
      }

      resolve({ valid: true, duration });
    };

    video.onerror = () => {
      resolve({ valid: false, error: 'Invalid video file' });
    };

    video.src = URL.createObjectURL(file);
  });
}

export function getFileType(file: File): 'image' | 'gif' | 'video' | 'file' | 'audio' {
  if (file.type.startsWith('image/')) {
    return file.type === 'image/gif' ? 'gif' : 'image';
  }
  if (file.type.startsWith('video/')) {
    return 'video';
  }
  if (file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}
