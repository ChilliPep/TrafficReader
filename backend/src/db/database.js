const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function addColumnIfMissing(tableName, columnName, definition) {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
        if (err) return;
        const exists = columns.some((column) => column.name === columnName);
        if (!exists) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`, [], (alterErr) => {
                if (alterErr && !String(alterErr.message).includes('duplicate column')) {
                    console.error(`Failed to add ${tableName}.${columnName}:`, alterErr.message);
                }
            });
        }
    });
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS traffic_segments (
        segment_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        length_km REAL NOT NULL,
        district TEXT DEFAULT 'Unknown',
        road_class TEXT DEFAULT 'collector',
        priority INTEGER DEFAULT 3,
        baseline_speed_kmh REAL DEFAULT 40,
        baseline_travel_time_seconds INTEGER DEFAULT 180,
        polyline_json TEXT,
        active INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS traffic_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        segment_id TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        speed_kmh REAL,
        congestion_percent REAL,
        vehicle_count INTEGER,
        travel_time_seconds INTEGER,
        baseline_travel_time_seconds INTEGER,
        delay_seconds INTEGER DEFAULT 0,
        severity_score REAL DEFAULT 0,
        status TEXT,
        source TEXT DEFAULT 'synthetic_model',
        confidence REAL DEFAULT 0.65,
        FOREIGN KEY (segment_id) REFERENCES traffic_segments (segment_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        segment_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        latitude REAL,
        longitude REAL,
        confidence REAL DEFAULT 0.55,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        FOREIGN KEY (segment_id) REFERENCES traffic_segments (segment_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS api_usage_daily (
        date TEXT NOT NULL,
        provider TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        used_units INTEGER DEFAULT 0,
        hard_limit INTEGER DEFAULT 3000,
        reserved_units INTEGER DEFAULT 450,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (date, provider, endpoint)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS route_cache (
        cache_key TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        response_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    addColumnIfMissing('traffic_segments', 'district', "TEXT DEFAULT 'Unknown'");
    addColumnIfMissing('traffic_segments', 'road_class', "TEXT DEFAULT 'collector'");
    addColumnIfMissing('traffic_segments', 'priority', 'INTEGER DEFAULT 3');
    addColumnIfMissing('traffic_segments', 'baseline_speed_kmh', 'REAL DEFAULT 40');
    addColumnIfMissing('traffic_segments', 'baseline_travel_time_seconds', 'INTEGER DEFAULT 180');
    addColumnIfMissing('traffic_segments', 'polyline_json', 'TEXT');
    addColumnIfMissing('traffic_segments', 'active', 'INTEGER DEFAULT 1');
    addColumnIfMissing('traffic_segments', 'updated_at', 'TEXT');

    addColumnIfMissing('traffic_metrics', 'baseline_travel_time_seconds', 'INTEGER');
    addColumnIfMissing('traffic_metrics', 'delay_seconds', 'INTEGER DEFAULT 0');
    addColumnIfMissing('traffic_metrics', 'severity_score', 'REAL DEFAULT 0');
    addColumnIfMissing('traffic_metrics', 'source', "TEXT DEFAULT 'synthetic_model'");
    addColumnIfMissing('traffic_metrics', 'confidence', 'REAL DEFAULT 0.65');

    db.run('CREATE INDEX IF NOT EXISTS idx_metrics_segment_time ON traffic_metrics(segment_id, timestamp DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_metrics_time ON traffic_metrics(timestamp DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_incidents_status_time ON incidents(status, created_at DESC)');
    db.run('PRAGMA journal_mode = WAL;');
});

const normalizeSegmentRow = (row) => ({
    ...row,
    priority: Number(row.priority || 3),
    active: row.active !== 0,
    polyline: row.polyline_json ? JSON.parse(row.polyline_json) : []
});

async function insertSegment(segment) {
    const polylineJson = JSON.stringify(segment.coordinates || []);

    await run(`
        INSERT INTO traffic_segments (
            segment_id, name, latitude, longitude, length_km, district, road_class,
            priority, baseline_speed_kmh, baseline_travel_time_seconds, polyline_json, active, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(segment_id) DO UPDATE SET
            name = excluded.name,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            length_km = excluded.length_km,
            district = excluded.district,
            road_class = excluded.road_class,
            priority = excluded.priority,
            baseline_speed_kmh = excluded.baseline_speed_kmh,
            baseline_travel_time_seconds = excluded.baseline_travel_time_seconds,
            polyline_json = excluded.polyline_json,
            active = 1,
            updated_at = excluded.updated_at
    `, [
        segment.segment_id,
        segment.name,
        segment.latitude,
        segment.longitude,
        segment.length_km,
        segment.district || 'Unknown',
        segment.road_class || 'collector',
        segment.priority || 3,
        segment.baseline_speed_kmh || 40,
        segment.baseline_travel_time_seconds || Math.round((segment.length_km / 40) * 3600),
        polylineJson,
        new Date().toISOString()
    ]);
}

async function insertMetric(metric) {
    const result = await run(`
        INSERT INTO traffic_metrics (
            segment_id, timestamp, speed_kmh, congestion_percent, vehicle_count,
            travel_time_seconds, baseline_travel_time_seconds, delay_seconds,
            severity_score, status, source, confidence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        metric.segment_id,
        metric.timestamp || new Date().toISOString(),
        metric.speed_kmh,
        metric.congestion_percent,
        metric.vehicle_count,
        metric.travel_time_seconds,
        metric.baseline_travel_time_seconds || null,
        metric.delay_seconds || 0,
        metric.severity_score || 0,
        metric.status,
        metric.source || 'synthetic_model',
        metric.confidence || 0.65
    ]);

    return result.lastID;
}

