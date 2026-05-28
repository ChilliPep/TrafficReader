const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const trafficRoutes = require('./routes/trafficRoutes');
const dataCollector = require('./services/dataCollector');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use('/api/traffic', trafficRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'traffic-reader-api',
        timestamp: new Date().toISOString()
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Traffic Reader Server running on port ${PORT}`);
    console.log('Starting data collector...');
    dataCollector.startCollection();
});
