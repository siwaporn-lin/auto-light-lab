import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, LEVELS, portPosition, normalizePair, validateCircuit, calculateScore } from '../src/circuits.js';

const circuitLevels = LEVELS.filter((level) => level.type === 'circuit');

test('lesson content includes five stages and real scalable circuit symbols', () => {
  assert.deepEqual(LEVELS.map(({ id }) => id), [1, 2, 3, 4, 5]);
  assert.deepEqual(LEVELS.map(({ type }) => type), ['match', 'circuit', 'circuit', 'circuit', 'analysis']);
  for (const key of LEVELS[0].items) {
    assert.ok(COMPONENTS[key].name);
    assert.match(COMPONENTS[key].symbol, /<svg[^>]*viewBox="0 0 64 64"/);
  }
});

for (const level of circuitLevels) {
  test(`level ${level.id}: complete wiring works in either drawing direction`, () => {
    assert.deepEqual(validateCircuit(level, level.required), { correct: true, missing: [], extra: [] });
    const reversed = level.required.map(([a, b]) => [b, a]).reverse();
    assert.equal(validateCircuit(level, reversed).correct, true);
  });

  test(`level ${level.id}: missing, extra, duplicate, self and unknown wires fail`, () => {
    const empty = validateCircuit(level, []);
    assert.equal(empty.correct, false);
    assert.equal(empty.missing.length, level.required.length);
    const partial = validateCircuit(level, level.required.slice(1));
    assert.deepEqual(partial.missing, [level.required[0]]);
    const extras = [
      level.required[0],
      [...level.required[0]].reverse(),
      ['battery:positive', 'battery:positive'],
      ['battery:positive', 'battery:negative'],
      ['battery:positive', 'unknown:terminal'],
    ];
    for (const wire of extras) {
      const result = validateCircuit(level, [...level.required, wire]);
      assert.equal(result.correct, false);
      assert.deepEqual(result.extra, [wire]);
      assert.equal(result.missing.length, 0);
    }
  });

  test(`level ${level.id}: all connections reference distinct, visible terminals`, () => {
    const ids = level.nodes.flatMap((node) => node.ports.map(({ id }) => id));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(level.required.map(([a, b]) => normalizePair(a, b))).size, level.required.length);
    for (const [a, b] of level.required) {
      assert.ok(ids.includes(a) && ids.includes(b));
      assert.notEqual(a, b);
    }
    for (const node of level.nodes) {
      for (const terminal of node.ports) {
        const point = portPosition(node, terminal);
        assert.ok(point.x >= 22 && point.x <= 878, `${terminal.id} x within board`);
        assert.ok(point.y >= 22 && point.y <= 438, `${terminal.id} y within board`);
      }
    }
  });
}

test('relay has separate power contacts and control coil connections', () => {
  for (const level of circuitLevels.filter(({ id }) => id >= 3)) {
    const relay = level.nodes.find(({ key }) => key === 'relay');
    assert.deepEqual(new Set(relay.ports.map(({ id }) => id)), new Set(['relay:30', 'relay:87', 'relay:85', 'relay:86']));
    const connections = new Set(level.required.map(([a, b]) => normalizePair(a, b)));
    assert.ok(connections.has(normalizePair('fuse:out', 'relay:30')));
    assert.ok(connections.has(normalizePair('switch:out', 'relay:86')));
    assert.ok(connections.has(normalizePair('relay:85', 'ground:body')));
    for (const [a, b] of level.required) {
      assert.ok(!(a.startsWith('relay:') && b.startsWith('relay:')), 'No user wire bridges relay internal terminals');
    }
  }
});

test('high/low selector is after relay output and lamp branches share ground', () => {
  const level = LEVELS[3];
  const connections = new Set(level.required.map(([a, b]) => normalizePair(a, b)));
  for (const pair of [['relay:87', 'selector:common'], ['selector:low', 'low:positive'], ['selector:high', 'high:positive'], ['low:negative', 'ground:body'], ['high:negative', 'ground:body']]) {
    assert.ok(connections.has(normalizePair(...pair)));
  }
  const bridged = [...level.required, ['selector:low', 'selector:high']];
  assert.equal(validateCircuit(level, bridged).correct, false);
});

test('diagnosis includes supply, both fuse blades and isolated continuity evidence', () => {
  const level = LEVELS[4];
  assert.equal(level.answer, 'fuse');
  assert.deepEqual(level.measurements.map(({ value }) => value), ['12.0 V', '12.0 V', '0.0 V', 'OL · วงจรเปิด']);
  assert.match(level.description, /ตัดไฟ/);
  assert.match(level.lesson, /พิกัดเดิม/);
});

test('malformed wiring is rejected without crashing', () => {
  const level = LEVELS[1];
  for (const input of [null, undefined, {}, 'wire']) assert.equal(validateCircuit(level, input).correct, false);
  for (const pair of [null, {}, 'wire', ['battery:positive'], ['battery:positive', 1], ['a', 'b', 'c']]) {
    assert.equal(validateCircuit(level, [...level.required, pair]).correct, false);
  }
  assert.equal(validateCircuit(LEVELS[0], []).correct, false);
  assert.equal(validateCircuit(null, []).correct, false);
});

test('terminal positions use centered 112 × 82 card dimensions', () => {
  const node = { x: 100, y: 100 };
  assert.deepEqual(portPosition(node, { side: 'left', offset: 0.5 }), { x: 44, y: 100 });
  assert.deepEqual(portPosition(node, { side: 'right', offset: 0.5 }), { x: 156, y: 100 });
  assert.deepEqual(portPosition(node, { side: 'top', offset: 0.25 }), { x: 72, y: 59 });
  assert.deepEqual(portPosition(node, { side: 'bottom', offset: 0.75 }), { x: 128, y: 141 });
});

test('scoring is accessible, bounded and penalizes only mistakes and hints', () => {
  assert.equal(calculateScore(), 100);
  assert.equal(calculateScore({ wrongAttempts: 2, hintsUsed: 3 }), 65);
  assert.equal(calculateScore({ wrongAttempts: 1, hintsUsed: 0, seconds: 900 }), 90);
  assert.equal(calculateScore({ wrongAttempts: 99, hintsUsed: 4 }), 0);
  assert.equal(calculateScore({ wrongAttempts: -2, hintsUsed: -1 }), 100);
  assert.equal(calculateScore({ wrongAttempts: NaN, hintsUsed: Infinity }), 100);
});
