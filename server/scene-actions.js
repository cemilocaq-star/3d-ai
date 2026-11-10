const MAX_SCENE_ACTIONS = 8;

function safeName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
  return name || null;
}

function vector(input, { min = -10000, max = 10000, positive = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = {};
  for (const axis of ['x', 'y', 'z']) {
    const value = input[axis];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (positive && value <= 0)) {
      return null;
    }
    result[axis] = Math.round(value * 1000) / 1000;
  }
  return result;
}

function normalizeObjectIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 20);
  return ids.length ? ids : null;
}

function color(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

export function normalizeSceneActions(input) {
  if (!Array.isArray(input)) return [];
  const actions = [];

  for (const item of input.slice(0, MAX_SCENE_ACTIONS)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    if (item.type === 'rename_object') {
      const objectName = safeName(item.objectName);
      const objectId = typeof item.objectId === 'string' && /^[0-9a-f-]{36}$/i.test(item.objectId) ? item.objectId : null;
      const name = safeName(item.name);
      if ((objectName || objectId) && name) actions.push({ type: item.type, ...(objectName && { objectName }), ...(objectId && { objectId }), name });
    } else if (item.type === 'set_material_color') {
      const objectIds = normalizeObjectIds(item.objectIds);
      const objectName = safeName(item.objectName);
      const objectId = typeof item.objectId === 'string' && /^[0-9a-f-]{36}$/i.test(item.objectId) ? item.objectId : null;
      const nextColor = color(item.color);
      if ((objectName || objectId || objectIds?.length) && nextColor) actions.push({ type: item.type, ...(objectName && { objectName }), ...(objectId && { objectId }), ...(objectIds && { objectIds }), color: nextColor });
    } else if (item.type === 'set_transform') {
      const objectIds = normalizeObjectIds(item.objectIds);
      const objectName = safeName(item.objectName);
      const objectId = typeof item.objectId === 'string' && /^[0-9a-f-]{36}$/i.test(item.objectId) ? item.objectId : null;
      const position = item.position === undefined ? null : vector(item.position);
      const rotation = item.rotation === undefined ? null : vector(item.rotation, { min: -3600, max: 3600 });
      const scale = item.scale === undefined ? null : vector(item.scale, { min: 0.01, max: 100, positive: true });
      const suppliedFields = ['position', 'rotation', 'scale'].filter(key => item[key] !== undefined);
      const validFields = suppliedFields.every(key => ({ position, rotation, scale })[key] !== null);
      if ((objectName || objectId || objectIds?.length) && suppliedFields.length > 0 && validFields) {
        actions.push({ type: item.type, ...(objectName && { objectName }), ...(objectId && { objectId }), ...(objectIds && { objectIds }), ...(position && { position }), ...(rotation && { rotation }), ...(scale && { scale }) });
      }
    } else if (item.type === 'add_primitive') {
      const name = safeName(item.name);
      const primitive = ['box', 'sphere', 'cylinder', 'torus'].includes(item.primitive) ? item.primitive : null;
      const nextColor = color(item.color || '#9ab6d4');
      const position = item.position === undefined ? { x: 0, y: 0, z: 0 } : vector(item.position);
      const scale = item.scale === undefined ? { x: 1, y: 1, z: 1 } : vector(item.scale, { min: 0.01, max: 100, positive: true });
      if (name && primitive && nextColor && position && scale) {
        actions.push({ type: item.type, primitive, name, color: nextColor, position, scale });
      }
    } else if (item.type === 'delete_object') {
      const objectIds = normalizeObjectIds(item.objectIds);
      const objectName = safeName(item.objectName);
      const objectId = typeof item.objectId === 'string' && /^[0-9a-f-]{36}$/i.test(item.objectId) ? item.objectId : null;
      if (objectName || objectId || objectIds?.length) actions.push({ type: item.type, ...(objectName && { objectName }), ...(objectId && { objectId }), ...(objectIds && { objectIds }) });
    }
  }

  return actions;
}
