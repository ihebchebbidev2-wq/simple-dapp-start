/**
 * Error Handler Utility
 * Comprehensive error handling with detailed messages and logging
 */

export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
  statusCode?: number;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

export class ApiError extends Error {
  code: string;
  userMessage: string;
  statusCode?: number;
  details?: Record<string, any>;
  requestId?: string;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    statusCode?: number,
    details?: Record<string, any>,
    requestId?: string
  ) {
    super(message);
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.name = 'ApiError';
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      statusCode: this.statusCode,
    };
  }
}

// Error type mapping
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED_ERROR',
  FORBIDDEN: 'FORBIDDEN_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
  PARSE: 'PARSE_ERROR',
  CORS: 'CORS_ERROR',
} as const;

// Detailed error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: {
    user: 'Unable to connect to the server. Please check your internet connection.',
    dev: 'Network request failed - check connectivity and CORS configuration',
  },
  TIMEOUT_ERROR: {
    user: 'Request took too long. Please try again.',
    dev: 'Request timeout exceeded 30 seconds',
  },
  UNAUTHORIZED_ERROR: {
    user: 'Your session has expired. Please log in again.',
    dev: 'JWT token is missing, invalid, or expired',
  },
  FORBIDDEN_ERROR: {
    user: 'You do not have permission to perform this action.',
    dev: 'User lacks required permissions/role',
  },
  NOT_FOUND_ERROR: {
    user: 'The requested resource was not found.',
    dev: 'API endpoint returned 404',
  },
  CONFLICT_ERROR: {
    user: 'This resource already exists. Please use a different value.',
    dev: 'Duplicate entry or resource conflict',
  },
  VALIDATION_ERROR: {
    user: 'Please check your input and try again.',
    dev: 'Request validation failed - check required fields',
  },
  SERVER_ERROR: {
    user: 'The server encountered an error. Please try again later.',
    dev: 'Server returned 5xx error',
  },
  UNKNOWN_ERROR: {
    user: 'Something went wrong. Please try again.',
    dev: 'Unknown error occurred',
  },
  PARSE_ERROR: {
    user: 'Failed to process the response. Please try again.',
    dev: 'JSON parse error - invalid response format',
  },
  CORS_ERROR: {
    user: 'Unable to communicate with the server. Please contact support.',
    dev: 'CORS error - check backend CORS configuration',
  },
} as const;

export function handleError(error: any): ApiError {
  // Handle fetch errors
  if (error instanceof TypeError) {
    if (error.message.includes('fetch')) {
      return new ApiError(
        ERROR_TYPES.NETWORK,
        error.message,
        ERROR_MESSAGES.NETWORK_ERROR.user,
        0,
        { originalError: error.message }
      );
    }
    if (error.message.includes('JSON')) {
      return new ApiError(
        ERROR_TYPES.PARSE,
        error.message,
        ERROR_MESSAGES.PARSE_ERROR.user,
        0,
        { originalError: error.message }
      );
    }
  }

  // Handle timeout
  if (error.name === 'AbortError') {
    return new ApiError(
      ERROR_TYPES.TIMEOUT,
      'Request timeout',
      ERROR_MESSAGES.TIMEOUT_ERROR.user,
      408
    );
  }

  // Handle API errors
  if (error.statusCode) {
    switch (error.statusCode) {
      case 400:
        return new ApiError(
          ERROR_TYPES.VALIDATION,
          error.message || 'Bad request',
          error.userMessage || ERROR_MESSAGES.VALIDATION_ERROR.user,
          400,
          error.details
        );
      case 401:
        return new ApiError(
          ERROR_TYPES.UNAUTHORIZED,
          error.message || 'Unauthorized',
          ERROR_MESSAGES.UNAUTHORIZED_ERROR.user,
          401
        );
      case 403:
        return new ApiError(
          ERROR_TYPES.FORBIDDEN,
          error.message || 'Forbidden',
          ERROR_MESSAGES.FORBIDDEN_ERROR.user,
          403
        );
      case 404:
        return new ApiError(
          ERROR_TYPES.NOT_FOUND,
          error.message || 'Not found',
          ERROR_MESSAGES.NOT_FOUND_ERROR.user,
          404
        );
      case 409:
        return new ApiError(
          ERROR_TYPES.CONFLICT,
          error.message || 'Conflict',
          ERROR_MESSAGES.CONFLICT_ERROR.user,
          409,
          error.details
        );
      case 500:
      case 502:
      case 503:
        return new ApiError(
          ERROR_TYPES.SERVER,
          error.message || 'Server error',
          ERROR_MESSAGES.SERVER_ERROR.user,
          error.statusCode
        );
    }
  }

  // Handle unknown errors
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(
    ERROR_TYPES.UNKNOWN,
    error.message || 'Unknown error',
    ERROR_MESSAGES.UNKNOWN_ERROR.user,
    500,
    { originalError: error }
  );
}

export function logError(error: ApiError): void {
  const logData = {
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    userMessage: error.userMessage,
    statusCode: error.statusCode,
    details: error.details,
    requestId: error.requestId,
    stack: error.stack,
  };

  console.error('[REMQUIP API ERROR]', logData);

  // Could also send to analytics/monitoring service
  if (typeof window !== 'undefined' && (window as any).__REMQUIP_ANALYTICS__) {
    (window as any).__REMQUIP_ANALYTICS__.logError(logData);
  }
}

export function getDetailedErrorMessage(error: ApiError): string {
  let message = error.userMessage;

  if (error.details) {
    const detailMessages = Object.entries(error.details)
      .map(([key, value]) => {
        if (typeof value === 'string') return `${key}: ${value}`;
        if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
        return null;
      })
      .filter(Boolean);

    if (detailMessages.length > 0) {
      message += '\n\n' + detailMessages.join('\n');
    }
  }

  return message;
}
