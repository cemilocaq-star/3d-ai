import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAssetMetadata } from './asset-metadata.js';

test('normalizes supported asset metadata and mesh inspection', () => {
  const result = normalizeAssetMetadata({
    filename: 'robot.glb', format: 'GLB',
    stats: {
      meshes: 3, vertices: 1200, triangles: 800, materials: 2, textures: 1,
      dimensions: { x: 2.5, y: 3, z: 1.25 },
      uvMeshes: 2, normalMeshes: 3, vertexColorMeshes: 1, skinnedMeshes: 1, morphMeshes: 1,
      meshDetails: [{
        name: 'Body', vertices: 900, triangles: 600, dimensions: { x: 2, y: 3, z: 1 },
        geometryType: 'SkinnedMeshGeometry', hasUV: true, hasNormals: true,
        hasVertexColors: false, hasSkinning: true, morphTargets: true,
        materials: ['Paint'], materialColors: ['#AABBCC']
      }]
    }
  });
  assert.equal(result.format, 'glb');
  assert.equal(result.stats.meshes, 3);
  assert.deepEqual(result.stats.dimensions, { x: 2.5, y: 3, z: 1.25 });
  assert.equal(result.stats.skinnedMeshes, 1);
  assert.equal(result.stats.meshDetails[0].geometryType, 'SkinnedMeshGeometry');
  assert.equal(result.stats.meshDetails[0].hasSkinning, true);
  assert.deepEqual(result.stats.meshDetails[0].materialColors, ['#aabbcc']);
});

test('rejects unsupported formats and invalid geometry counts', () => {
  const result = normalizeAssetMetadata({
    filename: 'asset.bin', format: 'bin',
    stats: { meshes: -2, vertices: 1.5, triangles: '100' }
  });
  assert.equal(result.format, null);
  assert.equal(result.stats.meshes, null);
  assert.equal(result.stats.vertices, null);
  assert.equal(result.stats.triangles, null);
  assert.equal(result.stats.uvMeshes, null);
  assert.deepEqual(result.stats.meshDetails, []);
});

test('removes control characters and truncates filenames', () => {
  const result = normalizeAssetMetadata({
    filename: 'a\\u0000b'.padEnd(140, 'x'), format: 'obj'
  });
  assert.equal(result.filename.length, 120);
  assert.equal(result.filename.includes('\\u0000'), false);
});

test('sanitizes mesh and material names and caps inspection detail', () => {
  const details = Array.from({ length: 25 }, (_, i) => ({
    name: 'Part ' + i + '\\u0000', vertices: 20, triangles: 10,
    dimensions: { x: -1, y: 2, z: 3 },
    materials: ['Paint\\u0001', 'Metal', 'Glass', 'Rubber', 'Extra'],
    materialColors: ['#FFFFFF', 'not-a-color']
  }));
  const result = normalizeAssetMetadata({
    filename: 'scene.gltf', format: 'gltf',
    stats: { meshDetails: details, dimensions: { x: 1.23456, y: 2, z: 3 } }
  });
  assert.equal(result.stats.meshDetails.length, 20);
  assert.equal(result.stats.meshDetails[0].name, 'Part 0');
  assert.deepEqual(result.stats.meshDetails[0].dimensions, { x: null, y: 2, z: 3 });
  assert.equal(result.stats.meshDetails[0].materials.length, 4);
  assert.deepEqual(result.stats.meshDetails[0].materialColors, ['#ffffff']);
  assert.deepEqual(result.stats.dimensions, { x: 1.235, y: 2, z: 3 });
});

test('returns null for empty or malformed metadata', () => {
  assert.equal(normalizeAssetMetadata(null), null);
  assert.equal(normalizeAssetMetadata([]), null);
  assert.equal(normalizeAssetMetadata({ stats: { meshes: -1 } }), null);
});
