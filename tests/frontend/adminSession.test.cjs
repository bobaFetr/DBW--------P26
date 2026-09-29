const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../components/AdminDashboard.jsx'), 'utf8');
test('blocked browser storage does not interrupt session setup or cleanup', () => {
  const context = { ADMIN_SESSION_ROLE_KEY: 'role', window: {} };
  Object.defineProperty(context.window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function readStoredAdminRole('), source.indexOf('export default function AdminDashboard')), context);
  assert.equal(context.readStoredAdminRole(), '');
  assert.doesNotThrow(() => context.storeAdminRole({ roles: ['SuperAdmin'] }));
  assert.doesNotThrow(() => context.clearStoredAdminRole());
});

test('empty API error bodies retain a useful HTTP error message', async () => {
  const context = {
    API_BASE: 'http://localhost:5001',
    adminReadFetch: async () => ({ ok: false, status: 403, statusText: 'Forbidden', text: async () => '' })
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('class ApiError'), source.indexOf('const COLLECTIONS')) +
    source.slice(source.indexOf('function isUnsafeMethod('), source.indexOf('function readStoredAdminRole(')), context);
  await assert.rejects(context.apiFetch('/test'), { message: '403 Forbidden' });
});

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
  vm.runInContext(`${errorClass}\n${accessHandler}\n${logout}\nglobalThis.check = (status, code) => handleAdminAccessError(new ApiError('Failure', status, code));\nglobalThis.signOut = logout;\nglobalThis.apiFetch = async () => { ${status ? `throw new ApiError('Failure', ${status});` : ''} };`, context);
  return { context, events };
}
test('expired super-admin session clears dashboard and prompts sign-in', () => {
  const { context, events } = harness(['SuperAdmin']);
  assert.equal(context.check(401), true);
  assert.deepEqual(events.slice(0, 2), ['reset', 'clearRole']);
  assert.ok(events.some((e) => Array.isArray(e) && e[0] === 'notice' && /sign in again/.test(e[1])));
});
test('confirmed content-admin removal retains revocation handling', () => {
  for (const status of [401, 403]) {
    const { context, events } = harness(['ContentAdmin']);
    assert.equal(context.check(status, 'content_admin_access_revoked'), true);
    assert.deepEqual(events, ['revoked']);
  }
});

test('expired content-admin session prompts sign-in without claiming revocation', () => {
  const { context, events } = harness(['ContentAdmin']);
  assert.equal(context.check(401), true);
  assert.ok(!events.includes('revoked'));
  assert.ok(events.some((e) => Array.isArray(e) && e[0] === 'notice' && /session has expired/.test(e[1])));
});

test('unrelated forbidden response does not claim content-admin revocation', () => {
  const { context, events } = harness(['ContentAdmin']);
  assert.equal(context.check(403), false);
  assert.deepEqual(events, []);
});

test('returning with a stored content-admin role and expired cookie prompts sign-in', async () => {
  const { context, events } = harness(['ContentAdmin'], 401);
  Object.assign(context, {
    setIsLoading() {}, setLoadingMessage() {}, setBootError() {}, AbortSignal, setSession() {}, storeAdminRole() {},
    readStoredAdminRole: () => 'ContentAdmin',
    loadContentRows: async () => [],
  });
  const boot = source.slice(source.indexOf('  async function boot('), source.indexOf('  async function refreshDashboard('));
  vm.runInContext(`${boot}\nglobalThis.start = boot;`, context);
  await context.start();
  assert.ok(events.includes('clearRole'));
  assert.ok(events.some((e) => Array.isArray(e) && e[0] === 'notice' && /session has expired/.test(e[1])));
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


test('startup API outages show recovery without fetching public content', async () => {
  const { context, events } = harness([], 503);
  Object.assign(context, {
    AbortSignal, setIsLoading() {}, setLoadingMessage() {}, setSession() {}, storeAdminRole() {},
    setBootError: (value) => events.push(['bootError', value]),
    loadContentRows: async () => assert.fail('Sign-in must not wait for public content'),
  });
  const boot = source.slice(source.indexOf('  async function boot('), source.indexOf('  async function refreshDashboard('));
  vm.runInContext(`${boot}\nglobalThis.start = boot;`, context);
  await context.start();
  assert.ok(events.some(e => Array.isArray(e) && e[0] === 'bootError' && /busy/.test(e[1])));
});


test('dashboard startup does not share the authentication deadline or disable data retries', async () => {
  const { context } = harness(['SuperAdmin']);
  let dashboardOptions;
  Object.assign(context, {
    setIsLoading() {}, setLoadingMessage() {}, setBootError() {}, setSession() {}, storeAdminRole() {},
    refreshDashboard: async (_, options) => { dashboardOptions = options; },
    apiFetch: async () => ({ roles: ['SuperAdmin'] }),
  });
  const boot = source.slice(source.indexOf('  async function boot('), source.indexOf('  async function refreshDashboard('));
  vm.runInContext(`${boot}\nglobalThis.start = boot;`, context);
  await context.start();
  assert.ok(dashboardOptions);
  assert.equal(dashboardOptions.signal, undefined);
  assert.notEqual(dashboardOptions.retry, false);
  assert.equal(typeof dashboardOptions.onRetry, 'function');
});
