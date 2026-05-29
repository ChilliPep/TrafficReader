const API_BASE = '/api/traffic';
const REFRESH_SECONDS = 15;

const state = {
    snapshot: null,
    selectedSegmentId: null,
    history: [],
    forecast: null,
    countdown: REFRESH_SECONDS
};

let map;
let segmentLayerGroup;
let incidentLayerGroup;
const segmentMarkers = new Map();
const SEGMENT_ID_PATTERN = /^[a-z0-9_-]{3,50}$/i;

const incidentTypeLabel = {
    jam: 'Traffic jam',
    roadwork: 'Roadwork',
    accident: 'Accident',
    hazard: 'Hazard',
    police: 'Police',
    report: 'Other report'
};

const statusLabel = {
    free: 'Free',
    light: 'Light',
    medium: 'Medium',
    heavy: 'Heavy',
    severe: 'Severe'
};

function qs(selector) {
    return document.querySelector(selector);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatPercent(value) {
    return `${Math.round(Number(value || 0))}%`;
}

function formatSpeed(value) {
    const speed = Math.round(Number(value || 0));
    const clamped = Math.max(5, Math.min(90, speed));
    return `${clamped} km/h`;
}

function formatDelay(seconds) {
    const value = Math.round(Number(seconds || 0));
    if (value < 60) return `${value}s`;
    return `${Math.round(value / 60)}m`;
}

function formatSource(source) {
    const value = String(source || '').toLowerCase();
    if (value.includes('2gis')) return '2GIS';
    return 'Synthetic';
}

function formatClock(iso) {
    if (!iso) return '--';
    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date(iso));
}

function setLoadingError(message) {
    qs('#hotspot-list').innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
    qs('#city-state-title').textContent = 'Dashboard offline';
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

async function refreshSnapshot() {
    try {
        const snapshot = await fetchJson(`${API_BASE}/snapshot`);
        state.snapshot = snapshot;

        if (!state.selectedSegmentId && snapshot.segments && snapshot.segments.length > 0) {
            state.selectedSegmentId = snapshot.segments[0].segment_id;
        }

        renderSnapshot();
        await refreshSelectedSegment();
        state.countdown = REFRESH_SECONDS;
    } catch (error) {
        setLoadingError('Could not load traffic snapshot. Check backend server.');
    }
}

async function refreshSelectedSegment() {
    if (!state.selectedSegmentId) return;

    const [history, forecast] = await Promise.all([
        fetchJson(`${API_BASE}/segment/${state.selectedSegmentId}?limit=60`),
        fetchJson(`${API_BASE}/forecast/${state.selectedSegmentId}`)
    ]);

    state.history = history;
    state.forecast = forecast;
    renderSegmentDetail();
    renderHistoryChart();
    renderForecast();
}

function getStatusClass(status) {
    return `status-${status || 'free'}`;
}

function getSelectedSegment() {
    return state.snapshot?.segments?.find((segment) => segment.segment_id === state.selectedSegmentId) || null;
}

function getStatusColor(status) {
    const colors = {
        free: '#45b97c',
        light: '#a9c75f',
        medium: '#d5a541',
        heavy: '#d96961',
        severe: '#b9414d'
    };
    return colors[status || 'free'];
}

function renderSnapshot() {
    const { snapshot } = state;
    if (!snapshot) return;

    qs('#collector-mode').textContent = snapshot.source === '2gis'
        ? '2GIS routing mode'
        : snapshot.collector?.mode === '2gis_routing'
            ? '2GIS routing mode'
            : 'Demo-safe synthetic mode';
    qs('#city-state-title').textContent = `Network is ${snapshot.city?.status || 'loading'}`;
    qs('#last-updated').textContent = formatClock(snapshot.updated_at);
    qs('#kpi-congestion').textContent = formatPercent(snapshot.statistics?.avg_congestion);
    qs('#kpi-speed').textContent = formatSpeed(snapshot.statistics?.avg_speed);
    qs('#kpi-delay').textContent = formatDelay(snapshot.statistics?.avg_delay_seconds);
    qs('#kpi-quota').textContent = `${snapshot.quota?.safe_remaining ?? '--'} left`;

    renderMap();
    renderHotspots();
    renderDistricts();
    renderIncidents();
    populateIncidentSegments();
    syncIncidentFormWithSelection();
}

function getSegmentGeoPoint(segment) {
    const lon = Number(segment.longitude);
    const lat = Number(segment.latitude);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return [lon, lat];
    }

    const polyline = segment.polyline || [];
    if (polyline.length > 0 && Array.isArray(polyline[0])) {
        return [Number(polyline[0][0]), Number(polyline[0][1])];
    }

    return null;
}

