# WingsFin Real-Time Market Data Visualization

WingsFin is a take-home project that visualizes real-time and historical market data for:

- `DSEX` index data
- `GP` stock data

The application is built as a full-stack system with:

- React + Vite frontend
- NestJS backend
- PostgreSQL persistence
- Socket.io live updates
- Prisma for data access
- Docker Compose for local development

## Project Structure

- [`frontend/`](frontend/) - React application, chart UI, and Socket.io client
- [`backend/`](backend/) - NestJS API, WebSocket gateway, simulator, and Prisma layer
- [`docs/`](docs/) - architecture notes, deployment guide, and diagram assets

## What The App Does

- Loads historical market data when the page opens
- Switches between index and stock views
- Forward-fills missing minutes into a continuous 1-minute chart timeline
- Shows the latest value, yesterday close, and market status
- Subscribes to live updates over Socket.io
- Only renders charts during market open hours
- Exposes API documentation through Swagger

## Quick Start

The fastest way to run the full stack locally is:

```bash
docker compose up --build
```

After startup:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- PostgreSQL: `localhost:5433`

## Local Development

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

If the frontend is pointed at a non-default backend URL, set:

- `VITE_API_BASE_URL`
- `VITE_SOCKET_URL`

## Environment Variables

The market session is configurable through environment variables.
Historical demo data is seeded only when the database is empty. Set `MARKET_SEED_RESET=true`
if you intentionally want to wipe and regenerate the demo dataset.

### Backend

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/wingfin` |
| `PORT` | Backend HTTP port | `4000` |
| `MARKET_OPEN_TIME` | Session open time | `10:00` |
| `MARKET_CLOSE_TIME` | Session close time | `20:00` |
| `MARKET_TIMEZONE` | Market timezone | `Asia/Dhaka` |
| `DEFAULT_INDEX_SYMBOL` | Default index symbol | `DSEX` |
| `DEFAULT_STOCK_SYMBOL` | Default stock symbol | `GP` |
| `INDEX_YESTERDAY_CLOSE` | Yesterday close for index seed/simulator | `5222.22` |
| `STOCK_YESTERDAY_CLOSE` | Yesterday close for stock seed/simulator | `238.88` |
| `MARKET_SIMULATOR_ENABLED` | Enables live tick simulation | `true` or `false` |
| `SIMULATOR_MAX_INTERVAL_MS` | Upper bound for simulator delay | `3000` |
| `MARKET_SEED_RESET` | Forces the seed script to clear and regenerate demo data | `true` or `false` |
| `MARKET_SEED_KEY` | Optional deterministic seed key for demo data generation | `wingfin-market-seed-v1` |

### Frontend

| Variable | Purpose | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend REST base URL | `http://localhost:4000` |
| `VITE_SOCKET_URL` | Backend Socket.io URL | `http://localhost:4000` |
| `VITE_MARKET_OPEN_TIME` | Default market open time shown in the UI | `10:00` |
| `VITE_MARKET_CLOSE_TIME` | Default market close time shown in the UI | `20:00` |

See the root `.env` file for a working local example.

## API

### `GET /market/status`

Returns:

- whether the market is open
- the current timestamp
- the configured open and close times
- the configured timezone

### `GET /market/history`

Query parameters:

- `type=INDEX | STOCK`
- `symbol=DSEX | GP`
- optional `openTime`
- optional `closeTime`
- optional `timeZone`

Returns either:

- a closed-market response, or
- a normalized 1-minute history series with `latestValue`, `yesterdayClose`, and `points`

## WebSocket Events

### Client events

- `market.subscribe`
- `market.unsubscribe`

### Server events

- `market.tick`
- `market.tick.all`
- `market.subscribed`
- `market.unsubscribed`

## Testing

### Backend

```bash
cd backend
npm test
npm run build
```

### Frontend

```bash
cd frontend
npm test
npm run build
```

## Documentation

- [Architecture overview](docs/ARCHITECTURE.md)
- [Deployment guide](DEPLOYMENT.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Swagger UI](https://backend-production-af70.up.railway.app/docs)

## Diagram Assets

- [Presentation-style architecture diagram](docs/architecture-diagram.png)
- [Presentation-style architecture PDF](docs/architecture-diagram.pdf)

## Design Notes

- Historical tick data is stored in PostgreSQL as raw events.
- The backend performs timeline normalization at request time.
- The frontend forward-fills and merges live updates on the selected chart.
- Socket.io rooms keep live updates scoped to the active symbol.
- The simulator is optional and can be disabled in production-like deployments.

## Deployment

The project is deployed on Railway with separate backend and frontend services plus a PostgreSQL service.

For Railway-specific setup and CLI commands, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Live Demo

- Frontend: https://frontend-production-1af2.up.railway.app
- Backend API: https://backend-production-af70.up.railway.app
- Swagger UI: https://backend-production-af70.up.railway.app/docs

## Demo Video

Demo video link: [wingfin-realtime-demo.webm](demo-artifacts/wingfin-realtime-demo.webm)

## How To Use The Live Demo

1. Open the frontend link above.
2. Leave the default selection on `Index view - DSEX`, or switch to `Stock view - GP`.
3. The app loads historical data first, then subscribes to live updates for the selected chart.
4. If the market is open, you will see the chart, latest value, yesterday close, and live updates.
5. If the market is closed, the app shows a closed-market message instead of the chart.
6. Market hours are configured in the app and currently use `10:00` to `20:00` in `Asia/Dhaka`.
