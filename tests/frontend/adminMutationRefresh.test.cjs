const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../components/AdminDashboard.jsx'), 'utf8');
const content = fs.readFileSync(path.join(__dirname, '../../components/adminContent.js'), 'utf8');
const keys = [...source.slice(source.indexOf('const COLLECTIONS ='), source.indexOf('function emptyDraft')).matchAll(/^    key: "([^"]+)"/gm)].map(match => match[1]);
function harness(key, failSummary = false) {
  const calls = [];
  let rows = Array.from({ length: 5 }, (_, id) => ({ id }));
  const state = { records: { [key]: rows, untouched: [{ id: 99 }] }, summary: { publicRows: 5, pendingReview: 0, activeContentAdmins: 1 }, more: { untouched: true } };
  const context = {
    session: { roles: ['SuperAdmin'] }, isSuperAdmin: true,
    activeCollection: { key, idKey: 'id' }, COLLECTIONS: keys.map(key => ({ key, label: key })), PAGE_SIZE: 50,
    contentLoadVersion: { current: 0 }, beginMutation: () => true, endMutation() {},
    setError: error => { state.error = error; },
    setSummary: summary => { state.summary = summary; },
    setSummaryStatus: status => { state.status = status; },
    setRecords: update => { state.records = update(state.records); },
    setHasMoreRecords: update => { state.more = update(state.more); },
    handleAdminAccessError: () => false,
    apiFetch: async (url, options = {}) => {
      calls.push([url, options.method || 'GET']);
      if (options.method === 'DELETE') { rows = rows.filter(row => String(row.id) !== url.split('/').at(-1)); return; }
      if (url === '/api/admin-dashboard/summary') {
        if (failSummary) throw new Error('HTTP 429');
        return { publicRows: rows.length, pendingReview: 0, activeContentAdmins: 1 };
      }
      assert.ok(url.startsWith(`/api/content/${key}?`), `Unexpected unrelated read: ${url}`);
      return rows;
    }
  };
  vm.createContext(context);
  vm.runInContext(content.replace('export async function', 'async function') + '\n' +
    source.slice(source.indexOf('  async function refreshDashboard('), source.indexOf('  async function loadMoreRecords(')) + '\n' +
    source.slice(source.indexOf('  async function removePublicRecord('), source.indexOf('  async function requestRecordRemoval(')) +
    '\nglobalThis.remove = removePublicRecord;', context);
  return { context, state, calls };
}
test('five consecutive deletions only reload the affected collection and totals for every content type', async () => {
  assert.equal(keys.length, 7);
  for (const key of keys) {
    const { context, state, calls } = harness(key);
    for (let id = 0; id < 5; id++) {
      await context.remove({ id });
      assert.equal(state.summary.publicRows, 4 - id);
      assert.equal(state.status, 'current');
      assert.equal(state.records[key].length, 4 - id);
      assert.equal(state.records.untouched.length, 1);
      assert.equal(state.more.untouched, true);
      assert.equal(state.error, '');
    }
    assert.equal(calls.length, 15);
  }
});
test('failed totals refresh preserves last known totals and marks them stale after a successful delete', async () => {
  const { context, state } = harness('members', true);
  await context.remove({ id: 0 });
  assert.equal(state.records.members.length, 4);
  assert.equal(state.summary.publicRows, 5);
  assert.equal(state.summary.activeContentAdmins, 1);
  assert.equal(state.status, 'stale');
  assert.match(state.error, /dashboard totals/);
});
