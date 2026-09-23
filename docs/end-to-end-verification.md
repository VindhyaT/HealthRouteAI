# End-to-end verification — 2026-09-23

Result: all requested workflows passed. No application defects were reproduced and no application-code fixes were needed.

## Environment and results

- TypeScript and production build: passed (`npm run build`).
- Backend: 54 tests passed against the separate `healthroute_setup_check` PostgreSQL database.
- Browser: 11 Playwright tests passed in Chrome, in two batches.
- Isolated API: port 4100; isolated frontend: port 5180.
- API health confirmed `mode: postgres` for both isolated and main applications.
- Main frontend at http://localhost:5173 returned HTTP 200 and was left running.
- The test API was restarted between browser batches to avoid exhausting the normal 200-request rate limit. Application rate limits were not changed.

## Requested workflows

| Workflow | Result and evidence |
| --- | --- |
| 1. Application loads | Passed: browser renders directory and main frontend responds successfully. |
| 2. Registration | Passed: browser creates a temporary patient; database confirms bcrypt hash and patient role. |
| 3. Login | Passed: real patient credentials and session refresh. |
| 4. Logout | Passed: JWT revocation and cross-tab synchronization. |
| 5. PostgreSQL directory | Passed: PostgreSQL-backed API returns department/service/location records rendered in browser. |
| 6. heart doctor | Passed: Cardiology is the top result in UI and API. |
| 7. X-ray | Passed: Radiology is the top result in UI and API. |
| 8. blood test | Passed: Laboratory Services is the top result in UI and API. |
| 9. Navigation assistant | Passed: department, service, contact details, hours, and appointment guidance displayed. |
| 10. Gemini failure | Passed: real browser flow without an API key; backend simulations cover timeout, network failure, unavailable provider, rate limiting, malformed/empty/blocked responses. |
| 11. Admin login | Passed: management dashboard opens and survives reload. |
| 12. Protected dashboard | Passed: guests have no admin UI; missing/forged/expired tokens rejected by API. |
| 13. Admin create/update | Passed: real browser CRUD for departments and all other managed resources. |
| 14. Patient access denied | Passed: admin reads/writes return 403; modifying cached user role does not grant access. |
| 15. Form validation | Passed: login, registration, departments, services, locations, FAQs, appointment guidance, and AI input reject invalid submissions with field messages. |
| 16. Mobile | Passed: public layouts at 768px, 390px, and 320px; mobile admin layout; keyboard navigation and dialog focus. |

## Scope and limitations

Live Gemini generation was not exercised. Generated-response presentation used controlled browser responses, provider failures used backend simulations, and the real assistant browser flow used the database fallback with Gemini disabled. Validation tests used mocked responses to verify that invalid inputs never reach the API; successful authentication and admin CRUD used real PostgreSQL.

Test-created users and CRUD records were cleaned up by the suites. The isolated test servers were stopped after verification. Existing application servers and user data were retained.

## Commands

To reproduce the isolated browser environment after creating the test database:

```bash
DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_setup_check npm run seed
# Terminal 1 (after npm run build):
PORT=4100 CLIENT_URL=http://localhost:5180 DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_setup_check GEMINI_API_KEY='' node server/dist/server.js
# Terminal 2:
VITE_API_URL=http://localhost:4100/api npm run dev --prefix client -- --port 5180 --strictPort
# Terminal 3: run the checks below.
```

The root backend `.env` must contain a valid JWT secret. Create the separate database
once with `docker compose exec -T postgres createdb -U healthroute healthroute_setup_check`.
Stop the isolated servers with Ctrl+C when finished.


```bash
npm run build
TEST_DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_setup_check npm test

# With isolated API/frontend running, run these as separate batches,
# restarting the isolated API between batches to reset its request budget.
E2E_BASE_URL=http://localhost:5180 E2E_API_URL=http://localhost:4100/api E2E_DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_setup_check npm run test:e2e --prefix client -- tests/auth.spec.ts tests/directory.spec.ts tests/frontend.spec.ts tests/validation.spec.ts
E2E_BASE_URL=http://localhost:5180 E2E_API_URL=http://localhost:4100/api E2E_DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_setup_check npm run test:e2e --prefix client -- tests/admin.spec.ts tests/assistant.spec.ts tests/appointments.spec.ts
```