function initMap() {
    map = L.map('traffic-map', {
        zoomControl: false
    }).setView([44.838, 65.502], 14);

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    segmentLayerGroup = L.featureGroup().addTo(map);
    incidentLayerGroup = L.featureGroup().addTo(map);

    window.addEventListener('resize', () => {
        if (map) map.invalidateSize();
    });
}

function focusSegmentOnMap(segmentId, zoom = 15) {
    const marker = segmentMarkers.get(segmentId);
    if (!marker || !map) return;
    map.flyTo(marker.getLatLng(), zoom, { duration: 0.45 });
    marker.openTooltip();
}

function fitAllSegments() {
    if (!map || segmentLayerGroup.getLayers().length === 0) return;
    map.fitBounds(segmentLayerGroup.getBounds(), { padding: [48, 48], maxZoom: 14 });
}

function renderMap() {
    const segments = state.snapshot?.segments || [];
    segmentLayerGroup.clearLayers();
    segmentMarkers.clear();

    if (segments.length === 0) {
        return;
    }

    segments.forEach((segment) => {
        const geoPoint = getSegmentGeoPoint(segment);
        if (!geoPoint || !Number.isFinite(geoPoint[0]) || !Number.isFinite(geoPoint[1])) {
            return;
        }

        const [lon, lat] = geoPoint;
        const isSelected = segment.segment_id === state.selectedSegmentId;
        const congestion = Math.max(0, Math.min(100, Number(segment.congestion_percent || 0)));
        const radius = 8 + Math.round(congestion / 8);
        const color = getStatusColor(segment.status);

        const halo = L.circleMarker([lat, lon], {
            radius: radius + 7,
            stroke: false,
            fillColor: color,
            fillOpacity: isSelected ? 0.32 : 0.16
        }).addTo(segmentLayerGroup);

        const marker = L.circleMarker([lat, lon], {
            radius: isSelected ? radius + 3 : radius,
            color: '#0f1215',
            weight: isSelected ? 3 : 2,
            fillColor: color,
            fillOpacity: 0.9
        }).addTo(segmentLayerGroup);

        marker.on('click', () => selectSegment(segment.segment_id));
        halo.on('click', () => selectSegment(segment.segment_id));

        marker.bindTooltip(segment.name.replace(' Street', '').replace(' Avenue', ' Ave'), {
            direction: 'top',
            offset: [0, -8],
            className: 'map-tooltip'
        });

        marker.bindPopup(`
            <div class="map-popup">
                <strong>${escapeHtml(segment.name)}</strong><br>
                ${escapeHtml(segment.district || 'Kyzylorda')}<br>
                Congestion: ${formatPercent(segment.congestion_percent)}<br>
                Speed: ${formatSpeed(segment.speed_kmh)}<br>
                Source: ${escapeHtml(formatSource(segment.source))}
            </div>
        `);

        segmentMarkers.set(segment.segment_id, marker);
    });

    if (!map._segmentsBoundsFitted) {
        fitAllSegments();
        map._segmentsBoundsFitted = true;
    }

    if (state.selectedSegmentId) {
        focusSegmentOnMap(state.selectedSegmentId, map.getZoom());
    }

    renderIncidentsOnMap();
}

