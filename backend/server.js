const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Plan API
app.post('/api/plan', (req, res) => {
    const { query } = req.body;
    console.log(`Received plan request: ${query}`);

    // Mock intent parsing
    const lowerQuery = query.toLowerCase();
    let destination = "Unknown";
    let vibe = "adventure";
    let budget = "moderate";
    let pace = "balanced";

    if (lowerQuery.includes("thanjavur")) destination = "Thanjavur";
    if (lowerQuery.includes("spiritual")) vibe = "spiritual";
    if (lowerQuery.includes("adventure")) vibe = "adventure";
    if (lowerQuery.includes("beach")) vibe = "beach";
    if (lowerQuery.includes("budget")) budget = "budget";

    // Mock Itinerary
    const itinerary = [
        {
            day: 1,
            title: `Arrival in ${destination}`,
            activities: ["Check-in to eco-stay", "Evening temple visit", "Local street food exploration"],
            vibe: vibe
        },
        {
            day: 2,
            title: "Cultural Deep Dive",
            activities: ["Morning meditation session", "Heritage walk", "Traditional craft workshop"],
            vibe: vibe
        },
        {
            day: 3,
            title: "Departure",
            activities: ["Sunrise photography", "Souvenir shopping", "Departure to next destination"],
            vibe: vibe
        }
    ];

    res.json({
        destination,
        vibe,
        budget,
        pace,
        itinerary
    });
});

// Fallback to index.html for React SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
