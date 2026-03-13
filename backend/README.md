# SSS Backend

## Setup

1. Copy env template:
   `cp .env.example .env`
2. Set required values:
   - `STABLECOIN_CONFIG`
   - `AUTHORITY_KEYPAIR_PATH` (for write endpoints)
3. Install and build:
   `npm install && npm run build`

## Run

- Dev: `npm run dev`
- Prod: `npm start`

## Security

- Write endpoints (`POST/PUT/PATCH/DELETE` under `/api`) support:
  - API key auth via header `x-api-key` if `API_KEY` is set.
  - In-memory rate limiting via:
    - `WRITE_RATE_LIMIT_WINDOW_MS`
    - `WRITE_RATE_LIMIT_MAX`

## Persistence

- Event indexer state persists to `INDEXER_STATE_PATH` (default `./data/indexer-state.json`).

## Smoke Test

With backend running:

`BACKEND_URL=http://127.0.0.1:8080 npm run test:smoke`

## Full Verify

Run full boot + smoke + authenticated write checks:

`make verify`
