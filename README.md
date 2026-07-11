# 🍺 BarLink — Real-time Bar Queue & Live Demographics Platform

## Architecture

```
barlink/
├── docker-compose.yml       # PostgreSQL + Redis + Redis Commander
├── backend/                 # NestJS + TypeScript API
│   ├── prisma/
│   │   ├── schema.prisma    # Full DB schema
│   │   └── seed.ts          # Seed data (2 bars, 3 users)
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/          # PrismaService (global)
│       ├── redis/           # RedisService (global) + Sorted Set helpers
│       ├── auth/            # JWT auth, login, register
│       ├── users/           # User CRUD
│       ├── bars/            # Bar listing, demographics, velocity
│       ├── queue/           # Queue join, admit, away, exit, GPS ping
│       ├── workers/         # BullMQ workers: eviction + away-monitor
│       └── gateway/         # Socket.IO WebSocket gateway
└── frontend/                # Expo (React Native) — runs on web too
    ├── app/
    │   ├── _layout.tsx
    │   ├── index.tsx        # Landing / role-based redirect
    │   ├── (auth)/          # login.tsx, register.tsx
    │   ├── (patron)/        # explore, bar/[id], queue/[barId], wait/[entryId]
    │   └── (staff)/         # door.tsx, dashboard.tsx
    ├── lib/
    │   ├── api.ts           # Axios client (all endpoints)
    │   └── socket.ts        # Socket.IO client + helpers
    └── store/
        └── authStore.ts     # Zustand auth state
```

## Quick Start

### 1. Boot databases

```bash
docker compose up -d
```

Services:
- **PostgreSQL** → `localhost:5432`
- **Redis** → `localhost:6379`
- **Redis Commander UI** → `http://localhost:8081`

### 2. Backend

```bash
cd backend
npm install
npm run db:generate       # Generate Prisma client
npm run db:push           # Push schema to DB (dev)
npm run db:seed           # Seed test bars + users
npm run dev               # Start dev server on :3000
```

### 3. Frontend (web sandbox)

```bash
cd frontend
npm install
npm run web               # Opens at http://localhost:8081 (or 19006)
```

## Test Credentials

| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Patron  | patron@barlink.com     | password123  |
| Staff   | staff@barlink.com      | password123  |
| Admin   | admin@barlink.com      | password123  |

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| GET | `/api/bars` | List all active bars |
| GET | `/api/bars/:id` | Bar detail + live queue info |
| POST | `/api/queue/:barId/join` | Join queue (partySize in body) |
| GET | `/api/queue/:barId/state` | Full queue state from Redis |
| POST | `/api/queue/:barId/admit` | Staff: admit patron by QR |
| PATCH | `/api/queue/:entryId/away` | Mark patron as temporarily away |
| PATCH | `/api/queue/:entryId/exit` | Exit bar |
| PATCH | `/api/queue/:entryId/override` | Bouncer override (reinstate/evict) |
| PATCH | `/api/queue/:entryId/gps` | GPS ping (lat/lon) |

## WebSocket Events

Connect to `ws://localhost:3000`

| Emit | Payload | Effect |
|------|---------|--------|
| `join-bar-room` | `{ barId }` | Subscribe to bar updates |
| `subscribe-entry` | `{ entryId }` | Subscribe to personal entry updates |

| Listen | When fired |
|--------|-----------|
| `queue-update` | Queue order changes |
| `capacity-update` | Patron admitted/exited |
| `position-update` | Your position changed |
| `eviction-warning` | You're #5 in line (20-min timer starts) |
| `away-comeback` | 15-min grace elapsed ("Coming back?") |

## BullMQ Workers

- **Eviction Worker** (`eviction` queue): Fires 20 minutes after patron reaches position #5. Auto-exits if no scan.
- **Away Monitor Worker** (`away-monitor` queue):
  - Stage 1 (t+15m): Push notification prompt
  - Stage 2 (t+20m): Final warning
  - Stage 3 (t+30m): Auto-exit, capacity released

## Environment Variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://barlink:barlink_secret@localhost:5432/barlink_db
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=barlink_redis_secret
JWT_SECRET=barlink_super_secret_jwt_key_change_in_production
JWT_EXPIRY=7d
PORT=3000
```

**Frontend** (`frontend/.env`):
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_WS_URL=http://localhost:3000
```
