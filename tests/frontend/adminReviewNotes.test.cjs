const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../../components/AdminDashboard.jsx'), 'utf8');

function harness({ reject = false, refreshFails = false } = {}) {
  const calls = [];
  const context = {
    isSuperAdmin: true,
    reviewNotes: { 'content:one': '  Please use a clearer photo.  ', 'content:two': 'Different note', 'signup:one': 'Welcome' },
    beginMutation: () => true, endMutation: () => {},
    setError: value => { context.error = value; },
    setNotice: value => { context.notice = value; },
    setReviewNotes: update => { context.reviewNotes = update(context.reviewNotes); },
    handleAdminAccessError: () => false,
    refreshDashboard: async () => { if (refreshFails) throw new Error('Refresh failed'); },
    apiFetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      if (reject) throw new Error('Review failed');
      return { changeCode: 'CHG-1', reviewNote: JSON.parse(options.body).reviewNote };
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  async function approveRequest('), source.indexOf('  async function cancelRequest(')), context);
  return { context, calls };
}

test('review submits only the selected request note and confirms the saved note', async () => {
  for (const decision of ['approve', 'deny']) {
    const { context, calls } = harness();
    await context.submitReview('content', 'one', decision);
    assert.equal(calls[0].url, `/api/content-requests/one/${decision}`);
    assert.equal(calls[0].body.reviewNote, 'Please use a clearer photo.');
    assert.equal(context.reviewNotes['content:one'], undefined);
    assert.equal(context.reviewNotes['content:two'], 'Different note');
    assert.equal(context.reviewNotes['signup:one'], 'Welcome');
    assert.match(context.notice, /Review note saved: Please use a clearer photo\./);
  }
});

test('signup review uses its own note even when content request IDs match', async () => {
  const { context, calls } = harness();
  await context.submitReview('signup', 'one', 'approve');
  assert.equal(calls[0].url, '/api/content-admin-requests/one/approve');
  assert.equal(calls[0].body.reviewNote, 'Welcome');
  assert.ok(context.reviewNotes['content:one']);
});

test('failed review retains the draft and does not claim that it was saved', async () => {
  const { context } = harness({ reject: true });
  await context.submitReview('content', 'one', 'deny');
  assert.ok(context.reviewNotes['content:one']);
  assert.equal(context.notice, '');
  assert.equal(context.error, 'Review failed');
});

test('successful review remains confirmed when subsequent refresh fails', async () => {
  const { context } = harness({ refreshFails: true });
  await context.submitReview('content', 'one', 'approve');
  assert.match(context.notice, /Review note saved/);
  assert.equal(context.error, 'Refresh failed');
});

test('blank notes are optional and overlong notes are rejected before sending', async () => {
  const { context, calls } = harness();
  context.reviewNotes['content:one'] = '   ';
  await context.submitReview('content', 'one', 'approve');
  assert.equal(calls[0].body.reviewNote, null);
  context.reviewNotes['content:two'] = 'x'.repeat(1001);
  await context.submitReview('content', 'two', 'deny');
  assert.equal(calls.length, 1);
  assert.equal(context.reviewNotes['content:two'].length, 1001);
  assert.match(context.error, /1,000/);
});

test('only super admins have requests in the review section', () => {
  const expression = source.slice(source.indexOf('  const visibleContentRequests ='), source.indexOf('  useEffect(', source.indexOf('  const visibleContentRequests =')));
  for (const isSuperAdmin of [true, false]) {
    const context = { isSuperAdmin, normalizeStatus: value => value,
      contentRequests: ['Pending', 'Approved', 'Denied', 'Cancelled'].map(status => ({ status, reviewNote: 'Decision' })) };
    vm.runInNewContext(expression + '\nglobalThis.visible = visibleContentRequests;', context);
    assert.equal(context.visible.length, isSuperAdmin ? 1 : 0);
  }
});
