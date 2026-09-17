import test from 'node:test';
import assert from 'node:assert/strict';

const resultsKey = 'auto-light-lab.results.v1';
let importCount = 0;
const record = (id = 'one', extra = {}) => ({
  id, player: 'นักเรียน', level: 1, score: 90, seconds: 35,
  wrong: 1, hints: 0, date: '2026-09-17T12:00:00.000Z', ...extra,
});

async function withStore(initial, callback, blocked = false) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      if (blocked) throw new Error('SecurityError: storage denied');
      return {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key),
      };
    },
  });
  try {
    const { store } = await import(`../src/storage.js?test=${++importCount}`);
    await callback(store, data);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

test('storage rejects malformed records and survives malformed JSON', async () => {
  await withStore({ [resultsKey]: '{broken' }, store => {
    assert.deepEqual(store.getResults(), []);
    for (const value of [null, [], {}, record('a', { level: 6 }), record('a', { score: Infinity }), record('a', { score: -1 }), record('a', { seconds: -2 }), record('a', { wrong: 0.5 }), record('a', { hints: -1 }), record('a', { date: 'yesterday' }), record('a', { player: '' })]) {
      assert.equal(store.saveResult(value), false);
    }
    assert.deepEqual(store.getResults(), []);
    assert.equal(store.saveResult(record()), true);
    assert.equal(store.getResults().length, 1);
  });
});

test('storage sanitizes loaded data, deduplicates IDs, and returns independent copies', async () => {
  await withStore({ [resultsKey]: JSON.stringify([record(), null, record('one', { score: 80 }), record('two', { level: 8 })]) }, store => {
    assert.equal(store.getResults().length, 1);
    assert.equal(store.getResults()[0].score, 80);
    const copy = store.getResults();
    copy[0].score = 0;
    copy.push(record('injected'));
    assert.equal(store.getResults()[0].score, 80);
    assert.equal(store.getResults().length, 1);
    assert.equal(store.saveResult(record('one', { score: 70 })), true);
    assert.equal(store.getResults().length, 1);
    assert.equal(store.getResults()[0].score, 70);
  });
});

test('storage caps history at the latest 500 records', async () => {
  await withStore({}, store => {
    for (let index = 0; index < 505; index += 1) store.saveResult(record(String(index)));
    assert.equal(store.getResults().length, 500);
    assert.equal(store.getResults()[0].id, '5');
    assert.equal(store.getResults().at(-1).id, '504');
    assert.equal(store.clearResults(), true);
    assert.deepEqual(store.getResults(), []);
  });
});

test('blocked localStorage keeps results and learner name in memory', async () => {
  await withStore({}, store => {
    assert.equal(store.available(), false);
    assert.equal(store.saveResult(record()), false);
    assert.equal(store.getResults().length, 1);
    assert.equal(store.saveName('  น้องช่าง  '), false);
    assert.equal(store.getName(), 'น้องช่าง');
    assert.equal(store.clearResults(), false);
    assert.deepEqual(store.getResults(), []);
  }, true);
});

test('name persists and invalid name inputs preserve the current name', async () => {
  await withStore({}, (store, data) => {
    assert.equal(store.available(), true);
    assert.equal(store.saveName('  ช่างน้อย  '), true);
    assert.equal(store.getName(), 'ช่างน้อย');
    assert.equal(data.get('auto-light-lab.name.v1'), 'ช่างน้อย');
    assert.equal(store.saveName({}), false);
    assert.equal(store.getName(), 'ช่างน้อย');
  });
});

test('results refresh from another tab and the next save preserves both tabs', async () => {
  await withStore({}, (store, data) => {
    assert.deepEqual(store.getResults(), []);
    data.set(resultsKey, JSON.stringify([record('other-tab')]));
    assert.equal(store.getResults()[0].id, 'other-tab');
    assert.equal(store.saveResult(record('this-tab')), true);
    data.set(resultsKey, JSON.stringify([...store.getResults(), record('later-tab')]));
    assert.equal(store.saveResult(record('latest')), true);
    assert.deepEqual(store.getResults().map(item => item.id), ['other-tab', 'this-tab', 'later-tab', 'latest']);
    assert.equal(JSON.parse(data.get(resultsKey)).length, 4);
    data.delete(resultsKey);
    assert.deepEqual(store.getResults(), []);
  });
});

test('learner name refreshes when another tab changes or clears it', async () => {
  await withStore({}, (store, data) => {
    assert.equal(store.getName(), '');
    data.set('auto-light-lab.name.v1', 'อีกแท็บ');
    assert.equal(store.getName(), 'อีกแท็บ');
    data.delete('auto-light-lab.name.v1');
    assert.equal(store.getName(), '');
  });
});

test('availability probe runs once to prevent cross-tab storage-event loops', async () => {
  await withStore({}, (store, data) => {
    let writes = 0;
    const originalSet = data.set;
    data.set = function (key, value) { writes += 1; return originalSet.call(this, key, value); };
    assert.equal(store.available(), true);
    assert.equal(store.available(), true);
    assert.equal(writes, 1);
  });
});
