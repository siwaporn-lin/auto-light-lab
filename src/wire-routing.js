// Card geometry matches circuits.portPosition and the circuit-node CSS.
const HALF_WIDTH = 56;
const HALF_HEIGHT = 41;
const CLEARANCE = 12;
const LEAD = 24;
const BEND_COST = 18;
const EPSILON = 1e-7;

function bounds(node) {
  return { left: node.x - HALF_WIDTH - CLEARANCE, right: node.x + HALF_WIDTH + CLEARANCE,
    top: node.y - HALF_HEIGHT - CLEARANCE, bottom: node.y + HALF_HEIGHT + CLEARANCE };
}

function lead(point) {
  return { x: point.x + (point.side === 'left' ? -LEAD : point.side === 'right' ? LEAD : 0),
    y: point.y + (point.side === 'top' ? -LEAD : point.side === 'bottom' ? LEAD : 0) };
}

function inside(point, rectangle) {
  return point.x > rectangle.left + EPSILON && point.x < rectangle.right - EPSILON &&
    point.y > rectangle.top + EPSILON && point.y < rectangle.bottom - EPSILON;
}

function clearSegment(a, b, rectangles) {
  const horizontal = Math.abs(a.y - b.y) < EPSILON;
  return rectangles.every((r) => horizontal
    ? !(a.y > r.top + EPSILON && a.y < r.bottom - EPSILON &&
        Math.max(a.x, b.x) > r.left + EPSILON && Math.min(a.x, b.x) < r.right - EPSILON)
    : !(a.x > r.left + EPSILON && a.x < r.right - EPSILON &&
        Math.max(a.y, b.y) > r.top + EPSILON && Math.min(a.y, b.y) < r.bottom - EPSILON));
}

// Small binary heap keeps each drag/drop redraw fast without any dependency.
class PriorityQueue {
  entries = [];
  before(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.order < b.order); }
  push(entry) {
    const list = this.entries;
    let index = list.length;
    list.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(entry, list[parent])) break;
      list[index] = list[parent];
      index = parent;
    }
    list[index] = entry;
  }
  pop() {
    const list = this.entries;
    const first = list[0];
    const last = list.pop();
    if (list.length) {
      let index = 0;
      while (index * 2 + 1 < list.length) {
        let child = index * 2 + 1;
        if (child + 1 < list.length && this.before(list[child + 1], list[child])) child++;
        if (!this.before(list[child], last)) break;
        list[index] = list[child];
        index = child;
      }
      list[index] = last;
    }
    return first;
  }
}

/**
 * Orthogonal points from terminal a to terminal b. The first/last 24 px leads
 * leave their own cards; all middle segments stay at least 12 px from cards.
 * A visibility grid and A* support both correct and intentionally wrong wires.
 * Connections are graphical wires: their intersections do not create junctions.
 */
export function routeWire(a, b, nodes) {
  const start = lead(a);
  const end = lead(b);
  const rectangles = nodes.map(bounds);
  const xs = [...new Set([start.x, end.x, ...rectangles.flatMap((r) => [r.left, r.right])])].sort((x, y) => x - y);
  const ys = [...new Set([start.y, end.y, ...rectangles.flatMap((r) => [r.top, r.bottom])])].sort((x, y) => x - y);
  const width = xs.length;
  const points = ys.flatMap((y) => xs.map((x) => ({ x, y })));
  const available = points.map((point) => !rectangles.some((r) => inside(point, r)));
  const startId = ys.indexOf(start.y) * width + xs.indexOf(start.x);
  const endId = ys.indexOf(end.y) * width + xs.indexOf(end.x);
  if (!available[startId] || !available[endId]) throw new RangeError('A terminal lead overlaps another card. Move the cards farther apart.');

  // Direction 0 is horizontal; 1 is vertical. Keeping direction in the state
  // permits an actual bend penalty instead of choosing visually noisy zigzags.
  const direction = (point) => ['top', 'bottom'].includes(point.side) ? 1 : 0;
  const startState = startId * 2 + direction(a);
  const distance = new Float64Array(points.length * 2).fill(Infinity);
  const previous = new Int32Array(points.length * 2).fill(-1);
  const queue = new PriorityQueue();
  const heuristic = (point) => Math.abs(point.x - end.x) + Math.abs(point.y - end.y);
  let sequence = 0;
  let bestState = -1;
  let bestCost = Infinity;
  distance[startState] = 0;
  queue.push({ state: startState, cost: 0, priority: heuristic(start), order: sequence++ });

  while (queue.entries.length) {
    const entry = queue.pop();
    if (entry.cost !== distance[entry.state]) continue;
    if (entry.priority >= bestCost) break;
    const id = Math.floor(entry.state / 2);
    const heading = entry.state % 2;
    if (id === endId) {
      const total = entry.cost + (heading === direction(b) ? 0 : BEND_COST);
      if (total < bestCost) { bestCost = total; bestState = entry.state; }
      continue;
    }
    const column = id % width;
    const row = Math.floor(id / width);
    const neighbors = [];
    if (column + 1 < width) neighbors.push([id + 1, 0]);
    if (row + 1 < ys.length) neighbors.push([id + width, 1]);
    if (column > 0) neighbors.push([id - 1, 0]);
    if (row > 0) neighbors.push([id - width, 1]);
    for (const [nextId, nextHeading] of neighbors) {
      if (!available[nextId] || !clearSegment(points[id], points[nextId], rectangles)) continue;
      const segmentLength = Math.abs(points[id].x - points[nextId].x) + Math.abs(points[id].y - points[nextId].y);
      const cost = entry.cost + segmentLength + (heading === nextHeading ? 0 : BEND_COST);
      const state = nextId * 2 + nextHeading;
      if (cost >= distance[state]) continue;
      distance[state] = cost;
      previous[state] = entry.state;
      queue.push({ state, cost, priority: cost + heuristic(points[nextId]), order: sequence++ });
    }
  }
  if (bestState < 0) throw new RangeError('No clear wire route between the terminals.');

  const middle = [];
  for (let state = bestState; state >= 0; state = previous[state]) middle.push(points[Math.floor(state / 2)]);
  middle.reverse();
  // Retain explicit leads for easy geometric verification; SVG can contain
  // collinear points without adding corners or changing the visual appearance.
  const simplified = middle.filter((point, i) => i === 0 || i === middle.length - 1 ||
    !((Math.abs(middle[i - 1].x - point.x) < EPSILON && Math.abs(point.x - middle[i + 1].x) < EPSILON) ||
      (Math.abs(middle[i - 1].y - point.y) < EPSILON && Math.abs(point.y - middle[i + 1].y) < EPSILON)));
  return [{ x: a.x, y: a.y }, ...simplified, { x: b.x, y: b.y }];
}

/** SVG path data, ready for a <path d="…">. */
export function wirePath(a, b, nodes) {
  return routeWire(a, b, nodes).map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
}
