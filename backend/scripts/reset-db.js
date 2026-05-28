const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`Removed ${dbPath}`);
} else {
    console.log('database.db does not exist');
}
