# GamerBrac - Indian Esports Tournament Management Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00.svg?style=flat&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org)
[![Alembic](https://img.shields.io/badge/Alembic-1.15-red.svg?style=flat)](https://alembic.sqlalchemy.org)
[![Security Hardened](https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20Argon2-green.svg?style=flat)](https://gamerbrac.com)
[![100% Free Entry](https://img.shields.io/badge/Compliance-100%25_Free_Entry_Only-blue.svg?style=flat)](https://gamerbrac.com)

GamerBrac is a production-hardened, responsive Indian esports tournament management platform designed for grassroots and semi-professional competitive gaming across **Free Fire MAX**, **BGMI (Battlegrounds Mobile India)**, and **VALORANT**.

Built strictly around a **100% Free-Entry Community MVP** model, GamerBrac eliminates gambling and predatory entry-fee liabilities while providing enterprise-grade tournament workflows: verified player rosters, team management, atomic slot allocation, time-locked encrypted Room ID/password dispatch, evidence-backed score submission, automated leaderboard computation, and admin moderation audit logs.

---

## 📑 Table of Contents

1. [Platform Architecture & Tech Stack](#-platform-architecture--tech-stack)
2. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
3. [Security Architecture & Hardening](#-security-architecture--hardening)
4. [Supported Titles & Rules](#-supported-titles--rules)
5. [Local Development Quickstart](#-local-development-quickstart)
6. [Database Migrations (Alembic)](#-database-migrations-alembic)
7. [Automated Testing Suite](#-automated-testing-suite)
8. [Production Deployment Guide](#-production-deployment-guide)
9. [Unresolved Risks & Publisher Compliance Report](#-unresolved-risks--publisher-compliance-report)

---

## ⚡ Platform Architecture & Tech Stack

```
                                  [ Browser / Client ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ React 19 + TypeScript ]             [ Nginx Reverse Proxy ]
               Tailwind CSS, Lucide                       (SSL / HTTPS)
              Vite Production Bundle                          │
                        │                                     ▼
                        └──────────────────────────► [ FastAPI ASGI App ]
                                                       Uvicorn Worker Pool
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                                [ Security Middleware ]               [ Rate Limit Engine ]
                                 HSTS, CSP, X-Frame, CORS             Sliding Window per IP
                                            │                                   │
                                            └─────────────────┬─────────────────┘
                                                              ▼
                                                    [ Business Layer ]
                                               Auth (Argon2 / JWT Sessions)
                                               Tournament & Roster Engine
                                               AES-256-GCM Credential Vault
                                               Scoring & Standings Calculator
                                               Audit & Notification Dispatch
                                                              │
                                                              ▼
                                                    [ SQLAlchemy 2.0 ]
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                                 [ SQLite (Local Dev) ]              [ PostgreSQL (Prod) ]
                                 Alembic Migration Track             Connection Pooling / SSL
```

### Frontend Architecture
- **Framework**: React 19 with TypeScript (strict typing enabled).
- **Build Tool**: Vite 8 with fast HMR and tree-shaken production bundling.
- **Styling**: Tailwind CSS v4 featuring modern CSS `@theme` variables, dark-mode gaming aesthetics, accessible responsive layouts, and loading skeleton states.
- **Icons**: Lucide React.
- **Testing**: Vitest + React Testing Library (8/8 automated frontend test cases).

### Backend Architecture
- **Framework**: Python 3.14 + FastAPI + Pydantic v2.
- **ORM & Database**: SQLAlchemy 2.0 with Alembic database migrations. Supports SQLite for zero-config local development and PostgreSQL for high-concurrency production deployments.
- **Password Security**: Argon2id via `pwdlib[argon2]`.
- **Credential Encryption**: Authenticated AES-256-GCM via `cryptography.hazmat` with 12-byte cryptographically secure random nonces.
- **Testing**: pytest + Starlette TestClient (100/100 automated backend test cases across 8 test suites).

---

## 👥 Role-Based Access Control (RBAC)

GamerBrac enforces strict backend authorization gates across three distinct roles:

| Role | Privileges & Workflows | Security Constraints |
| :--- | :--- | :--- |
| **Player** | Register personal profile, link game UIDs (FF MAX, BGMI, VALORANT), create teams, join rosters, register for free-entry tournaments, check in during active check-in windows, retrieve time-locked match room credentials, upload match screenshot evidence. | Cannot self-assign organizer or admin status; cannot edit verified match scores; cannot access credentials before release or after expiry; cannot access matches they are not assigned to. |
| **Organizer** | Create and manage owned tournaments, advance tournament status (`draft` → `registration_open` → `check_in_open` → `in_progress` → `completed`), set match schedules, encrypt Room IDs and passwords with release/expiry windows, review player score submissions, confirm/edit official match scores, compute live standings. | Must be approved by Platform Admin before creating public tournaments; cannot modify or access credentials of tournaments owned by other organizers. |
| **Admin** | Approve/reject organizer applications, inspect platform-wide audit logs, review dispute and conduct reports, suspend/reinstate offending user accounts, access any match for arbitration. | Superuser privileges; all administrative actions write immutable audit entries. |

---

## 🔒 Security Architecture & Hardening

### 1. Sliding-Window Rate Limiting
Built-in in-memory sliding window rate limiter protects sensitive endpoints:
- **Auth endpoints** (`/api/v1/auth/login`, `/api/v1/auth/register`): 15 requests / 60 seconds per IP.
- **Room Credential retrieval** (`/api/v1/matches/{id}/credentials`): 30 requests / 60 seconds per IP.
- **Evidence uploads** (`/api/v1/submissions/evidence`): 30 requests / 60 seconds per IP.
- **General API**: 300 requests / 60 seconds per IP.
- Exceeding thresholds returns `429 Too Many Requests` with a standard `Retry-After` header.

### 2. Time-Locked AES-256-GCM Credential Dispatch
Room IDs and custom match passwords never touch the database or public APIs in plaintext:
- Encrypted using authenticated AES-256-GCM with a 256-bit environment key (`ROOM_ENCRYPTION_KEY`).
- Each encryption operation generates a unique 12-byte cryptographically random initialization nonce stored alongside the ciphertext and authentication tag.
- Public tournament and match endpoints strip all room secrets.
- Decryption is strictly restricted to:
  1. The tournament owner / platform admin.
  2. Registered players who have completed check-in, are assigned to the match, and request credentials within the active window: `release_at <= now <= expires_at`.

### 3. Atomic Concurrency & Capacity Protection
Tournament slot allocation prevents overselling during high-concurrency registration rushes:
- Atomic database updates check remaining capacity at the SQL level:
  `UPDATE tournaments SET current_participants = current_participants + 1 WHERE id = :id AND current_participants < max_participants AND status = 'REGISTRATION_OPEN'`
- Paired with database CHECK constraint `ck_tournament_participants_within_cap (current_participants <= max_participants)`.
- If a race condition occurs, `IntegrityError` triggers a transaction rollback and decrements any transient reservation, ensuring capacity is never breached.

### 4. Defense-in-Depth HTTP Headers
`SecurityHeadersMiddleware` injects modern security headers on all HTTP responses:
- `X-Content-Type-Options: nosniff` (prevents MIME type sniffing)
- `X-Frame-Options: DENY` (clickjacking defense)
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 5. Private Evidence Storage & Path Traversal Defense
Match screenshot evidence files are stored in a private backend directory:
- Uploads validate both file extension (`.png`, `.jpg`, `.jpeg`, `.webp`) and MIME magic bytes.
- Direct static file serving is disabled; files are accessed exclusively through an authenticated streaming endpoint `/api/v1/submissions/evidence/{filename}`.
- Filename parameters are sanitized and strictly validated against path traversal characters (`..`, `/`, `\`), null bytes, and verified for directory prefix containment via `os.path.abspath`.

---

## 🎮 Supported Titles & Rules

| Title | Publisher | Supported Modes | Standard Scoring Formula |
| :--- | :--- | :--- | :--- |
| **Free Fire MAX** | Garena | Squads (4 players), Duo, Solo | Official FFWS placement points (1st: 12, 2nd: 9, 3rd: 8, 4th: 7...) + 1 point per confirmed kill. |
| **BGMI** | Krafton | Squads (4 players), Solo | Official BGIS / BMPS esports scoring: 1st: 10 pts (WWCD), 2nd: 6 pts, 3rd: 5 pts, 4th: 4 pts, 5th: 3 pts, 6th: 2 pts, 7th: 1 pt + 1 point per kill. |
| **VALORANT** | Riot Games | 5v5 Custom Lobby + 1 Substitute | Round difference / match win scoring (10 pts per match victory + 1 pt per round won). |

---

## 🚀 Local Development Quickstart

### Prerequisites
- Python 3.11+ (Python 3.14 tested)
- Node.js 18+ & npm
- SQLite3 (included with Python)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations to initialize SQLite database
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API Base: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/api/v1/docs`
- ReDoc UI: `http://127.0.0.1:8000/api/v1/redoc`
- Health Endpoint: `http://127.0.0.1:8000/api/v1/health`

### 2. Frontend Setup

```bash
# Open a second terminal and navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

- Frontend App: `http://localhost:5173` (configured with Vite proxy redirecting `/api` requests to `http://127.0.0.1:8000`).

---

## 🗄️ Database Migrations (Alembic)

Database schema revisions are managed using Alembic. All migrations support SQLite locally and PostgreSQL in production:

```bash
cd backend
source .venv/bin/activate

# Apply all migrations to latest revision
alembic upgrade head

# View migration history
alembic history --verbose

# Roll back by 1 revision
alembic downgrade -1
```

### Migration History
- `ec6063b83113`: Add submissions, match results, notifications, reports, and audit logs.
- `a111174d38f2`: Add matches, match participants, and encrypted room credentials.
- `9cbc3b19030b`: Add tournaments and tournament participant tables.
- `e79ff010aed6`: Add users, player profiles, game accounts, teams, and team members.

---

## 🧪 Automated Testing Suite

The repository contains 108 automated tests verifying permissions, encryption, concurrency, scoring, and UI behavior.

### Run Backend Tests (100 Tests)

```bash
cd backend
source .venv/bin/activate

# Run all backend tests
pytest tests/ -v

# Run Phase 5 audit & security tests only
pytest tests/test_phase5.py -v

# Run with test coverage report
pytest --cov=app tests/
```

### Run Frontend Tests (8 Tests)

```bash
cd frontend

# Run Vitest test runner
npm run test

# Run production build check
npm run build
```

---

## 🌐 Production Deployment Guide

### 1. Environment Configuration

Create a production `.env` file in `backend/` with secure, dedicated credentials:

```ini
# Production Environment Flag
ENVIRONMENT=production
DEBUG=false
APP_NAME="GamerBrac Esports Platform"

# Dedicated Security Secrets (minimum 32 characters, never commit to git)
# Generate with: openssl rand -hex 32
SECRET_KEY=e83a79d0124f5a892b13c8812304918239014812390841239081239048123094
ROOM_ENCRYPTION_KEY=f91c7842e0123948123094812039481203948120394812309481230948123491

# Production PostgreSQL Database
DATABASE_URL=postgresql+psycopg2://gamerbrac_user:SecurePostgresPassword#2026@localhost:5432/gamerbrac_prod

# Allowed CORS Origins (Wildcard '*' is forbidden in production)
BACKEND_CORS_ORIGINS=["https://gamerbrac.com","https://www.gamerbrac.com","https://app.gamerbrac.com"]

# Rate Limiting
RATE_LIMIT_ENABLED=true
```

### 2. PostgreSQL Setup

```bash
# Install PostgreSQL server
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE gamerbrac_prod;
CREATE USER gamerbrac_user WITH ENCRYPTED PASSWORD 'SecurePostgresPassword#2026';
GRANT ALL PRIVILEGES ON DATABASE gamerbrac_prod TO gamerbrac_user;
\q

# Run Alembic migrations against PostgreSQL
DATABASE_URL="postgresql+psycopg2://gamerbrac_user:SecurePostgresPassword#2026@localhost:5432/gamerbrac_prod" alembic upgrade head
```

### 3. Systemd Service (`/etc/systemd/system/gamerbrac.service`)

```ini
[Unit]
Description=GamerBrac FastAPI Application
After=network.target postgresql.service

[Service]
User=gamerbrac
Group=gamerbrac
WorkingDirectory=/var/www/gamerbrac/backend
EnvironmentFile=/var/www/gamerbrac/backend/.env
ExecStart=/var/www/gamerbrac/backend/.venv/bin/uvicorn app.main:app --workers 4 --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable gamerbrac
sudo systemctl start gamerbrac
```

### 4. Nginx Reverse Proxy & SSL Configuration

```nginx
server {
    listen 80;
    server_name gamerbrac.com www.gamerbrac.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gamerbrac.com www.gamerbrac.com;

    ssl_certificate /etc/letsencrypt/live/gamerbrac.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gamerbrac.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend Static SPA
    root /var/www/gamerbrac/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

---

## ⚠️ Unresolved Risks & Publisher Compliance Report

This platform audit identifies key external dependencies, legal frameworks, and operational constraints that must be observed prior to commercial expansion.

### 1. Publisher API Access & Custom Room Automation
- **Krafton (BGMI)**:
  - BGMI does **not** provide a public, self-serve developer API for automated custom lobby creation or live in-game kill/placement data scraping.
  - *Current Operational Workflow*: Tournament organizers must manually create custom rooms in the official BGMI client, paste the Room ID and Password into GamerBrac, and let the platform manage encrypted, time-locked dispatch to checked-in players.
  - *Future Pathway*: High-tier organizers must apply for the official Krafton India Esports Partner Program to receive custom room cards and potential webhook integrations.
- **Garena (Free Fire MAX)**:
  - Custom lobby cards must be acquired in-game via diamonds or guild activity. Third-party automation or bot-driven room creation violates Garena's Terms of Service and anti-cheat policies.
  - *Operational Safeguard*: GamerBrac operates strictly out-of-band as a coordination layer. Manual screenshot proof review prevents account bans associated with memory scrapers.
- **Riot Games (VALORANT)**:
  - Riot requires registration on the Riot Developer Portal for tournament management tools. While VALORANT Tournament API exists for approved tournament partners (e.g., VCT/Challengers), community tournaments must adhere to the *Riot Games Community Tournament Guidelines* (no fee collection without license, limits on total prize values).

### 2. Indian State Gaming Law Compliance
GamerBrac was intentionally designed with **0% paid entry fees and 0% cash payouts**:
- Under the Public Gambling Act, 1867 and respective State Gaming Legislations, games of skill are protected under Article 19(1)(g) of the Constitution of India. However, states including **Telangana**, **Andhra Pradesh**, **Assam**, **Odisha**, and **Nagaland** enforce specific licensing requirements or prohibitions on real-money gaming (RMG) stakes.
- By strictly restricting GamerBrac to **Free-Entry Community Tournaments**:
  1. The platform is **completely exempt** from gambling, betting, and prize competition licensing restrictions.
  2. No 28% Goods & Services Tax (GST) on online real-money deposits is applicable.
  3. No banking or financial KYC (PAN/Aadhaar) liabilities are incurred for cash handling.
- **Strict Compliance Directive**: Do **not** implement entry fees, cash wallets, or coin wagering mechanisms on GamerBrac without dedicated state-by-state legal counsel and appropriate corporate licensing.

### 3. Anti-Smurfing & In-Game Verification
- In-game UIDs are manually submitted by players and verified by organizers during screenshot review.
- While the database enforces that a UID cannot be linked to multiple GamerBrac player accounts simultaneously, players can technically register alternative game UIDs (smurfs).
- Organizers should require minimum in-game account levels (e.g., Level 25+ in BGMI, Level 20+ in VALORANT) in tournament descriptions to mitigate smurfing.

---

## 📄 License & Publisher Disclaimer

GamerBrac is an independent esports tournament management platform. **Free Fire MAX** is a registered trademark of Garena International. **BGMI (Battlegrounds Mobile India)** is a registered trademark of Krafton, Inc. **VALORANT** is a registered trademark of Riot Games, Inc. GamerBrac is not endorsed, certified, or directly affiliated with Garena, Krafton, or Riot Games.
