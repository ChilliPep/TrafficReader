# 🚗 Traffic Reader - Kyzylorda

Real-time traffic analysis system for Kyzylorda city using 2GIS API data.

## Features

✅ Real-time traffic data collection from 2GIS API  
✅ Automatic congestion hotspot detection  
✅ Infrastructure problem identification  
✅ Interactive web dashboard with live map  
✅ Python-based statistical analysis  
✅ Automatic data export and reporting  

## Architecture

\`\`\`
traffic-reader/
├── backend/          # Node.js Express server
│   ├── src/
│   │   ├── api/     # 2GIS API integration
│   │   ├── db/      # SQLite management
│   │   └── services/ # Data collection & processing
│   └── database.db  # SQLite database
├── frontend/         # Web dashboard (HTML/CSS/JS)
├── analysis/         # Python analysis engine
└── README.md
\`\`\`

## Quick Start

### Prerequisites
- Node.js 14+
- Python 3.8+

### Setup

\`\`\`bash
# 1. Clone and install backend
cd backend
npm install

# 2. Configure environment
# Edit .env and add your 2GIS_API_KEY (optional, using mock for now)
# IMPORTANT: 2GIS API has a daily limit (600-1000 requests). 
# Default configuration polls every 5 minutes (288 requests/day) to stay under the limit.

# 3. Install Python dependencies
cd ../analysis
pip install -r requirements.txt

# 4. Start backend
cd ../backend
npm run dev

# 5. Open dashboard
# Visit http://localhost:3000
\`\`\`
