const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const trafficRoutes = require('./routes/trafficRoutes');
const dataCollector = require('./services/dataCollector');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../frontend'));

// Routes
app.use('/api/traffic', trafficRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚗 Traffic Reader Server running on port ${PORT}`);
    
    // Start background data collection
    console.log('Starting data collector...');
    dataCollector.startCollection();
});
