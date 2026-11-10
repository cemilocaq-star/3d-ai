# Nova 3D AI Studio

A browser-based 3D asset workspace built with React, Vite and Three.js.

## Run locally
```bash
npm install
npm run dev
```

## Current implementation
- Interactive Three.js viewport with orbit, pan, zoom, automatic framing and grid visibility control.
- Import by file picker for GLB/GLTF, FBX, OBJ, STL, PLY, 3MF, Collada/DAE and USDZ.
- Drag-and-drop import for the same listed formats.
- Basic mesh, vertex and triangle statistics.
- Export the currently loaded scene as binary GLB.
- Responsive studio layout and an AI-assistant interface shell.
- GitHub Actions workflow configured to run `npm install` and `npm run build`.

## Known limitations
- AI provider integration and actual text-to-3D generation/editing are not implemented.
- OBJ companion MTL/textures and other multi-file asset packages are not handled.
- Only the formats listed above are wired; this is not universal 3D-format support.
- CI/build, browser and device validation must pass before calling this production-ready.
