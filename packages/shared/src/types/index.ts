/**
 * Shared types for minimal terminal client
 */

// WebSocket communication types
export * from './websocket.js';

// Tunnel and connection types
export * from './tunnel.js';

// Configuration types
export * from './config.js';

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  status: Status;
  data?: T;
  error?: string;
}