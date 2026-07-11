# API Contract — Nigerian Banking API

**Base URL (production):** `https://nigerian-banking-api-production.up.railway.app`

This document exists because the API has a known naming inconsistency between
request and response bodies (see **Known Inconsistency** at the bottom). Until
that's fixed, this file is the single source of truth for exact field names —
do not guess shapes when writing frontend or client code. Verify against this
file or Postman first.

All responses follow a consistent envelope:

```json
{
  "success": true | false,
  "message": "human-readable summary",
  "data": { ... } | [ ... ],   // present on success
  "error": "specific reason"    // present on failure, in ADDITION to message
}
```

**Important:** on failure responses, `message` is often a generic category
(e.g. `"Validation failed"`) while `error` holds the specific, user-facing
reason (e.g. `"password must be at least 8 characters"`). Client code should
display `error` to the user, not `message`, on failure paths. This bit us
repeatedly during frontend integration.

---

## Auth

### `POST /api/auth/register`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "minimum8characters",
  "fullName": "John Doe"
}
```
Note: `fullName` is camelCase in the request.

**Success — 201:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "created_at": "ISO timestamp"
    },
    "token": "jwt string"
  }
}
```
Note: `full_name` is snake_case in the response (straight from the `users` table).

**Failure:**
- `400` — missing fields, or password under 8 characters → `error` holds the specific reason
- `409` — email already registered
- `500` — unexpected server error

---

### `POST /api/auth/login`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "..."
}
```

**Success — 200:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "...",
      "full_name": "...",
      "created_at": "ISO timestamp"
    },
    "token": "jwt string"
  }
}
```

