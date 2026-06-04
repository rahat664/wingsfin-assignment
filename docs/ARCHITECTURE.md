# Architecture

This document explains how the WingsFin real-time market chart application is structured, how data flows through the system, and why the implementation is organized the way it is.

## Diagram Assets

- [Presentation-style architecture diagram](architecture-diagram.png)
- [Presentation-style architecture PDF](architecture-diagram.pdf)

## System Overview

The application consists of four main runtime pieces:

1. React frontend
2. NestJS backend
3. PostgreSQL database
4. Socket.io live update channel

The backend also includes a market simulator that can generate irregular tick data for the demo. The simulator is optional and can be disabled through environment variables.

The system is built around one central rule: the chart must represent the market session as a continuous 1-minute timeline even when source data arrives irregularly.

## Core Responsibilities

### Frontend

The frontend is responsible for:

- Loading market history on startup
- Switching between index and stock views
- Subscribing to live updates for the selected symbol
- Forward-filling missing minutes into a readable chart series
- Displaying the latest value and yesterday close
- Showing a market-closed state when the backend indicates the session is closed
- Rendering the chart with tooltip, legend, and reference-line behavior

### Backend

The backend is responsible for:

- Serving `GET /market/status`
- Serving `GET /market/history`
- Normalizing irregular ticks into 1-minute points
- Persisting raw ticks to PostgreSQL
- Broadcasting live updates over Socket.io
- Producing Swagger documentation for the public API

### PostgreSQL

PostgreSQL stores raw `MarketTick` rows rather than only precomputed chart candles.

This design keeps the source data auditable and allows the aggregation logic to evolve later without losing tick-level history.

### Market Simulator

The simulator is used to create demo-friendly data during open market hours.

It generates updates at irregular intervals, rather than fixed intervals, so the charting and normalization logic are tested under realistic conditions.

## Request Flow

### 1. Initial Page Load

1. The browser loads the frontend.
2. The frontend calls `GET /market/history`.
3. The backend checks whether the market is open.
4. If the market is closed, the backend returns a closed-market payload.
5. If the market is open, the backend reads raw ticks from PostgreSQL.
6. The backend converts the ticks into a continuous 1-minute series.
7. The frontend renders the chart with the returned points.

### 2. Live Update Flow

1. The simulator generates a new tick, or a live producer posts new data.
2. The backend stores the raw tick in PostgreSQL.
3. The backend broadcasts the tick to the correct Socket.io room.
4. The frontend receives the event for the selected chart.
5. The frontend merges the update into the current minute.
6. If multiple updates arrive in the same minute, the latest one wins.

## History Normalization Rules

The normalization logic is central to the project.

The backend and frontend both rely on these business rules:

1. Charts are only considered active during market open hours.
2. Historical data must be converted into a continuous 1-minute timeline.
3. If multiple updates arrive in the same minute, the latest value for that minute is used.
4. If a minute has no update, the previous known value is carried forward.
5. The latest chart point must represent the current minute.
6. Point status is derived from yesterday close:
   - `ABOVE`
   - `BELOW`
   - `EQUAL`
   - `NO_DATA`

## Data Model

The primary database entity is `MarketTick`.

| Field | Purpose |
| --- | --- |
| `id` | Unique tick identifier |
| `symbol` | Market symbol such as `DSEX` or `GP` |
| `instrumentType` | `INDEX` or `STOCK` |
| `eventTime` | Timestamp of the source event |
| `value` | Index value or stock price |
| `yesterdayClose` | Yesterday close reference value |
| `changePercent` | Optional percentage change for index payloads |
| `rawPayload` | Original source payload |
| `createdAt` | Server insertion time |

Raw persistence is intentionally used instead of only storing derived chart points.

## Backend Components

### `MarketController`

Exposes the REST API:

- `GET /market/status`
- `GET /market/history`

### `MarketService`

Contains the core market logic:

- market open / closed checks
- session boundary computation
- history querying
- 1-minute forward-fill aggregation
- point status classification
- ingestion helpers for simulator payloads

### `MarketGateway`

Handles live updates:

- room subscription management
- room-based `market.tick` broadcasting
- unsubscribe behavior when the user changes chart context

### `MarketSimulatorService`

Generates sample market ticks while the market is open.

The simulator is intentionally irregular so the chart normalization logic is exercised with:

- multiple ticks in the same minute
- gaps between updates
- changing open and close windows

### `PrismaService`

Provides database connectivity and type-safe access to PostgreSQL.

## Frontend Behavior

The frontend is designed to treat the backend as the source of truth for history, while handling live updates incrementally.

It performs the following tasks:

- fetches initial history
- subscribes to the selected room
- merges live updates into the existing series
- shows closed-market state when history is unavailable during off-hours
- displays latest-value metadata and market state information

## Deployment Topology

The project is deployed as separate services on Railway:

- backend service
- frontend service
- PostgreSQL service

For local development, the same stack is represented by Docker Compose.

### Local

- `frontend` runs on port `5173`
- `backend` runs on port `4000`
- PostgreSQL runs on port `5433`

### Railway

- frontend is deployed as a static service
- backend is deployed from the backend Dockerfile
- PostgreSQL is provided by Railway's database service

## API Design

### `GET /market/status`

Returns the current market session state:

- whether the market is open
- the current timestamp
- session open time
- session close time
- timezone

### `GET /market/history`

Returns either:

- a closed-market payload, or
- an open-market payload with:
  - `openTime`
  - `currentTime`
  - `latestValue`
  - `yesterdayClose`
  - `points`
  - `totalPoints`

Swagger documentation is available at `/docs`.

## WebSocket Design

### Client Events

- `market.subscribe`
- `market.unsubscribe`

### Server Events

- `market.tick`
- `market.tick.all`
- `market.subscribed`
- `market.unsubscribed`

The selected chart type and symbol determine the Socket.io room, which keeps unrelated market data out of the client.

## Operational Notes

- The market session is configurable through environment variables.
- The close-time default is `20:00`.
- The simulator can be disabled for stable demo or production-like deployments.
- The backend exposes a Swagger UI for contract verification.

## Trade-Offs

### Raw ticks instead of precomputed candles

This keeps the source data auditable and flexible, at the cost of more work at query time.

### Socket.io instead of polling

This reduces latency and unnecessary requests, at the cost of managing socket lifecycle state.

### PostgreSQL instead of in-memory storage

This gives durable history and cleaner query semantics, at the cost of requiring migrations and a real database.

## Known Limitations

This project is intentionally scoped for the take-home assignment.

Current limitations:

- only the demo symbols `DSEX` and `GP` are supported
- there is no authentication
- there is no Redis-based websocket scaling
- the simulator is synthetic, not a real exchange feed

These are acceptable for the assignment and can be extended later without changing the core architecture.
