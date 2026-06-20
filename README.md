# Chirpy — HTTP Server API

A Twitter-like microblogging REST API built with **Express 5** and **TypeScript**. Users can register, authenticate with JWT access tokens (and long-lived refresh tokens), and post short messages called *chirps*. It includes argon2 password hashing, a PostgreSQL database managed with Drizzle ORM, a third-party payment webhook, dev-only admin tooling, and interactive Swagger API docs.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?logo=postgresql&logoColor=white)

## Features

- **User accounts** — register, log in, update credentials.
- **JWT authentication** — short-lived access tokens (~1h) plus refresh tokens (~60 days) that can be refreshed and revoked.
- **Secure password storage** — passwords hashed with [argon2](https://github.com/ranisalt/node-argon2); hashes are never returned by the API.
- **Chirps** — create (max 140 chars, with profanity filtering), list (filter by author, sort by date), fetch, and delete (author-only).
- **Webhooks** — a Polka payment webhook (API-key protected) upgrades users to "Chirpy Red".
- **Admin tooling** — a metrics page and a dev-only reset endpoint.
- **Interactive API docs** — Swagger UI served at `/docs`.
- **Type-safe data layer** — PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/) and versioned migrations.
- **Unit tests** — auth/JWT helpers tested with [Vitest](https://vitest.dev/).

## Tech stack

| Layer        | Technology                                |
| ------------ | ----------------------------------------- |
| Runtime      | Node.js 22 (ESM)                          |
| Language     | TypeScript                                |
| Web framework| Express 5                                 |
| Database     | PostgreSQL                                |
| ORM / migrations | Drizzle ORM + drizzle-kit             |
| Auth         | jsonwebtoken (JWT) + argon2               |
| API docs     | swagger-ui-express (OpenAPI 3.0)          |
| Testing      | Vitest                                    |

## Project structure

```
src/
├── index.ts              # App entry: Express setup, routes, handlers, error middleware
├── auth.ts               # Password hashing, JWT, token & API-key helpers
├── auth.test.ts          # Vitest unit tests for auth helpers
├── config.ts             # Loads & validates environment variables
├── swagger.ts            # OpenAPI 3.0 spec served at /docs
├── app/                  # Static assets served at /app
└── db/
    ├── index.ts          # Drizzle/postgres connection
    ├── schema.ts         # users, chirps, refresh_tokens tables
    ├── migrations/       # Generated SQL migrations
    └── queries/          # users / chirps / refreshTokens query functions
drizzle.config.ts         # drizzle-kit configuration
```

## Prerequisites

- **Node.js 22.14.0** (see [.nvmrc](.nvmrc) — run `nvm use`)
- **PostgreSQL** running and reachable
- npm

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

```bash
createdb chirpy   # or: psql -c "CREATE DATABASE chirpy;"
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
DB_URL="postgres://postgres:postgres@localhost:5432/chirpy?sslmode=disable"
PLATFORM="dev"
SECRET="replace-with-a-long-random-secret"
POLKA_KEY="replace-with-your-polka-api-key"
```

| Variable    | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `DB_URL`    | PostgreSQL connection string.                                               |
| `PLATFORM`  | Set to `dev` to enable the admin reset endpoint; anything else disables it. |
| `SECRET`    | Secret used to sign and verify JWTs. Use a long random value.               |
| `POLKA_KEY` | API key the Polka webhook must present in the `Authorization` header.       |

> The app reads and validates these at startup via [src/config.ts](src/config.ts) and throws if any are missing. `.env` is gitignored — never commit real secrets.

### 4. Run database migrations

Migrations run automatically when the server boots, but you can apply them manually:

```bash
npm run migrate    # apply pending migrations
npm run generate   # generate a new migration after editing src/db/schema.ts
npm run studio     # open Drizzle Studio to browse data
```

### 5. Start the server

```bash
npm run dev        # compile (tsc) and run
# or
npm run build && npm start
```

The server listens on **http://localhost:8080**.

## API documentation

Interactive Swagger UI is available at **http://localhost:8080/docs** once the server is running. Use it to explore and test every endpoint:

1. **POST `/api/users`** — create an account with `{ "email", "password" }`.
2. **POST `/api/login`** — log in with the same credentials and copy the returned `token`.
3. Click **Authorize** in Swagger UI and paste the token to call protected endpoints.

> Note: the only way to get valid login credentials is to create a user first — passwords are stored as argon2 hashes and cannot be set directly in the database.

## Endpoints

| Method | Path                      | Auth        | Description                                            |
| ------ | ------------------------- | ----------- | ------------------------------------------------------ |
| GET    | `/api/healthz`            | —           | Readiness check (returns `OK`).                        |
| POST   | `/api/users`              | —           | Create a user.                                         |
| GET    | `/api/users`              | —           | List all users.                                        |
| PUT    | `/api/users`              | Bearer JWT  | Update the authenticated user's email/password.        |
| POST   | `/api/login`              | —           | Log in; returns user, access token and refresh token.  |
| POST   | `/api/refresh`            | Bearer (refresh token) | Issue a new access token.                   |
| POST   | `/api/revoke`             | Bearer (refresh token) | Revoke a refresh token.                     |
| POST   | `/api/chirps`             | Bearer JWT  | Create a chirp (max 140 chars, profanity filtered).    |
| GET    | `/api/chirps`             | —           | List chirps. Query: `authorId`, `sort=asc\|desc`.      |
| GET    | `/api/chirps/:id`         | —           | Get a single chirp by id.                              |
| DELETE | `/api/chirps/:chirpId`    | Bearer JWT  | Delete a chirp (author only).                          |
| POST   | `/api/polka/webhooks`     | API key     | Polka webhook; upgrades a user to Chirpy Red.          |
| GET    | `/admin/metrics`          | —           | HTML page showing fileserver hit count.                |
| POST   | `/admin/reset`            | — (dev only)| Reset metrics and delete all users.                    |
| GET    | `/docs`                   | —           | Swagger UI.                                            |
| —      | `/app`                    | —           | Static file server.                                    |

### Authentication

- **Access tokens** are JWTs signed with `SECRET`, issued by `POST /api/login`, and sent as `Authorization: Bearer <token>`.
- **Refresh tokens** are opaque random strings stored in the database. Send the refresh token as the bearer value to `POST /api/refresh` (new access token) or `POST /api/revoke` (invalidate it).
- The **Polka webhook** uses an API key sent as `Authorization: ApiKey <POLKA_KEY>`.

## Database schema

Three tables (see [src/db/schema.ts](src/db/schema.ts)):

- **users** — `id`, `email` (unique), `hashed_password`, `is_chirpy_red`, timestamps.
- **chirps** — `id`, `body` (≤140 chars), `user_id` (FK → users, cascade delete), timestamps.
- **refresh_tokens** — `token` (PK), `user_id` (FK → users), `expires_at`, `revoked_at`, timestamps.

## Testing

```bash
npm test
```

Runs the Vitest suite in [src/auth.test.ts](src/auth.test.ts), covering password hashing/verification, JWT creation and validation, and bearer-token extraction.

## Available scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Compile and run the server.                  |
| `npm run build`     | Compile TypeScript to `dist/`.               |
| `npm start`         | Run the compiled server (`dist/index.js`).   |
| `npm test`          | Run the Vitest test suite.                   |
| `npm run generate`  | Generate a new Drizzle migration.            |
| `npm run migrate`   | Apply pending migrations.                    |
| `npm run studio`    | Open Drizzle Studio.                         |

## License

ISC
