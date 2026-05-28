# Testing Checklist

## Unit Tests

### Database
- [ ] Connection established
- [ ] Schema created correctly
- [ ] Insert operations work
- [ ] Query operations return correct data
- [ ] Old data cleanup works

### Data Collector
- [ ] Collection starts without errors
- [ ] Data inserted every 5 minutes
- [ ] Memory usage stays consistent

## Integration Tests

### Backend API
- [ ] GET /api/traffic/hotspots returns data
- [ ] GET /api/traffic/statistics returns numbers
- [ ] GET /api/traffic/segment/:id returns history
- [ ] GET /api/traffic/export downloads JSON
- [ ] CORS headers present

### Frontend
- [ ] Dashboard loads without errors
- [ ] Hotspots display on map/list
- [ ] Statistics update every 5 minutes
- [ ] Export button works
