# Checkpoint 3.1 Architecture: Cloudflare Edge Skeleton

Implemented the foundation for the Cloudflare-hybrid architecture, enabling the local application to communicate with an Edge API.

## Core Components

### 1. Cloudflare Workers / Functions
- **Location**: `functions/api/health.ts`
- **Purpose**: Provides a lightweight connectivity check.
- **Implementation**: Returns a JSON response with status, timestamp, and environment details.

### 2. CloudflareService
- **Purpose**: Client-side gateway for all Cloudflare Edge communications.
- **Key Methods**:
    - `checkHealth()`: Performs a fetch to the `/api/health` endpoint.
- **Environment Handling**: Defaults to `http://127.0.0.1:8788` in development and relative paths in production.

## Infrastructure
- **Wrangler**: Configured `wrangler.toml` for local emulation.
- **Proxy**: Vite configuration ensures the frontend can reach the local Wrangler server during development.

## Verification
- Successfully performed an end-to-end handshake from the browser to the local Edge Function.
