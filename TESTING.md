# Testing Checklist

## Automated

```bash
cd backend
npm test
```

The smoke test verifies:

- Data collector inserts current metrics.
- Database returns latest segment metrics.
- Average speed is positive.
- Quota model exposes the 3000 request daily limit.

## Manual API Checks

```text
GET http://localhost:3000/api/health
GET http://localhost:3000/api/traffic/snapshot
GET http://localhost:3000/api/traffic/segments
GET http://localhost:3000/api/traffic/quota
GET http://localhost:3000/api/traffic/export?days=7
```

## Manual UI Checks

- Dashboard opens at `http://localhost:3000`.
- KPI values are visible.
- The map renders all corridors.
- Clicking a corridor updates selected segment metrics.
- Hotspot list selects a segment.
- History chart renders.
- Forecast bars render.
- Incident form saves a report.
- Export button downloads JSON.
- Mobile width does not cause horizontal scrolling.

## Demo-Key Safety

- Keep `USE_2GIS_API` unset or `false` during UI development.
- Turn on `USE_2GIS_API=true` only when testing the real 2GIS key.
- Watch `/api/traffic/quota` before and after real API tests.
