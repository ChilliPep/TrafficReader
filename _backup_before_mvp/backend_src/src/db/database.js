const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS traffic_segments (
        segment_id TEXT PRIMARY KEY,
        name TEXT,
        latitude REAL,
        longitude REAL,
        length_km REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS traffic_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        segment_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        speed_kmh REAL,
        congestion_percent REAL,
        vehicle_count INTEGER,
        travel_time_seconds INTEGER,
        status TEXT,
        FOREIGN KEY (segment_id) REFERENCES traffic_segments (segment_id)
    )`);
});

const insertMetric = (metric) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT INTO traffic_metrics (segment_id, timestamp, speed_kmh, congestion_percent, vehicle_count, travel_time_seconds, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(
            metric.segment_id, 
            metric.timestamp || new Date().toISOString(), 
            metric.speed_kmh, 
            metric.congestion_percent, 
            metric.vehicle_count, 
            metric.travel_time_seconds, 
            metric.status,
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
        stmt.finalize();
    });
};

const insertSegment = (segment) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT OR IGNORE INTO traffic_segments (segment_id, name, latitude, longitude, length_km) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(
            segment.segment_id, 
            segment.name, 
            segment.latitude, 
            segment.longitude, 
            segment.length_km,
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
        stmt.finalize();
    });
};

const getHotspots = () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                s.segment_id, s.name, s.latitude, s.longitude,
                AVG(m.congestion_percent) as avg_congestion,
                AVG(m.speed_kmh) as avg_speed
            FROM traffic_segments s
            JOIN traffic_metrics m ON s.segment_id = m.segment_id
            WHERE m.timestamp >= datetime('now', '-1 hour')
            GROUP BY s.segment_id
            ORDER BY avg_congestion DESC
            LIMIT 10
        `, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getStatistics = () => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                AVG(congestion_percent) as avg_congestion,
                MAX(congestion_percent) as max_congestion,
                AVG(speed_kmh) as avg_speed
            FROM traffic_metrics
            WHERE timestamp >= datetime('now', '-1 hour')
        `, [], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getSegmentHistory = (segmentId) => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM traffic_metrics 
            WHERE segment_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 50
        `, [segmentId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const exportDataset = (days) => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT s.name, s.latitude, s.longitude, m.* 
            FROM traffic_metrics m
            JOIN traffic_segments s ON m.segment_id = s.segment_id
            WHERE m.timestamp >= datetime('now', '-' || ? || ' days')
        `, [days], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = {
    db,
    insertMetric,
    insertSegment,
    getHotspots,
    getStatistics,
    getSegmentHistory,
    exportDataset
};
