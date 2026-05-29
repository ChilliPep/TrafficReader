const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const trafficRoutes = require('./routes/trafficRoutes');
const dataCollector = require('./services/dataCollector');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const trafficReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many traffic API requests. Try again later.',
        timestamp: new Date().toISOString()
    }
});

const incidentWriteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many incident reports. Please wait and try again.',
        timestamp: new Date().toISOString()
    }
});

app.use('/api/traffic', (req, res, next) => {
    if (req.method === 'POST' && req.path === '/incidents') {
        return incidentWriteLimiter(req, res, next);
    }
    return trafficReadLimiter(req, res, next);
});

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

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
    console.log(`Traffic Reader Server running on port ${PORT}`);
    console.log('Starting data collector...');
    dataCollector.startCollection();
});
