# Nova 3D AI Studio

A browser-based 3D asset workspace built with React, Vite, Three.js and an optional server-side AI chat connection.

## Run locally
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` on the server if you want AI chat.
3. Start the API: `npm run server`
4. In a second terminal, start the UI: `npm run dev`

The Vite development server proxies `/api` requests to the API on port 8787. For a deployed environment, run the API server and configure the web server to proxy `/api` to it.

## AI configuration
- `OPENAI_API_KEY` is read only by the server. Never put it in a `VITE_*` variable or browser code.
- `OPENAI_MODEL` optionally selects the chat model; the default is `gpt-4o-mini`.
- `GET /api/health` reports whether a key is configured without exposing the key.
- `POST /api/chat` provides server-side AI chat. Requests are size-limited, limited to 20 requests per IP per minute, and use a 45-second upstream timeout.

The in-memory rate limiter is suitable for a single server process. A multi-instance deployment should use a shared rate-limit store so limits apply across instances.

## Current implementation
- Interactive Three.js viewport with orbit, pan, zoom, automatic framing and grid visibility control.
- Import by file picker and drag-and-drop for GLB/GLTF, FBX, OBJ, STL, PLY, 3MF, Collada/DAE and USDZ.
- Basic mesh, vertex and triangle statistics.
- Export the currently loaded scene as binary GLB.
- Responsive studio layout and assistant chat interface.
- Optional OpenAI chat backend with server-only API key handling, a health-status endpoint, request rate limiting and upstream timeout.
- Backend unit tests for rate-limit enforcement, window reset, client isolation and invalid configuration.
- GitHub Actions runs backend syntax checks, backend tests and the production frontend build.

## Known limitations
- Text-to-3D generation and AI-driven geometry/material editing are not implemented.
- Chat does not receive raw model geometry or file contents; it only knows whether an asset is loaded.
- OBJ companion MTL/textures and other multi-file asset packages are not handled.
- Only the listed formats are wired; this is not universal 3D-format support.
- Browser/device and live provider tests are still required before production use.
