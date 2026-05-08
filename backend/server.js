const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Logging } = require('@google-cloud/logging');

const app = express();
const PORT = process.env.PORT || 8080;

// Security: Helmet for secure headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for easier demo/static serving
}));

// Efficiency: Gzip compression
app.use(compression());

// Security: Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Google Services: Cloud Logging
const logging = new Logging();
const log = logging.log('travel-engine-logs');

async function logInfo(message) {
    const metadata = { resource: { type: 'global' } };
    const entry = log.entry(metadata, { message });
    await log.write(entry).catch(console.error);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/plan', async (req, res) => {
    const { query } = req.body;
    await logInfo(`Planning trip for query: ${query}`);

    try {
        const prompt = `
            You are a world-class travel planner. Based on the user request: "${query}", 
            generate a structured JSON travel itinerary.
            
            JSON format:
            {
                "destination": "Name of destination",
                "vibe": "one of: spiritual, adventure, beach, culture, luxury",
                "budget": "string",
                "pace": "string",
                "itinerary": [
                    {
                        "day": 1,
                        "title": "Day Title",
                        "activities": ["Activity 1", "Activity 2", "Activity 3"]
                    }
                ]
            }
            Return ONLY the raw JSON.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonData = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        res.json(jsonData);
    } catch (err) {
        console.error("Gemini Error:", err);
        res.json({
            destination: "Exploration Mode",
            vibe: "adventure",
            budget: "flexible",
            pace: "dynamic",
            itinerary: [
                { day: 1, title: "Adventure Awaits", activities: ["AI integration pending", "Check API keys", "Start exploring manually"] }
            ]
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
