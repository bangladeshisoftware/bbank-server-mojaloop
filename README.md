# B Bank — Mojaloop DFSP

A production-grade **Digital Financial Service Provider (DFSP)** backend built on the [Mojaloop](https://mojaloop.io/) open-source real-time payment framework. B Bank acts as a participant FSP within a Mojaloop switch, handling merchant onboarding, party lookups, quote negotiation, and transfer execution — with full callback handling for both payer and payee flows.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Mojaloop Flow — End to End](#mojaloop-flow--end-to-end)
  - [Phase 1 — Party Discovery](#phase-1--party-discovery)
  - [Phase 2 — Quote Negotiation](#phase-2--quote-negotiation)
  - [Phase 3 — Transfer Execution](#phase-3--transfer-execution)
- [Payer Side (SEND) State Machine](#payer-side-send-state-machine)
- [Payee Side (RECV) State Machine](#payee-side-recv-state-machine)
- [API Reference](#api-reference)
  - [Internal / Portal APIs](#internal--portal-apis)
  - [Mojaloop Callback Endpoints](#mojaloop-callback-endpoints)
- [Merchant Management](#merchant-management)
- [Balance & Ledger](#balance--ledger)
- [ILP Packet & Condition Generation](#ilp-packet--condition-generation)
- [Email Notifications](#email-notifications)
- [WebSocket Events](#websocket-events)
- [Database Schema Overview](#database-schema-overview)
- [Transaction Types](#transaction-types)
- [Error Handling](#error-handling)
- [Security](#security)

---

## Overview

B Bank implements the **Mojaloop FSPIOP API** to participate in an interoperable instant payment network. It exposes:

- **Inbound Mojaloop callbacks** — received from the Mojaloop Hub (ALS, Quote Service, ML API Adapter)
- **Outbound portal APIs** — used by the React frontend to initiate transfers, manage merchants, and view dashboards
- **Real-time WebSocket events** — pushed to connected clients after every callback stage

The system supports multiple payment rails: `P2P`, `INSTANT`, `BULK`, `NPSB`, `RTGS`, and `BEFTN`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    B Bank DFSP Server                    │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐  ┌─────────────┐  │
│  │  Portal API  │   │  Mojaloop    │  │  WebSocket  │  │
│  │  (Express)   │   │  Callbacks   │  │  (Socket.IO)│  │
│  └──────┬───────┘   └──────┬───────┘  └──────┬──────┘  │
│         │                  │                  │         │
│         └──────────────────▼──────────────────┘         │
│                     Core Business Logic                  │
│         ┌────────────┬─────────────┬──────────────┐     │
│         │  send_S*   │  recv_R*    │  Balance      │     │
│         │  (Payer)   │  (Payee)    │  Controller   │     │
│         └────────────┴─────────────┴──────────────┘     │
│                          │                              │
│                     MySQL Database                       │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  Mojaloop Hub                    React Frontend
  (ALS / Quote /                  (Admin Portal)
   ML API Adapter)
```

---

## Tech Stack

| Layer       | Technology                                |
| ----------- | ----------------------------------------- |
| Runtime     | Node.js                                   |
| Framework   | Express.js                                |
| Real-time   | Socket.IO                                 |
| Database    | MySQL                                     |
| Auth        | JWT (jsonwebtoken) + bcryptjs             |
| HTTP Client | Axios + native Fetch                      |
| Email       | Nodemailer (SMTP)                         |
| Protocol    | Mojaloop FSPIOP API v1.0 / v2.0           |
| Crypto      | Node.js `crypto` (SHA-256 ILP conditions) |

---

## Environment Setup

Copy `.env.example` to `.env` and fill in all values:

```dotenv
# ── Database ──────────────────────────────────────────────
HOST=localhost
USER=root
PASSWORD=your_db_password
PORT=5004
DATABASE=moja_dfsp_2

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=365d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=365d

# ── Mojaloop Core Services ────────────────────────────────
ALS_ADMIN_SERVICE=https://your-als-admin-domain.com
ALS_SERVICE=https://your-als-domain.com
CENTRAL_LEDGER=https://your-ledger-domain.com
ML_API_ADAPTER=https://your-ml-api-adapter-domain.com
QUOTE_SERVICE=https://your-quoting-service-domain.com
SETTLEMENT=https://your-settlement-domain.com

# ── App ───────────────────────────────────────────────────
NODE_ENV=development
SERVER_URL=https://your-server-url.com
PORT=5002

# ── SMTP ──────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_USER=noreply@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@example.com

# ── FSP Identity ──────────────────────────────────────────
fspId=SELFFSPID          # This DFSP's FSP ID registered in Mojaloop
fspDes=DESTFSPID         # Default destination FSP ID
currency=BDT             # Default currency
```

> **Note:** `fspId` must match the FSP ID registered with the Mojaloop Hub's Account Lookup Service (ALS).

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/bangladeshisoftware/bbank-server-mojaloop.git
cd b-bank-dfsp

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Run database migrations (if applicable)
# mysql -u root -p moja_dfsp_2 < schema.sql

# 5. Start the server
npm start

# Development with hot reload
npm run dev
```

The server starts on `PORT` (default `5002`). WebSocket listens on the same port.

---

## Mojaloop Flow — End to End

B Bank implements the full three-phase Mojaloop FSPIOP flow:

```
Payer DFSP (B Bank)          Mojaloop Hub              Payee DFSP
      │                           │                         │
      │──── GET /parties ────────►│──── GET /parties ──────►│
      │◄─── PUT /parties ─────────│◄─── PUT /parties ───────│
      │                           │                         │
      │──── POST /quotes ────────►│──── POST /quotes ──────►│
      │◄─── PUT /quotes ──────────│◄─── PUT /quotes ────────│
      │                           │                         │
      │──── POST /transfers ─────►│──── POST /transfers ───►│
      │◄─── PUT /transfers ───────│◄─── PUT /transfers ──────│
      │                           │                         │
```

### Phase 1 — Party Discovery

**Purpose:** Resolve which FSP owns the payee's identifier (MSISDN, account number, etc.)

**Payer-side trigger (Portal API):**

```
GET /api/oracle-verify/:id_type/:id_value
GET /api/verify-parties/:receiver_dfsp/:id/:number
```

**B Bank acting as Payee DFSP (inbound):**

```
GET /parties/:partyIdType/:partyIdentifier
```

B Bank queries its `merchant` table. If the merchant is active, it sends a `PUT /parties` callback to the ALS with the merchant's full party info. If inactive or not found, it sends an error callback.

**Callbacks received by B Bank (acting as Payer DFSP):**

```
PUT /parties/:partyIdType/:partyIdentifier         → emits: alsputCallback
PUT /parties/:partyIdType/:partyIdentifier/error   → emits: alsputErrorCallback
PUT /participants/:partyIdType/:partyIdentifier     → emits: alsOracleVerifyCallback / alsRegisterOneCallback
```

---

### Phase 2 — Quote Negotiation

**Purpose:** Calculate fees, generate ILP packet + condition, and agree on transfer terms.

**Payer-side trigger (Portal API):**

```
POST /api/init-quotes
Body: { payer_id, payee, amount, type }
```

This creates a `QUOTE_REQUESTED` transaction record, then forwards a `POST /quotes` to the Mojaloop Quote Service.

**B Bank acting as Payee DFSP (inbound):**

```
POST /quotes
```

B Bank:

1. Records the incoming quote (`recv_R1_createQuote`)
2. Calculates fee from `settings.quote_fee` (percentage)
3. Generates ILP packet, SHA-256 condition, and fulfilment
4. Stores the fulfilment for later transfer verification
5. Calls `PUT /quotes/:id` on the Quote Service with the ILP data

**Callbacks received by B Bank (acting as Payer DFSP):**

```
PUT /quotes/:id        → emits: putQuoteCallback     → updates to QUOTE_RECEIVED
PUT /quotes/:id/error  → emits: putQuoteCallbackError → updates to FAILED
```

---

### Phase 3 — Transfer Execution

**Purpose:** Move funds through the Mojaloop Central Ledger and commit the transfer.

**Payer-side trigger (Portal API):**

```
POST /api/init-transfer
Body: { currency, amount, ilpPacket, condition, payer_fsp, payee_fsp, quoteId }
```

B Bank forwards `POST /transfers` to the ML API Adapter and records `TRANSFER_SENT`.

**B Bank acting as Payee DFSP (inbound):**

```
POST /transfers
```

B Bank:

1. Records the transfer (`recv_R3_transferReceived`)
2. Retrieves the stored fulfilment from the database
3. Calls `PUT /transfers/:id` on the ML API Adapter with `transferState: COMMITTED`
4. Updates status to `COMMITTED` and **credits** the payee merchant's balance

**Callbacks received by B Bank (acting as Payer DFSP):**

```
PUT /transfers/:id        → emits: putTransferCallback      → updates to COMMITTED / ABORTED / EXPIRED
PUT /transfers/:id/error  → emits: putTransferCallbackError → updates to FAILED
```

On `COMMITTED`, the payer merchant's balance is **debited**.

---

## Payer Side (SEND) State Machine

These functions track an outgoing transaction through its lifecycle:

| Function                  | Trigger                       | DB Status                                      |
| ------------------------- | ----------------------------- | ---------------------------------------------- |
| `send_S1_createQuote()`   | `POST /api/init-quotes`       | `QUOTE_REQUESTED`                              |
| `send_S2_quoteReceived()` | `PUT /quotes/:id` callback    | `QUOTE_RECEIVED`                               |
| `send_S3_transferSent()`  | `POST /api/init-transfer`     | `TRANSFER_SENT`                                |
| `send_S4_finalStatus()`   | `PUT /transfers/:id` callback | `COMMITTED` / `FAILED` / `ABORTED` / `EXPIRED` |

On `COMMITTED` → triggers **DEBIT** on the payer's merchant wallet.

---

## Payee Side (RECV) State Machine

These functions track an incoming transaction:

| Function                     | Trigger                          | DB Status              |
| ---------------------------- | -------------------------------- | ---------------------- |
| `recv_R1_createQuote()`      | `POST /quotes` inbound           | `QUOTE_REQUESTED`      |
| `recv_R2_ilpSentToHub()`     | After ILP generated & PUT to Hub | `QUOTE_RECEIVED`       |
| `recv_R3_transferReceived()` | `POST /transfers` inbound        | `TRANSFER_SENT`        |
| `recv_R4_finalStatus()`      | After PUT COMMITTED to Hub       | `COMMITTED` / `FAILED` |

On `COMMITTED` → triggers **CREDIT** on the payee's merchant wallet.

---

## API Reference

### Internal / Portal APIs

All portal routes require a valid JWT (`Authorization: Bearer <token>`).

#### Merchant (Parties) Management

| Method   | Endpoint                          | Description                                     |
| -------- | --------------------------------- | ----------------------------------------------- |
| `GET`    | `/api/parties`                    | List merchants with search, filter, pagination  |
| `GET`    | `/api/parties/:id`                | Get single merchant with linked user            |
| `POST`   | `/api/parties/add`                | Register new merchant (ALS + DB + user + email) |
| `PUT`    | `/api/parties/add`                | Update merchant details                         |
| `PUT`    | `/api/parties/:id`                | Patch specific merchant fields                  |
| `DELETE` | `/api/parties/:id`                | Delete merchant + de-register from ALS          |
| `PUT`    | `/api/merchant/update/status/:id` | Toggle merchant active/inactive                 |
| `GET`    | `/api/parties/active/merchant`    | List active merchants with balance > 50         |

**Query params for `GET /api/parties`:**

| Param       | Type   | Description                              |
| ----------- | ------ | ---------------------------------------- |
| `search`    | string | Searches name, ID value, NID, account no |
| `status`    | string | `1` = active, `0` = inactive             |
| `id_type`   | string | e.g. `MSISDN`, `ACCOUNT_ID`              |
| `date_from` | date   | Filter by created date (YYYY-MM-DD)      |
| `date_to`   | date   | Filter by created date (YYYY-MM-DD)      |
| `page`      | number | Page number (default: 1)                 |
| `per_page`  | number | Results per page (default: 10, max: 100) |

#### Settings

| Method | Endpoint        | Description                            |
| ------ | --------------- | -------------------------------------- |
| `GET`  | `/api/settings` | Get system settings (e.g. `quote_fee`) |
| `POST` | `/api/settings` | Update `quote_fee` percentage          |

#### Payment Initiation

| Method | Endpoint                                         | Description                         |
| ------ | ------------------------------------------------ | ----------------------------------- |
| `GET`  | `/api/oracle-verify/:id_type/:id_value`          | Check if an ID is registered in ALS |
| `GET`  | `/api/verify-parties/:receiver_dfsp/:id/:number` | Look up a payee party via ALS       |
| `POST` | `/api/init-quotes`                               | Initiate a quote (payer flow)       |
| `POST` | `/api/init-transfer`                             | Execute a transfer (payer flow)     |

**`POST /api/init-quotes` body:**

```json
{
  "payer_id": "merchant-uuid",
  "payee": {
    "party": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "01700000000",
        "fspId": "PAYEEFSP"
      }
    }
  },
  "amount": "500.00",
  "type": "P2P"
}
```

**`POST /api/init-transfer` body:**

```json
{
  "currency": "BDT",
  "amount": "500.00",
  "ilpPacket": "<base64-encoded-ilp>",
  "condition": "<base64url-sha256-condition>",
  "payer_fsp": "SELFFSPID",
  "payee_fsp": "PAYEEFSP",
  "quoteId": "uuid-from-quote-response"
}
```

---

### Mojaloop Callback Endpoints

These are called by the Mojaloop Hub. They respond `202` immediately and process asynchronously.

#### Participants

| Method | Endpoint                                            | Description                                  |
| ------ | --------------------------------------------------- | -------------------------------------------- |
| `PUT`  | `/participants/:partyIdType/:partyIdentifier`       | ALS oracle verify or batch register callback |
| `PUT`  | `/participants/:partyIdType/:partyIdentifier/error` | ALS error callback                           |
| `PUT`  | `/participants/:requestId`                          | Batch register callback                      |
| `PUT`  | `/participants/:requestId/error`                    | Batch register error callback                |

#### Parties

| Method | Endpoint                                       | Description                        |
| ------ | ---------------------------------------------- | ---------------------------------- |
| `GET`  | `/parties/:partyIdType/:partyIdentifier`       | Party lookup request (Payee DFSP)  |
| `PUT`  | `/parties/:partyIdType/:partyIdentifier`       | Party lookup response (Payer DFSP) |
| `PUT`  | `/parties/:partyIdType/:partyIdentifier/error` | Party lookup error                 |

#### Quotes

| Method | Endpoint            | Description                          |
| ------ | ------------------- | ------------------------------------ |
| `POST` | `/quotes`           | Quote request received (Payee DFSP)  |
| `PUT`  | `/quotes/:id`       | Quote response received (Payer DFSP) |
| `PUT`  | `/quotes/:id/error` | Quote error                          |

#### Transfers

| Method | Endpoint               | Description                            |
| ------ | ---------------------- | -------------------------------------- |
| `POST` | `/transfers`           | Transfer request received (Payee DFSP) |
| `PUT`  | `/transfers/:id`       | Transfer result callback (Payer DFSP)  |
| `PUT`  | `/transfers/:id/error` | Transfer error                         |

---

## Merchant Management

When adding a merchant via `POST /api/parties/add`, B Bank:

1. Validates required fields (`display_name`, `first_name`, `id_type`, `id_value`, `email`, `password`)
2. Checks for duplicate merchant/user in the local DB
3. Registers the identifier with Mojaloop ALS (`POST /participants/:id_type/:id_value`)
4. Creates a `merchant` record in MySQL
5. Creates a linked `users` record with hashed password and role `MERCHANT`
6. Credits an optional opening balance (`open_account`)
7. Sends a welcome email with login credentials

When deleting a merchant, B Bank de-registers the identifier from ALS before removing local records.

---

## Balance & Ledger

Balance changes are managed via `updateBalance()` from `balance.controller.js`.

| Event                         | Direction  | Trigger                             |
| ----------------------------- | ---------- | ----------------------------------- |
| Transfer committed (outgoing) | **DEBIT**  | `send_S4_finalStatus` → `COMMITTED` |
| Transfer committed (incoming) | **CREDIT** | `recv_R4_finalStatus` → `COMMITTED` |
| Merchant opening deposit      | **CREDIT** | `POST /api/parties/add`             |

Each balance operation is linked to the `transaction_id` and `transfer_id` for full auditability.

---

## ILP Packet & Condition Generation

B Bank generates ILP data dynamically per quote using standard cryptography:

```
fulfilment  = random 32 bytes (base64url)
condition   = SHA-256(fulfilment) encoded as base64url
ilpPacket   = base64(JSON({ amount, currency, payee, payer, expiration }))
expiration  = NOW + 1 hour
```

The `fulfilment` is stored in the `transactions` table against the `quote_id`. When the transfer arrives (`POST /transfers`), B Bank retrieves the stored fulfilment and includes it in the `PUT /transfers/:id` COMMITTED response, ensuring cryptographic proof of payment.

---

## Email Notifications

On merchant creation, B Bank sends a styled HTML welcome email containing:

- Username and temporary password
- Instructions to change password on first login
- Security advisory (confidentiality notice)

Configure SMTP via `.env`:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_USER=noreply@example.com
SMTP_PASS=your_password
SMTP_FROM=noreply@example.com
```

---

## WebSocket Events

B Bank emits real-time events via Socket.IO to connected frontend clients. All events carry `{ params, query, headers, body }`.

| Event                          | Phase     | Description                    |
| ------------------------------ | --------- | ------------------------------ |
| `alsOracleVerifyCallback`      | Parties   | ALS oracle verify success      |
| `alsOracleVerifyErrorCallback` | Parties   | ALS oracle verify failure      |
| `alsRegisterOneCallback`       | Parties   | Single participant registered  |
| `alsRegisterOneErrorCallback`  | Parties   | Single participant error       |
| `alsRegisterManyCallback`      | Parties   | Batch participants registered  |
| `alsRegisterManyErrorCallback` | Parties   | Batch participants error       |
| `alsverifyCallback`            | Parties   | Party lookup received          |
| `alsputCallback`               | Parties   | Party lookup response received |
| `alsputErrorCallback`          | Parties   | Party lookup error received    |
| `postQuoteCallback`            | Quotes    | Quote request received         |
| `putQuoteCallback`             | Quotes    | Quote response received        |
| `putQuoteCallbackError`        | Quotes    | Quote error received           |
| `postTransferCallback`         | Transfers | Transfer request received      |
| `putTransferCallback`          | Transfers | Transfer result received       |
| `putTransferCallbackError`     | Transfers | Transfer error received        |

**Client connection example:**

```js
import { io } from 'socket.io-client';
const socket = io('https://your-server-url.com');

socket.on('putTransferCallback', (data) => {
  console.log('Transfer result:', data.body.transferState);
});
```

---

## Database Schema Overview

| Table             | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `merchant`        | FSP participants — identity, limits, status |
| `users`           | Portal users linked to merchants            |
| `transactions`    | Full audit trail of all payment flows       |
| `merchant_wallet` | Current balance per merchant                |
| `settings`        | System config (e.g. `quote_fee`)            |

**Key `transactions` columns:**

| Column              | Description                                       |
| ------------------- | ------------------------------------------------- |
| `quote_id`          | Mojaloop quote UUID                               |
| `transfer_id`       | Mojaloop transfer UUID                            |
| `transaction_id`    | End-to-end transaction UUID                       |
| `direction`         | `INCOMING` or `OUTGOING`                          |
| `type`              | `P2P`, `INSTANT`, `BULK`, `NPSB`, `RTGS`, `BEFTN` |
| `status`            | Current state (see state machines above)          |
| `ilp_packet`        | Base64 encoded ILP packet                         |
| `condition_hash`    | SHA-256 condition (base64url)                     |
| `fulfilment`        | Pre-image of condition (base64url)                |
| `fee`               | Calculated fee amount                             |
| `receive_amount`    | Amount after fee deduction                        |
| `error_code`        | Mojaloop error code on failure                    |
| `error_description` | Human-readable error on failure                   |

---

## Transaction Types

| Type      | Mojaloop Scenario | Initiator Type | Use Case                                     |
| --------- | ----------------- | -------------- | -------------------------------------------- |
| `P2P`     | `TRANSFER`        | `CONSUMER`     | Person-to-person transfer                    |
| `INSTANT` | `PAYMENT`         | `BUSINESS`     | Merchant payment / instant pay               |
| `BULK`    | `TRANSFER`        | `CONSUMER`     | Bulk disbursement                            |
| `NPSB`    | `PAYMENT`         | `CONSUMER`     | National Payment Switch Bangladesh           |
| `RTGS`    | `TRANSFER`        | `CONSUMER`     | Real-Time Gross Settlement                   |
| `BEFTN`   | `TRANSFER`        | `CONSUMER`     | Bangladesh Electronic Funds Transfer Network |

---

## Error Handling

B Bank follows defensive patterns throughout:

- All Mojaloop callback endpoints respond `202` immediately, then process asynchronously — the Hub never times out
- Terminal statuses (`COMMITTED`, `FAILED`, `ABORTED`, `EXPIRED`) are idempotent — duplicate callbacks are silently ignored
- ALS de-registration failures on merchant delete are non-fatal — DB cleanup proceeds regardless
- ILP fulfilment generation falls back to a fresh random value if the stored one is missing
- Balance operations are fire-and-forget with isolated error logging to prevent blocking the payment flow

---

## Security

- All portal API routes are protected by JWT middleware (`auth`)
- Passwords are hashed with `bcryptjs` (salt rounds: 10)
- JWT secrets are environment-variable-only — never hardcoded
- CORS is open (`*`) by default — restrict `origin` in production
- Mojaloop callbacks use `FSPIOP-Source` / `FSPIOP-Destination` header validation
- No raw SQL interpolation — all queries use parameterized `?` placeholders

---

## License

Private — Bangladeshi Software LTD. All rights reserved.
