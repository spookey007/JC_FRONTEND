/**
 * Client-side MinIO service for file operations
 * Provides easy-to-use methods for uploading, downloading, and managing files
 */

interface MinioConfig {
  endpoint: string;
  bucket: string;
}

interface UploadResult {
  success: boolean;
  fileName: string;
  originalName: string;
  size: number;
  contentType: string;
  url: string;
}

interface FileInfo {
  success: boolean;
  fileName: string;
  size: number;
  lastModified: string;
  contentType: string;
  metadata: Record<string, string>;
}

interface PresignedUrlResult {
  success: boolean;
  fileName: string;
  url: string;
  expiry: number;
}

class MinioClient {
  private config: MinioConfig;
  private apiBase: string;

  constructor() {
    this.config = {
      endpoint: process.env.NEXT_PUBLIC_MINIO_ENDPOINT || '',
      bucket: process.env.NEXT_PUBLIC_MINIO_BUCKET || ''
    };
    // Use the same API base URL as the rest of the app
    this.apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
  }

  /**
   * Upload a file to MinIO
   */
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    console.log('📤 [MinIO Client] Starting upload:', {
      fileName: file.name,
      size: file.size,
      type: file.type,
      apiBase: this.apiBase,
      endpoint: this.config.endpoint,
      bucket: this.config.bucket
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const sessionToken = localStorage.getItem('l4_session') || '';
      console.log('📤 [MinIO Client] Sending request to:', `${this.apiBase}/minio/upload`);
      console.log('🔑 [MinIO Client] Session token:', sessionToken ? `${sessionToken.substring(0, 20)}...` : 'NO TOKEN');
      console.log('🍪 [MinIO Client] Document cookies:', document.cookie);
      console.log('🌐 [MinIO Client] API Base URL:', this.apiBase);

      const response = await fetch(`${this.apiBase}/minio/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      console.log('📤 [MinIO Client] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [MinIO Client] Upload failed with error:', errorData);
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] File uploaded successfully:', {
        fileName: result.fileName,
        originalName: result.originalName,
        size: result.size,
        contentType: result.contentType,
        url: result.url,
        etag: result.etag
      });
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Upload failed:', error);
      console.error('❌ [MinIO Client] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Download a file from MinIO
   */
  async downloadFile(fileName: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/download?fileName=${encodeURIComponent(fileName)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const blob = await response.blob();
      console.log('✅ [MinIO Client] File downloaded successfully:', fileName);
      return blob;
    } catch (error) {
      console.error('❌ [MinIO Client] Download failed:', error);
      throw error;
    }
  }

  /**
   * Copy a file within MinIO
   */
  async copyFile(sourceFileName: string, destFileName: string): Promise<{ success: boolean; destFileName: string; url: string }> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/copy`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceFileName,
          destFileName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Copy failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] File copied successfully:', sourceFileName, '->', destFileName);
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Copy failed:', error);
      throw error;
    }
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(fileName: string): Promise<{ success: boolean; fileName: string }> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/delete?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] File deleted successfully:', fileName);
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Delete failed:', error);
      throw error;
    }
  }

  /**
   * List user's files
   */
  async listFiles(): Promise<{ success: boolean; files: Array<{ name: string; size: number; lastModified: string; etag: string }>; count: number }> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/list`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'List files failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] Files listed successfully:', result.count, 'files');
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] List files failed:', error);
      throw error;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(fileName: string): Promise<FileInfo> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/info?fileName=${encodeURIComponent(fileName)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Get file info failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] File info retrieved successfully:', fileName);
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Get file info failed:', error);
      throw error;
    }
  }

  /**
   * Get presigned URL for file access
   */
  async getPresignedUrl(fileName: string, expiry: number = 3600): Promise<PresignedUrlResult> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/presigned?fileName=${encodeURIComponent(fileName)}&expiry=${expiry}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Get presigned URL failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] Presigned URL generated successfully:', fileName);
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Get presigned URL failed:', error);
      throw error;
    }
  }

  /**
   * Get presigned URL for file upload
   */
  async getPresignedUploadUrl(fileName: string, contentType: string = 'application/octet-stream', expiry: number = 3600): Promise<PresignedUrlResult & { originalFileName: string; contentType: string }> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/presigned-upload?fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}&expiry=${expiry}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Get presigned upload URL failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] Presigned upload URL generated successfully:', result.fileName);
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Get presigned upload URL failed:', error);
      throw error;
    }
  }

  /**
   * Upload file using presigned URL (for large files)
   */
  async uploadFileWithPresignedUrl(file: File, fileName: string, onProgress?: (progress: number) => void): Promise<{ success: boolean; fileName: string; url: string }> {
    try {
      // Get presigned upload URL
      const presignedResult = await this.getPresignedUploadUrl(fileName, file.type);
      
      // Upload directly to MinIO using presigned URL
      const response = await fetch(presignedResult.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Upload to presigned URL failed');
      }

      console.log('✅ [MinIO Client] File uploaded via presigned URL successfully:', presignedResult.fileName);
      return {
        success: true,
        fileName: presignedResult.fileName,
        url: `${this.config.endpoint}/${this.config.bucket}/${presignedResult.fileName}`
      };
    } catch (error) {
      console.error('❌ [MinIO Client] Upload with presigned URL failed:', error);
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(fileName: string): string {
    // Use the browser URL format for direct access
    return `${this.config.endpoint}/browser/${this.config.bucket}/${fileName}`;
  }

  /**
   * Download shared object using encoded URL
   */
  async downloadSharedObject(encodedUrl: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/download-shared/${encodedUrl}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download shared object failed');
      }

      const blob = await response.blob();
      console.log('✅ [MinIO Client] Shared object downloaded successfully');
      return blob;
    } catch (error) {
      console.error('❌ [MinIO Client] Download shared object failed:', error);
      throw error;
    }
  }

  /**
   * Generate shareable download URL
   */
  async generateShareableUrl(fileName: string, expiry: number = 604800): Promise<{ success: boolean; fileName: string; shareableUrl: string; presignedUrl: string; encodedUrl: string; expiry: number }> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/shareable/${encodeURIComponent(fileName)}?expiry=${expiry}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generate shareable URL failed');
      }

      const result = await response.json();
      console.log('✅ [MinIO Client] Shareable URL generated successfully:', result.fileName);
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Generate shareable URL failed:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ connected: boolean; error?: string; timestamp: string }> {
    try {
      const response = await fetch(`${this.apiBase}/api/minio/health`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ [MinIO Client] Health check failed:', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
export const minioClient = new MinioClient();

// Export for convenience
export default minioClient;
