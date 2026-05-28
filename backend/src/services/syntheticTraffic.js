const { buildMetricFromDuration, clamp, round } = require('./trafficScoring');

function hashSegment(segmentId) {
    return segmentId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getKyzylordaHour(date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Qyzylorda',
        hour: 'numeric',
        hour12: false,
        minute: 'numeric',
        weekday: 'short'
    });

    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour').value);
    const minute = Number(parts.find((part) => part.type === 'minute').value);
    const weekday = parts.find((part) => part.type === 'weekday').value;

    return {
        hour: hour + (minute / 60),
        weekday
    };
}

function bellCurve(hour, center, width) {
    return Math.exp(-Math.pow(hour - center, 2) / (2 * Math.pow(width, 2)));
}

function getTemporalPressure(now) {
    const { hour, weekday } = getKyzylordaHour(now);
    const weekendMultiplier = ['Sat', 'Sun'].includes(weekday) ? 0.72 : 1;
    const morning = bellCurve(hour, 8.25, 0.75);
    const lunch = bellCurve(hour, 13.0, 0.90);
    const evening = bellCurve(hour, 18.15, 0.95);
    const nightRelief = hour >= 23 || hour < 6 ? -0.18 : 0;

    return clamp(((morning * 0.62) + (lunch * 0.28) + (evening * 0.72)) * weekendMultiplier + nightRelief, 0, 1);
}

function getDistrictPressure(segment, hour) {
    if (segment.district === 'Central Market') {
        return bellCurve(hour, 11.2, 1.8) * 0.22;
    }

    if (segment.district === 'Railway Station') {
        return (bellCurve(hour, 8.0, 1.1) + bellCurve(hour, 19.2, 1.3)) * 0.12;
    }

    if (segment.district === 'Administrative Core') {
        return bellCurve(hour, 9.0, 1.4) * 0.16;
    }

    return 0;
}

function getOrganicNoise(segment, now) {
    const seed = hashSegment(segment.segment_id);
    const bucket = Math.floor(now.getTime() / (5 * 60 * 1000));
    const slowWave = Math.sin((bucket + seed) / 4.2) * 0.055;
    const fastWave = Math.cos((bucket * 1.7 + seed) / 3.1) * 0.035;
    return slowWave + fastWave;
}

function estimateMetric(segment, now = new Date()) {
    const { hour } = getKyzylordaHour(now);
    const networkPressure = getTemporalPressure(now);
    const districtPressure = getDistrictPressure(segment, hour);
    const priorityPressure = (segment.priority - 1) * 0.055;
    const roadPressure = segment.road_class === 'local' ? 0.16 : segment.road_class === 'collector' ? 0.08 : 0.03;
    const noise = getOrganicNoise(segment, now);

    const pressure = clamp(networkPressure + districtPressure + priorityPressure + roadPressure + noise, 0.02, 0.95);
    const delayRatio = 1 + (pressure * 1.38);
    const currentDurationSeconds = Math.round(segment.baseline_travel_time_seconds * delayRatio);
    const confidence = round(0.58 + (pressure * 0.18), 2);

    return buildMetricFromDuration(segment, currentDurationSeconds, 'synthetic_model', confidence);
}

module.exports = {
    estimateMetric,
    getKyzylordaHour,
    getTemporalPressure
};
