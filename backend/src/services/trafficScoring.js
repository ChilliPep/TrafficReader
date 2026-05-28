function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

function buildMetricFromDuration(segment, currentDurationSeconds, source, confidence) {
    const baselineDurationSeconds = segment.baseline_travel_time_seconds;
    const speedKmh = round(segment.length_km / (currentDurationSeconds / 3600));
    const congestionPercent = calculateCongestion(currentDurationSeconds, baselineDurationSeconds);
    const delaySeconds = Math.max(0, Math.round(currentDurationSeconds - baselineDurationSeconds));
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
        travel_time_seconds: Math.round(currentDurationSeconds),
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
    clamp,
    getTrafficStatus,
    round
};
