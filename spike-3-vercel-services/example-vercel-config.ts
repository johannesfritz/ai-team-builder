/**
 * Vercel Services Configuration for BotCamp
 *
 * NOTE: Vercel Services uses vercel.json (not vercel.ts) for configuration.
 * This file documents the configuration as TypeScript for type-safety reference.
 * The actual deployment uses vercel.json at the project root.
 *
 * vercel.json contents:
 */

// Type definition matching Vercel's experimentalServices schema
interface VercelServiceConfig {
  entrypoint: string;
  routePrefix: string;
  framework?: string;
  memory?: number; // 128 - 10240 MB
  maxDuration?: number; // 1 - 900 seconds
  includeFiles?: string | string[];
  excludeFiles?: string | string[];
}

interface VercelConfig {
  experimentalServices: Record<string, VercelServiceConfig>;
}

// --- Configuration for BotCamp ---

const vercelConfig: VercelConfig = {
  experimentalServices: {
    // Next.js frontend — catches all routes not matched by other services
    web: {
      entrypoint: "frontend",
      routePrefix: "/",
    },
    // FastAPI backend — handles AI/chat API requests
    api: {
      entrypoint: "backend/main.py",
      routePrefix: "/api/ai",
      // Optional: increase memory for AI workloads
      // memory: 1024,
      // Optional: extend timeout for long Claude API calls (default 300s is fine)
      // maxDuration: 300,
      // Optional: exclude test files from the bundle
      // excludeFiles: "{tests/**,**/*.test.py,**/test_*.py}",
    },
  },
};

// --- Equivalent vercel.json ---
//
// {
//   "experimentalServices": {
//     "web": {
//       "entrypoint": "frontend",
//       "routePrefix": "/"
//     },
//     "api": {
//       "entrypoint": "backend/main.py",
//       "routePrefix": "/api/ai"
//     }
//   }
// }

// --- Auto-generated environment variables ---
//
// Server-side (available in both services):
//   WEB_URL = "https://botcamp-xxxx.vercel.app"
//   API_URL = "https://botcamp-xxxx.vercel.app/api/ai"
//
// Client-side (available in Next.js):
//   NEXT_PUBLIC_WEB_URL = "/"
//   NEXT_PUBLIC_API_URL = "/api/ai"
//
// Usage in Next.js frontend:
//   const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/ai';
//   fetch(`${apiUrl}/chat`, { method: 'POST', body: JSON.stringify({ messages }) });

// --- Routing behavior ---
//
// Request                          -> Service   -> FastAPI/Next.js receives
// GET  /                           -> web       -> /
// GET  /dashboard                  -> web       -> /dashboard
// POST /api/ai/chat                -> api       -> /chat  (prefix stripped!)
// GET  /api/ai/health              -> api       -> /health
// GET  /api/ai/docs                -> api       -> /docs  (Swagger UI)
//
// IMPORTANT: FastAPI routes do NOT include /api/ai prefix.
// Vercel strips the routePrefix before forwarding to the service.

export default vercelConfig;
