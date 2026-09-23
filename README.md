# HealthRoute AI

A full-stack healthcare service directory and AI navigation assistant built with React, TypeScript, Express, PostgreSQL, and Google Gemini.

HealthRoute AI helps people find the right department, discover available services, locate clinics, and understand how to arrange a visit. It provides **healthcare navigation information, not medical advice**. It does not diagnose conditions, recommend medication, or recommend treatment.

## Business problem

Patients may know what they need in everyday language—such as “heart doctor” or “blood test”—without knowing a hospital's department names. Service information, opening hours, and appointment instructions can also be scattered across different pages.

HealthRoute AI brings this information into one searchable directory. Patients receive practical navigation guidance, while administrators maintain the underlying information through a protected dashboard. Local matching keeps service recommendations available when Gemini is unavailable.

## Key features

- Department cards with services, locations, phone numbers, and operating hours.
- Search using official names and everyday phrases, including “heart doctor,” “X-ray,” “blood test,” “skin doctor,” and “rehab.”
- A signed-in navigation assistant grounded in relevant directory records.
- Appointment guidance covering scheduling, general documents, arrival instructions, and contact details.
- Patient registration, login, logout, bcrypt password hashing, and JWT authentication.
- An admin dashboard for managing departments, services, locations, FAQs, and appointment guidance.
- Field-level validation, deletion confirmation, loading indicators, empty states, retryable errors, and success messages.
- Responsive layouts, accessible labels, keyboard focus indicators, and mobile navigation.
- PostgreSQL migrations, repeatable demo seeding, backend tests, and browser tests.

### Access by role

| Capability | Guest | Patient | Admin |
| --- | --- | --- | --- |
| Browse/search directory, locations, FAQs, and guidance | Yes | Yes | Yes |
| Use the navigation assistant | No | Yes | Yes |
| Open the admin dashboard | No | No | Yes |
| Create, update, and delete directory content | No | No | Yes |

Registration always creates a patient account. Admin login opens the management workspace; **Browse directory** returns to the public view.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, CSS, Lucide icons |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL 16, `pg`, SQL migrations |
| Authentication | JWT, bcrypt, database-backed sessions |
| AI | Google Gemini REST API with local matching fallback |
| Testing | Node.js test runner, Playwright with Google Chrome |
| Local infrastructure | Docker Compose |

## Project structure

```text
HealthRouteAI/
├── client/
│   ├── public/                 Static assets
│   ├── src/
│   │   ├── components/         Directory, assistant, forms, and shared UI
│   │   ├── context/            Authentication state
│   │   ├── hooks/              Shared data-loading hooks
│   │   ├── pages/              Public and admin pages
│   │   ├── services/           API client
│   │   ├── types/              Frontend types
│   │   ├── styles.css          Base styles
│   │   └── theme.css           Healthcare theme and responsive styles
│   ├── tests/                  Browser tests
│   └── .env.example            Public frontend configuration template
├── server/
│   ├── src/
│   │   ├── controllers/        Request orchestration
│   │   ├── database/           Pool, demo records, migration/seed/check scripts
│   │   │   └── migrations/     Versioned SQL migrations
│   │   ├── middleware/        Authentication and authorization
│   │   ├── models/            Domain types
│   │   ├── routes/            Public, authentication, and admin endpoints
│   │   ├── services/          Search, context retrieval, Gemini, and safeguards
│   │   ├── env.ts             Backend environment loading
│   │   ├── app.ts             Express application
│   │   └── server.ts          API startup
│   ├── tests/                 Backend and database integration tests
│   └── .env.example            Alternative backend configuration template
├── docs/                       Verification report and test instructions
├── .env.example                Recommended backend configuration template
├── .gitignore
├── docker-compose.yml
├── package.json                Root development and database commands
└── README.md
```

## Prerequisites

- Node.js 22 or newer and npm.
- Docker Desktop with Docker Compose, running before database setup; alternatively, an existing PostgreSQL installation.
- Google Chrome for Playwright browser tests.
- An optional Gemini API key for live generated responses. Local recommendations work without it.

The default ports are **5173** for the frontend, **4000** for the API, and **5432** for PostgreSQL. Commands below run from the project root unless stated otherwise. Examples use a POSIX shell, such as macOS Terminal, Linux, or WSL.

