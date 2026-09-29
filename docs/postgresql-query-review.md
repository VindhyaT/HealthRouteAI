# PostgreSQL query review — September 26, 2026

Result: no SQL injection risk was identified in the current backend query paths. All user-controlled values passed to PostgreSQL are parameters; interpolated SQL identifiers are derived from fixed application definitions. No production query changes were necessary.

## Query inventory

| File | Statements reviewed | Safety basis |
| --- | --- | --- |
| `server/src/routes/auth.ts` | User insert, email lookup, session deletion, transaction statements | Name/email/hash/session ID passed through `$1`… parameters. Role is a fixed patient literal. |
| `server/src/middleware/authMiddleware.ts` | Session/user lookup and session insert | JWT subject/session ID and account/expiry values parameterized. |
| `server/src/routes/admin.ts` | Summary counts, resource lists, insert/update/lookup/delete, department-location replacement, transaction statements | Tables come from the fixed `definitions` object. Column keys come only from strict Zod schema output (also for PATCH). Order columns are fixed alternatives. All field values, IDs, arrays, booleans, and relationship IDs use placeholders. |
| `server/src/routes/index.ts` | Public locations, FAQs, guidance | Static SQL with no request interpolation. |
| `server/src/database/index.ts` | Service/guidance join, department list, department-location join | Static SQL. User search input is ranked in application code after retrieval, not inserted into SQL. |
| `server/src/services/navigationContext.ts` | FAQ/location full-text queries and ranking | Normalized search expression passed as `$1` to `to_tsquery`; never SQL string concatenation. |
| `server/src/database/seed.ts` | User, department, location, service, guidance, relationship, FAQ inserts/upserts | Values passed as parameters, including arrays; SQL structure and constants are fixed. |
| `server/src/database/check.ts` | Counts, seeded-record lookups, test inserts, transactions/savepoints | Count table names use a fixed local list; lookup values are parameters. Constraint-test SQL consists of hardcoded developer statements within a rolled-back transaction. |
| `server/src/database/migrate.ts` | Advisory lock, migration table creation, migration lookups/inserts, file execution, transactions | Migration filenames used in database values are parameters. Executed SQL comes from the fixed application migrations directory, not request input. |
| `server/src/database/schema.sql`, `migrations/*.sql` | Schema/index/constraint creation and fixed data updates | Trusted repository SQL; no request-controlled SQL construction or dynamic EXECUTE statements. |

Identifiers cannot be substituted using PostgreSQL value placeholders. The admin identifier interpolation is safe because it occurs only after strict schema parsing and fixed resource selection. Maintain those boundaries when adding new fields/resources. Do not introduce client-controlled table names, sort expressions, or raw filters.

Migration files are trusted code and must remain protected from untrusted writes. A party able to edit deployed migration files already has application-code modification privileges; that is outside request-based SQL injection.

## Changes and verification

Added a regression subtest to `server/tests/auth.integration.cjs`:

- SQL-like strings containing apostrophes, semicolons, comments, and a function-call fragment round-trip as literal FAQ values.
- PATCH stores SQL-like text unchanged.
- SQL-like property names are rejected by the strict schema.
- SQL-like record IDs return 400; injected resource names return 404.
- Injection-like directory/service searches return no unrelated records.
- AI full-text retrieval handles SQL-like punctuation without a SQL error.
- A SQL-like password cannot bypass authentication.
- Test-created records are cleaned up.

Command: `TEST_DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_setup_check npm test`

Result: **58 tests passed**, including server compilation and the new injection regression. Review and representative tests are not a mathematical proof against every future code change; no exploit was found in the current implementation.
