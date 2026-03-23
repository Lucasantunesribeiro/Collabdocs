// Minimal ambient type declaration for Cloudflare D1Database.
// This allows test files to reference D1Database as a type without importing
// the full @cloudflare/workers-types package, which requires a separate tsconfig.
declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

declare interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  error?: string;
  changes?: number;
  duration?: number;
  meta?: Record<string, unknown>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
}
