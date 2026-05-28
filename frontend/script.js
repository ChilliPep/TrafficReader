const API_BASE = '/api/traffic';
const REFRESH_SECONDS = 15;

const state = {
    snapshot: null,
    selectedSegmentId: null,
    history: [],
    forecast: null,
    countdown: REFRESH_SECONDS
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
    return `${Math.round(Number(value || 0))} km/h`;
}

function formatDelay(seconds) {
    const value = Math.round(Number(seconds || 0));
    if (value < 60) return `${value}s`;
    return `${Math.round(value / 60)}m`;
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

function renderSnapshot() {
    const { snapshot } = state;
    if (!snapshot) return;

    qs('#collector-mode').textContent = snapshot.collector?.mode === '2gis_routing'
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
    populateIncidentSegments();
}

function renderMap() {
    const svg = qs('#traffic-map');
    const segments = state.snapshot?.segments || [];
    svg.innerHTML = '';

    if (segments.length === 0) {
        svg.innerHTML = '<text x="40" y="80" class="map-label">No traffic data yet</text>';
        return;
    }

    const points = segments.flatMap((segment) => segment.polyline || []);
    const lonValues = points.map((point) => point[0]);
    const latValues = points.map((point) => point[1]);
    const minLon = Math.min(...lonValues);
    const maxLon = Math.max(...lonValues);
    const minLat = Math.min(...latValues);
    const maxLat = Math.max(...latValues);
    const padding = 80;

    function project(point) {
        const [lon, lat] = point;
        const x = padding + ((lon - minLon) / Math.max(maxLon - minLon, 0.0001)) * (1000 - padding * 2);
        const y = 720 - padding - ((lat - minLat) / Math.max(maxLat - minLat, 0.0001)) * (720 - padding * 2);
        return [x, y];
    }

    function pathFor(polyline) {
        return polyline.map((point, index) => {
            const [x, y] = project(point);
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
    }

    const districtLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    districtLayer.setAttribute('opacity', '0.34');
    svg.appendChild(districtLayer);

    segments.forEach((segment) => {
        const polyline = segment.polyline || [];
        if (polyline.length < 2) return;
        const path = pathFor(polyline);
        const strokeWidth = 8 + Number(segment.priority || 3);
        const isSelected = segment.segment_id === state.selectedSegmentId;

        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shadow.setAttribute('d', path);
        shadow.setAttribute('class', 'road-shadow');
        shadow.setAttribute('stroke-width', String(strokeWidth + 8));
        svg.appendChild(shadow);

        const road = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        road.setAttribute('d', path);
        road.setAttribute('class', `traffic-road ${getStatusClass(segment.status)}${isSelected ? ' selected' : ''}`);
        road.setAttribute('stroke-width', String(strokeWidth));
        road.dataset.segmentId = segment.segment_id;
        road.addEventListener('click', () => selectSegment(segment.segment_id));
        svg.appendChild(road);

        const middle = project(polyline[Math.floor(polyline.length / 2)]);
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        node.setAttribute('cx', middle[0].toFixed(1));
        node.setAttribute('cy', middle[1].toFixed(1));
        node.setAttribute('r', isSelected ? '9' : '6');
        node.setAttribute('class', `map-node ${getStatusClass(segment.status)}`);
        node.addEventListener('click', () => selectSegment(segment.segment_id));
        svg.appendChild(node);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(middle[0] + 12));
        label.setAttribute('y', String(middle[1] - 10));
        label.setAttribute('class', 'map-label');
        label.textContent = segment.name.replace(' Street', '').replace(' Avenue', ' Ave');
        label.addEventListener('click', () => selectSegment(segment.segment_id));
        svg.appendChild(label);
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
    const segments = state.snapshot?.segments || [];
    const currentValue = select.value;

    select.innerHTML = segments.map((segment) => `
        <option value="${escapeHtml(segment.segment_id)}">${escapeHtml(segment.name)}</option>
    `).join('');

    if (currentValue && segments.some((segment) => segment.segment_id === currentValue)) {
        select.value = currentValue;
    } else if (state.selectedSegmentId) {
        select.value = state.selectedSegmentId;
    }
}

async function submitIncident(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = qs('#incident-status');
    const formData = new FormData(form);
    const body = {
        segment_id: String(formData.get('segment_id') || ''),
        type: String(formData.get('type') || 'report'),
        title: String(formData.get('title') || '').trim(),
        description: String(formData.get('description') || '').trim()
    };

    if (!body.title) {
        status.textContent = 'Add a short title before sending.';
        return;
    }

    status.textContent = 'Sending report...';
    try {
        await fetchJson(`${API_BASE}/incidents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        form.reset();
        status.textContent = 'Report saved. It will decay automatically after a few hours.';
        await refreshSnapshot();
    } catch (error) {
        status.textContent = 'Report was not saved. Backend rejected the request.';
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
    qs('#incident-form').addEventListener('submit', submitIncident);
}

bindEvents();
refreshSnapshot();
setInterval(refreshSnapshot, REFRESH_SECONDS * 1000);
setInterval(tickCountdown, 1000);
