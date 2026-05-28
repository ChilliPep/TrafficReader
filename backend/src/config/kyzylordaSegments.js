const segments = [
    {
        segment_id: 'seg_kyzylorda_1',
        name: 'Nursultana Nazarbayeva Ave',
        district: 'City Center',
        road_class: 'arterial',
        priority: 5,
        length_km: 2.5,
        baseline_speed_kmh: 44,
        latitude: 46.3168,
        longitude: 65.2797,
        coordinates: [
            [65.2639, 46.3199],
            [65.2717, 46.3185],
            [65.2797, 46.3168],
            [65.2882, 46.3149]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_2',
        name: 'Maylin Street',
        district: 'North-East',
        road_class: 'collector',
        priority: 3,
        length_km: 1.8,
        baseline_speed_kmh: 38,
        latitude: 46.3200,
        longitude: 65.2850,
        coordinates: [
            [65.2780, 46.3260],
            [65.2816, 46.3232],
            [65.2850, 46.3200],
            [65.2886, 46.3168]
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
        latitude: 46.3050,
        longitude: 65.2800,
        coordinates: [
            [65.2638, 46.3071],
            [65.2722, 46.3061],
            [65.2800, 46.3050],
            [65.2910, 46.3033],
            [65.2990, 46.3025]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_4',
        name: 'Zhibek Zholy Street',
        district: 'Central Market',
        road_class: 'collector',
        priority: 4,
        length_km: 1.5,
        baseline_speed_kmh: 34,
        latitude: 46.3100,
        longitude: 65.2900,
        coordinates: [
            [65.2842, 46.3151],
            [65.2869, 46.3128],
            [65.2900, 46.3100],
            [65.2943, 46.3067]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_5',
        name: 'Zheltoksan Street',
        district: 'West Center',
        road_class: 'collector',
        priority: 3,
        length_km: 2.1,
        baseline_speed_kmh: 36,
        latitude: 46.3150,
        longitude: 65.2750,
        coordinates: [
            [65.2680, 46.3230],
            [65.2714, 46.3192],
            [65.2750, 46.3150],
            [65.2790, 46.3104]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_6',
        name: 'Korkyt Ata Street',
        district: 'Railway Station',
        road_class: 'arterial',
        priority: 4,
        length_km: 2.7,
        baseline_speed_kmh: 42,
        latitude: 46.3237,
        longitude: 65.2706,
        coordinates: [
            [65.2585, 46.3258],
            [65.2660, 46.3245],
            [65.2706, 46.3237],
            [65.2790, 46.3225],
            [65.2868, 46.3212]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_7',
        name: 'Aiteke Bi Street',
        district: 'Administrative Core',
        road_class: 'collector',
        priority: 4,
        length_km: 1.9,
        baseline_speed_kmh: 35,
        latitude: 46.3126,
        longitude: 65.2825,
        coordinates: [
            [65.2764, 46.3183],
            [65.2791, 46.3158],
            [65.2825, 46.3126],
            [65.2865, 46.3090]
        ]
    },
    {
        segment_id: 'seg_kyzylorda_8',
        name: 'Central Market Access',
        district: 'Central Market',
        road_class: 'local',
        priority: 5,
        length_km: 1.2,
        baseline_speed_kmh: 26,
        latitude: 46.3092,
        longitude: 65.2865,
        coordinates: [
            [65.2814, 46.3112],
            [65.2841, 46.3100],
            [65.2865, 46.3092],
            [65.2904, 46.3084]
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
        latitude: 46.2974,
        longitude: 65.3336,
        coordinates: [
            [65.3000, 46.3024],
            [65.3128, 46.3002],
            [65.3256, 46.2984],
            [65.3336, 46.2974]
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
