const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../../components/adminRequestStatus.js'), 'utf8');
const context = {};
vm.runInNewContext(source.replace(/export /g, ''), context);
const { loadOwnRequestStatus } = context;

test('denied requests disappear exactly one minute after the saved denial timestamp', () => {
  const deniedAt = Date.parse('2026-09-13T10:00:00Z');
  for (const status of ['Denied', 3]) {
    const request = { status, reviewedAtUtc: '2026-09-13T10:00:00Z' };
    assert.equal(context.isVisibleOwnRequest(request, deniedAt + 59999), true);
    assert.equal(context.isVisibleOwnRequest(request, deniedAt + 60000), false);
    assert.equal(context.isVisibleOwnRequest({ ...request }, deniedAt + 120000), false);
  }
});

test('pending requests remain visible and invalid denial timestamps do not accumulate', () => {
  assert.equal(context.isVisibleOwnRequest({ status: 'Pending' }), true);
  assert.equal(context.isVisibleOwnRequest({ status: 1 }), true);
  for (const request of [{ status: 'Approved' }, { status: 'Cancelled' },
    { status: 'Denied' }, { status: 3, reviewedAtUtc: 'invalid' }]) {
    assert.equal(context.isVisibleOwnRequest(request), false);
  }
  assert.equal(context.deniedRequestExpiresAt({ status: 3, reviewedAtUtc: '2026-09-13T10:00:00' }),
    Date.parse('2026-09-13T10:01:00Z'));
});

test('awaiting request changes to denied and retains the super-admin note on refresh', async () => {
  let request = { id: 'one', status: 'Pending', reviewNote: null };
  const first = await loadOwnRequestStatus(async () => [request], 0);
  assert.equal(first.requests[0].status, 'Pending');
  request = { ...request, status: 'Denied', reviewNote: 'Please send a clearer photo.' };
  const next = await loadOwnRequestStatus(async () => [request], 1);
  assert.equal(next.requests[0].status, 'Denied');
  assert.equal(next.requests[0].reviewNote, 'Please send a clearer photo.');
  assert.equal(next.hasMore, false);
});

test('refresh includes decisions on older pages already loaded by the content admin', async () => {
  const calls = [];
  const result = await loadOwnRequestStatus(async (url) => {
    calls.push(url);
    return calls.length === 1
      ? [{ id: 'new', requestedAtUtc: '2026-09-13T12:00:00Z' }, { id: 'cursor', requestedAtUtc: '2026-09-12T12:00:00Z' }]
      : [{ id: 'older', status: 3, reviewNote: 'Denied older request' }];
  }, 3, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /afterRequestedAtUtc=2026-09-12T12%3A00%3A00Z&afterId=cursor/);
  assert.equal(result.requests[2].reviewNote, 'Denied older request');
  assert.equal(result.hasMore, false);
});

test('failed status refresh does not return a partial list that could erase decisions', async () => {
  let calls = 0;
  await assert.rejects(loadOwnRequestStatus(async () => {
    if (++calls === 1) return [{ id: 'one', requestedAtUtc: 'date' }];
    throw new Error('API busy');
  }, 2, 1), /API busy/);
});
