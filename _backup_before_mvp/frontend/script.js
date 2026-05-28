const API_BASE = 'http://localhost:3000/api/traffic';

async function fetchStatistics() {
    try {
        const response = await fetch(`${API_BASE}/statistics`);
        const data = await response.json();
        
        animateValue('val-congestion', data.avg_congestion || 0, '%');
        animateValue('val-max-congestion', data.max_congestion || 0, '%');
        animateValue('val-speed', data.avg_speed || 0, ' km/h');
    } catch (error) {
        console.error('Failed to fetch statistics', error);
    }
}

async function fetchHotspots() {
    try {
        const response = await fetch(`${API_BASE}/hotspots`);
        const data = await response.json();
        const container = document.getElementById('hotspot-container');
        
        container.innerHTML = '';
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="loading-state">No hotspot data available yet.</div>';
            return;
        }

        data.forEach(spot => {
            const cong = Math.round(spot.avg_congestion);
            const speed = Math.round(spot.avg_speed);
            
            let statusClass = 'safe';
            if (cong > 70) statusClass = 'danger';
            else if (cong > 40) statusClass = 'warning';

            const item = document.createElement('div');
            item.className = 'hotspot-item';
            item.innerHTML = `
                <div class="hotspot-info">
                    <h3>${spot.name}</h3>
                    <div class="hotspot-coords">${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)}</div>
                </div>
                <div class="hotspot-stat ${statusClass}">
                    <span class="stat-label">Congestion</span>
                    <span class="stat-value">${cong}%</span>
                </div>
                <div class="hotspot-stat">
                    <span class="stat-label">Avg Speed</span>
                    <span class="stat-value">${speed} km/h</span>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to fetch hotspots', error);
    }
}

function animateValue(id, target, suffix) {
    const el = document.getElementById(id);
    let start = null;
    const duration = 1000;
    const targetVal = parseFloat(target);
    
    if (isNaN(targetVal)) return;

    const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const currentVal = (progress * targetVal).toFixed(1);
        el.innerText = `${currentVal}${suffix}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

document.getElementById('btn-export').addEventListener('click', () => {
    window.open(`${API_BASE}/export?days=7`, '_blank');
});

// Initialization
fetchStatistics();
fetchHotspots();

// Auto-refresh every 30 seconds
setInterval(() => {
    fetchStatistics();
    fetchHotspots();
}, 30000);
