const db = require('../src/db/database');
const fs = require('fs');
const path = require('path');

async function exportData() {
    console.log('Exporting traffic dataset...');

    try {
        const data = await db.exportDataset(7);
        const exportPath = path.join(__dirname, '../exports');

        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath);
        }

        const filename = `traffic-data-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(exportPath, filename);

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`Exported ${data.length} records to ${filepath}`);

        if (data.length > 0) {
            const csv = convertToCSV(data);
            const csvpath = filepath.replace('.json', '.csv');
            fs.writeFileSync(csvpath, csv);
            console.log(`Also exported CSV to ${csvpath}`);
        } else {
            console.log('No data found to export CSV.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Export failed:', error);
        process.exit(1);
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0] || {});
    const rows = data.map((row) =>
        headers.map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

exportData();
