/**
 * Toast Notification System
 * Centralized toast management with detailed logging
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  details?: Record<string, any>;
  timestamp: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Toast subscribers
let toastSubscribers: ((toast: Toast) => void)[] = [];
let dismissSubscribers: ((id: string) => void)[] = [];
let toastHistory: Toast[] = [];

/**
 * Subscribe to toast events
 */
export function subscribeToToasts(callback: (toast: Toast) => void) {
  toastSubscribers.push(callback);
  return () => {
    toastSubscribers = toastSubscribers.filter(cb => cb !== callback);
  };
}

/**
 * Subscribe to toast dismiss events
 */
export function subscribeToDismiss(callback: (id: string) => void) {
  dismissSubscribers.push(callback);
  return () => {
    dismissSubscribers = dismissSubscribers.filter(cb => cb !== callback);
  };
}

/**
 * Show toast notification
 */
function showToast(toast: Toast): string {
  const id = toast.id;
  
  // Log toast
  console.log(`[TOAST] ${toast.type.toUpperCase()}: ${toast.title}`, {
    message: toast.message,
    details: toast.details,
    timestamp: toast.timestamp,
  });

  // Add to history
  toastHistory.push(toast);
  if (toastHistory.length > 50) {
    toastHistory.shift(); // Keep last 50 toasts
  }

  // Notify subscribers
  toastSubscribers.forEach(cb => cb(toast));

  // Auto dismiss non-persistent toasts
  if (toast.duration) {
    setTimeout(() => {
      dismissToast(id);
    }, toast.duration);
  }

  return id;
}

/**
 * Dismiss toast
 */
export function dismissToast(id: string): void {
  dismissSubscribers.forEach(cb => cb(id));
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Show success toast
 */
export function showSuccessToast(
  title: string,
  message?: string,
  options?: {
    duration?: number;
    details?: Record<string, any>;
    action?: { label: string; onClick: () => void };
  }
): string {
  return showToast({
    id: generateId(),
    type: 'success',
    title,
    message: message ?? '',
    duration: options?.duration || 4000,
    details: options?.details,
    timestamp: new Date().toISOString(),
    action: options?.action,
  });
}

/**
 * Show error toast
 */
export function showErrorToast(
  title: string,
  message?: string,
  options?: {
    duration?: number;
    details?: Record<string, any>;
    action?: { label: string; onClick: () => void };
  }
): string {
  return showToast({
    id: generateId(),
    type: 'error',
    title,
    message: message ?? '',
    duration: options?.duration || 6000,
    details: options?.details,
    action: options?.action,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Show warning toast
 */
export function showWarningToast(
  title: string,
  message?: string,
  options?: {
    duration?: number;
    details?: Record<string, any>;
    action?: { label: string; onClick: () => void };
  }
): string {
  return showToast({
    id: generateId(),
    type: 'warning',
    title,
    message: message ?? '',
    duration: options?.duration || 5000,
    details: options?.details,
    action: options?.action,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Show info toast
 */
export function showInfoToast(
  title: string,
  message?: string,
  options?: {
    duration?: number;
    details?: Record<string, any>;
    action?: { label: string; onClick: () => void };
  }
): string {
  return showToast({
    id: generateId(),
    type: 'info',
    title,
    message: message ?? '',
    duration: options?.duration || 4000,
    details: options?.details,
    action: options?.action,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get toast history
 */
export function getToastHistory(): Toast[] {
  return [...toastHistory];
}

/**
 * Clear toast history
 */
export function clearToastHistory(): void {
  toastHistory = [];
}

/**
 * Batch toasts for multiple operations
 */
export function showBatchToasts(toasts: Toast[]): string[] {
  return toasts.map(toast => showToast({
    ...toast,
    id: toast.id || generateId(),
    timestamp: toast.timestamp || new Date().toISOString(),
  }));
}

/**
 * Show progress toast
 */
export function showProgressToast(
  title: string,
  message: string
): {
  id: string;
  update: (message: string, details?: Record<string, any>) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: () => void;
} {
  const id = generateId();

  showToast({
    id,
    type: 'info',
    title,
    message,
    duration: 0, // Don't auto-dismiss
    timestamp: new Date().toISOString(),
  });

  return {
    id,
    update: (newMessage: string, details?: Record<string, any>) => {
      showToast({
        id,
        type: 'info',
        title,
        message: newMessage,
        details,
        duration: 0,
        timestamp: new Date().toISOString(),
      });
    },
    success: (newMessage: string) => {
      showToast({
        id,
        type: 'success',
        title,
        message: newMessage,
        duration: 4000,
        timestamp: new Date().toISOString(),
      });
    },
    error: (newMessage: string) => {
      showToast({
        id,
        type: 'error',
        title: `${title} - Failed`,
        message: newMessage,
        duration: 6000,
        timestamp: new Date().toISOString(),
      });
    },
    dismiss: () => {
      dismissToast(id);
    },
  };
}
