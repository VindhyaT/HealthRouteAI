# Security audit — September 26, 2026

Scope: local source/configuration review, tracked Git history secret scan, dependency advisory checks, and focused backend tests. This is not a certification or a deployed-system penetration test. Existing uncommitted error-handling work was preserved.

## Confirmed findings and fixes

| Finding | Affected files | Fix | Verification |
| --- | --- | --- | --- |
| High: seeding promoted an existing account using the demo admin email while preserving its password. A patient registering that email before an operator reran the seed could gain admin access. Requires that seed operation; registration alone did not grant admin. | `server/src/database/seed.ts` | Admin seed now uses conflict-do-nothing; existing roles and passwords are preserved. | Isolated-schema regression creates a patient with the admin email, seeds, and confirms role/password unchanged. Passed. |
| Deployment risk: demo seed could create publicly documented privileged credentials in production mode. | `server/src/database/seed.ts` | Refuse demo seeding with `NODE_ENV=production`, before opening a database connection. | Production-mode seed exits unsuccessfully. Passed. Existing deployed accounts are not automatically removed. |
| Local network exposure: Compose published PostgreSQL on every host interface with public demo credentials. Actual remote reachability also depends on host firewall/network. | `docker-compose.yml` | Bind database port to `127.0.0.1`. | Recreated the container with its existing data volume; verified published port and database checks. |
| Sensitive-log exposure: startup/migration/seed/check failures printed raw error objects, potentially including PostgreSQL detail fields or connection information; seed also printed demo passwords. | `server/src/server.ts`, `server/src/database/{migrate,seed,check}.ts` | Replace raw errors with fixed operational messages; remove credential output from seed. | Source inspection and build passed; seed regression confirms password absent from output. Existing safe HTTP error-response test passed. |

## Requested areas reviewed

- **Secrets and environment:** no real `.env` files tracked; no configured JWT/Gemini values or recognized Google/private-key patterns found in the available Git history. No frontend secret references identified in reviewed code. Git/Docker excludes real environment files. Public local demo credentials are deliberately documented; these are not private production secrets. Pattern scanning cannot prove absence of every possible credential.
- **SQL injection and PostgreSQL:** request values use parameterized queries. Dynamic admin table names are from fixed definitions, and column names are constrained by strict Zod schemas. Migration SQL is read from repository migration files, not request input. No exploitable request-to-SQL interpolation found.
- **JWT:** HS256 allowlist, issuer/audience, expiry, server-side session revocation, and current database role checks present. Production rejects secrets shorter than 32 characters. Existing tests cover forged/expired/wrong-audience tokens, logout, and role tampering. No JWT bypass found.
- **Authorization/admin routes:** the admin router applies both authentication and admin middleware before its routes. Registration rejects submitted role fields. Tests verify patient denial; new tests verify unauthenticated denial across GET/POST/PUT/PATCH/DELETE.
- **Password storage:** bcrypt cost 12; registration enforces 8 characters and a 72-byte maximum. API responses omit hashes. No plaintext password-storage issue found.
- **CORS:** fixed configured origin, no credentialed wildcard/reflected origin. Added test confirms an untrusted origin is not reflected. CORS is a browser policy, not the authorization boundary.
- **XSS:** inspected UI uses React text rendering; no `dangerouslySetInnerHTML`, `innerHTML`, or `eval` sink found. Booking paths are validated and are not rendered as public booking links. No confirmed executable XSS identified.
- **Validation:** strict schemas and length/type/UUID limits protect writes, auth, and AI questions. Missing records/conflicts/foreign-key failures receive controlled responses. Existing validation and CRUD tests passed.
- **Errors/logs:** HTTP errors omit SQL, stack traces, and connection strings. Error-handling regression tests confirm safe failure responses. CLI raw-error logging was fixed as above.
- **Dependencies:** npm audit reported zero known vulnerabilities for both client and server lockfiles at audit time. This does not establish that dependencies have no undisclosed flaws.

## Verification

- Production build passed.
- Full backend suite: 56 tests passed before adding the final CORS case.
- Final focused security suite: 2 tests passed (seed protections and CORS/admin methods).
- Database data/relationships/demo-account checks passed after applying the port change.
- Dependency audit: client 0, server 0 reported vulnerabilities.

## Remaining limitations and deployment work

JWT storage in localStorage increases the impact of any future same-origin XSS, but no executable XSS was established here. Evaluate HttpOnly cookies with CSRF protection as a separate authentication design change. Development allows short JWT secrets; use a generated high-entropy secret and correct production mode. Existing demo accounts on any deployed database must be reviewed explicitly; the seed guard does not remove them. TLS, cloud security groups, secret rotation, backup access, proxy settings, and deployed security headers were not audited because no production deployment was inspected. Live Gemini was not used; existing mocked provider/safety tests passed. No Git push or production deployment was performed.
