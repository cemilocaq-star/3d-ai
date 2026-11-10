const SUPPORTED_FORMATS = new Set(['glb', 'gltf', 'fbx', 'obj', 'stl', 'ply', '3mf', 'dae', 'usdz']);

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}

function safeText(value, maxLength = 80) {
  if (typeof value !== 'string') return null;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
  return result || null;
}

function safeDimension(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  return Math.round(value * 1000) / 1000;
}

function normalizeDimensions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const dimensions = {
    x: safeDimension(input.x),
    y: safeDimension(input.y),
    z: safeDimension(input.z)
  };
  return Object.values(dimensions).every(value => value === null) ? null : dimensions;
}

function normalizeNames(input, maxItems = 24) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, maxItems).map(value => safeText(value, 80)).filter(Boolean);
}

function normalizeMeshDetails(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const normalized = {
      name: safeText(item.name, 80),
      vertices: safeCount(item.vertices),
      triangles: safeCount(item.triangles),
      dimensions: normalizeDimensions(item.dimensions),
      geometryType: safeText(item.geometryType, 48),
      hasUV: typeof item.hasUV === 'boolean' ? item.hasUV : null,
      hasNormals: typeof item.hasNormals === 'boolean' ? item.hasNormals : null,
      hasVertexColors: typeof item.hasVertexColors === 'boolean' ? item.hasVertexColors : null,
      hasSkinning: typeof item.hasSkinning === 'boolean' ? item.hasSkinning : null,
      morphTargets: typeof item.morphTargets === 'boolean' ? item.morphTargets : null,
      materials: normalizeNames(item.materials, 4),
      materialColors: Array.isArray(item.materialColors) ? item.materialColors.slice(0, 4).filter(value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)).map(value => value.toLowerCase()) : []
    };
    return Object.values(normalized).some(value => value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0))
      ? normalized
      : null;
  }).filter(Boolean);
}

export function normalizeAssetMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const filename = safeText(input.filename, 120);
  const format = typeof input.format === 'string' && SUPPORTED_FORMATS.has(input.format.toLowerCase())
    ? input.format.toLowerCase()
    : null;

  const statsInput = input.stats && typeof input.stats === 'object' && !Array.isArray(input.stats)
    ? input.stats
    : {};
  const stats = {
    meshes: safeCount(statsInput.meshes),
    vertices: safeCount(statsInput.vertices),
    triangles: safeCount(statsInput.triangles),
    materials: safeCount(statsInput.materials),
    textures: safeCount(statsInput.textures),
    uvMeshes: safeCount(statsInput.uvMeshes),
    normalMeshes: safeCount(statsInput.normalMeshes),
    vertexColorMeshes: safeCount(statsInput.vertexColorMeshes),
    skinnedMeshes: safeCount(statsInput.skinnedMeshes),
    morphMeshes: safeCount(statsInput.morphMeshes),
    dimensions: normalizeDimensions(statsInput.dimensions),
    meshDetails: normalizeMeshDetails(statsInput.meshDetails)
  };

  if (!filename && !format && Object.entries(stats).every(([key, value]) =>
    key === 'meshDetails' ? value.length === 0 : value === null
  )) return null;

  return { filename, format, stats };
}
