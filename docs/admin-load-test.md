# Admin refresh load test — 2026-09-13

The updated API passed a bounded local HTTP load test against PostgreSQL. Ten rapid dashboard reloads and three overlapping tabs succeeded; exhausted capacity produced HTTP 429 responses, and a subsequent reload recovered. This demonstrates the refresh allowance and graceful throttling on the current local dataset, not production capacity.

The database contained **10 public content rows, zero pending reviews, and one active content admin**. This is a small dataset and does not exercise large-table counts or full 50-row responses. The API ran a Debug build on the same Windows computer as the test client and PostgreSQL, listening at `http://127.0.0.1:5001`. One real super-admin session was used. Every measured request passed through cookie authentication, rate limiting, authorization, and the real endpoint/database code. Response latency includes reading the entire response body.

| Scenario | Requests | HTTP 200 | HTTP 429 | Total duration | Request p95 |
|---|---:|---:|---:|---:|---:|
| Initial dashboard reload | 13 | 13 | 0 | 0.38 s | 213.2 ms |
| Ten sequential reloads | 130 | 130 | 0 | 1.09 s | 39.9 ms |
| Three overlapping dashboard tabs | 39 | 39 | 0 | 0.22 s | 119.5 ms |
| Deliberate overload: 24 workers | 240 | 4 | 236 | 0.38 s | 62.1 ms |
| Recovery reload | 13 | 13 | 0 | 0.11 s | 37.1 ms |

There were **435 measured requests, zero HTTP 5xx responses, and zero timeouts/transport errors**. Every 429 response included `Retry-After: 1`. Recovery was checked after 15 seconds, enough to fund a complete 13-request dashboard reload; a one-second retry allowance is not enough to fund a whole reload after exhaustion.

The test waited 15 seconds after setup/baseline, 40 seconds before overlapping tabs, and 15 seconds before recovery. These waits replenish the existing bucket; they are excluded from scenario durations. Overload immediately followed the overlapping tabs, so its bucket was nearly empty. Its low successful-request count tests rejection behavior, not maximum database throughput. Workers do not replay failed requests, unlike the browser's bounded retry helper. The baseline is not directly comparable with warmed subsequent requests because startup/JIT/cache effects are included.

Limits of the conclusion:

- Parallel workers share one identity and therefore one limiter partition. Distinct-admin concurrency and aggregate server capacity are untested.
- No production-size fixture, prolonged soak, distributed deployment, or browser rendering was tested.
- Database CPU, connection-pool utilization, and query plans were not measured. Fast HTTP responses alone cannot establish available capacity.
- Authentication still queries the database before the limiter. Rate-limited traffic therefore still costs database work.
- The test reads dashboard data and performs one normal login; it does not create content or administrative accounts. Reports contain timings/statuses and aggregate counts, not credentials, cookies, or row contents.

For this small local dataset, repeated manual refreshes behaved well. Before claiming production safety, repeat against an isolated database with representative row counts and multiple distinct admin accounts while monitoring database resources.

## Repeat the test

Start the updated local API with its Development configuration, then run:

```powershell
node scripts/load-test-admin.cjs
```

The runner defaults to the local development super-admin credentials already configured in `appsettings.Development.json`. If those credentials differ from the actual account, provide `LOAD_TEST_USER` and `LOAD_TEST_PASSWORD` through environment variables. `LOAD_TEST_URL` can select another loopback URL; remote hosts are rejected. Do not run other admin traffic during the test. Start with a fresh API limiter or allow 130 seconds of idle time before repeating a run.

The runner permits at most 24 workers and 240 overload requests, applies a 10-second timeout, stops issuing additional overload requests after a server/transport failure, and exits nonzero if success/recovery checks fail or throttling is not observed. It overwrites `docs/admin-load-test-results.json` with machine-readable results and endpoint-level statistics.
