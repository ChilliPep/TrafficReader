// GIS standard: coordinates are [longitude, latitude]
function haversineKm(lon1, lat1, lon2, lat2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const segments = [
    {
        segment_id: 'seg_kyzylorda_1',
        name: 'Aiteke Bi Avenue',
        district: 'City Center',
        road_class: 'arterial',
        priority: 5,
        length_km: 3.0,
        baseline_speed_kmh: 44,
        latitude: 44.842390,
        longitude: 65.502240,
        coordinates: [
            [65.502240, 44.842390],
            [65.502440, 44.842390]
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
        latitude: 44.840005,
        longitude: 65.493447,
        coordinates: [
            [65.493447, 44.840005],
            [65.493647, 44.840005]
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
        latitude: 44.832582,
        longitude: 65.507194,
        coordinates: [
            [65.507194, 44.832582],
            [65.507394, 44.832582]
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
        latitude: 44.842838,
        longitude: 65.502001,
        coordinates: [
            [65.502001, 44.842838],
            [65.502201, 44.842838]
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
        latitude: 44.838500,
        longitude: 65.510500,
        coordinates: [
            [65.510500, 44.838500],
            [65.510700, 44.838500]
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
        latitude: 44.836000,
        longitude: 65.500500,
        coordinates: [
            [65.500500, 44.836000],
            [65.500700, 44.836000]
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
        latitude: 44.835500,
        longitude: 65.505500,
        coordinates: [
            [65.505500, 44.835500],
            [65.505700, 44.835500]
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
        latitude: 44.841000,
        longitude: 65.506500,
        coordinates: [
            [65.506500, 44.841000],
            [65.506700, 44.841000]
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
        latitude: 44.828000,
        longitude: 65.512000,
        coordinates: [
            [65.512000, 44.828000],
            [65.512200, 44.828000]
        ]
    }
];

module.exports = segments.map((segment) => {
    const start = {
        lon: segment.coordinates[0][0],
        lat: segment.coordinates[0][1]
    };
    const end = {
        lon: segment.coordinates[segment.coordinates.length - 1][0],
        lat: segment.coordinates[segment.coordinates.length - 1][1]
    };
    const probeLengthKm = Math.max(0.15, roundProbe(haversineKm(start.lon, start.lat, end.lon, end.lat)));

    return {
        ...segment,
        probe_length_km: probeLengthKm,
        baseline_travel_time_seconds: Math.round((probeLengthKm / segment.baseline_speed_kmh) * 3600),
        start,
        end
    };
});

function roundProbe(value) {
    return Math.round(value * 1000) / 1000;
}
