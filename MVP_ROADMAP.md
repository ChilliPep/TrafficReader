# TrafficReader MVP Roadmap

## What Was Completed In This Pass

| Area | Completed |
|---|---|
| Safety | Created `_backup_before_mvp/` before changing code |
| Backend | Added richer Kyzylorda corridor model |
| Backend | Added snapshot API for the main dashboard |
| Backend | Added severity score, delay, confidence, source metadata |
| Backend | Added quota status model for 2GIS daily limit |
| Backend | Added optional 2GIS Routing client with cache fallback |
| Backend | Added incidents API |
| Backend | Added rule-based forecast endpoint |
| Frontend | Rebuilt dashboard into a map-first traffic UI |
| Frontend | Added SVG corridor map, KPI cards, hotspot list, history chart, forecast, district analytics, incident form |
| Testing | Added `npm test` smoke test |

## Roadmap Passed

MUST HAVE progress:

| Item | Status |
|---|---|
| API-safe backend collector | Done |
| Better segment model | Done |
| Snapshot API | Done |
| Quota visibility | Done |
| Map-first dashboard | Done |
| Hotspot ranking | Done |
| Historical chart | Done |
| Forecast without ML | Done |
| Incident reports | Done |
| Smoke test | Done |

Not yet completed:

| Item | Why not yet |
|---|---|
| Full React migration | Too risky before tomorrow |
| PostgreSQL/TimescaleDB | SQLite is enough for MVP demo |
| Real production 2GIS integration tuning | Needs valid key and endpoint testing under real quota |
| Auth/admin panel | Not needed for school/portfolio demo |
| Real crowd-sourced mobile app | Future phase |

## Next 10 Tasks By Value

| Priority | Task | Impact | Complexity | API Cost |
|---:|---|---|---|---|
| 1 | Test with a real 2GIS demo key in `USE_2GIS_API=true` mode | Very high | Medium | Medium |
| 2 | Add 20-30 more real Kyzylorda corridors | Very high | Medium | Medium |
| 3 | Add route comparison UI | High | Medium | Medium |
| 4 | Add school/market filter layer | High | Low | Low |
| 5 | Add PDF/HTML daily report | High | Medium | Zero |
| 6 | Add anomaly alerts | Medium-high | Medium | Zero |
| 7 | Add local storage user preferences | Medium | Low | Zero |
| 8 | Add mobile bottom sheet for selected segment | Medium | Medium | Zero |
| 9 | Add admin screen for editing segments | Medium | Medium | Zero |
| 10 | Move to PostgreSQL when data grows | Medium | High | Zero |

## Tomorrow Demo Script

1. Start backend with `cd backend && npm start`.
2. Open `http://localhost:3000`.
3. Explain that the browser reads local snapshots, not 2GIS directly.
4. Click different corridors on the map.
5. Show congestion, delay, efficiency, history, forecast.
6. Send a sample incident report.
7. Open `/api/traffic/snapshot` and explain that the dashboard is API-driven.
8. Run `npm test` to show the smoke test.

## Core Code To Explain

| File | What to explain |
|---|---|
| `backend/src/services/dataCollector.js` | Scheduler, adaptive polling, 2GIS/cache/synthetic fallback |
| `backend/src/services/trafficScoring.js` | Congestion, status, severity score |
| `backend/src/routes/trafficRoutes.js` | API endpoints for dashboard |
| `backend/src/db/database.js` | SQLite schema, time-series metrics, quota, incidents |
| `frontend/script.js` | State, polling, map rendering, charts, incident form |
