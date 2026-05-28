const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/hotspots', async (req, res) => {
    try {
        const hotspots = await db.getHotspots();
        res.json(hotspots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/statistics', async (req, res) => {
    try {
        const stats = await db.getStatistics();
        res.json(stats || {
            avg_congestion: 0,
            max_congestion: 0,
            avg_speed: 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/segment/:id', async (req, res) => {
    try {
        const history = await db.getSegmentHistory(req.params.id);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const data = await db.exportDataset(days);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=traffic-export-${days}days.json`);
        res.send(JSON.stringify(data, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
