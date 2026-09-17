import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, portPosition } from '../src/circuits.js';
import { routeWire, wirePath } from '../src/wire-routing.js';

const levels = LEVELS.filter((level) => level.type === 'circuit');
const portsFor = (level) => new Map(level.nodes.flatMap((node) => node.ports.map((port) => [port.id, { ...port, ...portPosition(node, port), nodeId: node.id }])));
const epsilon = 1e-6;

function crosses(a, b, node, margin = 0) {
  const left = node.x - 56 - margin, right = node.x + 56 + margin;
  const top = node.y - 41 - margin, bottom = node.y + 41 + margin;
  return Math.abs(a.y - b.y) < epsilon
    ? a.y > top + epsilon && a.y < bottom - epsilon && Math.max(a.x, b.x) > left + epsilon && Math.min(a.x, b.x) < right - epsilon
    : a.x > left + epsilon && a.x < right - epsilon && Math.max(a.y, b.y) > top + epsilon && Math.min(a.y, b.y) < bottom - epsilon;
}

function assertClearRoute(level, a, b) {
  const points = routeWire(a, b, level.nodes);
  assert.deepEqual(points[0], { x: a.x, y: a.y });
  assert.deepEqual(points.at(-1), { x: b.x, y: b.y });
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i];
    assert.ok(Math.abs(from.x - to.x) < epsilon || Math.abs(from.y - to.y) < epsilon, 'segments are orthogonal');
    for (const node of level.nodes) {
      assert.equal(crosses(from, to, node), false, `${a.id} to ${b.id}: segment ${i} crosses ${node.id}`);
      if (i > 1 && i < points.length - 1) assert.equal(crosses(from, to, node, 12), false, 'middle segments preserve 12 px clearance');
    }
  }
  for (const point of points) assert.ok(point.x >= 0 && point.x <= 900 && point.y >= 0 && point.y <= 480, 'route stays on board');
  return points;
}

test('relay lesson fuse-to-switch route clears both vertically aligned cards', () => {
  const level = LEVELS[2], ports = portsFor(level);
  const a = ports.get('fuse:out'), b = ports.get('switch:in');
  const points = assertClearRoute(level, a, b);
  assert.deepEqual(routeWire(a, b, level.nodes), points, 'routing is deterministic');
  assert.match(wirePath(a, b, level.nodes), /^M341,100 L/);
});

for (const level of levels) {
  test(`level ${level.id}: every required wire has a clear route in either drawing direction`, () => {
    const ports = portsFor(level);
    for (const [a, b] of level.required) {
      assertClearRoute(level, ports.get(a), ports.get(b));
      assertClearRoute(level, ports.get(b), ports.get(a));
    }
  });

  test(`level ${level.id}: arbitrary wrong terminal pairs also avoid cards`, () => {
    const ports = [...portsFor(level).values()];
    for (let a = 0; a < ports.length; a++) {
      for (let b = a + 1; b < ports.length; b++) assertClearRoute(level, ports[a], ports[b]);
    }
  });
}