function renderIncidentsOnMap() {
    if (!incidentLayerGroup) return;
    incidentLayerGroup.clearLayers();

    const incidents = state.snapshot?.incidents || [];
    incidents.forEach((incident) => {
        const lat = Number(incident.latitude);
        const lon = Number(incident.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const marker = L.circleMarker([lat, lon], {
            radius: 9,
            color: '#6bb8c7',
            weight: 3,
            fillColor: '#101214',
            fillOpacity: 0.95
        }).addTo(incidentLayerGroup);

        marker.bindTooltip(`${incidentTypeLabel[incident.type] || incident.type}: ${incident.title}`, {
            direction: 'top',
            offset: [0, -8],
            className: 'map-tooltip incident-tooltip'
        });

        marker.bindPopup(`
            <div class="map-popup">
                <strong>${escapeHtml(incident.title)}</strong><br>
                ${escapeHtml(incidentTypeLabel[incident.type] || incident.type)}<br>
                ${escapeHtml(incident.segment_name || 'Unknown corridor')}<br>
                ${formatClock(incident.created_at)}
            </div>
        `);

        marker.on('click', () => {
            if (incident.segment_id) {
                selectSegment(incident.segment_id);
            } else {
                map.flyTo([lat, lon], 15, { duration: 0.45 });
            }
        });
    });
}

function formatTimeLeft(iso) {
    if (!iso) return '';
    const diffMs = new Date(iso).getTime() - Date.now();
    if (diffMs <= 0) return 'expiring soon';
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

function renderIncidents() {
    const list = qs('#incident-list');
    const count = qs('#incident-count');
    const incidents = state.snapshot?.incidents || [];

    count.textContent = String(incidents.length);

    if (incidents.length === 0) {
        list.innerHTML = '<div class="empty-state">No active crowd reports</div>';
        return;
    }

    list.innerHTML = incidents.map((incident) => `
        <button class="incident-item" type="button" data-incident-id="${escapeHtml(incident.id)}" data-segment-id="${escapeHtml(incident.segment_id || '')}" data-lat="${escapeHtml(incident.latitude)}" data-lon="${escapeHtml(incident.longitude)}">
            <span class="incident-type">${escapeHtml(incidentTypeLabel[incident.type] || incident.type)}</span>
            <span class="incident-title">${escapeHtml(incident.title)}</span>
            <span class="incident-meta">${escapeHtml(incident.segment_name || 'Unknown corridor')} · ${escapeHtml(formatTimeLeft(incident.expires_at))}</span>
        </button>
    `).join('');

    list.querySelectorAll('.incident-item').forEach((button) => {
        button.addEventListener('click', () => {
            const segmentId = button.dataset.segmentId;
            if (segmentId) {
                selectSegment(segmentId);
                return;
            }

            const lat = Number(button.dataset.lat);
            const lon = Number(button.dataset.lon);
            if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
                map.flyTo([lat, lon], 15, { duration: 0.45 });
            }
        });
    });
}

function renderHotspots() {
    const list = qs('#hotspot-list');
    const hotspots = state.snapshot?.hotspots || [];

    if (hotspots.length === 0) {
        list.innerHTML = '<div class="empty-state">No hotspot data in the selected window.</div>';
        return;
    }

    list.innerHTML = hotspots.slice(0, 7).map((spot) => {
        const selected = spot.segment_id === state.selectedSegmentId ? ' selected' : '';
        return `
            <button class="hotspot-item${selected}" type="button" data-segment-id="${escapeHtml(spot.segment_id)}">
                <span>
                    <p class="item-title">${escapeHtml(spot.name)}</p>
                    <p class="item-subtitle">${escapeHtml(spot.district || 'Kyzylorda')} · ${formatDelay(spot.avg_delay_seconds)} delay</p>
                </span>
                <span class="item-score ${getStatusClass(scoreToStatus(spot.avg_congestion))}">${formatPercent(spot.avg_congestion)}</span>
            </button>
        `;
    }).join('');

    list.querySelectorAll('[data-segment-id]').forEach((button) => {
        button.addEventListener('click', () => selectSegment(button.dataset.segmentId));
    });
}

function scoreToStatus(value) {
    const score = Number(value || 0);
    if (score >= 80) return 'severe';
    if (score >= 60) return 'heavy';
    if (score >= 38) return 'medium';
    if (score >= 18) return 'light';
    return 'free';
}

function renderDistricts() {
    const list = qs('#district-list');
    const districts = state.snapshot?.districts || [];

    if (districts.length === 0) {
        list.innerHTML = '<div class="empty-state">District analytics will appear after collection.</div>';
        return;
    }

    list.innerHTML = districts.map((district) => `
        <div class="district-row">
            <div>
                <div class="district-name">${escapeHtml(district.district)}</div>
                <div class="bar-track">
                    <div class="bar-fill ${getStatusClass(scoreToStatus(district.avg_congestion))}" style="width: ${Math.min(100, Math.round(district.avg_congestion || 0))}%"></div>
                </div>
            </div>
            <div class="district-value">${formatPercent(district.avg_congestion)}</div>
        </div>
    `).join('');
}

async function selectSegment(segmentId) {
    state.selectedSegmentId = segmentId;
    renderSnapshot();
    focusSegmentOnMap(segmentId);
    await refreshSelectedSegment();
}

function renderSegmentDetail() {
    const segment = getSelectedSegment();
    if (!segment) {
        qs('#segment-title').textContent = 'Select a road segment';
        qs('#segment-metrics').innerHTML = '<div class="empty-state">Click a corridor on the map.</div>';
        return;
    }

    qs('#segment-title').textContent = segment.name;
    const efficiency = Math.max(0, Math.round(100 - Number(segment.severity_score || 0)));
    qs('#segment-metrics').innerHTML = `
        <div class="segment-stat">
            <span>Status</span>
            <strong class="${getStatusClass(segment.status)}">${statusLabel[segment.status] || segment.status}</strong>
        </div>
        <div class="segment-stat">
            <span>Congestion</span>
            <strong>${formatPercent(segment.congestion_percent)}</strong>
        </div>
        <div class="segment-stat">
            <span>Travel time</span>
            <strong>${formatDelay(segment.travel_time_seconds)}</strong>
        </div>
        <div class="segment-stat">
            <span>Efficiency</span>
            <strong>${efficiency}/100</strong>
        </div>
        <div class="segment-stat">
            <span>Data source</span>
            <strong>${escapeHtml(formatSource(segment.source))}</strong>
        </div>
    `;
}

function renderHistoryChart() {
    const svg = qs('#history-chart');
    const data = [...state.history].reverse();
    svg.innerHTML = '';

    if (data.length < 2) {
        svg.innerHTML = '<text x="20" y="90" class="map-label">Not enough history yet</text>';
        qs('#history-label').textContent = '0 samples';
        return;
    }

    qs('#history-label').textContent = `${data.length} samples`;

    const width = 720;
    const height = 180;
    const pad = 20;
    const points = data.map((row, index) => {
        const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
        const y = height - pad - (Number(row.congestion_percent || 0) / 100) * (height - pad * 2);
        return [x, y];
    });
    const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `${path} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;

    svg.innerHTML = `
        <path d="${area}" fill="rgba(107, 184, 199, 0.13)"></path>
        <path d="${path}" fill="none" stroke="#6bb8c7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="rgba(232,238,242,0.18)"></line>
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="rgba(232,238,242,0.18)"></line>
        <text x="${pad}" y="${pad + 5}" fill="#8d98a1" font-size="18">100%</text>
        <text x="${pad}" y="${height - 4}" fill="#8d98a1" font-size="18">0%</text>
    `;
}

function renderForecast() {
    const list = qs('#forecast-list');
    const buckets = state.forecast?.buckets || [];

    if (buckets.length === 0) {
        list.innerHTML = '<div class="empty-state">Forecast is waiting for history.</div>';
        return;
    }

    list.innerHTML = buckets.map((bucket) => `
        <div class="forecast-row">
            <span class="forecast-time">${formatClock(bucket.at).slice(0, 5)}</span>
            <div class="bar-track">
                <div class="bar-fill ${getStatusClass(bucket.status)}" style="width: ${Math.round(bucket.congestion_percent)}%"></div>
            </div>
            <span class="forecast-value">${formatPercent(bucket.congestion_percent)}</span>
        </div>
    `).join('');
}

function populateIncidentSegments() {
    const select = qs('#incident-segment');
    const segments = [...(state.snapshot?.segments || [])].sort((a, b) => {
        return String(a.name).localeCompare(String(b.name));
    });
    const preferredValue = state.selectedSegmentId || select.value;

    if (segments.length === 0) {
        select.innerHTML = '<option value="">No corridors loaded</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = segments.map((segment) => {
        const district = segment.district || 'Kyzylorda';
        const congestion = formatPercent(segment.congestion_percent);
        return `<option value="${escapeHtml(segment.segment_id)}">${escapeHtml(segment.name)} · ${escapeHtml(district)} · ${congestion}</option>`;
    }).join('');

    if (preferredValue && segments.some((segment) => segment.segment_id === preferredValue)) {
        select.value = preferredValue;
    } else {
        select.value = segments[0].segment_id;
    }
}

function syncIncidentFormWithSelection() {
    const select = qs('#incident-segment');
    if (!select || select.disabled || !state.selectedSegmentId) return;

    const exists = [...select.options].some((option) => option.value === state.selectedSegmentId);
    if (exists) {
        select.value = state.selectedSegmentId;
    }
}

function updateIncidentFieldHints() {
    const title = qs('#incident-title');
    const description = qs('#incident-description');
    qs('#incident-title-hint').textContent = `${title.value.length} / 80`;
    qs('#incident-description-hint').textContent = `${description.value.length} / 500`;
}

function resetIncidentFormFields() {
    qs('#incident-title').value = '';
    qs('#incident-description').value = '';
    updateIncidentFieldHints();
    syncIncidentFormWithSelection();
}

async function submitIncident(event) {
    event.preventDefault();
    const status = qs('#incident-status');
    const submitButton = qs('#incident-submit');
    const formData = new FormData(event.currentTarget);
    const body = {
        segment_id: String(formData.get('segment_id') || '').trim(),
        type: String(formData.get('type') || 'report'),
        title: String(formData.get('title') || '').trim(),
        description: String(formData.get('description') || '').trim()
    };

    if (!body.segment_id) {
        status.textContent = 'Select a corridor from the current list.';
        status.className = 'form-status error-state-inline';
        return;
    }

    if (!body.title) {
        status.textContent = 'Add a short title before sending.';
        status.className = 'form-status error-state-inline';
        return;
    }

    if (!SEGMENT_ID_PATTERN.test(body.segment_id)) {
        status.textContent = 'Invalid corridor id. Refresh the page.';
        status.className = 'form-status error-state-inline';
        return;
    }

    status.className = 'form-status';
    status.textContent = 'Sending report...';
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/incidents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error(payload.error || 'Too many requests. Wait a minute and try again.');
            }
            throw new Error(payload.error || `Request failed: ${response.status}`);
        }

        resetIncidentFormFields();
        status.textContent = `Report saved for ${payload.segment_name || 'selected corridor'}. Visible for ~3 hours.`;
        await refreshSnapshot();
    } catch (error) {
        status.textContent = error.message || 'Report was not saved. Try again.';
        status.className = 'form-status error-state-inline';
    } finally {
        submitButton.disabled = false;
    }
}

function tickCountdown() {
    state.countdown = Math.max(0, state.countdown - 1);
    qs('#refresh-countdown').textContent = `${state.countdown}s`;
    if (state.countdown === 0) {
        state.countdown = REFRESH_SECONDS;
    }
}

function bindEvents() {
    qs('#export-button').addEventListener('click', () => {
        window.open(`${API_BASE}/export?days=7`, '_blank');
    });
    qs('#fit-map-button').addEventListener('click', fitAllSegments);
    qs('#refresh-now-button').addEventListener('click', () => {
        refreshSnapshot();
    });
    qs('#incident-form').addEventListener('submit', submitIncident);
    qs('#incident-title').addEventListener('input', updateIncidentFieldHints);
    qs('#incident-description').addEventListener('input', updateIncidentFieldHints);
    qs('#incident-segment').addEventListener('change', (event) => {
        const segmentId = event.currentTarget.value;
        if (segmentId && segmentId !== state.selectedSegmentId) {
            selectSegment(segmentId);
        }
    });
    updateIncidentFieldHints();
}

initMap();
bindEvents();
refreshSnapshot();
setInterval(refreshSnapshot, REFRESH_SECONDS * 1000);
setInterval(tickCountdown, 1000);
