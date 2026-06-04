# Railway Deployment

This repository is set up as a two-service Railway deployment:

- `backend` - NestJS API, Socket.io, Prisma, PostgreSQL
- `frontend` - React + Vite static site served by Nginx
- `postgres` - Railway PostgreSQL plugin

## 1. Create the Railway project

1. Connect the GitHub repository to Railway.
2. Add a PostgreSQL service.
3. Add two app services:
   - backend
   - frontend

## 2. Configure the backend service

- Root directory: `/backend`
- Build: use the Dockerfile in `backend/Dockerfile`
- Config as code: `backend/railway.toml`
- The Railway deploy config intentionally omits an explicit HTTP healthcheck for this stack.

### Backend environment variables

Set these in Railway for the backend service:

- `DATABASE_URL` from the Railway PostgreSQL service
- `MARKET_OPEN_TIME` optional, default `10:00`
- `MARKET_CLOSE_TIME` optional, default `14:30`
- `MARKET_TIMEZONE` optional, default `Asia/Dhaka`
- `DEFAULT_INDEX_SYMBOL` optional, default `DSEX`
- `DEFAULT_STOCK_SYMBOL` optional, default `GP`
- `INDEX_YESTERDAY_CLOSE` optional, default `5222.22`
- `STOCK_YESTERDAY_CLOSE` optional, default `238.88`
- `MARKET_SIMULATOR_ENABLED` optional, set `false` if you want to disable the live simulator

### Backend behavior

The backend container runs Prisma migration and seed steps on startup through `backend/docker-entrypoint.sh`.

That is useful for the take-home/demo setup because:

- migrations are applied automatically
- sample market data is loaded automatically

If you want production data persistence later, move seeding out of the startup path.

## 3. Configure the frontend service

- Root directory: `/frontend`
- Build: use the Dockerfile in `frontend/Dockerfile`
- Config as code: `frontend/railway.toml`
- The Railway deploy config intentionally omits an explicit HTTP healthcheck for this stack.

### Frontend environment variables

Set these in Railway for the frontend service:

- `VITE_API_BASE_URL` = the public URL of the backend service
- `VITE_SOCKET_URL` = the public URL of the backend service
- `VITE_MARKET_OPEN_TIME` optional
- `VITE_MARKET_CLOSE_TIME` optional

## 4. Deployment order

Use this order:

1. Deploy backend first.
2. Copy the backend public URL into the frontend variables.
3. Deploy frontend.

## 5. What to verify

- `GET /` on the backend returns a healthy response.
- `GET /market/status` responds successfully.
- `GET /market/history?type=INDEX&symbol=DSEX` returns points.
- The frontend loads and can fetch the backend history/status endpoints.
- Socket.io live ticks connect to the backend URL.

## 6. Local sanity checks

Before pushing to Railway, verify locally:

- `backend`: `npm test`
- `backend`: `npm run build`
- `frontend`: `npm test`
- `frontend`: `npm run build`

## 7. Railway CLI

If you prefer the CLI over the Railway UI, use the current Railway service commands directly:

- `railway login`
- `railway init`
- `railway up`
- `railway variable set`
- `railway domain`

See the Railway CLI documentation for the current command syntax and flags:

- https://docs.railway.com/cli
