const URBAN_SPEED_MIN_KMH = 5;
const URBAN_SPEED_MAX_KMH = 90;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function haversineKm(lon1, lat1, lon2, lat2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getProbeLengthKm(segment) {
    if (Number(segment.probe_length_km) > 0) {
        return Number(segment.probe_length_km);
    }

    if (segment.start && segment.end) {
        const probe = haversineKm(
            segment.start.lon,
            segment.start.lat,
            segment.end.lon,
            segment.end.lat
        );
        if (probe > 0.01) return round(probe, 3);
    }

    return Number(segment.length_km) || 0.5;
}

function normalizeRouteDistanceMeters(distance, segment) {
    const probeKm = getProbeLengthKm(segment);
    if (!Number.isFinite(distance) || distance <= 0) {
        return probeKm * 1000;
    }

    // 2GIS returns meters; guard against km or bad values.
    if (distance < 20 && probeKm > 0.2) {
        return probeKm * 1000;
    }

    if (distance > 0 && distance < 50000) {
        return distance;
    }

    return probeKm * 1000;
}

function normalizeRouteDurationSeconds(durationSeconds, distanceMeters) {
    let duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
        return null;
    }

    // Some providers return milliseconds for short urban hops.
    const distanceKm = distanceMeters / 1000;
    const speedIfSeconds = distanceKm / (duration / 3600);
    if (speedIfSeconds > 250 && duration >= 1000) {
        duration = duration / 1000;
    }

    return Math.max(8, Math.round(duration));
}

function calculateSpeedKmh(distanceKm, durationSeconds, fallbackSpeedKmh = 40) {
    if (!durationSeconds || durationSeconds <= 0 || !distanceKm || distanceKm <= 0) {
        return clamp(fallbackSpeedKmh, URBAN_SPEED_MIN_KMH, URBAN_SPEED_MAX_KMH);
    }

    const rawSpeed = distanceKm / (durationSeconds / 3600);
    return round(clamp(rawSpeed, URBAN_SPEED_MIN_KMH, URBAN_SPEED_MAX_KMH));
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function getTrafficStatus(congestionPercent) {
    if (congestionPercent >= 80) return 'severe';
    if (congestionPercent >= 60) return 'heavy';
    if (congestionPercent >= 38) return 'medium';
    if (congestionPercent >= 18) return 'light';
    return 'free';
}

function calculateCongestion(currentDurationSeconds, baselineDurationSeconds) {
    if (!currentDurationSeconds || !baselineDurationSeconds) return 0;
    const delayRatio = currentDurationSeconds / baselineDurationSeconds;
    return round(clamp(((delayRatio - 1) / 1.45) * 100, 0, 100));
}

function calculateSeverity({ congestionPercent, speedKmh, baselineSpeedKmh, delaySeconds, priority }) {
    const delayScore = clamp(congestionPercent / 100, 0, 1);
    const lowSpeedScore = clamp(1 - (speedKmh / Math.max(baselineSpeedKmh, 1)), 0, 1);
    const delayMinutesScore = clamp(delaySeconds / 900, 0, 1);
    const priorityScore = clamp(priority / 5, 0, 1);

    return round(100 * (
        (delayScore * 0.45) +
        (lowSpeedScore * 0.25) +
        (delayMinutesScore * 0.20) +
        (priorityScore * 0.10)
    ));
}

function buildMetricFromDuration(segment, currentDurationSeconds, source, confidence, options = {}) {
    const probeLengthKm = getProbeLengthKm(segment);
    const distanceMeters = normalizeRouteDistanceMeters(options.routeDistanceMeters, segment);
    const distanceKm = distanceMeters / 1000;

    const normalizedDuration = normalizeRouteDurationSeconds(currentDurationSeconds, distanceMeters);
    const travelTimeSeconds = normalizedDuration ||
        Math.round((distanceKm / Math.max(segment.baseline_speed_kmh || 40, 1)) * 3600);

    const baselineDurationSeconds = Math.max(
        20,
        Math.round((probeLengthKm / Math.max(segment.baseline_speed_kmh || 40, 1)) * 3600)
    );

    const speedKmh = calculateSpeedKmh(distanceKm, travelTimeSeconds, segment.baseline_speed_kmh);
    const congestionPercent = calculateCongestion(travelTimeSeconds, baselineDurationSeconds);
    const delaySeconds = Math.max(0, Math.round(travelTimeSeconds - baselineDurationSeconds));
    const severityScore = calculateSeverity({
        congestionPercent,
        speedKmh,
        baselineSpeedKmh: segment.baseline_speed_kmh,
        delaySeconds,
        priority: segment.priority
    });

    return {
        segment_id: segment.segment_id,
        timestamp: new Date().toISOString(),
        speed_kmh: speedKmh,
        congestion_percent: congestionPercent,
        vehicle_count: Math.round(40 + (congestionPercent * 4.2) + (segment.priority * 11)),
        travel_time_seconds: travelTimeSeconds,
        baseline_travel_time_seconds: baselineDurationSeconds,
        delay_seconds: delaySeconds,
        severity_score: severityScore,
        status: getTrafficStatus(congestionPercent),
        source,
        confidence
    };
}

module.exports = {
    buildMetricFromDuration,
    calculateCongestion,
    calculateSeverity,
    calculateSpeedKmh,
    clamp,
    getProbeLengthKm,
    getTrafficStatus,
    normalizeRouteDistanceMeters,
    normalizeRouteDurationSeconds,
    round,
    URBAN_SPEED_MAX_KMH,
    URBAN_SPEED_MIN_KMH
};
