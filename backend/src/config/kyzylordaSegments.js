const segments = [
    {
        segment_id: 'seg_kyzylorda_1',
        name: 'Aiteke Bi Avenue',
        district: 'City Center',
        road_class: 'arterial',
        priority: 5,
        length_km: 3.0,
        baseline_speed_kmh: 44,
        latitude: 44.8530,
        longitude: 65.5030,
        coordinates: [
            [65.4850, 44.8545],
            [65.4920, 44.8540],
            [65.5000, 44.8533],
            [65.5080, 44.8525],
            [65.5160, 44.8518]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_2',
        name: 'Korkyt Ata Street',
        district: 'North Center',
        road_class: 'arterial',
        priority: 4,
        length_km: 2.5,
        baseline_speed_kmh: 42,
        latitude: 44.8580,
        longitude: 65.5050,
        coordinates: [
            [65.4880, 44.8595],
            [65.4950, 44.8590],
            [65.5030, 44.8582],
            [65.5110, 44.8575],
            [65.5180, 44.8568]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_3',
        name: 'Abay Avenue',
        district: 'South Center',
        road_class: 'arterial',
        priority: 5,
        length_km: 3.2,
        baseline_speed_kmh: 46,
        latitude: 44.8480,
        longitude: 65.5020,
        coordinates: [
            [65.4830, 44.8495],
            [65.4910, 44.8490],
            [65.5000, 44.8483],
            [65.5090, 44.8475],
            [65.5170, 44.8468]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_4',
        name: 'Zheltoksan Street',
        district: 'West Center',
        road_class: 'collector',
        priority: 4,
        length_km: 1.8,
        baseline_speed_kmh: 36,
        latitude: 44.8530,
        longitude: 65.4920,
        coordinates: [
            [65.4910, 44.8610],
            [65.4915, 44.8570],
            [65.4920, 44.8530],
            [65.4925, 44.8490],
            [65.4930, 44.8450]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_5',
        name: 'Tokmagambetov Street',
        district: 'East Center',
        road_class: 'collector',
        priority: 3,
        length_km: 1.6,
        baseline_speed_kmh: 34,
        latitude: 44.8530,
        longitude: 65.5120,
        coordinates: [
            [65.5110, 44.8610],
            [65.5113, 44.8570],
            [65.5118, 44.8530],
            [65.5122, 44.8490],
            [65.5125, 44.8450]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_6',
        name: 'Muratbayev Street',
        district: 'Railway Station',
        road_class: 'collector',
        priority: 4,
        length_km: 2.0,
        baseline_speed_kmh: 38,
        latitude: 44.8560,
        longitude: 65.5010,
        coordinates: [
            [65.5000, 44.8630],
            [65.5005, 44.8590],
            [65.5010, 44.8550],
            [65.5012, 44.8510],
            [65.5015, 44.8470]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_7',
        name: 'Zhibek Zholy Street',
        district: 'Central Market',
        road_class: 'collector',
        priority: 5,
        length_km: 1.5,
        baseline_speed_kmh: 30,
        latitude: 44.8510,
        longitude: 65.5060,
        coordinates: [
            [65.4960, 44.8515],
            [65.5000, 44.8512],
            [65.5050, 44.8508],
            [65.5100, 44.8505],
            [65.5140, 44.8502]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_8',
        name: 'Sultanbayev Street',
        district: 'Administrative Core',
        road_class: 'local',
        priority: 3,
        length_km: 1.2,
        baseline_speed_kmh: 28,
        latitude: 44.8560,
        longitude: 65.5070,
        coordinates: [
            [65.5060, 44.8610],
            [65.5063, 44.8590],
            [65.5067, 44.8560],
            [65.5070, 44.8540],
            [65.5073, 44.8520]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_9',
        name: 'Airport Road Connector',
        district: 'East Gateway',
        road_class: 'arterial',
        priority: 3,
        length_km: 4.4,
        baseline_speed_kmh: 58,
        latitude: 44.8460,
        longitude: 65.5400,
        coordinates: [
            [65.5200, 44.8490],
            [65.5300, 44.8480],
            [65.5400, 44.8465],
            [65.5500, 44.8455],
            [65.5600, 44.8445]
        ]
    }
];

module.exports = segments.map((segment) => ({
    ...segment,
    baseline_travel_time_seconds: Math.round((segment.length_km / segment.baseline_speed_kmh) * 3600),
    start: {
        lon: segment.coordinates[0][0],
        lat: segment.coordinates[0][1]
    },
    end: {
        lon: segment.coordinates[segment.coordinates.length - 1][0],
        lat: segment.coordinates[segment.coordinates.length - 1][1]
    }
}));
