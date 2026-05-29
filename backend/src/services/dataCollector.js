const db = require('../db/database');
const segments = require('../config/kyzylordaSegments');
const { estimateMetric, getTemporalPressure } = require('./syntheticTraffic');
const { fetchSegmentMetric, getRouteCacheKey, shouldUseTwoGis } = require('./twoGisClient');
require('dotenv').config();

let lastCollection = null;
let nextCollection = null;
let collectionInProgress = false;
let timer = null;

async function initSegments() {
    for (const segment of segments) {
        await db.insertSegment(segment);
    }
}

function getAdaptivePollInterval(now = new Date()) {
    const explicitInterval = Number(process.env.POLL_INTERVAL);
    if (Number.isFinite(explicitInterval) && explicitInterval >= 60000) {
        return explicitInterval;
    }

    const pressure = getTemporalPressure(now);
    if (pressure >= 0.55) return 5 * 60 * 1000;
    if (pressure >= 0.25) return 10 * 60 * 1000;
    return 30 * 60 * 1000;
}

async function getMetricForSegment(segment) {
    if (!shouldUseTwoGis()) {
        return estimateMetric(segment);
    }

    const cacheKey = getRouteCacheKey(segment);
    const cached = await db.getCachedRoute(cacheKey);
    if (cached && cached.metric) {
        return {
            ...cached.metric,
            timestamp: new Date().toISOString(),
            source: '2gis_routing_cache'
        };
    }

    const quota = await db.getQuotaStatus();
    if (quota.status === 'locked') {
        console.warn(`2GIS quota guard active for ${segment.segment_id}; using synthetic data`);
        const fallback = estimateMetric(segment);
        return {
            ...fallback,
            source: 'synthetic_quota_guard',
            confidence: 0.52
        };
    }

    try {
        const result = await fetchSegmentMetric(segment);
        await db.recordApiUsage('2gis', 'routing', 1);
        await db.setCachedRoute(cacheKey, '2gis', { metric: result.metric, summary: result.summary }, 300);
        return result.metric;
    } catch (error) {
        console.warn(`2GIS fallback for ${segment.segment_id}: ${error.message}`);
        const fallback = estimateMetric(segment);
        return {
            ...fallback,
            source: 'synthetic_2gis_fallback',
            confidence: 0.50
        };
    }
}

async function collectData() {
    if (collectionInProgress) {
        return {
            skipped: true,
            reason: 'collection already in progress'
        };
    }

    collectionInProgress = true;
    const startedAt = new Date();
    const inserted = [];

    try {
        await initSegments();

        for (const segment of segments) {
            const metric = await getMetricForSegment(segment);
            const id = await db.insertMetric(metric);
            inserted.push({ id, segment_id: segment.segment_id, status: metric.status });
        }

        lastCollection = new Date().toISOString();
        return {
            skipped: false,
            started_at: startedAt.toISOString(),
            finished_at: lastCollection,
            inserted_count: inserted.length,
            inserted
        };
    } finally {
        collectionInProgress = false;
    }
}

function scheduleNextCollection() {
    const interval = getAdaptivePollInterval();
    nextCollection = new Date(Date.now() + interval).toISOString();
    timer = setTimeout(async () => {
        try {
            await collectData();
        } catch (error) {
            console.error('Traffic collection failed:', error.message);
        } finally {
            scheduleNextCollection();
        }
    }, interval);
}

function startCollection() {
    initSegments()
        .then(() => collectData())
        .catch((error) => console.error('Initial traffic collection failed:', error.message))
        .finally(() => {
            if (!timer) scheduleNextCollection();
        });
}

function getCollectorStatus() {
    return {
        mode: shouldUseTwoGis() ? '2gis_routing' : 'demo_safe_synthetic',
        segment_count: segments.length,
        last_collection: lastCollection,
        next_collection: nextCollection,
        collection_in_progress: collectionInProgress,
        adaptive_polling: true
    };
}

module.exports = {
    startCollection,
    collectData,
    getCollectorStatus,
    getAdaptivePollInterval
};
