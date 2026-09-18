/**
 * Google Sheets sync via Google Apps Script Web App.
 * Set the deployed Apps Script URL below after deploying the script.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBu8zJS3Z90wvIJCiP3YjWnqGi6zWXMv0UriGKVRWF2eHumpDRX7TAAmV-QviLVshiyg/exec';

let sheetUrl = APPS_SCRIPT_URL;

export function setSheetUrl(url) {
  sheetUrl = url;
  try { globalThis.localStorage.setItem('auto-light-lab.sheet-url', url); } catch {}
}

export function getSheetUrl() {
  if (sheetUrl) return sheetUrl;
  try {
    const saved = globalThis.localStorage.getItem('auto-light-lab.sheet-url');
    if (saved) { sheetUrl = saved; return sheetUrl; }
  } catch {}
  return '';
}

export function isConnected() {
  return !!getSheetUrl();
}

export async function pushResult(record) {
  const url = getSheetUrl();
  if (!url) return { ok: false, reason: 'no-url' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'addResult', data: record }),
    });
    if (!response.ok) return { ok: false, reason: 'http-error' };
    const result = await response.json();
    return { ok: result.status === 'ok', reason: result.status === 'ok' ? '' : 'script-error' };
  } catch {
    return { ok: false, reason: 'network-error' };
  }
}

export async function fetchResults() {
  const url = getSheetUrl();
  if (!url) return { ok: false, data: [], reason: 'no-url' };
  try {
    const response = await fetch(`${url}?action=getResults`);
    if (!response.ok) return { ok: false, data: [], reason: 'http-error' };
    const result = await response.json();
    if (result.status === 'ok' && Array.isArray(result.data)) {
      return { ok: true, data: result.data };
    }
    return { ok: false, data: [], reason: 'script-error' };
  } catch {
    return { ok: false, data: [], reason: 'network-error' };
  }
}

export async function testConnection(url) {
  try {
    const response = await fetch(`${url}?action=ping`);
    if (!response.ok) return false;
    const result = await response.json();
    return result.status === 'ok';
  } catch {
    return false;
  }
}
