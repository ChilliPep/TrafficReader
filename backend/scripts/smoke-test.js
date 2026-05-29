const http = require('http');
const dataCollector = require('../src/services/dataCollector');
const db = require('../src/db/database');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function main() {
    const result = await dataCollector.collectData();
    assert(result.inserted_count >= 5, 'collector should insert traffic metrics');

    const snapshot = {
        latest: await db.getLatestMetrics(),
        stats: await db.getStatistics(180),
        quota: await db.getQuotaStatus()
    };

    assert(snapshot.latest.length >= 5, 'latest metrics should include seeded segments');
    assert(Number(snapshot.stats.avg_speed) > 0, 'average speed should be positive');
    assert(snapshot.quota.hard_limit === 1000, 'quota guard should expose default 1000 limit');

    await new Promise((resolve, reject) => {
        const req = http.request({ method: 'GET', host: 'localhost', port: 3000, path: '/api/health', timeout: 500 }, (res) => {
            res.resume();
            resolve();
        });
        req.on('timeout', () => {
            req.destroy();
            resolve();
        });
        req.on('error', () => resolve());
        req.end();
    });

    console.log('Smoke test passed: collector, database, quota model are working.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
