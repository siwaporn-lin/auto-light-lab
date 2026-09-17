/** Local-only persistence. The in-memory copy remains usable if storage is blocked. */
const RESULTS_KEY = 'auto-light-lab.results.v1';
const NAME_KEY = 'auto-light-lab.name.v1';
const MAX_RESULTS = 500;
let results = [];
let name = '';
const pendingResults = new Map();
let pendingClear = false;
let pendingName = false;
let storageAvailable;

function validRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, player, level, score, seconds, wrong, hints, date } = value;
  if (typeof id !== 'string' || !id.trim() || id.length > 200) return null;
  if (typeof player !== 'string' || !player.trim() || player.length > 80) return null;
  if (!Number.isInteger(level) || level < 1 || level > 5) return null;
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (!Number.isInteger(wrong) || wrong < 0 || !Number.isInteger(hints) || hints < 0) return null;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date))) return null;
  return { id, player, level, score, seconds, wrong, hints, date };
}

function loadResults() {
  try {
    const parsed = JSON.parse(globalThis.localStorage.getItem(RESULTS_KEY) || '[]');
    const byId = new Map();
    for (const item of !pendingClear && Array.isArray(parsed) ? parsed : []) {
      const record = validRecord(item);
      if (record) {
        byId.delete(record.id);
        byId.set(record.id, record);
      }
    }
    for (const [id, record] of pendingResults) {
      byId.delete(id);
      byId.set(id, record);
    }
    results = [...byId.values()].slice(-MAX_RESULTS);
  } catch {
    // Private browsing, denied storage, and malformed JSON all have a safe fallback.
  }
}

function loadName() {
  if (pendingName) return;
  try {
    const saved = globalThis.localStorage.getItem(NAME_KEY);
    name = typeof saved === 'string' && saved.length <= 80 ? saved.trim() : '';
  } catch {
    // Keep the current session name in memory.
  }
}

export const store = {
  getResults() {
    loadResults();
    return results.map(record => ({ ...record }));
  },
  saveResult(value) {
    loadResults();
    const record = validRecord(value);
    if (!record) return false;
    results = [...results.filter(item => item.id !== record.id), record].slice(-MAX_RESULTS);
    try {
      globalThis.localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
      pendingResults.clear();
      pendingClear = false;
      storageAvailable = true;
      return true;
    } catch {
      pendingResults.delete(record.id);
      pendingResults.set(record.id, record);
      if (pendingResults.size > MAX_RESULTS) pendingResults.delete(pendingResults.keys().next().value);
      storageAvailable = false;
      return false;
    }
  },
  getName() {
    loadName();
    return name;
  },
  saveName(value) {
    loadName();
    if (typeof value !== 'string' || value.trim().length > 80) return false;
    name = value.trim();
    try {
      globalThis.localStorage.setItem(NAME_KEY, name);
      pendingName = false;
      storageAvailable = true;
      return true;
    } catch {
      pendingName = true;
      storageAvailable = false;
      return false;
    }
  },
  clearResults() {
    loadResults();
    results = [];
    pendingResults.clear();
    pendingClear = true;
    try {
      globalThis.localStorage.removeItem(RESULTS_KEY);
      pendingClear = false;
      storageAvailable = true;
      return true;
    } catch {
      storageAvailable = false;
      return false;
    }
  },
  available() {
    // Probe once: repeated writes here would make storage-event views ping-pong
    // between open tabs. Real persistence attempts update this cached status.
    if (typeof storageAvailable === 'boolean') return storageAvailable;
    const probe = 'auto-light-lab.storage-probe';
    try {
      const storage = globalThis.localStorage;
      storage.setItem(probe, '1');
      const works = storage.getItem(probe) === '1';
      storage.removeItem(probe);
      storageAvailable = works;
      return storageAvailable;
    } catch {
      storageAvailable = false;
      return false;
    }
  },
};