## Installation

### 1. Install dependencies

Open the project folder in a terminal:

```bash
npm install
npm run install:all
```

### 2. Configure environment variables

For a new installation, copy the template. Preserve an existing `.env` instead of overwriting it.

```bash
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `JWT_SECRET` in `.env`. Do not use the example database credentials outside local development.

### 3. Initialize PostgreSQL

Start Docker Desktop, then run:

```bash
npm run db:init
```

This starts PostgreSQL, waits for readiness, applies migrations, inserts demo data, and verifies the database.

### 4. Run the application

```bash
npm run dev
```

| Address | Purpose |
| --- | --- |
| http://localhost:5173 | Open the React application |
| http://localhost:4000/api/health | Check API status |
| http://localhost:4000/api | API base address; not a webpage |

The health endpoint should return `{"ok":true,"mode":"postgres"}`. Use Ctrl+C to stop the development servers. PostgreSQL remains running in Docker.

## Environment variables

### Backend

Use the root `.env` (recommended), or copy `server/.env.example` to `server/.env`. Normally use only one. Loading precedence is **shell/container variables → server/.env → root .env**, including compiled startup, migrations, and seeding.

| Variable | Purpose | Local value or behavior |
| --- | --- | --- |
| `PORT` | Backend listening port | `4000` |
| `DATABASE_URL` | Private PostgreSQL connection string | `postgresql://healthroute:healthroute@localhost:5432/healthroute` |
| `JWT_SECRET` | Private JWT signing secret | Generate a random value; use at least 32 characters |
| `GEMINI_API_KEY` | Private Gemini API key | Optional; empty enables local fallback |
| `GEMINI_MODEL` | Configurable Gemini model identifier | See `.env.example`; availability depends on the provider account |
| `NODE_ENV` | Runtime environment | `development`, `test`, or `production` |
| `CLIENT_URL` | Allowed frontend origin | `http://localhost:5173` |

An explicitly empty `DATABASE_URL` enables a directory-only static demo. Authentication, admin editing, and the protected assistant require PostgreSQL.

### Frontend

The default API address works locally. To change it:

```bash
cp client/.env.example client/.env
```

```dotenv
VITE_API_URL=http://localhost:4000/api
```

Restart Vite after changing frontend configuration. Production values are embedded during the frontend build.

**Every `VITE_` variable is public. Never place `GEMINI_API_KEY`, `JWT_SECRET`, or database credentials in frontend files or prefix them with `VITE_`.** Real environment files are excluded by Git and Docker ignore rules; safe `.env.example` templates are retained.

## PostgreSQL setup and migrations

The local Compose service uses PostgreSQL 16 with a persistent named volume. Its demo database, username, and password are all `healthroute`.

| Command | Action |
| --- | --- |
| `npm run db:start` | Start PostgreSQL and wait for readiness |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed an already-migrated database |
| `npm run db:check` | Verify tables, relationships, roles, and demo logins |
| `npm run db:init` | Run all four steps above |
| `npm run seed` | Migrate and seed an already-running database |

For an existing PostgreSQL installation, create a database, set its connection string in `DATABASE_URL`, then run:

```bash
npm run db:migrate
npm run db:seed
npm run db:check
```

Migrations live in [server/src/database/migrations](server/src/database/migrations). Applied filenames are recorded in `schema_migrations`; migrations use transactions and a lock to prevent concurrent application. API startup also applies pending migrations. Add new numbered migration files rather than changing migrations already applied. `schema.sql` is a reference snapshot of the initial schema, not the complete migration history.

### Database tables

| Table | Purpose |
| --- | --- |
| `users` | Name, unique email, bcrypt password hash, role, and timestamps |
| `auth_sessions` | Revocable JWT sessions and expiry times |
| `departments` | Department names, descriptions, and icons |
| `services` | Services linked to departments |
| `locations` | Clinic names, addresses, phones, and hours |
| `department_locations` | Department/location relationships |
| `faqs` | Navigation questions and answers |
| `appointment_guidance` | Service-linked scheduling and arrival information |
| `schema_migrations` | Applied migration history |

## Seed data and demo credentials

