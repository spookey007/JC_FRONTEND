'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-hide after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onHide: (id: string) => void }> = ({ toasts, onHide }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm">
      {toasts.map((toast, index) => (
        <div 
          key={toast.id} 
          className="transform transition-all duration-300 ease-out"
          style={{
            transform: `translateY(${index * 8}px)`,
            zIndex: 9999 - index
          }}
        >
          <ToastItem toast={toast} onHide={onHide} />
        </div>
      ))}
    </div>,
    document.body
  );
};

const ToastItem: React.FC<{ toast: Toast; onHide: (id: string) => void }> = ({ toast, onHide }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (toast.duration! / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [toast.duration]);

  const handleHide = () => {
    setIsLeaving(true);
    setTimeout(() => onHide(toast.id), 500);
  };

  const getToastStyles = () => {
    const baseStyles = "max-w-sm w-full pointer-events-auto overflow-hidden transform transition-all duration-500 ease-out shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]";
    
    if (isLeaving) {
      return `${baseStyles} translate-x-full opacity-0 scale-95 rotate-2`;
    }
    
    if (isVisible) {
      return `${baseStyles} translate-x-0 opacity-100 scale-100 rotate-0`;
    }
    
    return `${baseStyles} translate-x-full opacity-0 scale-95 rotate-2`;
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-white border-2 border-black rounded flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <svg className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-white border-2 border-black rounded flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <svg className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        );
      case 'warning':
        return (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-white border-2 border-black rounded flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <svg className="h-4 w-4 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.725-1.36 3.49 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        );
      case 'info':
        return (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-white border-2 border-black rounded flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <svg className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        );
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success': return '!bg-gradient-to-br from-green-300 via-green-400 to-green-500 !border-4 !border-black !text-black';
      case 'error': return '!bg-gradient-to-br from-red-300 via-red-400 to-red-500 !border-4 !border-black !text-black';
      case 'warning': return '!bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 !border-4 !border-black !text-black';
      case 'info': return '!bg-gradient-to-br from-blue-300 via-blue-400 to-blue-500 !border-4 !border-black !text-black';
    }
  };

  return (
    <div className={getToastStyles()}>
      <div className={`relative ${getBackgroundColor()} rounded-lg font-mono transition-all duration-300`}>
        {/* Lisa GUI Title Bar - Compact */}
        <div className="!bg-black !text-white px-3 py-1.5 rounded-t-lg border-b-2 border-black flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 !bg-red-500 rounded-full border border-white"></div>
            <div className="w-2 h-2 !bg-yellow-500 rounded-full border border-white"></div>
            <div className="w-2 h-2 !bg-green-500 rounded-full border border-white"></div>
            <span className="text-xs font-mono font-bold ml-1.5 !text-white"></span>
          </div>
          <button
            onClick={handleHide}
            className="w-4 h-4 !bg-red-500 hover:!bg-red-600 !text-white rounded-full border border-white flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110"
          >
            ×
          </button>
        </div>
        
        {/* Content Area - Compact */}
        <div className="p-3">
          <div className="flex items-start space-x-3">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold font-mono uppercase tracking-wide mb-1">
                {toast.title || 'NO TITLE'}
              </p>
              {toast.message && (
                <p className="text-xs font-mono leading-relaxed">
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <div className="mt-2">
                  <button
                    onClick={toast.action.onClick}
                    className="inline-flex items-center px-2 py-1 text-xs font-bold font-mono text-black bg-white hover:bg-gray-100 border-2 border-black rounded transition-all duration-200 hover:scale-105 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {toast.action.label}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        {toast.duration && toast.duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-lg overflow-hidden">
            <div 
              className="h-full bg-black transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Convenience hooks for common toast types
export const useToastNotifications = () => {
  const { showToast } = useToast();

  return {
    success: (title: string, message?: string) => 
      showToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      showToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) => 
      showToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) => 
      showToast({ type: 'info', title, message }),
    connection: (message: string) => 
      showToast({ 
        type: 'info', 
        title: 'Connection Status', 
        message,
        duration: 3000 
      }),
    message: (message: string, from: string) => 
      showToast({ 
        type: 'info', 
        title: `New message from ${from}`, 
        message,
        duration: 4000 
      }),
  };
};
