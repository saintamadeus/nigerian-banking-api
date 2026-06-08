# Nigerian Banking API

![CI](https://github.com/saintamadeus/nigerian-banking-api/actions/workflows/ci.yml/badge.svg)

A production-grade RESTful banking API built with Node.js, TypeScript, Express, PostgreSQL, and Redis. Built to demonstrate backend engineering competency for roles in Nigerian banking and fintech.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** PostgreSQL (ACID transactions, row-level locking)
- **Cache:** Redis (account balance caching with TTL and invalidation)
- **Auth:** JWT + bcrypt
- **Security:** Helmet, rate limiting, IDOR protection

## Features

- User registration and login with bcrypt password hashing
- JWT authentication with 24h expiry
- Create and manage bank accounts
- Credit and debit transactions with ACID guarantees
- Transaction history per account
- Redis caching on account reads with automatic cache invalidation on balance change
- IDOR protection — every query scoped to authenticated user
- Rate limiting: 100 req/15min general, 10 req/15min on auth routes
- Security headers via Helmet
- Request logging via Morgan
- Fail-fast startup on missing environment variables

## Testing

- 11 integration tests across auth and account flows
- Jest + Supertest
- Isolated test database (`nigeria_banking_test_db`)
- Redis mocked — tests never depend on cache infrastructure

```bash
npm test
```

## Project Structure
src/
config/         # Database pool, JWT helpers, Redis client
controllers/    # Route handlers
middleware/     # Auth, error handler, request logger
routes/         # Express routers
services/       # Business logic and DB queries
types/          # TypeScript interfaces

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| POST | /api/auth/register | No | Register user |
| POST | /api/auth/login | No | Login |
| GET | /api/accounts | Yes | List all user accounts |
| POST | /api/accounts | Yes | Create account |
| GET | /api/accounts/:id | Yes | Get account (Redis cached) |
| POST | /api/accounts/:id/transaction | Yes | Credit or debit |
| GET | /api/accounts/:id/transactions | Yes | Transaction history |

## Setup
### With Docker (recommended)

```bash
docker-compose up --build
```

### Manual setup
1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Start PostgreSQL and create the database
5. Start Redis (Docker): `docker run -d --name redis-banking -p 6379:6379 redis:7-alpine`
6. Run the server: `npm run dev`

## Environment Variables

See `.env.example` for required variables.

## Security Design Decisions

- Passwords never stored in plain text — bcrypt with 12 salt rounds
- JWTs signed with secret from environment, never hardcoded
- All account endpoints enforce ownership via `AND user_id = $2` in SQL — authorization at the database level, not application level
- Cache ownership re-verified on every Redis read
- Server refuses to start if `DB_PASSWORD` or `JWT_SECRET` are missing