<div align="center">

# TriageLoom

### From incident reports to actionable service intelligence.

**A multi-tenant incident operations platform for tracking production disruptions, understanding service dependencies, and measuring reliability against SLAs.**

[![Live application](https://img.shields.io/badge/Live%20App-Open%20TriageLoom-06b6d4?style=for-the-badge&logo=vercel&logoColor=white)](https://triage-loom.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-111827?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Data%20Layer-4169e1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[**Explore the live app**](https://triage-loom.vercel.app) · [**See the screenshots**](#product-walkthrough) · [**Architecture**](#system-architecture) · [**Run locally**](#run-it-locally)

</div>

---

## The problem

During an incident, the hardest question is rarely *“Is something broken?”* It is *“What broke, which services depend on it, who can respond, and are we meeting our commitments?”*

TriageLoom brings those questions into a single workflow. Rather than treating incidents, service inventory, and reliability targets as disconnected spreadsheets, it models their relationships: **an incident affects a service; a service may affect downstream dependencies; an incident history can be evaluated against severity-specific SLA policies.**

> **A realistic scenario:** Authentication starts failing. An engineer creates a SEV1 incident for the Authentication Service. TriageLoom tracks its lifecycle, highlights directly and potentially affected services in ImpactGraph, and evaluates response/resolution times against the workspace's SLA policy.

## What you can do

| Capability | How it works | Engineering value |
| --- | --- | --- |
| **Workspace isolation** | Create organizations and associate users through membership records | Organizes incident data by tenant |
| **Authentication + roles** | Better Auth email/password sessions; owner, admin, responder and viewer roles | Server-side access decisions for organization-scoped operations |
| **Incident operations** | Create incidents, assign severity and service, update status, inspect event timelines | Traceable incident lifecycle |
| **Operational analytics** | Organization-level totals, active/resolved counts and severity/status breakdowns | Turns incident records into operational indicators |
| **Service registry** | Register services and inspect associated active incident counts | Identifies affected systems rather than just ticket titles |
| **ImpactGraph** | Store directional service dependencies and visualize direct/potential impact | Connects incidents with downstream service risk |
| **SLA Lab** | Configure response and resolution targets per severity | Makes reliability policy explicit and editable |
| **SLA monitoring** | Evaluate incident history against the configured thresholds | Shows met, breached, pending or unconfigured outcomes |

## Product walkthrough

These screenshots are from the deployed TriageLoom application and illustrate a populated example workspace. Counts and SLA results are snapshots, not benchmark claims.

### 01 · Secure access

The entry point uses an email/password sign-in flow. The dashboard checks the server-side session before showing protected content.

![TriageLoom sign-in screen](docs/screenshots/01-sign-in.webp)

### 02 · Organization-scoped operations

Create a workspace and use the authenticated operations dashboard. Memberships determine the role a user holds inside each organization.

![Authenticated dashboard and organization workspace](docs/screenshots/02-workspace-dashboard.webp)

### 03 · Capture and track incidents

Report disruptions with a title, context, affected service and severity. The incident list surfaces operational state and links to incident timelines.

![Incident creation form and recent incidents](docs/screenshots/03-incident-operations.webp)

### 04 · Make incident data useful

Track the number of active and resolved incidents and inspect the severity/status distribution, using data from the selected organization.

![Incident analytics dashboard](docs/screenshots/04-incident-analytics.webp)

### 05 · Maintain a service inventory

Register services and see which ones have active incident associations—connecting business-facing incident reports to actual components.

![Service registry and affected services](docs/screenshots/05-service-registry.webp)

### 06 · Understand downstream impact with ImpactGraph

Model directed dependencies between services. The graph distinguishes services with directly linked incidents from those potentially affected through dependency relationships. Arrows indicate **dependent → dependency**.

![ImpactGraph service dependency visualization](docs/screenshots/06-impact-graph.webp)

### 07 · Evaluate real incident SLAs

Compare recorded incident lifecycle timing with response and resolution targets. Results surface breaches alongside successful evaluations, with elapsed and target minutes visible for each incident.

![Incident SLA monitoring and evaluations](docs/screenshots/07-sla-monitoring.webp)

## System architecture

```mermaid
flowchart TD
    U[Operator / Responder] --> UI[Next.js App Router UI]
    UI --> AUTH[Better Auth session handling]
    UI --> API[Next.js Route Handlers]
    AUTH --> ORM[Drizzle ORM]
    API --> ACCESS[Session + membership + role checks]
    ACCESS --> DOM[Incident / service / dependency / SLA logic]
    DOM --> ORM
    ORM --> PG[(PostgreSQL)]
    API --> HEALTH[Health endpoint: SELECT 1]
    HEALTH --> PG
    GH[GitHub Actions CI] --> CHECKS[Tests / Typecheck / Build]
    V[Vercel] -. hosts .-> UI
```

**Request flow:** browser UI → organization-scoped API route → authenticated membership and permission check → database query/mutation → JSON response → refreshed UI state.

**Tenant boundary:** organization IDs scope core records, while membership checks determine access to organization resources. Several database relationships use composite foreign keys involving `organization_id` to prevent cross-organization references for incidents, services, memberships and dependency edges.

### Data model (simplified)

```mermaid
erDiagram
    USERS ||--o{ MEMBERSHIPS : belongs_to
    ORGANIZATIONS ||--o{ MEMBERSHIPS : includes
    ORGANIZATIONS ||--o{ SERVICES : owns
    ORGANIZATIONS ||--o{ INCIDENTS : tracks
    ORGANIZATIONS ||--o{ SLA_POLICIES : configures
    SERVICES ||--o{ INCIDENTS : affected_by
    INCIDENTS ||--o{ INCIDENT_EVENTS : has
    SERVICES ||--o{ SERVICE_DEPENDENCIES : dependent_service
    SERVICES ||--o{ SERVICE_DEPENDENCIES : dependency_service
    USERS ||--o{ INCIDENTS : creates
```

**Key decisions:**

- **Relational integrity first.** PostgreSQL constraints, indexed organization filters, unique organization/service names, and tenant-aware foreign keys protect important invariants.
- **Role checks live on the server.** UI affordances are not the only enforcement mechanism; protected routes inspect session and organization membership before performing operations.
- **Dependencies are explicit edges.** Service-to-service relationships are stored as data and used to drive impact visualization, instead of being hardcoded in the frontend.
- **SLA outcomes are derived.** Response/resolution evaluations compare incident timing with organization-specific severity targets rather than displaying static badges.
- **Health means an actual database round-trip.** `/api/health` executes `SELECT 1`, reporting `503` if the database check fails.

## Technology stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4 |
| Authentication | Better Auth, persisted sessions |
| API | Next.js route handlers, Zod validation |
| Database | PostgreSQL, Drizzle ORM, Drizzle Kit migrations |
| Testing | Vitest, GitHub Actions CI |
| Deployment | Vercel |

## API surface

The following are representative routes implemented in the repository. Organization-specific paths require an authenticated user with appropriate permissions.

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Check application → PostgreSQL connectivity |
| `/api/auth/[...all]` | Better Auth endpoints |
| `GET /api/organizations` | List workspaces accessible to the user |
| `POST /api/organizations` | Create a workspace |
| `GET, POST /api/organizations/:id/incidents` | Read/create incidents |
| `/api/organizations/:id/incidents/:incidentId` | Individual incident operations |
| `GET /api/organizations/:id/analytics` | Incident statistics |
| `GET, POST /api/organizations/:id/services` | Service inventory |
| `GET, POST /api/organizations/:id/dependencies` | Service dependency graph |
| `GET, PUT /api/organizations/:id/sla-policies` | Read/configure SLA policies |
| `GET /api/organizations/:id/sla-evaluation` | Evaluate historical incidents against SLAs |

> For complete payloads and permitted HTTP methods, consult the corresponding `src/app/api/**/route.ts` files. The table describes the principal interfaces, not a generated OpenAPI contract.

## Run it locally

**Prerequisites:** Node.js 24 (matches the CI runner), npm, and an accessible PostgreSQL database.

```bash
git clone https://github.com/mallikarjun-git7/TriageLoom.git
cd TriageLoom
npm ci
```

Create **`.env.local`** in the project root:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
BETTER_AUTH_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
BETTER_AUTH_URL=http://localhost:3000
```

Generate an authentication secret with `openssl rand -base64 32`. Never commit the actual secret or database connection string.

Migrations are stored in `drizzle/`. Once the database is provisioned and `DATABASE_URL` is valid, apply the existing migrations with Drizzle Kit:

```bash
npx drizzle-kit migrate
npm run dev
```

Visit **http://localhost:3000** and create an account. The root page redirects to `/login`.

### Verify the deployment

```bash
curl https://triage-loom.vercel.app/api/health
```

An available database returns a response shaped like:

```json
{"status":"ok","application":"TriageLoom","database":"connected"}
```

This endpoint checks connectivity—not the health of every downstream service.

### Quality checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The committed GitHub Actions workflow runs unit tests, generates Next.js types, checks TypeScript and builds the application on pushes and pull requests to `main`.

## Repository guide

```text
src/
├── app/
│   ├── api/                 # Authentication + organization-scoped endpoints
│   ├── dashboard/           # Session-protected operations dashboard
│   ├── login/               # Sign-in / account creation flow
│   └── page.tsx             # Redirects to /login
├── components/              # Incident, analytics, service, graph and SLA UI
├── db/                      # Drizzle connection and relational schema
└── lib/                     # Auth and organization access logic
drizzle/                      # Versioned SQL migrations
.github/workflows/ci.yml      # Tests, type checks and production build
tests/                        # Automated tests
docs/screenshots/             # Product walkthrough assets
```

## What this project demonstrates

TriageLoom is a hands-on example of **full-stack application design with backend constraints that matter**: tenant boundaries, persistent sessions, role-aware operations, referential integrity, stateful incident workflows, dependency modeling, and data-driven reliability reporting.

Its value is not a list of frameworks; it is how those pieces combine to answer an operational question end to end: **when an incident occurs, what does it affect, and how quickly was it handled?**

### Next engineering milestones

- Expand role and cross-tenant isolation tests for every organization-scoped endpoint.
- Add richer incident ownership and escalation workflows.
- Add production observability, structured logs, and alerting around API/database failures.
- Explore graph layouts and performance for larger service inventories.
- Add load tests and document measured throughput/latency before making scaling claims.

---

<div align="center">

**Built to turn incident records into operational context.**

[Live Demo](https://triage-loom.vercel.app) · [Source Code](https://github.com/mallikarjun-git7/TriageLoom)

</div>
