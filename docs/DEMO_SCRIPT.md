# Demo Script

Use this script when recording the submission demo video.

## 1. Introduction

- Introduce the project as a full-stack real-time market data visualization system.
- Mention the stack: Node.js backend, React frontend, PostgreSQL, Socket.io, Prisma, Docker Compose.

## 2. Start the system

- Show `docker compose up --build`.
- Point out that the backend seeds data and starts the live simulator automatically.

## 3. Open the frontend

- Visit `http://localhost:5173`.
- Show that the default chart is the index view for `DSEX`.
- Mention that historical data is loaded first, then the live socket subscription starts.

## 4. Switch charts

- Change the dropdown from index to stock.
- Show `GP` loading and live updates continuing in the new chart room.

## 5. Explain the chart behavior

- Point out the 1-minute timeline.
- Show that missing minutes are forward-filled.
- Hover a point to show the tooltip with value and time.
- Highlight the yesterday-close reference line and the latest-point heartbeat animation.

## 6. Closeout

- Mention that market hours are configurable through environment variables.
- Mention that the backend persists raw ticks in PostgreSQL.
- End by stating that the demo uses irregular seed data and irregular real-time updates.
