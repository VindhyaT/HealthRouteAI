# EC2 deployment guide

The production containers have been built and exercised locally. AWS resources, a real domain certificate, RDS connectivity and a live Gemini response still require deployment-specific verification. This is a university navigation application, not a clinical system.

## Architecture

Internet → nginx HTTPS (443) → Express (private container port 4000) → private PostgreSQL. nginx serves the compiled React application and proxies `/api` on the same origin. Only ports 80 and 443 are published. Port 80 redirects to HTTPS. The development `docker-compose.yml` remains separate.

The backend image runs as the `node` user with production dependencies only. Both builds use committed lockfiles with `npm ci`. Production Compose enables restart policies, bounded logs, health checks and graceful shutdown. `/api/ready` performs a real database query; `/api/health` describes the configured mode only. Health-check failure marks a container unhealthy; configure monitoring/recovery separately, as Docker restart policies alone do not restart an unhealthy running process.

## Prepare EC2 and PostgreSQL

1. Install Docker Engine and the Compose plugin on the chosen EC2 operating system. Build on the target CPU architecture (local verification used ARM64); an x86 EC2 instance must build its own images or receive matching images.
2. Allow inbound TCP 80/443 to the web instance. Restrict SSH to your administrative IP or use managed session access. Do not open 4000, 5173 or 5432 publicly. This configuration assumes nginx is the sole proxy; adding an ALB/CDN requires reviewing proxy trust and client-IP handling.
3. Provision a dedicated PostgreSQL database and application account. Allow database connections only from the EC2 security group. Enable backups and confirm restoration. Migrations run at API startup and require schema creation/alteration permissions; for stricter deployments, use a separate migration account and release process.
4. Point your domain at the instance. Obtain a trusted certificate using your certificate provider. Place the actual `fullchain.pem` and `privkey.pem` files in a protected directory outside the repository. Do not use symlinks whose targets are outside the mounted directory. Automate renewal, update these files and reload nginx afterward.
5. For RDS, download the official CA bundle into a separate public-certificate directory. Use `sslmode=verify-full` and its container path in `DATABASE_URL`; do not disable certificate verification. See [AWS PostgreSQL TLS guidance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html) and [node-postgres SSL configuration](https://node-postgres.com/features/ssl).

## Configure and start

Clone the release containing these changes. The current local changes must be committed and pushed before a GitHub clone can include them.

```sh
cp docs/production.env.example .env.production
chmod 600 .env.production
openssl rand -hex 32
```

Edit `.env.production` on the server. Use the generated random value for `JWT_SECRET`; configure the actual database URL, HTTPS `CLIENT_URL` (origin only, no trailing slash), certificate directories and optional Gemini key. URL-encode special characters in database credentials. The example uses a verified TLS database connection. `NODE_ENV=production`, `PORT=4000` and `TRUST_PROXY=1` are fixed by production Compose. Never reuse demo database passwords or accounts.

Keep environment values in this protected file or inject them from a secret manager at runtime. Do not put backend secrets into `VITE_` variables or Docker build arguments. Do not publish the output of `docker compose config`, `docker inspect` or process environments: they can contain runtime secrets. Docker host access is privileged.

```sh
# Validate without printing expanded secrets.
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
# Build and start; automatic migrations finish before readiness succeeds.
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build --wait
# Status and safe application logs.
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 server
```

Do not combine this file with the development Compose file. `DATABASE_CERT_DIRECTORY` mounts only public database CA certificates; it must not contain private keys. A missing or invalid TLS certificate prevents nginx startup. A missing database URL, weak JWT secret, invalid HTTPS origin, or database/migration failure prevents production API startup.

If running outside Docker, run `npm ci --prefix server`, `npm run build --prefix server`, then `npm start --prefix server` with production environment variables set. The optional compiled migration command is `npm run db:migrate:prod --prefix server`. Development `tsx` scripts are intentionally absent from the production image. Serve the React build through a configured HTTPS web server; `vite dev` and `vite preview` are not the production serving path.

## Initial administrator and content

Production demo seeding is blocked. Register an account through the application with a strong password. An authorized database operator must verify its owner, then update that specific existing user's role from `patient` to `admin` using a parameterized query in a trusted database tool. Sign out and sign in again, then create approved directory content through the admin dashboard. There is no automatic production admin password or public role-selection option. An empty new database will show the application's empty states until content is created.

## Verify and operate

```sh
curl --fail https://YOUR_DOMAIN/api/ready
curl --fail https://YOUR_DOMAIN/api/health
# After certificate renewal:
docker compose --env-file .env.production -f docker-compose.production.yml exec client nginx -t
docker compose --env-file .env.production -f docker-compose.production.yml exec client nginx -s reload
```

Verify registration, login, logout, patient denial of admin APIs, admin CRUD, directory searches and appointment information through the public HTTPS origin. Confirm untrusted certificate connections fail. With a valid Gemini key and approved directory data, submit a navigation question and inspect the response's `source`: `gemini` confirms an accepted live provider response; `local` means the database fallback was used. A healthy API alone does not verify Gemini. The configured model must be available to your account.

Back up before releases, retain the prior image/release and test database restoration. Do not assume SQL migrations are reversible. Monitor readiness, certificate expiry, application failures, disk usage and database backups. This is a single-instance deployment: rate limits are in memory; multi-instance deployments need a shared rate-limit store and a reviewed proxy topology.

## Local verification — 29 September 2026

- React/TypeScript and Express builds passed; production Docker builds passed.
- 59 existing backend tests passed: JWT validation/revocation, bcrypt, role enforcement, CRUD, validation, database errors, service matching and mocked Gemini safeguards/failures. A separate production configuration regression test passed.
- Five Chrome tests passed against nginx HTTPS and the production API: registration/login/logout, patient/admin permissions, directory searches/results/states, navigation recommendations, safety refusals and retry behavior. Generated-provider presentation used a mock; real navigation used the local fallback.
- Both containers became healthy against the existing local test PostgreSQL database. The final rebuilt configuration passed the same five browser checks; HTTPS readiness returned 200 and HTTP redirected with 308. The API ran as UID 1000 without TypeScript or an environment file in its runtime image. Local HTTPS used a temporary self-signed certificate with verification bypass enabled only for the test browser; this is not a production certificate test.
- GitHub `main` matched the single locally available commit `972a0c4`. No tracked private environment/key files or known-secret/common credential-pattern matches were found in that history. This limited scan is not a guarantee about other branches, deleted remote content or every possible secret format. Demo credentials are intentionally documented and must never be reused in production.
- No Gemini key was configured, so live Gemini remains unverified. No AWS deployment, RDS TLS connection, public DNS/certificate renewal, backup restore or x86 image run was performed.