async function getSegments() {
    const rows = await all('SELECT * FROM traffic_segments WHERE active = 1 ORDER BY priority DESC, name ASC');
    return rows.map(normalizeSegmentRow);
}

async function getLatestMetrics() {
    const rows = await all(`
        WITH latest AS (
            SELECT segment_id, MAX(timestamp) AS max_timestamp
            FROM traffic_metrics
            GROUP BY segment_id
        )
        SELECT
            s.segment_id, s.name, s.latitude, s.longitude, s.length_km, s.district,
            s.road_class, s.priority, s.baseline_speed_kmh, s.baseline_travel_time_seconds,
            s.polyline_json,
            m.timestamp, m.speed_kmh, m.congestion_percent, m.vehicle_count,
            m.travel_time_seconds, m.delay_seconds, m.severity_score, m.status,
            m.source, m.confidence
        FROM latest l
        JOIN traffic_metrics m ON m.segment_id = l.segment_id AND m.timestamp = l.max_timestamp
        JOIN traffic_segments s ON s.segment_id = m.segment_id
        WHERE s.active = 1
        ORDER BY m.severity_score DESC, m.congestion_percent DESC
    `);

    return rows.map((row) => ({
        ...row,
        polyline: row.polyline_json ? JSON.parse(row.polyline_json) : []
    }));
}

async function getHotspots(windowMinutes = 60) {
    return all(`
        SELECT
            s.segment_id, s.name, s.latitude, s.longitude, s.district, s.priority,
            AVG(m.congestion_percent) AS avg_congestion,
            AVG(m.speed_kmh) AS avg_speed,
            AVG(m.delay_seconds) AS avg_delay_seconds,
            AVG(m.severity_score) AS avg_severity,
            MAX(m.timestamp) AS last_seen
        FROM traffic_segments s
        JOIN traffic_metrics m ON s.segment_id = m.segment_id
        WHERE datetime(substr(m.timestamp, 1, 19)) >= datetime('now', '-' || ? || ' minutes')
        GROUP BY s.segment_id
        ORDER BY avg_severity DESC, avg_congestion DESC
        LIMIT 10
    `, [Number(windowMinutes) || 60]);
}

async function getStatistics(windowMinutes = 60) {
    const row = await get(`
        SELECT
            AVG(congestion_percent) AS avg_congestion,
            MAX(congestion_percent) AS max_congestion,
            AVG(CASE
                WHEN speed_kmh < 5 THEN 5
                WHEN speed_kmh > 90 THEN 90
                ELSE speed_kmh
            END) AS avg_speed,
            AVG(delay_seconds) AS avg_delay_seconds,
            AVG(severity_score) AS avg_severity,
            COUNT(*) AS samples,
            MAX(timestamp) AS last_updated
        FROM traffic_metrics
        WHERE datetime(substr(timestamp, 1, 19)) >= datetime('now', '-' || ? || ' minutes')
    `, [Number(windowMinutes) || 60]);

    return row || {
        avg_congestion: 0,
        max_congestion: 0,
        avg_speed: 0,
        avg_delay_seconds: 0,
        avg_severity: 0,
        samples: 0,
        last_updated: null
    };
}

async function getSegmentHistory(segmentId, limit = 96) {
    return all(`
        SELECT *
        FROM traffic_metrics
        WHERE segment_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    `, [segmentId, Math.min(Number(limit) || 96, 500)]);
}

async function getDistrictAnalytics(windowMinutes = 180) {
    return all(`
        SELECT
            s.district,
            COUNT(DISTINCT s.segment_id) AS segment_count,
            AVG(m.congestion_percent) AS avg_congestion,
            AVG(m.delay_seconds) AS avg_delay_seconds,
            AVG(m.severity_score) AS avg_severity
        FROM traffic_segments s
        JOIN traffic_metrics m ON s.segment_id = m.segment_id
        WHERE datetime(substr(m.timestamp, 1, 19)) >= datetime('now', '-' || ? || ' minutes')
        GROUP BY s.district
        ORDER BY avg_severity DESC
    `, [Number(windowMinutes) || 180]);
}

async function exportDataset(days) {
    return all(`
        SELECT s.name, s.latitude, s.longitude, s.district, s.road_class, m.*
        FROM traffic_metrics m
        JOIN traffic_segments s ON m.segment_id = s.segment_id
        WHERE datetime(substr(m.timestamp, 1, 19)) >= datetime('now', '-' || ? || ' days')
        ORDER BY m.timestamp DESC
    `, [Number(days) || 7]);
}

