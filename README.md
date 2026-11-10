# Nova 3D AI Studio

A browser-based 3D asset workspace built with React, Vite, Three.js and the Nova API.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `NOVA_PROVIDER_API_KEY` on the server.
3. Start the Nova API: `npm run server`
4. In a second terminal, start the UI: `npm run dev`

The Vite development server proxies `/api` requests to the API on port 8787.

### Production run

1. Set the server-side provider environment variables from `.env.example`.
2. Build the frontend: `npm run build`.
3. Start the single production server: `npm start`.
4. Open `http://localhost:8787` (or the configured `PORT`).

When `dist/index.html` exists, Express serves the production frontend and the Nova API from the same origin. A separate static frontend host or reverse proxy is not required. Keep the server-side provider key private. Do not expose this single-user prototype publicly until app-level authentication and stronger abuse controls are added.

## Nova API v1

Nova exposes its own versioned REST API:

- `GET /api/v1/health` — API availability, provider configuration and capabilities without exposing credentials.
- `POST /api/v1/chat` — a bounded multi-turn conversation endpoint.
- `GET /api/v1/openapi.json` — machine-readable OpenAPI 3.1 specification.
- Legacy `/api/health` and `/api/chat` paths remain available for compatibility.

Example request:

```json
{
  "messages": [
    { "role": "user", "content": "Hi Nova, let's talk." },
    { "role": "assistant", "content": "Hello! What would you like to discuss?" },
    { "role": "user", "content": "Can you help me plan a 3D scene?" }
  ],
  "mode": "Nova Studio",
  "asset": null
}
```

The API accepts up to 16 recent user/assistant messages, requires the final message to be from the user, limits each message to 6,000 characters and bounds total conversation context. System/developer messages are not accepted from clients. The frontend saves the recent conversation in the browser so it remains after a refresh on that device.

## Provider configuration

- `NOVA_PROVIDER_API_KEY` is the server-side provider credential. `OPENAI_API_KEY` remains a backwards-compatible alias.
- `NOVA_PROVIDER_BASE_URL` selects an OpenAI-compatible API base URL; HTTPS is required except for localhost development. Default: `https://api.openai.com/v1`.
- `NOVA_MODEL` selects the provider model. Default: `gpt-4o-mini`.
- Legacy `OPENAI_BASE_URL` and `OPENAI_MODEL` aliases are also supported.
- Never put provider credentials in a `VITE_*` variable or browser code.

**Important distinction:** Nova now has its own API interface, assistant instructions and conversation flow, but it is not a newly trained foundation model. Natural-language responses still require a configured external OpenAI-compatible model provider. Without provider credentials, the API reports that it is not configured and does not fake responses.

The chat endpoint is limited to 20 requests per IP per minute and has a 45-second provider timeout. The in-memory rate limiter is for a single server process; multi-instance deployments need a shared store and appropriate API authentication.

## 3D workspace

- Interactive Three.js viewport with orbit, pan, zoom, automatic framing and grid visibility.
- Import by file picker and drag-and-drop for GLB/GLTF, FBX, OBJ, STL, PLY, 3MF, Collada/DAE and USDZ.
- Inspect mesh, vertex, triangle, material and texture counts; scene bounds/dimensions; and bounded per-mesh geometry attributes including UVs, normals, vertex colors, skinning, morph targets, geometry types and material base colors. A compact mesh inspector is available in the viewport.
- Export the currently loaded scene as binary GLB.
- Nova can issue validated scene edits through its function-calling interface: rename an object, change a material color, adjust local position/rotation/scale, add a box/sphere/cylinder/torus primitive, or delete a non-root object.
- Nova can start a new empty-canvas scene by adding primitives and combine them into simple compositions; these are basic geometric assemblies, not arbitrary high-detail text-to-3D meshes.
- The browser applies only the allow-listed scene operations and reports how many actually succeeded.
- Asset metadata is validated server-side before it is included in Nova's conversation context. Nova is told that structural statistics are not a visual inspection.

## Mobile-first use

The workspace is designed to work on phone-sized screens as well as desktop:

- Use the bottom **Studio** and **Nova** tabs to switch between the 3D viewport and the full-screen chat.
- Tap **Multi** in Studio before tapping meshes to select multiple parts by touch. Turn it off to return to single selection.
- Use **GLB** where possible. A single-file GLB keeps geometry and embedded textures together and is the most reliable format for mobile import.
- The import progress panel reports loading status. Models over 150 MB are rejected to reduce the risk of mobile browser memory or GPU failures.
- A `.gltf` file is accepted when its buffers and images are embedded as data URIs. Files that reference separate `.bin` or image files are rejected with a prompt to export one `.glb`; multi-file bundles are not yet supported.
- WebGL and hardware acceleration are required. Older phones may not have enough GPU memory for complex scenes; reduce polygon counts and texture dimensions before import.

The viewport pauses rendering while its tab is hidden or the browser is in the background. The renderer also responds to viewport resizing and reports WebGL startup/context errors instead of silently leaving a blank canvas.

## Tests and build

`npm test` runs unit tests plus an end-to-end API test that starts Nova against a local mock provider and checks health, multi-turn chat forwarding and input validation. `npm run build` creates the production frontend build. GitHub Actions checks server syntax, runs tests and builds the frontend.

## Known limitations

- Full text-to-3D generation of arbitrary custom models is not implemented. Primitive creation is limited to basic built-in shapes.
- Advanced geometry sculpting, retopology, UV editing, rigging, animation generation and material-node editing are not implemented.
- Nova receives structural model metadata, not raw vertex buffers, full texture data or a rendered image. It cannot truthfully claim to visually inspect the loaded asset from metadata alone.
- The current conversation is saved locally in the browser, not synchronized to an account or shared across devices.
- Voice input/output, user accounts, hosted conversation storage, multi-file OBJ/MTL packaging and live provider/device QA are not implemented.
- Only the listed 3D formats are wired; this is not universal 3D-format support.
