# MembersGuild

> Built for clubs. Trusted by members.

A multi-tenant SaaS platform for community sports clubs. One codebase, one database, complete data isolation per club via PostgreSQL schemas.

---

## Architecture

| Layer | Technology |
|---|---|
| Backend | C# .NET 8 Web API |
| ORM | Entity Framework Core 8 |
| Database | PostgreSQL 16 |
| Frontend | Next.js 15, TypeScript strict, Tailwind CSS |
| Auth | JWT (contains club_id + role claims) |
| Containers | Docker + docker-compose |
| CI/CD | GitHub Actions self-hosted runner |

Multi-tenancy is enforced at two layers:
1. **Application** — `ClubResolutionMiddleware` scopes every request to a club schema
2. **Database** — PostgreSQL schema isolation (`club_bsm.*`, `club_northside.*`, etc.)

---

## Ports

| Service | Port |
|---|---|
| PostgreSQL | 5433 (host) → 5432 (container) |
| Backend API | 5015 |
| Frontend | 5016 |

---

## Quick Start (Development)

### Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/Nathan-Forest/membersguild.git
cd membersguild
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` — the defaults work for local dev, but change the password:

```env
DB_USER=membersguild
DB_PASSWORD=your_secure_password_here
JWT_SECRET=your_32_char_minimum_secret_here
FRONTEND_URL=http://localhost:5016
```

**JWT_SECRET rules:** minimum 32 characters, no `!` character (causes bash expansion issues). Generate with:
```bash
openssl rand -hex 32
```

### 3. Build and start

```bash
docker compose up --build
```

First run takes 3–5 minutes (downloading base images, building, seeding).

### 4. Verify

```bash
# Backend health check
curl http://localhost:5015/api/health

# Forest Den club config (confirms multi-tenancy is working)
curl -H "X-Club-Slug: forestden" http://localhost:5015/api/public/club-config
```

### 5. Access the demo club

Open your browser and set a hosts entry for local subdomain routing:

**Windows** — edit `C:\Windows\System32\drivers\etc\hosts` as Administrator:
```
127.0.0.1  forestden.localhost
```

**Mac/Linux** — edit `/etc/hosts`:
```
127.0.0.1  forestden.localhost
```

Then visit: **http://forestden.localhost:5016**

**Demo credentials (all use password `ForestDen2026`):**

| Email | Role |
|---|---|
| `webmaster@forestden.demo` | Webmaster |
| `coach@forestden.demo` | Coach |
| `finance@forestden.demo` | Finance |
| `sarah.wade@email.com` | Member (8 credits) |
| `marcus.lee@email.com` | Member (0 credits — good for testing blocked booking) |
| `trial.member@email.com` | CATS (2 credits) |

---

## Development Workflow

Nathan's established workflow — edit in VS Code, push, pull on server.

### Local changes

```bash
# Make changes in VS Code
git add .
git commit -m "feat: your change here"
git push origin main
```

### Server deployment (manual)

```bash
ssh nathan@192.168.50.160
cd ~/apps/membersguild
git pull origin main
docker compose up --build -d
```

### Automatic deployment

GitHub Actions handles this on every push to `main` via the self-hosted runner `den-runner-membersguild`.

---

## Adding a New Club

From the super-admin dashboard (Phase 8), or directly via the provisioning endpoint:

```bash
curl -X POST http://localhost:5015/api/platform/clubs \
  -H "Content-Type: application/json" \
  -H "X-Platform-Admin: true" \
  -d '{
    "slug": "bsm",
    "name": "Brisbane Southside Masters Swimming",
    "displayName": "BSM Swimming",
    "sport": "swimming"
  }'
