# Nova 3D AI Studio

A browser-based 3D asset workspace built with React, Vite and Three.js. Its offline prompt builder creates editable procedural models without a chat API.

## Run locally

1. Install dependencies: `npm install`
2. Start the UI: `npm run dev`

The offline 3D model builder works without `.env`, an API key or a running backend. The optional chat feature still uses the server API when configured.

### Production run

1. Set the server-side provider environment variables from `.env.example`.
2. Build the frontend: `npm run build`.
3. Start the single production server: `npm start`.
4. Open `http://localhost:8787` (or the configured `PORT`).

When `dist/index.html` exists, Express serves the production frontend and the Nova API from the same origin. A separate static frontend host or reverse proxy is not required. Keep the server-side provider key private.

For a private hosted instance, set `NOVA_APP_PASSWORD` before starting the server and set a separate random `NOVA_SESSION_SECRET` (recommended: at least 32 random characters). The app then shows a sign-in screen and protects chat requests with a signed, seven-day HttpOnly, SameSite=Lax cookie. Login attempts are rate-limited. Changing either secret invalidates previously issued sessions. Do not use a short or reused password. This is a single shared app password, not individual user accounts; the in-memory rate limiter is still per server process.

## Nova API v1

Nova exposes its own versioned REST API:

- `GET /api/v1/health` — API availability, provider configuration and capabilities without exposing credentials.
- `POST /api/v1/chat` — a bounded multi-turn conversation endpoint.
- `GET /api/v1/openapi.json` — machine-readable OpenAPI 3.1 specification.
- `GET /api/v1/auth/status`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` — optional shared-password session flow when `NOVA_APP_PASSWORD` is configured.
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

- `NOVA_PROVIDER_API_KEY` is the server-side credential for remote providers. `OPENAI_API_KEY` remains a backwards-compatible alias. A key is not required when the configured OpenAI-compatible provider is bound to `localhost`, `127.0.0.1` or `::1`.
- `NOVA_PROVIDER_BASE_URL` selects an OpenAI-compatible API base URL; HTTPS is required except for localhost development. Default: `https://api.openai.com/v1`.
- `NOVA_MODEL` selects the provider model. Default: `gpt-4o-mini`.
- Legacy `OPENAI_BASE_URL` and `OPENAI_MODEL` aliases are also supported.
- Never put provider credentials in a `VITE_*` variable or browser code.

### Local model provider (no provider API key)

Nova can connect to an OpenAI-compatible inference server running on the same computer as the Nova API. Set its loopback URL and model identifier in the server environment, for example:

```env
NOVA_PROVIDER_API_KEY=
NOVA_PROVIDER_BASE_URL=http://127.0.0.1:YOUR_PROVIDER_PORT/v1
NOVA_MODEL=your-local-model-id
```

Only loopback HTTP addresses are allowed without a provider key. The local model server must implement the OpenAI-compatible `/chat/completions` endpoint. Keep both servers on your trusted computer/network; do not expose an unauthenticated local inference port to the internet.

For phone use on the same Wi-Fi: start the production Nova server on the computer, then open that computer's LAN address and port `8787` on the phone (replace the address with your computer's actual LAN IP). The phone talks to Nova; Nova talks to the local model through loopback on the computer. Set `NOVA_APP_PASSWORD` and `NOVA_SESSION_SECRET` before allowing other devices on the network to connect.

**Important distinction:** Nova now has its own API interface, assistant instructions and conversation flow, but it is not a newly trained foundation model. Natural-language responses still require a configured external OpenAI-compatible model provider. Without provider credentials, the API reports that it is not configured and does not fake responses.

The chat endpoint is limited to 20 authenticated requests per IP per minute and has a 45-second provider timeout. Login attempts are limited to 5 per IP per 15 minutes. The in-memory rate limiter is for a single server process; multi-instance deployments need a shared store. The optional shared password is a basic access gate, not a substitute for individual user accounts, billing, or a production identity system.

## 3D workspace

- Interactive Three.js viewport with orbit, pan, zoom, automatic framing and grid visibility.
- Import by file picker and drag-and-drop for GLB/GLTF, FBX, OBJ, STL, PLY, 3MF, Collada/DAE and USDZ.
- Inspect mesh, vertex, triangle, material and texture counts; scene bounds/dimensions; and bounded per-mesh geometry attributes including UVs, normals, vertex colors, skinning, morph targets, geometry types and material base colors. A compact mesh inspector is available in the viewport.
- Export the currently loaded scene as binary GLB.
- Nova can issue validated scene edits through its function-calling interface: rename an object, change a material color, adjust local position/rotation/scale, add a box/sphere/cylinder/torus primitive, or delete a non-root object.
- **Offline prompt-to-3D builder:** enter a description and tap **Create 3D**. It builds editable procedural templates for robots, houses, trees, cars, chairs and desk lamps directly in the browser, without any API key or internet connection. The resulting meshes can be selected, recolored, inspected and exported as GLB. This is template-based procedural generation, not a neural text-to-3D model; unsupported prompts currently produce a desk-lamp starter model.
- The browser applies only the allow-listed scene operations and reports how many actually succeeded.
- Asset metadata is validated server-side before it is included in Nova's conversation context. Nova is told that structural statistics are not a visual inspection.

## Mobile-first use

The workspace is designed to work on phone-sized screens as well as desktop:

- Use the bottom **Studio** and **Nova** tabs to switch between the 3D viewport and the full-screen chat.
- Tap **Multi** in Studio before tapping meshes to select multiple parts by touch. Turn it off to return to single selection.
- Use **GLB** where possible. A single-file GLB keeps geometry and embedded textures together and is the most reliable format for mobile import.
- The import progress panel reports loading status. Models over 75 MB are rejected on phone-sized screens and models over 150 MB are rejected on larger screens to reduce the risk of browser memory or GPU failures.
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
