# HealthRoute AI — Testing & Security Report

**Verification date:** 26 September 2026
**Scope:** Local full-stack application; React/TypeScript frontend, Express backend, PostgreSQL, and healthcare navigation assistant.

## 1. Testing approach

Verification combined source-code review, TypeScript/production builds, PostgreSQL integration tests, and Playwright-driven interactions in Google Chrome. Final testing used an isolated database (`healthroute_setup_check`), API port 4100, and frontend port 5180. Temporary accounts and CRUD records were cleaned up. Browser tests ran in two batches, with the test API restarted between batches to avoid exhausting its normal rate limit; protections were not disabled.

This was automated browser testing, not human manual testing. Real PostgreSQL supported authentication, directory reads, admin CRUD, and assistant fallback. Controlled responses exercised selected failure, validation, accessibility, and generated-response presentation scenarios.

## 2. Completed testing checklist and features tested

All items below passed within the recorded test scope.

| Checklist | Features and behavior verified |
| --- | --- |
| ✓ Startup and build | Fresh API/frontend startup; TypeScript checks and production compilation. |
| ✓ PostgreSQL | Migrations, seeding, relationships, demo-account checks, integration reads/writes, and safe failure responses. |
| ✓ Authentication | Registration, valid/invalid login, logout, refresh, cross-tab synchronization, bcrypt hashes, and session revocation. |
| ✓ JWT validation | Invalid/expired tokens, missing expiry, wrong algorithm/issuer/audience, malformed identifiers, and unknown sessions rejected. |
| ✓ Role permissions | Patients denied direct admin API access; admin access uses current database roles rather than client claims. |
| ✓ Healthcare search | Department/service results, relevant ranking, empty results, reset, loading, and retry behavior. |
| ✓ Smart matching | Heart doctor → Cardiology; X-ray → Radiology; blood test → Laboratory Services; skin doctor, rehab, and bone doctor matching. |
| ✓ AI navigation | Verified service/contact recommendations, unknown-question handling, and navigation-only refusal presentation. |
| ✓ Gemini fallback | Missing-key browser flow; simulated timeout, network/provider errors, malformed/blocked/unsafe output, and invalid citations. |
| ✓ Departments and locations | Service lists, descriptions, linked locations, addresses, phone links, hours, and FAQ states. |
| ✓ Appointment guidance | Scheduling instructions, documents, arrival guidance, contact details, and disclaimers. |
| ✓ Admin CRUD | Create/edit/delete across departments, services, locations, FAQs, and guidance; confirmation, cancellation, persistence, and error recovery. |
| ✓ Input validation | Empty/whitespace input, invalid email, password limits, long input, special characters, missing fields, and invalid booking links. |
| ✓ API failures | Network failure, unreadable/incomplete responses, generic server errors, retries, and rendering recovery. |
| ✓ SQL safety | Literal handling of SQL-like values; malicious identifiers rejected; authentication not bypassed. |
| ✓ Accessibility | Skip link, keyboard navigation, dialog focus, error associations, and mobile-menu focus restoration. |
| ✓ Responsiveness | Public/admin layouts and forms at 320, 390, 768, 1024, and 1440 pixels, including long content. |

## 3. Bugs and reliability gaps fixed

- **Dialog focus:** corrected initial focus, keyboard containment, and focus return in authentication dialogs.
- **Missing favicon:** added the icon to eliminate its browser 404 console error.
- **Responsive overflow:** fixed long location text overflowing cards, clipped admin actions, and crowded navigation at 320px using targeted CSS changes.
- **Validation feedback:** added field-level messages and required/length checks across authentication, admin forms, and assistant input.
- **Failure handling:** added API request timeouts, response-shape checks, generic server messages, PostgreSQL connection/query timeouts, and an idle-connection error handler. A React error boundary now offers recovery instead of a blank screen.
- **Project configuration:** removed unused source modules/imports, strengthened TypeScript checks, and replaced legacy server module resolution with compatible Node16 settings. Builds and database initialization passed; the original IDE-only diagnostic was not reproduced.

## 4. Confirmed security findings and resolutions

| Finding | Affected files and fix | Verification |
| --- | --- | --- |
| Reseeding could promote a patient registered with the demo admin email while preserving their password. | `database/seed.ts`: preserve existing accounts with conflict-do-nothing. | Isolated-schema regression passed. |
| Demo privileged credentials could be seeded in production mode. | `database/seed.ts`: reject production-mode demo seeding. | Production rejection test passed. |
| Local PostgreSQL was published on all host interfaces with documented demo credentials. | `docker-compose.yml`: bind to loopback only. | Applied mapping and database integrity checks passed. |
| Raw operational errors could disclose database details; seed output printed demo passwords. | Server startup and database scripts: fixed safe messages; removed password output. | Source/build checks and logging regressions passed. |
| Login accepted passwords beyond bcrypt’s 72-byte boundary, allowing suffix truncation. | `routes/auth.ts`, `AuthModal.tsx`: enforce the limit at login. | Boundary-password regression passed. |
| Malformed signed session identifiers could reach PostgreSQL and cause server errors. | `authMiddleware.ts`: validate UUID strings and expiry type before lookup. | Malformed-claim tests passed; no authorization bypass was established. |

Query review found no SQL injection path: values are parameterized, and dynamic identifiers come from fixed definitions and strict schemas. No missing admin authorization, plaintext password storage, reflected-origin CORS issue, or executable XSS was identified. Git-history scanning found no configured JWT/Gemini secrets or tracked private environment files. Git/Docker exclusions protect real environment files. npm audit reported zero known vulnerabilities in both dependency trees at audit time.

## 5. Accessibility improvements

Added a visible assistant label, password-hint/error associations, named authentication forms, an announced connecting status, an admin-search label, and record-specific action names. Escape now returns mobile-menu focus to its trigger. Focus contrast on the dark assistant panel was improved, and redundant icons were hidden from assistive technology. Existing semantic controls and reduced-motion styles were retained. Sampled text contrast exceeded 4.5:1; sampled focus contrast exceeded 3:1.

## 6. Final results and limitations

**Final result: PASS — 59 backend tests, 24 browser tests, production build, and PostgreSQL verification.** No further application defect was reproduced during the final run.

Live Gemini generation was not tested. Mobile checks used Chrome viewport emulation, not physical devices. Manual screen-reader evaluation, full WCAG conformance, and production-deployment penetration testing were not performed. JWTs remain in localStorage; this is a documented risk if future XSS is introduced. Existing deployed demo accounts require explicit review. Passing results establish the tested behavior, not universal security or accessibility compliance.

**Supporting records:** [Final verification](final-verification-2026-09-26.md), [security audit](security-audit-2026-09-26.md), [query review](postgresql-query-review.md), and [accessibility audit](accessibility-audit.md).
