export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: string;
}

function emit(entry: LogEntry): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    emit({
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
    });
  },

  info(message: string, context?: Record<string, unknown>): void {
    emit({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
    });
  },

  warn(message: string, context?: Record<string, unknown>): void {
    emit({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
    });
  },

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    emit({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...(error !== undefined
        ? { error: error instanceof Error ? error.message : String(error) }
        : {}),
      ...(context ? { context } : {}),
    });
  },
};