**Failure:**
- `401` — invalid email or password (message: `"Invalid email or password"` — deliberately vague, doesn't reveal which field was wrong)
- `500` — unexpected server error

JWT expires in 24 hours. No refresh token mechanism currently exists — client must re-login on expiry.

---

## Accounts

All account routes require header: `Authorization: Bearer <token>`

### `POST /api/accounts`

**Request body:**
```json
{
  "accountName": "Savings"
}
```
Note: `accountName` is camelCase in the request.

**Success — 201:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "uuid",
    "account_number": "10-digit string",
    "account_name": "Savings",
    "balance": "0.00",
    "user_id": "uuid",
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp"
  }
}
```
Note: `account_name`, `account_number`, `user_id` are snake_case in the response — same field that was `accountName` going in comes back as `account_name`.

`balance` is returned as a **string**, not a number, to avoid floating-point precision loss on currency. Parse with `parseFloat()` before doing math, but never round-trip a parsed float back to the server — send raw user input as a number only where the API explicitly expects `amount`.

**Failure:**
- `400` — `accountName` missing or not a string
- `500` — unexpected server error

---

### `GET /api/accounts`

No request body.

**Success — 200:**
```json
{
  "success": true,
  "message": "Accounts retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "account_number": "...",
      "account_name": "...",
      "balance": "...",
      "user_id": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```
**Important:** `data` is the array directly. It is NOT nested under `data.accounts`.

Only returns accounts belonging to the authenticated user (`user_id` scoped at the SQL layer).

---

### `GET /api/accounts/:id`

No request body.

**Success — 200:**
```json
{
  "success": true,
  "message": "Account retrieved successfully",
  "data": {
    "id": "uuid",
    "account_number": "...",
    "account_name": "...",
    "balance": "...",
    "user_id": "...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```
**Important:** `data` is the account object directly. It is NOT nested under `data.account`.

Cached in Redis on read; cache is invalidated on every transaction against this account. Ownership is re-verified even on cache hits.

**Failure:**
- `404` — account not found, **including when the account exists but belongs to a different user** (deliberate — see Security Notes below)

---

### `POST /api/accounts/:id/transaction`

**Headers:**
- `Idempotency-Key` (optional, recommended) — any client-generated string
  (e.g. a UUID) unique per intended transaction. If a request with the same
  key on the same account is retried (network timeout, double-click, etc.),
  the API returns the original transaction instead of applying the
  debit/credit a second time. Omitting it is allowed but means retries are
  **not** safe — a retried request without a key will be treated as a new,
  separate transaction.

**Request body:**
```json
{
  "type": "credit",
  "amount": 5000.50,
  "description": "optional string"
}
```
- `type` must be exactly `"credit"` or `"debit"` — NOT `"deposit"`/`"withdrawal"`.
- `amount` must be a positive number with at most 2 decimal places (not a string — send a real JSON number). `10.999` is rejected; `10.99` is not.
- `description` is optional.

**Success — 200:**
```json
{
  "success": true,
  "message": "Transaction processed successfully",
  "data": {
    "account": {
      "id": "...",
      "account_number": "...",
      "account_name": "...",
      "balance": "...",
      "user_id": "...",
      "created_at": "...",
      "updated_at": "..."
    },
    "transaction": {
      "id": "...",
      "account_id": "...",
      "type": "...",
      "amount": "...",
      "balance_before": "...",
      "balance_after": "...",
      "description": "...",
      "created_at": "..."
    }
  }
}
```
**Important:** the updated balance lives at `data.account.balance`, NOT at a top-level `newBalance` field. There is no separate `newBalance` key — verify before assuming.

If the request is a replay of a previous `Idempotency-Key` on this account, the response is still `200` with `success: true`, but `message` is `"Transaction already processed (idempotent replay)"` and `data` reflects the *original* transaction, not a new one.

**Failure:**
- `400` — missing `type`/`amount`, invalid `type` value, non-positive or over-precision `amount`, or **insufficient funds** (the specific reason is in `error`, e.g. `"Insufficient funds"` — display `error`, not the generic `message`)
- `404` — account not found / not owned by user
- `409` — the same `Idempotency-Key` was reused on this account for what the server considers a distinct, concurrent request (rare defense-in-depth case; a clean retry with the same key normally returns 200, not 409)
- `500` — unexpected server error

Row-locked via `SELECT ... FOR UPDATE` inside a transaction to prevent race conditions on concurrent requests against the same account. The same row lock backs the idempotency check, so a retried request on the same account is serialized behind the original rather than racing it. Publishes a `TRANSACTION_COMPLETED` Kafka event after COMMIT (non-fatal if Kafka is unavailable) — skipped on idempotent replays since nothing new happened.

---

### `GET /api/accounts/:id/transactions`

No request body.

**Success — 200:**
```json
{
  "success": true,
  "message": "Transaction history retrieved successfully",
  "data": [
    {
      "id": "...",
      "account_id": "...",
      "type": "...",
      "amount": "...",
      "balance_before": "...",
      "balance_after": "...",
      "description": "...",
      "created_at": "..."
    }
  ]
}
```
**Important:** `data` is the array directly. It is NOT nested under `data.transactions`.

---

## Known Inconsistency: camelCase in, snake_case out

**The problem:** every request body in this API uses camelCase (`fullName`,
`accountName`) because that's idiomatic JavaScript/JSON. Every response body
returns snake_case (`full_name`, `account_name`, `account_number`, `user_id`)
because those are the literal PostgreSQL column names, returned with zero
serialization layer in between.

**Why this exists:** this is NOT a deliberate API design choice. It's the
natural result of writing the SQL layer with database-convention names and
the Express validation layer with JS-convention names, without a DTO mapper
or ORM (e.g. Prisma, TypeORM) to translate between them at the boundary.

**Why it wasn't fixed:** discovered during frontend integration, after the
backend was already complete across all 9 phases and deployed to production.
Fixing it now means adding a serialization step to every controller/service
response — a real refactor, not a one-line patch. Prioritized finishing the
frontend first; this document exists so the inconsistency is explicit and
defensible rather than silently confusing.

**How I'd fix it properly:** add a thin DTO/serializer function at the
service layer boundary that converts outgoing snake_case keys to camelCase
before the controller sends the response — OR adopt an ORM that does this
automatically. Either way, the fix belongs at one chokepoint, not scattered
across every controller.

**What this means for any client code:** always check this document (or
Postman) for the actual field name on each side of the wire. Do not assume
symmetry between what you send and what you get back.

---

## Security Notes

- **IDOR prevention:** every account/transaction query is scoped with
  `AND user_id = $N` at the SQL layer, not just checked in application code.
  A user requesting another user's account ID gets `404 Not Found`, not
  `403 Forbidden` — this is deliberate. A `403` would confirm the account
  exists but isn't yours, enabling account-ID enumeration. `404` makes
  "doesn't exist" and "exists but isn't yours" indistinguishable from the
  outside.
- **Rate limiting:** general routes are capped at 100 requests / 15 min;
  `/api/auth/*` routes are capped at 10 requests / 15 min specifically to
  blunt credential-stuffing and brute-force attempts.
- **JWT:** 24-hour expiry, no refresh token. On expiry, any protected
  endpoint returns `401`. Client code should treat any `401` as "log the
  user out and redirect to `/login`," not as a retryable error.