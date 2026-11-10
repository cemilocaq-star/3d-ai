import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSceneActions } from './scene-actions.js';

test('accepts bounded, supported scene edits', () => {
  assert.deepEqual(normalizeSceneActions([
    { type: 'rename_object', objectName: 'Cube', name: 'Main body' },
    { type: 'set_material_color', objectName: 'Main body', color: '#AABBCC' },
    { type: 'set_transform', objectName: 'Main body', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 90, z: 0 } },
    { type: 'add_primitive', primitive: 'sphere', name: 'Lens', color: '#ffffff' },
    { type: 'delete_object', objectName: 'Old part' }
  ]), [
    { type: 'rename_object', objectName: 'Cube', name: 'Main body' },
    { type: 'set_material_color', objectName: 'Main body', color: '#aabbcc' },
    { type: 'set_transform', objectName: 'Main body', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 90, z: 0 } },
    { type: 'add_primitive', primitive: 'sphere', name: 'Lens', color: '#ffffff', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { type: 'delete_object', objectName: 'Old part' }
  ]);
});

test('rejects unsupported operations, invalid colors and unsafe transforms', () => {
  assert.deepEqual(normalizeSceneActions([
    { type: 'execute_code', code: 'alert(1)' },
    { type: 'set_material_color', objectName: 'Cube', color: 'red' },
    { type: 'set_transform', objectName: 'Cube', scale: { x: -1, y: 1, z: 1 } },
    { type: 'add_primitive', primitive: 'custom-script', name: 'Part' }
  ]), []);
});

test('accepts UUID-targeted edits and rejects malformed UUIDs', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.deepEqual(normalizeSceneActions([
    { type: 'set_material_color', objectId: id, color: '#abcdef' },
    { type: 'delete_object', objectId: 'not-a-uuid' }
  ]), [{ type: 'set_material_color', objectId: id, color: '#abcdef' }]);
});

test('caps action count and strips control characters in names', () => {
  const actions = Array.from({ length: 12 }, (_, i) => ({
    type: 'rename_object', objectName: 'Part', name: 'Part ' + i + '\u0000'
  }));
  const result = normalizeSceneActions(actions);
  assert.equal(result.length, 8);
  assert.equal(result[0].name, 'Part 0');
});


test('accepts bounded UUID arrays for bulk mesh edits and rejects malformed entries', () => {
  const ids = ['12345678-1234-1234-1234-123456789abc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
  assert.deepEqual(normalizeSceneActions([
    { type: 'set_material_color', objectIds: [...ids, 'bad'], color: '#ABCDEF' },
    { type: 'delete_object', objectIds: ['not-a-uuid'] }
  ]), [{ type: 'set_material_color', objectIds: ids, color: '#abcdef' }]);
});
