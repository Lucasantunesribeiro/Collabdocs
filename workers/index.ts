import router from './api/router';

export { DocumentSession } from './collaboration/DocumentSession';

export interface Env {
  DB: D1Database;
  NEXTAUTH_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /**
   * Comma-separated list of allowed CORS origins.
   * Example: "https://collabdocs-app.vercel.app,https://collabdocs.lucas.com.br"
   * Falls back to http://localhost:3000 if empty or not set.
   */
  ALLOWED_ORIGINS: string;
  /** Durable Object namespace for real-time collaboration sessions. */
  COLLAB_SESSIONS: DurableObjectNamespace;
}

export default {
  fetch: router.fetch,
};
