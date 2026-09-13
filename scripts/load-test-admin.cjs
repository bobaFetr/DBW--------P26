// Local-only, bounded HTTP load test. Never records credentials, cookies, or row data.
// Build/start the API first. Optional credentials: LOAD_TEST_USER / LOAD_TEST_PASSWORD.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const base = process.env.LOAD_TEST_URL || 'http://127.0.0.1:5001';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('This test only permits a local API.');
}
const development = JSON.parse(fs.readFileSync(path.join(root, 'Back End/MyApi/appsettings.Development.json')));
const cookies = new Map();
const report = { startedAt: new Date().toISOString(), target: base, scenarios: [],
  limitations: ['Existing local dataset; no production-sized data seeded.',
    'One authenticated super-admin; parallel workers represent tabs, not distinct users.',
    'HTTP latency includes authentication, database work, and serialization; database CPU/connections are not measured.',
    'Overload requests are not retried. Browser backoff is excluded to expose server throttling.'] };
let measured = false;
let samples = [];
async function request(route, method = 'GET', body, extraHeaders = {}) {
  const start = performance.now();
  let status = 0;
  let value;
  let retryAfter;
  try {
    const response = await fetch(base + route, {
      method, signal: AbortSignal.timeout(10000),
      headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    status = response.status;
    retryAfter = response.headers.get('retry-after');
    const text = await response.text(); // Include complete body transfer in latency.
    try { value = JSON.parse(text); } catch { /* Error bodies are not retained. */ }
  } catch { /* Record timeouts/transport errors as status 0, without leaking headers. */ }
  const sample = { route, status, ms: performance.now() - start, retryAfter };
  if (measured) samples.push(sample);
  return { ...sample, value };
}
const collections = ['albums', 'singles', 'concerts', 'news', 'timeline', 'members', 'gallery'];
const content = collections.map(key => `/api/content/${key}?afterId=0&pageSize=50`);
const administration = ['/api/content-requests/pending?page=1&pageSize=50',
  '/api/content-admins?page=1&pageSize=50', '/api/content-admin-requests/pending?page=1&pageSize=50',
  '/api/ca-requests-permission'];
async function reload() {
  const session = await request('/api/auth/me');
  if (session.status !== 200) return;
  await Promise.all(content.map(route => request(route)));
  await request('/api/admin-dashboard/summary');
  await Promise.all(administration.map(route => request(route)));
}
function stats(rows) {
  const times = rows.map(row => row.ms).sort((a, b) => a - b);
  const percentile = p => times.length ? Math.round(times[Math.ceil(times.length * p) - 1] * 10) / 10 : null;
  return { requests: rows.length, statuses: rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1; return counts;
  }, {}), p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: percentile(1) };
}
async function scenario(name, run) {
  samples = []; measured = true;
  const start = performance.now();
  await run();
  measured = false;
  const durationSeconds = (performance.now() - start) / 1000;
  const result = { name, durationSeconds: Math.round(durationSeconds * 100) / 100,
    ...stats(samples), successful: stats(samples.filter(row => row.status === 200)),
    throttled: stats(samples.filter(row => row.status === 429)),
    retryAfterSeconds: [...new Set(samples.filter(row => row.status === 429).map(row => row.retryAfter))],
    endpoints: Object.fromEntries([...new Set(samples.map(row => row.route))].map(route =>
      [route, stats(samples.filter(row => row.route === route))])) };
  report.scenarios.push(result);
  console.log(JSON.stringify({ ...result, endpoints: undefined }));
  if (samples.some(row => row.status === 0 || row.status >= 500)) {
    throw new Error('Stopping load after a server error or transport failure.');
  }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const health = await request('/health');
  if (health.status !== 200) throw new Error('Local API health check failed.');
  const csrf = await request('/api/auth/csrf');
  const login = await request('/api/auth/login', 'POST', {
    email: process.env.LOAD_TEST_USER || 'superadmin',
    password: process.env.LOAD_TEST_PASSWORD || development.SeedUsers.SuperAdminPassword
  }, { 'X-CSRF-TOKEN': csrf.value?.token || '' });
  if (login.status !== 200 || !login.value?.roles?.includes('SuperAdmin')) {
    throw new Error(`Super-admin login failed (${login.status}); supply LOAD_TEST_USER and LOAD_TEST_PASSWORD.`);
  }
  const summary = await request('/api/admin-dashboard/summary');
  report.dataset = summary.value;
  console.log('Warming up with one complete dashboard reload.');
  await scenario('baseline', reload);
  console.log('Allowing 15 seconds to restore tokens used by setup and baseline.');
  await wait(15000);
  await scenario('ten sequential reloads', async () => {
    for (let index = 0; index < 10; index++) await reload();
  });
  console.log('Allowing 40 seconds of refill before three overlapping dashboard tabs.');
  await wait(40000);
  await scenario('three simultaneous tabs', () => Promise.all(Array.from({ length: 3 }, reload)));
  await scenario('bounded overload: 240 reads, 24 workers', async () => {
    const routes = [...content, '/api/admin-dashboard/summary', ...administration, '/api/auth/me'];
    let next = 0;
    let stop = false;
    await Promise.all(Array.from({ length: 24 }, async () => {
      while (!stop && next < 240) {
        const index = next++;
        const result = await request(routes[index % routes.length]);
        if (result.status === 0 || result.status >= 500) stop = true;
      }
    }));
  });
  console.log('Allowing 15 seconds of refill before recovery check.');
  await wait(15000);
  await scenario('recovery reload', reload);
  report.passed = report.scenarios.filter(row => ['baseline', 'ten sequential reloads', 'recovery reload'].includes(row.name))
    .every(row => row.requests === (row.name === 'ten sequential reloads' ? 130 : 13) && row.statuses[200] === row.requests)
    && report.scenarios.every(row => Object.keys(row.statuses).every(status => ['200', '429'].includes(status)))
    && report.scenarios.find(row => row.name.startsWith('bounded overload')).statuses[429] > 0;
}
main().catch(error => { report.error = error.message; report.passed = false; console.error(error.message); })
  .finally(() => {
    report.finishedAt = new Date().toISOString();
    const output = path.join(root, 'docs/admin-load-test-results.json');
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Report: ${output}; passed=${report.passed}`);
    process.exitCode = report.passed ? 0 : 1;
  });