```

This creates:
- A record in `platform.clubs`
- A new PostgreSQL schema `club_bsm`
- All tables migrated
- Swimming template metrics seeded (24 metrics — 4 strokes × 6 distances)
- All standard features enabled
- Default club settings

The club is immediately live at `bsm.membersguild.com.au`.

---

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|---|---|---|
| `ConnectionStrings__Default` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, no `!` — sign JWT tokens |
| `AllowedOrigins__0` | ✅ | Frontend URL for CORS |
| `SENDGRID_API_KEY` | Phase 9 | Email notifications |
| `STRIPE_SECRET_KEY` | Phase 8 | Platform subscription billing |
| `STRIPE_WEBHOOK_SECRET` | Phase 8 | Stripe webhook verification |

### Frontend (bake-time — passed as Docker build args)

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://membersguild-backend:5015` | Internal Docker service name — never exposed to browser |

---

## Project Structure

```
membersguild/
├── backend/
│   ├── MembersGuild.API/         ← Controllers, middleware, services
│   │   ├── Controllers/          ← Auth, Public, Members, Sessions, etc.
│   │   ├── Middleware/           ← ClubResolution, ClubScopeValidation, FeatureFlag
│   │   ├── Services/             ← Auth, Provisioning, Seed, Credits, etc.
│   │   ├── DTOs/                 ← Request/response shapes
│   │   └── Program.cs            ← App bootstrap + middleware pipeline
│   ├── MembersGuild.Data/        ← EF Core models and DbContexts
│   │   ├── Contexts/             ← PlatformDbContext, ClubDbContext
│   │   └── Models/               ← Platform/ and Club/ model classes
│   └── MembersGuild.Tests/       ← xUnit tests
├── frontend/
│   ├── app/
│   │   ├── (platform)/           ← membersguild.com.au pages
│   │   ├── (club)/               ← Club portal pages
│   │   └── api/[...path]/        ← Catch-all proxy to C# backend
│   ├── components/
│   │   └── layout/ClubNav.tsx    ← Role-aware navigation
│   ├── lib/
│   │   ├── api.ts                ← Fetch wrapper
│   │   ├── auth.ts               ← JWT storage + role checks
│   │   └── club-config.ts        ← Server-side club branding fetch
│   ├── types/index.ts            ← All TypeScript types
│   └── middleware.ts             ← Route protection + slug forwarding
├── docker-compose.yml
├── .env.example
└── .github/workflows/
    ├── deploy.yml                ← Push to main → auto-deploy
    └── test.yml                  ← PR → run tests + typecheck
```

---

## Build Sequence

Progress is tracked against the architecture document (`MEMBERSGUILD_V2_ARCHITECTURE.md`).

| Phase | Goal | Status |
|---|---|---|
| 1 | Foundation — multi-tenancy, auth, Forest Den demo | ✅ **Current** |
| 2 | Member core — user CRUD, CATS signup, credits | 🔲 Next |
| 3 | Sessions & calendar — booking, credit deduction | 🔲 |
| 4 | Attendance — marking, NSBA refunds, QR codes | 🔲 |
| 5 | Training — metrics, PBs, swim sets, videos | 🔲 |
| 6 | Shop — items, orders, bank transfer workflow | 🔲 |
| 7 | Feature flags & settings — Webmaster controls | 🔲 |
| 8 | Platform & super-admin — club provisioning, Stripe | 🔲 |
| 9 | Polish — PWA, email, S3, production migration | 🔲 |

---

## Key Design Decisions

**Schema-per-tenant** — PostgreSQL schema isolation means Club A's data is physically separate from Club B's. No `WHERE club_id` filtering. No risk of accidental data bleed. One schema change applies to all clubs via migrations.

**Next.js API proxy** — All `/api/*` calls from the browser go to Next.js route handlers, which forward to the C# backend with the `X-Club-Slug` header. The backend URL is never exposed to the browser. No CORS configuration needed.

**JWT with club_id claim** — Every token contains the club it was issued for. `ClubScopeValidationMiddleware` rejects tokens used against a different club. Combined with schema isolation, cross-club access requires two independent failures.

**Bank transfer by default** — Matches how small community clubs already operate. Finance role confirms receipt and releases credits manually. Stripe per club is a future upgrade path.

---

## Commit Style

```
feat:     New feature
fix:      Bug fix
refactor: Code change without behaviour change
docs:     Documentation only
chore:    Build, CI, tooling
```

---

*MembersGuild — Built for clubs. Trusted by members.*