Seed or refresh the local demonstration data with:

```bash
npm run seed
```

A fresh seed includes 9 departments, 11 services, 3 locations, 11 department/location links, 3 FAQs, and 11 appointment guidance records. Departments include Primary Care, Cardiology, Orthopedics, Radiology, Dermatology, Laboratory Services, Physical Therapy, Urgent Care, and Women's Health.

All clinic and administrative details are fictional. Seeding is transactional and repeatable: it updates recognized demo content while preserving unrelated records and existing users' passwords. Existing databases may therefore contain more records than a fresh seed.

| Role | Email | Password |
| --- | --- | --- |
| Patient | `patient@healthroute.local` | `DemoPass123!` |
| Admin | `admin@healthroute.local` | `DemoPass123!` |

Use these accounts only locally. If an existing demo account has a different password, seeding preserves it; `db:check` reports the mismatch.

## Run the frontend and backend separately

Use two terminals from the project root.

**Backend:**

```bash
npm run dev --prefix server
```

The API starts at http://localhost:4000.

**Frontend:**

```bash
npm run dev --prefix client
```

Open http://localhost:5173. If a port changes, update `PORT`, `CLIENT_URL`, and/or `VITE_API_URL` to match.

### Production build check

```bash
npm run build
```

This checks TypeScript, including unused-code checks, and builds `server/dist` and `client/dist`.

To run the compiled API after configuring the backend environment:

```bash
npm run start --prefix server
```

For a local inspection of the frontend production build:

```bash
npm run preview --prefix client -- --port 5173
```

Stop the development frontend first. Vite preview is for local verification, not the planned production hosting setup.

## Gemini integration

The assistant follows this flow:

1. A signed-in user submits a navigation question.
2. The backend validates the question and retrieves relevant departments, services, locations, FAQs, and appointment guidance.
3. Local matching ranks service recommendations, including everyday synonyms.
4. Only bounded, relevant directory context is sent to Gemini; user accounts, hashes, and tokens are excluded.
5. The backend validates the generated response and returns it alongside verified database recommendations.
6. If the key is absent or Gemini fails, the API returns database-based navigation in the same response format.

Set `GEMINI_API_KEY` and, if needed, `GEMINI_MODEL` in the **backend** environment, then restart the API. The integration calls Gemini's `generateContent` endpoint. Model availability is account-dependent; the model name is configurable.

Example questions:

- “Where can I get an X-ray?”
- “I need a heart doctor.”
- “Where should I go for physical therapy?”
- “Which department performs blood tests?”

Navigation-only instructions and local safeguards reject clinical advice and unsupported generated details. Provider errors, malformed responses, and the four-second deadline fall back gracefully. Database failures produce explicit retryable errors rather than invented recommendations.

The safeguards are conservative checks, not a guarantee of semantic correctness. Live Gemini generation has not been verified in the recorded test run; automated tests simulate provider responses and verify local fallback.

