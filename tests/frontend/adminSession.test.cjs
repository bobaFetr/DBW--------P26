const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../components/AdminDashboard.jsx'), 'utf8');
function harness(roles, status) {
  const events = [];
  const context = {
    session: { roles },
    resetAdminState: () => events.push('reset'),
    clearStoredAdminRole: () => events.push('clearRole'),
    handleContentAdminKickout: () => events.push('revoked'),
    setError: (value) => events.push(['error', value]),
    setNotice: () => {},
    setForcedLogoutNotice: (value) => events.push(['notice', value]),
  };
  vm.createContext(context);
  const errorClass = source.slice(source.indexOf('class ApiError'), source.indexOf('const COLLECTIONS'));
  const accessHandler = source.slice(source.indexOf('  function handleAdminAccessError('), source.indexOf('  async function boot('));
  const logout = source.slice(source.indexOf('  async function logout('), source.indexOf('  function updateDraft('));
  vm.runInContext(`${errorClass}\n${accessHandler}\n${logout}\nglobalThis.check = (status) => handleAdminAccessError(new ApiError('Failure', status));\nglobalThis.signOut = logout;\nglobalThis.apiFetch = async () => { ${status ? `throw new ApiError('Failure', ${status});` : ''} };`, context);
  return { context, events };
}
test('expired super-admin session clears dashboard and prompts sign-in', () => {
  const { context, events } = harness(['SuperAdmin']);
  assert.equal(context.check(401), true);
  assert.deepEqual(events.slice(0, 2), ['reset', 'clearRole']);
  assert.ok(events.some((e) => Array.isArray(e) && e[0] === 'notice' && /sign in again/.test(e[1])));
});
test('content-admin access loss retains revocation handling', () => {
  for (const status of [401, 403]) {
    const { context, events } = harness(['ContentAdmin']);
    assert.equal(context.check(status), true);
    assert.deepEqual(events, ['revoked']);
  }
});
test('server failures and super-admin forbidden responses do not erase sessions', () => {
  for (const status of [403, 500]) {
    const { context, events } = harness(['SuperAdmin']);
    assert.equal(context.check(status), false);
    assert.deepEqual(events, []);
  }
});
test('logout clears local state when session has already expired', async () => {
  const { context, events } = harness(['SuperAdmin'], 401);
  await context.signOut();
  assert.deepEqual(events.slice(0, 2), ['reset', 'clearRole']);
});
test('failed logout remains visible and does not pretend server logout succeeded', async () => {
  const { context, events } = harness(['SuperAdmin'], 500);
  await context.signOut();
  assert.deepEqual(events, [['error', 'Failure']]);
});

test('incorrect kick confirmation password does not clear a valid reviewer session', async () => {
  const { context, events } = harness(['SuperAdmin']);
  Object.assign(context, {
    kickConfirmation: { userId: 'target' }, kickPassword: 'wrong',
    beginMutation: () => true, endMutation: () => {},
  });
  const kick = source.slice(source.indexOf('  async function kickContentAdmin('), source.indexOf('  if (isLoading)'));
  vm.runInContext(`${kick}\nglobalThis.kick = kickContentAdmin; globalThis.apiFetch = async (path) => { if (path !== '/api/auth/me') throw new ApiError('Wrong confirmation password', 401); return {roles: ['SuperAdmin']}; };`, context);
  await context.kick({ preventDefault() {} });
  assert.ok(!events.includes('reset'));
  assert.ok(events.some((e) => Array.isArray(e) && e[1] === 'Wrong confirmation password'));
});
