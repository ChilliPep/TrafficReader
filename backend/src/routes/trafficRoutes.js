const express = require('express');
const db = require('../db/database');
const dataCollector = require('../services/dataCollector');
const { getTrafficStatus, round, clamp, URBAN_SPEED_MIN_KMH, URBAN_SPEED_MAX_KMH } = require('../services/trafficScoring');
const { shouldUseTwoGis } = require('../services/twoGisClient');

const router = express.Router();
const SEGMENT_ID_PATTERN = /^[a-z0-9_-]{3,50}$/i;

function asyncRoute(handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (err) {
            res.status(500).json({
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    };
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getApiSourceLabel() {
    return shouldUseTwoGis() ? '2gis' : 'synthetic';
}

function normalizeMetricSource(source) {
    const value = String(source || '').toLowerCase();
    if (value.includes('2gis')) return '2gis';
    return 'synthetic';
}

function validateSegmentId(req, res, next) {
    const segmentId = String(req.params.id || '');
    if (!SEGMENT_ID_PATTERN.test(segmentId)) {
        res.status(400).json({
            error: 'Invalid segment id format',
            segment_id: segmentId,
            timestamp: new Date().toISOString()
        });
        return;
    }
    next();
}

function buildForecastFromHistory(history) {
    const chronological = [...history].reverse();
    const last = chronological[chronological.length - 1];
    const lastCongestion = last ? Number(last.congestion_percent || 0) : 0;
    const buckets = [];

    for (let step = 1; step <= 8; step += 1) {
        const projectedAt = new Date(Date.now() + (step * 30 * 60 * 1000));
        const hour = projectedAt.getHours() + (projectedAt.getMinutes() / 60);
        const peakBoost = Math.exp(-Math.pow(hour - 8.2, 2) / 1.4) * 18 +
            Math.exp(-Math.pow(hour - 18.1, 2) / 1.7) * 22 +
            Math.exp(-Math.pow(hour - 13.0, 2) / 2.6) * 8;
        const recentTrend = chronological.length > 3
            ? Number(chronological[chronological.length - 1].congestion_percent) -
              Number(chronological[chronological.length - 4].congestion_percent)
            : 0;
        const predicted = Math.max(0, Math.min(100, (lastCongestion * 0.58) + peakBoost + (recentTrend * 0.35)));

        buckets.push({
            at: projectedAt.toISOString(),
            congestion_percent: round(predicted),
            status: getTrafficStatus(predicted)
        });
    }

    return buckets;
}

function buildCityStatus(stats) {
    const avg = Number(stats.avg_congestion || 0);
    if (avg >= 70) return 'critical';
    if (avg >= 50) return 'strained';
    if (avg >= 28) return 'busy';
    return 'calm';
}

router.get('/snapshot', asyncRoute(async (req, res) => {
    const [latest, stats, hotspots, districts, incidents, quota] = await Promise.all([
        db.getLatestMetrics(),
        db.getStatistics(90),
        db.getHotspots(90),
        db.getDistrictAnalytics(180),
        db.getActiveIncidents(),
        db.getQuotaStatus()
    ]);

    const updatedAt = latest.reduce((max, item) => {
        if (!item.timestamp) return max;
        return !max || item.timestamp > max ? item.timestamp : max;
    }, stats.last_updated || null);

    const segments = latest.map((segment) => ({
        ...segment,
        speed_kmh: round(clamp(Number(segment.speed_kmh || 0), URBAN_SPEED_MIN_KMH, URBAN_SPEED_MAX_KMH)),
        source: normalizeMetricSource(segment.source)
    }));

    res.json({
        timestamp: new Date().toISOString(),
        updated_at: updatedAt,
        last_updated: updatedAt,
        source: getApiSourceLabel(),
        city: {
            name: 'Kyzylorda',
            status: buildCityStatus(stats),
            center: { lat: 44.838, lon: 65.502 }
        },
        statistics: {
            avg_congestion: round(Number(stats.avg_congestion || 0)),
            max_congestion: round(Number(stats.max_congestion || 0)),
            avg_speed: round(clamp(Number(stats.avg_speed || 0), URBAN_SPEED_MIN_KMH, URBAN_SPEED_MAX_KMH)),
            avg_delay_seconds: Math.round(Number(stats.avg_delay_seconds || 0)),
            avg_severity: round(Number(stats.avg_severity || 0)),
            samples: Number(stats.samples || 0),
            last_updated: stats.last_updated || updatedAt
        },
        segments,
        hotspots,
        districts,
        incidents,
        quota,
        collector: dataCollector.getCollectorStatus()
    });
}));

router.get('/segments', asyncRoute(async (req, res) => {
    const segments = await db.getSegments();
    res.json({
        type: 'FeatureCollection',
        source: getApiSourceLabel(),
        last_updated: new Date().toISOString(),
        features: segments.map((segment) => ({
            type: 'Feature',
            id: segment.segment_id,
            properties: {
                segment_id: segment.segment_id,
                name: segment.name,
                district: segment.district,
                road_class: segment.road_class,
                priority: segment.priority,
                length_km: segment.length_km,
                baseline_speed_kmh: segment.baseline_speed_kmh,
                baseline_travel_time_seconds: segment.baseline_travel_time_seconds
            },
            geometry: {
                type: 'LineString',
                coordinates: segment.polyline
            }
        }))
    });
}));

router.get('/hotspots', asyncRoute(async (req, res) => {
    const windowMinutes = toNumber(req.query.window_minutes, 60);
    const hotspots = await db.getHotspots(windowMinutes);
    res.set('X-Traffic-Source', getApiSourceLabel());
    res.set('X-Traffic-Last-Updated', new Date().toISOString());
    res.json(hotspots);
}));

router.get('/statistics', asyncRoute(async (req, res) => {
    const windowMinutes = toNumber(req.query.window_minutes, 60);
    const stats = await db.getStatistics(windowMinutes);
    const payload = stats || {
        avg_congestion: 0,
        max_congestion: 0,
        avg_speed: 0
    };

    res.json({
        ...payload,
        source: getApiSourceLabel(),
        last_updated: payload.last_updated || new Date().toISOString()
    });
}));

router.get('/segment/:id', validateSegmentId, asyncRoute(async (req, res) => {
    const limit = toNumber(req.query.limit, 96);
    const history = await db.getSegmentHistory(req.params.id, limit);
    const lastUpdated = history[0]?.timestamp || new Date().toISOString();
    res.set('X-Traffic-Source', getApiSourceLabel());
    res.set('X-Traffic-Last-Updated', lastUpdated);
    res.json(history.map((row) => ({
        ...row,
        source: normalizeMetricSource(row.source)
    })));
}));

router.get('/forecast/:id', validateSegmentId, asyncRoute(async (req, res) => {
    const history = await db.getSegmentHistory(req.params.id, 96);
    res.json({
        segment_id: req.params.id,
        generated_at: new Date().toISOString(),
        last_updated: history[0]?.timestamp || null,
        source: getApiSourceLabel(),
        method: 'historical median + recent trend + rush-hour curve',
        buckets: buildForecastFromHistory(history)
    });
}));

router.get('/incidents', asyncRoute(async (req, res) => {
    const incidents = await db.getActiveIncidents();
    res.set('X-Traffic-Source', getApiSourceLabel());
    res.set('X-Traffic-Last-Updated', new Date().toISOString());
    res.json(incidents);
}));

router.post('/incidents', asyncRoute(async (req, res) => {
    const allowedTypes = new Set(['accident', 'roadwork', 'police', 'hazard', 'jam', 'report']);
    const type = allowedTypes.has(req.body.type) ? req.body.type : 'report';
    const title = String(req.body.title || '').trim().slice(0, 80);
    const segmentId = String(req.body.segment_id || '').trim();
    const description = String(req.body.description || '').trim().slice(0, 500);

    if (!title) {
        res.status(400).json({ error: 'title is required' });
        return;
    }

    if (!segmentId) {
        res.status(400).json({ error: 'segment_id is required' });
        return;
    }

    if (!SEGMENT_ID_PATTERN.test(segmentId)) {
        res.status(400).json({ error: 'Invalid segment id format' });
        return;
    }

    try {
        const incident = await db.insertIncident({
            segment_id: segmentId,
            type,
            title,
            description,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            confidence: 0.55
        });

        res.status(201).json({
            ...incident,
            status: 'active',
            source: getApiSourceLabel(),
            last_updated: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === 'UNKNOWN_SEGMENT') {
            res.status(400).json({ error: 'Unknown corridor. Refresh the dashboard and try again.' });
            return;
        }
        throw error;
    }
}));

router.get('/districts', asyncRoute(async (req, res) => {
    const windowMinutes = toNumber(req.query.window_minutes, 180);
    const districts = await db.getDistrictAnalytics(windowMinutes);
    res.set('X-Traffic-Source', getApiSourceLabel());
    res.set('X-Traffic-Last-Updated', new Date().toISOString());
    res.json(districts);
}));

router.get('/quota', asyncRoute(async (req, res) => {
    const quota = await db.getQuotaStatus();
    res.json({
        ...quota,
        source: getApiSourceLabel(),
        last_updated: new Date().toISOString()
    });
}));

router.post('/collect-now', asyncRoute(async (req, res) => {
    const result = await dataCollector.collectData();
    res.json({
        ...result,
        source: getApiSourceLabel(),
        last_updated: new Date().toISOString()
    });
}));

router.get('/export', asyncRoute(async (req, res) => {
    const days = toNumber(req.query.days, 7);
    const data = await db.exportDataset(days);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=traffic-export-${days}days.json`);
    res.set('X-Traffic-Source', getApiSourceLabel());
    res.set('X-Traffic-Last-Updated', new Date().toISOString());
    res.send(JSON.stringify(data, null, 2));
}));

module.exports = router;
