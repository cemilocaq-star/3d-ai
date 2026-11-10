# Nova 3D AI Studio

A browser-based 3D asset workspace with an interactive Three.js viewport and an AI-assistant UI shell.

## Run locally
```bash
npm install
npm run dev
```

## Current capabilities
- Import and inspect GLB/GLTF, FBX, OBJ, STL, PLY, 3MF, Collada/DAE and USDZ files.
- Orbit, pan, zoom, auto-frame and grid viewport.
- Responsive studio layout and assistant chat shell.

## Important limitations
The AI endpoint is not yet implemented. Model switching is currently UI-only. Some formats need companion files or external dependencies (for example OBJ materials/textures); multi-file asset packaging is not implemented yet. The app has not yet been built or browser-tested in this repository.
