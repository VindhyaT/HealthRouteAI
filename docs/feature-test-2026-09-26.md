# Feature verification — September 26, 2026

Method: Playwright-driven interactions in Google Chrome, with visual inspection of the admin screenshot. This was automated browser testing, not human manual testing. The API and UI ran on isolated ports 4100/5180 against `healthroute_setup_check`; existing application data was not used for admin mutations.

Result: production build passed; 12 browser scenarios passed across two batches. No application defects were reproduced. Added `client/tests/edge-inputs.spec.ts` to retain coverage for invalid credentials, long input, special characters, and recovery.

| Feature | Result | Evidence |
| --- | --- | --- |
| Registration/login/logout | Pass | Real PostgreSQL authentication, session restoration, logout revocation, and cross-tab behavior |
| Invalid credentials | Pass | Wrong patient password rejected; guest state retained; corrected password succeeds |
| Search/department results | Pass | Heart doctor → Cardiology, X-ray → Radiology, blood test → Laboratory Services, plus other example searches |
| Location information | Pass | Addresses, phone links, hours, independent loading/error/retry/empty states |
| Appointment guidance | Pass | Expanded service guidance, documents, scheduling and arrival details, disclaimer |
| AI navigation | Pass | Real database fallback recommendations, unknown-query handling, recovery to a valid question |
| Patient/admin restrictions | Pass | Patient cannot access admin APIs; cached-role tampering does not grant admin access |
| Admin create/edit/delete | Pass | All five resource types; cancellation, confirmation, persistence, failure recovery |
| Empty input | Pass | Field-level validation across authentication, all admin forms, and assistant |
| Long input | Pass | Directory capped at 200 characters; AI input capped at 500; oversized UTF-8 registration password rejected |
| Special characters | Pass | Script-like text, punctuation, quotes, and SQL-like search text do not crash the page; clear search restores results |
| Mobile | Pass | Public layouts at 768px, 390px, 320px; admin mobile workflow; keyboard/dialog behavior |

## Test batches

1. `auth.spec.ts`, `directory.spec.ts`, `frontend.spec.ts`, `validation.spec.ts`, `edge-inputs.spec.ts`: 8 passed.
2. `admin.spec.ts`, `assistant.spec.ts`, `appointments.spec.ts`: 4 passed.

The isolated API was restarted between batches to avoid exhausting its normal request limit. Rate limits were not disabled. Test-created accounts and admin records were cleaned up by the tests; isolated servers were stopped afterward.

## Limits

- Gemini was disabled on the isolated API. Live provider generation was not tested.
- Generated-response presentation, clinical refusal presentation, and selected error/validation states use controlled browser responses; core authentication, directory reads, assistant fallback, and admin CRUD use the real API and PostgreSQL.
- Mobile tests emulate viewport sizes in desktop Chrome, not physical mobile devices.
- Input checks cover the cases described above, not every possible length/Unicode/browser combination.
