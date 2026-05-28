const axios = require('axios');
const crypto = require('crypto');
const { buildMetricFromDuration } = require('./trafficScoring');

const ROUTING_URL = 'https://routing.api.2gis.com/routing/7.0.0/global';

function shouldUseTwoGis() {
    return Boolean(process.env.GIS_API_KEY || process.env.TWOGIS_API_KEY) &&
        String(process.env.USE_2GIS_API || '').toLowerCase() === 'true';
}

function getApiKey() {
    return process.env.GIS_API_KEY || process.env.TWOGIS_API_KEY;
}

function getRouteCacheKey(segment) {
    const raw = `${segment.segment_id}:${segment.start.lat},${segment.start.lon}:${segment.end.lat},${segment.end.lon}`;
    return crypto.createHash('sha1').update(raw).digest('hex');
}

function sumManeuverField(route, field) {
    if (!Array.isArray(route.maneuvers)) return 0;
    return route.maneuvers.reduce((sum, maneuver) => {
        const path = maneuver.outcoming_path || {};
        return sum + Number(path[field] || 0);
    }, 0);
}

function extractRouteSummary(payload) {
    const route = payload && Array.isArray(payload.result) ? payload.result[0] : null;
    if (!route) return null;

    const duration = Number(
        route.total_duration ||
        route.duration ||
        route.route_duration ||
        sumManeuverField(route, 'duration')
    );
    const distance = Number(
        route.total_distance ||
        route.distance ||
        route.route_distance ||
        sumManeuverField(route, 'distance')
    );

    if (!Number.isFinite(duration) || duration <= 0) return null;

    return {
        duration,
        distance: Number.isFinite(distance) ? distance : null,
        algorithm: route.algorithm || 'with traffic'
    };
}

async function fetchSegmentMetric(segment) {
    const apiKey = getApiKey();
    const body = {
        points: [
            { type: 'stop', lon: segment.start.lon, lat: segment.start.lat },
            { type: 'stop', lon: segment.end.lon, lat: segment.end.lat }
        ],
        transport: 'driving',
        route_mode: 'fastest',
        traffic_mode: 'jam',
        output: 'summary',
        locale: 'ru'
    };

    const response = await axios.post(`${ROUTING_URL}?key=${encodeURIComponent(apiKey)}`, body, {
        timeout: 9000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const summary = extractRouteSummary(response.data);
    if (!summary) {
        throw new Error('2GIS route summary was empty');
    }

    return {
        metric: buildMetricFromDuration(segment, summary.duration, '2gis_routing', 0.86),
        raw: response.data,
        summary
    };
}

module.exports = {
    fetchSegmentMetric,
    getRouteCacheKey,
    shouldUseTwoGis
};
