import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAssetMetadata } from './asset-metadata.js';

test('normalizes valid model metadata', () => {
  assert.deepEqual(normalizeAssetMetadata({
    filename: 'robot.glb',
    format: 'GLB',
    stats: { meshes: 3, vertices: 1200, triangles: 800 }
  }), {
    filename: 'robot.glb',
    format: 'glb',
    stats: { meshes: 3, vertices: 1200, triangles: 800 }
  });
});

test('rejects unsupported format and invalid geometry counts', () => {
  assert.deepEqual(normalizeAssetMetadata({
    filename: 'asset.bin',
    format: 'bin',
    stats: { meshes: -2, vertices: 1.5, triangles: '100' }
  }), {
    filename: 'asset.bin',
    format: null,
    stats: { meshes: null, vertices: null, triangles: null }
  });
});

test('removes control characters and truncates filenames', () => {
  const result = normalizeAssetMetadata({
    filename: 'a\u0000b'.padEnd(140, 'x'),
    format: 'obj'
  });
  assert.equal(result.filename.length, 120);
  assert.equal(result.filename.includes('\u0000'), false);
});

test('returns null for empty or malformed metadata', () => {
  assert.equal(normalizeAssetMetadata(null), null);
  assert.equal(normalizeAssetMetadata([]), null);
  assert.equal(normalizeAssetMetadata({ stats: { meshes: -1 } }), null);
});