## API overview

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/auth/register`, `/api/auth/login` | Public, rate limited |
| GET | `/api/auth/me` | Signed in |
| POST | `/api/auth/logout` | Signed in |
| GET | `/api/departments?q=`, `/api/services?q=` | Public |
| GET | `/api/locations`, `/api/faqs`, `/api/appointment-guidance` | Public |
| POST | `/api/assistant` | Patient or admin |
| GET | `/api/admin/summary` | Admin |
| GET, POST | `/api/admin/:resource` | Admin |
| PUT, PATCH, DELETE | `/api/admin/:resource/:id` | Admin |

Admin resources are `departments`, `services`, `locations`, `faqs`, and `appointment_guidance`. Protected requests use `Authorization: Bearer <token>`. Validation errors return readable messages and field errors where applicable.

## Testing and verification

```bash
npm run build
# Create once; use a separate database for integration tests.
docker compose exec -T postgres createdb -U healthroute healthroute_auth_test
TEST_DATABASE_URL=postgresql://healthroute:healthroute@localhost:5432/healthroute_auth_test npm test
```

Backend tests cover registration, bcrypt hashes, JWT validation and revocation, role enforcement, PostgreSQL CRUD, search, and Gemini safeguards/fallback. Integration tests require an explicit test database and clean up their own records.

Playwright tests cover authentication, admin CRUD, field validation, directory search, assistant responses, feedback states, keyboard navigation, and mobile layouts down to 320px. Google Chrome must be installed.

See [the end-to-end verification report](docs/end-to-end-verification.md) for reproducible isolated-server commands and results. Browser tests run in two batches with the test API restarted between them to avoid exhausting the normal 200-request rate limit. Production protections are not disabled for testing.

## Security notes

- Passwords are stored only as bcrypt hashes with cost 12; registration enforces 8 characters minimum and a 72-byte maximum.
- JWTs have a one-hour expiry, a fixed issuer/audience, and database-backed revocation. Logout invalidates the current session.
- Backend middleware checks the current database role on protected requests. Client-side role changes cannot grant admin access.
- Input is validated on the server; SQL values use parameterized queries. Frontend validation improves feedback but does not replace server checks.
- CORS restricts the allowed frontend origin, and API/authentication rate limits are enabled.
- Backend secrets remain outside browser code. Do not commit real credentials or reuse demo secrets in deployment.
- The frontend currently stores JWTs in localStorage. This makes XSS prevention important; evaluate secure HttpOnly-cookie authentication before production use.
- Do not store real medical records or patient health information in this demonstration. Seeded content is fictional administrative information.
- HTTPS, private database access, secret rotation, backups, audit logging, password reset, and email verification need deployment-specific work before production use.

## Future AWS EC2 deployment plan

The following is a proposed deployment plan, **not an implemented or verified deployment**. Confirm infrastructure choices and costs before provisioning.

1. **Prepare the environment:** create a dedicated EC2 instance, use an appropriate instance role, and manage access with restricted administrative permissions. Keep production configuration separate from local demo settings.
2. **Provision PostgreSQL:** use a private managed PostgreSQL database, such as Amazon RDS, rather than the local Compose database. Restrict database access to the application, enable encrypted connections, and configure backups.
3. **Manage secrets:** supply `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` through a secrets service or protected runtime configuration. Set `NODE_ENV=production` and the deployed frontend origin in `CLIENT_URL`.
4. **Build a release:** install dependencies and run tests. Set `VITE_API_URL=/api` for a same-origin deployment, then run `npm run build`. Keep secrets out of build artifacts and container contexts.
5. **Serve the application:** run the compiled Express API under a process supervisor with automatic restart. Serve `client/dist` with Nginx and proxy `/api` to the backend on a private/local port. Do not expose the Vite development server.
6. **Configure networking and HTTPS:** point a domain to the deployment, terminate TLS at the reverse proxy or load balancer, and expose only required public web ports. Keep PostgreSQL and the Node API port inaccessible directly from the internet.
7. **Apply migrations:** run migrations as a controlled release step and verify rollback/recovery procedures. Do not seed public demo accounts into production; establish an approved admin-provisioning process.
8. **Add operations:** configure health monitoring, application logs without secrets, alerts, database restore checks, and a repeatable release/rollback workflow.
9. **Validate before launch:** rerun authentication, authorization, CRUD, mobile, and AI fallback tests over HTTPS. Test live Gemini with approved administrative content and review the remaining security work above.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| PostgreSQL connection refused | Start Docker Desktop, run `npm run db:start`, and verify `DATABASE_URL`. |
| API reports a missing JWT secret | Generate a random value, set `JWT_SECRET` in backend `.env`, and restart. |
| `/api` returns “endpoint was not found” | Open the website at port 5173; use `/api/health` to check the backend. |
| Port already in use | Reuse the existing project process or choose another port and update the matching environment variables. |
| Login unavailable in demo mode | Configure PostgreSQL, run migrations and seeding, and restart the API. |
| Gemini unavailable | Database navigation remains available; check the private key and model configuration for live generation. |
| HTTP 429 during tests | Wait for the 15-minute window or restart only the isolated test API between batches. |
| Demo password does not work | Seeding preserves existing passwords; run `npm run db:check` and confirm the intended local database. |

## Project scope

HealthRoute AI is a university full-stack demonstration, not a clinical system. It provides service navigation and appointment instructions, but does not book appointments, manage patient medical records, send verification emails, or implement password reset. These are potential future extensions, alongside the deployment work described above.
