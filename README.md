# TrafficReader - Kyzylorda Traffic Intelligence MVP

TrafficReader is a city traffic dashboard for Kyzylorda. It tracks important road corridors, stores time-series metrics, highlights congestion hotspots, estimates short-term congestion, and keeps 2GIS API usage under control.

The current MVP is intentionally safe for a demo API key:

- The frontend never calls 2GIS directly.
- The backend has a quota ledger and cache layer.
- If `USE_2GIS_API=true` is not enabled, the app runs in demo-safe synthetic mode.
- All existing basic endpoints still work.

## Current MVP Features

- Map-first dashboard with Kyzylorda road corridors.
- Current congestion, speed, delay, severity, and confidence.
- Hotspot ranking.
- Segment history chart.
- Rule-based 4-hour congestion forecast without ML.
- District pressure analytics.
- Crowd incident reports.
- JSON export.
- Adaptive backend polling.
- Optional 2GIS Routing API mode with cache and quota protection.

## Quick Start

```bash
cd backend
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Run smoke test:

```bash
cd backend
npm test
```

Export last 7 days:

```bash
cd backend
npm run data-export
```

## Optional 2GIS Mode

By default the project uses `demo_safe_synthetic` mode to avoid wasting the demo API key.

To enable 2GIS Routing API calls:

```env
GIS_API_KEY=your_2gis_key
USE_2GIS_API=true
DEMO_SAFE_SYNTHETIC=false
POLL_INTERVAL=300000
```

The app caches route responses for 5 minutes and tracks daily usage against a 1000 request monthly limit (demo key).

Full Russian setup guide: `backend/ZAPUSK.md`  
Env security guide: `backend/SETUP_ENV_INSTRUCTIONS.md`

## Key API Endpoints

```text
GET  /api/health
GET  /api/traffic/snapshot
GET  /api/traffic/segments
GET  /api/traffic/hotspots
GET  /api/traffic/statistics
GET  /api/traffic/segment/:id
GET  /api/traffic/forecast/:id
GET  /api/traffic/districts
GET  /api/traffic/quota
GET  /api/traffic/export?days=7
POST /api/traffic/incidents
POST /api/traffic/collect-now
```

## Architecture

```text
frontend/
  index.html       Map-first dashboard shell
  style.css        Responsive dark operations UI
  script.js        Client state, SVG map, charts, polling

backend/
  src/app.js
  src/config/kyzylordaSegments.js
  src/db/database.js
  src/routes/trafficRoutes.js
  src/services/dataCollector.js
  src/services/syntheticTraffic.js
  src/services/twoGisClient.js
  src/services/trafficScoring.js
```

## MVP Safety Notes

- `_backup_before_mvp/` contains the original important files from before the MVP pass.
- No React migration was done, because the deadline is short and the existing static frontend is easier to keep stable.
- `vehicle_count` is kept for backward compatibility, but in this MVP it should be explained as an estimated density index, not a real counted vehicle number.
