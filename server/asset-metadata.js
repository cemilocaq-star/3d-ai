const SUPPORTED_FORMATS = new Set(['glb', 'gltf', 'fbx', 'obj', 'stl', 'ply', '3mf', 'dae', 'usdz']);

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}

export function normalizeAssetMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const rawName = typeof input.filename === 'string' ? input.filename : '';
  const filename = rawName.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
  const format = typeof input.format === 'string' && SUPPORTED_FORMATS.has(input.format.toLowerCase())
    ? input.format.toLowerCase()
    : null;

  const statsInput = input.stats && typeof input.stats === 'object' && !Array.isArray(input.stats)
    ? input.stats
    : {};
  const stats = {
    meshes: safeCount(statsInput.meshes),
    vertices: safeCount(statsInput.vertices),
    triangles: safeCount(statsInput.triangles)
  };

  if (!filename && !format && Object.values(stats).every(value => value === null)) return null;
  return { filename: filename || null, format, stats };
}
