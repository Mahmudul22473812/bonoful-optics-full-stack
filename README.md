# Bonoful Optics

Full-stack storefront and inventory management for a local optical shop, built with TypeScript, React, a Next.js-compatible Vinext frontend, NestJS, PostgreSQL, and Prisma.

> Development preview. This repository is not yet a production-ready release. Sample products and inventory are for demonstration.

## Features

- Product browsing, search, filters, wishlist, reviews and shopping cart.
- Colour/size variants with independent prices and stock.
- Colour swatches and colour-assigned product photos, plus a centered image zoom viewer.
- Customer accounts, addresses, private prescriptions and order tracking.
- Persistent customer/admin navigation, responsive layouts and accessible controls.
- Staff permission filtering and server-side authorization.
- Product/category/brand management, stock movements, suppliers and purchase receiving.
- Cash-on-delivery order workflow, stock reservations, cancellation and refund handling.

## Technology

| Layer | Stack |
| --- | --- |
| Frontend | React 19, Next.js 16-compatible routing, Vinext/Vite, TypeScript |
| API | NestJS 11, REST, OpenAPI |
| Database | PostgreSQL, Prisma 6 |
| Security | Argon2id, server-side cookie sessions, CSRF/origin checks, encrypted private files |
| Tests | Vitest/Testing Library and Node test runner |

## Getting started

Requirements: Node.js 22.13+ and a running PostgreSQL database.

### 1. Install dependencies

```sh
git clone https://github.com/Mahmudul22473812/bonoful-optics-full-stack.git
cd bonoful-optics-full-stack
npm ci
npm --prefix backend ci
```

### 2. Configure environment

Copy the root `.env.example` to `.env.local` and `backend/.env.example` to `backend/.env`.

Set `DATABASE_URL`, `WEB_ORIGIN`, and a random `DATA_KEY` (32 bytes expressed as 64 hexadecimal characters). Supply strong development seed passwords if using sample data. Set `API_URL` in the frontend environment to the reachable backend origin.

Generate an encryption key locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the key private and backed up. Changing or losing it prevents decryption of existing private records. Never commit environment files or production credentials.

### 3. Prepare the database

```sh
cd backend
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seed only a development database. Do not reseed existing store data.

### 4. Start both applications

In the backend directory:

```sh
npm run dev
```

In another terminal, from the repository root:

```sh
npm run dev -- --port 3000
```

- Storefront: http://localhost:3000
- Customer account: http://localhost:3000/account
- Administration: http://localhost:3000/admin
- API documentation: http://localhost:4000/api/docs

Use the accounts configured through the seed environment variables. No working passwords are included in this repository.

## Product colours and images

In the product editor, add a variant for each colour/size combination. Each variant has its own SKU, price and stock. New variants require a stock receipt or adjustment.

Upload photos and use **Photo colour** to assign each image. Selecting a colour on a card or product page displays matching photos. Unassigned images act as general fallbacks; photos for a different colour are not used as fallbacks. Upload real colour-specific images for an accurate demonstration.

## Checks and builds

```sh
npm run typecheck
npm test
npm run build
npm --prefix backend run build
npm --prefix backend test
```

The frontend build produces `dist/standalone/server.js`. Start it with `node dist/standalone/server.js`; start the API with `npm start` from `backend`.

Tests cover product cards, persistent account navigation, grouped admin navigation, colour-photo selection, totals, encryption and upload validation. Full isolated-database integration and checkout end-to-end coverage remain pending.

## Repository structure

```text
app/                  Routes and styles
components/           Storefront, account and admin UI
lib/                  API clients and shared frontend helpers
backend/src/          NestJS application
backend/prisma/       Schema, migrations and development seed
backend/tests/        Backend unit tests
tests/                Frontend component/helper tests
public/               Static demo assets
docs/                 Architecture and image credits
```

## Security and production checklist

Implemented: hashed passwords, hashed session tokens stored in PostgreSQL, HttpOnly/SameSite cookies, Secure cookies in production, CSRF checks for protected mutations, origin validation, backend permissions, encrypted prescription data, bounded image decoding and transactional stock operations.

Before a public launch:

- Validate checkout, concurrent stock reservations, cancellation/refunds and permissions end to end.
- Review session inactivity policy, expired-record cleanup and trusted-proxy rate limiting.
- Finish catalog/inventory query scaling and audit remaining permission boundaries.
- Replace sample products, stock, photos and draft policies with verified business content.
- Configure HTTPS, transactional email, production secrets and persistent private-file storage.
- Back up PostgreSQL, uploaded files and encryption keys; test restoration.
- Configure monitoring, health checks and a reviewed deployment pipeline.

The separate NestJS API and PostgreSQL database must be hosted where the frontend can reach them. Localhost configuration is not a production deployment. Existing Sites tooling does not deploy the separate backend automatically.

## Assets and documentation

See [architecture](docs/ARCHITECTURE.md) and [image credits](docs/IMAGE_CREDITS.json). Demo assets do not establish actual product availability or stock. No license is granted beyond any applicable third-party asset terms unless the owner adds a project license.