async function getSegmentById(segmentId) {
    if (!segmentId) return null;
    const row = await get('SELECT * FROM traffic_segments WHERE segment_id = ? AND active = 1', [segmentId]);
    return row ? normalizeSegmentRow(row) : null;
}

async function insertIncident(incident) {
    const segment = incident.segment_id ? await getSegmentById(incident.segment_id) : null;
    if (incident.segment_id && !segment) {
        const error = new Error('Unknown corridor id');
        error.code = 'UNKNOWN_SEGMENT';
        throw error;
    }

    const expiresAt = incident.expires_at || new Date(Date.now() + (3 * 60 * 60 * 1000)).toISOString();
    const createdAt = new Date().toISOString();
    const result = await run(`
        INSERT INTO incidents (
            segment_id, type, title, description, latitude, longitude, confidence, status, created_at, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [
        segment ? segment.segment_id : null,
        incident.type || 'report',
        incident.title || 'User report',
        incident.description || '',
        incident.latitude ?? (segment && segment.latitude) ?? null,
        incident.longitude ?? (segment && segment.longitude) ?? null,
        incident.confidence || 0.55,
        createdAt,
        expiresAt
    ]);

    return get(`
        SELECT i.*, s.name AS segment_name, s.district AS segment_district
        FROM incidents i
        LEFT JOIN traffic_segments s ON s.segment_id = i.segment_id
        WHERE i.id = ?
    `, [result.lastID]);
}

async function getActiveIncidents() {
    return all(`
        SELECT i.*, s.name AS segment_name
        FROM incidents i
        LEFT JOIN traffic_segments s ON s.segment_id = i.segment_id
        WHERE i.status = 'active'
          AND (i.expires_at IS NULL OR datetime(substr(i.expires_at, 1, 19)) >= datetime('now'))
        ORDER BY i.created_at DESC
        LIMIT 50
    `);
}

async function recordApiUsage(provider, endpoint, units = 1, hardLimit = 1000, reservedUnits = 100) {
    const date = new Date().toISOString().slice(0, 10);
    await run(`
        INSERT INTO api_usage_daily (date, provider, endpoint, used_units, hard_limit, reserved_units, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, provider, endpoint) DO UPDATE SET
            used_units = used_units + excluded.used_units,
            hard_limit = excluded.hard_limit,
            reserved_units = excluded.reserved_units,
            updated_at = excluded.updated_at
    `, [date, provider, endpoint, units, hardLimit, reservedUnits, new Date().toISOString()]);
}

async function getQuotaStatus() {
    const date = new Date().toISOString().slice(0, 10);
    const rows = await all('SELECT * FROM api_usage_daily WHERE date = ?', [date]);
    const used = rows.reduce((sum, row) => sum + Number(row.used_units || 0), 0);
    const hardLimit = rows[0] ? Number(rows[0].hard_limit || 1000) : 1000;
    const reservedUnits = rows[0] ? Number(rows[0].reserved_units || 100) : 100;
    const remaining = Math.max(0, hardLimit - used);
    const safeRemaining = Math.max(0, hardLimit - reservedUnits - used);

    return {
        date,
        provider: '2gis',
        used,
        hard_limit: hardLimit,
        reserved_units: reservedUnits,
        remaining,
        safe_remaining: safeRemaining,
        usage_percent: hardLimit ? Math.round((used / hardLimit) * 1000) / 10 : 0,
        status: safeRemaining <= 0 ? 'locked' : used > hardLimit * 0.75 ? 'careful' : 'healthy',
        endpoints: rows
    };
}

async function getCachedRoute(cacheKey) {
    const row = await get(`
        SELECT *
        FROM route_cache
        WHERE cache_key = ?
          AND datetime(substr(expires_at, 1, 19)) >= datetime('now')
    `, [cacheKey]);

    return row ? JSON.parse(row.response_json) : null;
}

async function setCachedRoute(cacheKey, provider, payload, ttlSeconds = 300) {
    const expiresAt = new Date(Date.now() + (ttlSeconds * 1000)).toISOString();
    await run(`
        INSERT INTO route_cache (cache_key, provider, response_json, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            provider = excluded.provider,
            response_json = excluded.response_json,
            expires_at = excluded.expires_at,
            created_at = excluded.created_at
    `, [cacheKey, provider, JSON.stringify(payload), expiresAt, new Date().toISOString()]);
}

module.exports = {
    db,
    run,
    get,
    all,
    insertMetric,
    insertSegment,
    getSegments,
    getLatestMetrics,
    getHotspots,
    getStatistics,
    getSegmentHistory,
    getDistrictAnalytics,
    exportDataset,
    getSegmentById,
    insertIncident,
    getActiveIncidents,
    recordApiUsage,
    getQuotaStatus,
    getCachedRoute,
    setCachedRoute
};
