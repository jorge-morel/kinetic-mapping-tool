const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
// 🔧 Increase payload limit to 10MB (adjustable)
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const DATA_FILE = './data.json';

// Ensure the data file exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Load addresses from file
app.get('/addresses', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.json([]);
        }
        res.json(JSON.parse(data));
    });
});

// Save addresses to file
app.post('/addresses', (req, res) => {
    const addresses = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(addresses, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).json({ message: 'Failed to save data' });
        }
        res.json({ message: 'Data saved successfully' });
    });
});

// Start the server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
