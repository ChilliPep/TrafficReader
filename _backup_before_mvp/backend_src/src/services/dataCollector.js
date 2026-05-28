const db = require('../db/database');
const axios = require('axios');
require('dotenv').config({ path: '../../.env' });

const segments = [
    { segment_id: 'seg_kyzylorda_1', name: 'Nursultana Nazarbayeva Ave', latitude: 46.3168, longitude: 65.2797, length_km: 2.5 },
    { segment_id: 'seg_kyzylorda_2', name: 'Maylin Street', latitude: 46.3200, longitude: 65.2850, length_km: 1.8 },
    { segment_id: 'seg_kyzylorda_3', name: 'Abay Avenue', latitude: 46.3050, longitude: 65.2800, length_km: 3.2 },
    { segment_id: 'seg_kyzylorda_4', name: 'Zhibek Zholy Street', latitude: 46.3100, longitude: 65.2900, length_km: 1.5 },
    { segment_id: 'seg_kyzylorda_5', name: 'Zheltoksan Street', latitude: 46.3150, longitude: 65.2750, length_km: 2.1 }
];

async function initSegments() {
    for (const seg of segments) {
        await db.insertSegment(seg).catch(console.error);
    }
}

async function collectData() {
    console.log(`[${new Date().toISOString()}] Starting data collection cycle...`);
    
    // Mocking the data for Kyzylorda based on time of day
    const hour = new Date().getHours();
    const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19);
    
    for (const seg of segments) {
        // Base congestion 10-30%, rush hour adds 40-60%
        const baseCongestion = 10 + Math.random() * 20;
        const rushHourBump = isRushHour ? (40 + Math.random() * 20) : 0;
        const congestion = Math.min(100, baseCongestion + rushHourBump);
        
        // Speed is inversely proportional to congestion
        const speed = Math.max(5, 60 - (congestion * 0.5));
        
        let status = 'free';
        if (congestion > 80) status = 'blocked';
        else if (congestion > 60) status = 'heavy';
        else if (congestion > 40) status = 'moderate';
        else if (congestion > 20) status = 'light';
        
        const metric = {
            segment_id: seg.segment_id,
            timestamp: new Date().toISOString(),
            speed_kmh: speed,
            congestion_percent: congestion,
            vehicle_count: Math.floor((congestion / 100) * 500) + 50,
            travel_time_seconds: Math.floor((seg.length_km / speed) * 3600),
            status: status
        };
        
        await db.insertMetric(metric).catch(console.error);
    }
    console.log(`[${new Date().toISOString()}] Data collection completed.`);
}

function startCollection() {
    const pollInterval = parseInt(process.env.POLL_INTERVAL || '300000');
    initSegments().then(() => {
        collectData(); // Initial run
        setInterval(collectData, pollInterval);
    });
}

module.exports = {
    startCollection,
    collectData
};
