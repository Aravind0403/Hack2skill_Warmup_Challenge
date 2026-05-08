const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Logging } = require('@google-cloud/logging');

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.GEMINI_API_KEY) {
    console.warn('[WARN] GEMINI_API_KEY is not set. AI features will return 503.');
}
if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn('[WARN] GOOGLE_MAPS_API_KEY is not set. Places features will return 503.');
}

// Attach a unique request ID to every response for traceability
app.use((_req, res, next) => {
    res.setHeader('X-Request-ID', crypto.randomUUID());
    next();
});

// Security: Helmet with a real CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://loremflickr.com"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
}));

// Efficiency: Gzip compression
app.use(compression());

// Security: strict CORS — env-configured origin only; disable cross-origin in prod
const allowedOrigin = process.env.ALLOWED_ORIGIN || null;
app.use(cors({
    origin: allowedOrigin ? allowedOrigin : false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

// Security: cap request body size
app.use(express.json({ limit: '16kb' }));

// Security: rate limiting on all API routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Google Services: Cloud Logging (gracefully degrade without GCP credentials)
let log = null;
try {
    const logging = new Logging();
    log = logging.log('travel-engine-logs');
} catch {
    // Running locally without GCP credentials
}

async function logInfo(message) {
    if (log) {
        const entry = log.entry({ resource: { type: 'global' } }, { message });
        await log.write(entry).catch(() => {});
    }
    console.info('[INFO]', message);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Efficiency: simple in-memory response cache (FIFO eviction at 100 entries)
const CACHE_MAX = 100;
const responseCache = new Map();

function cacheGet(key) {
    return responseCache.get(key) || null;
}

function cacheSet(key, value) {
    if (responseCache.size >= CACHE_MAX) {
        responseCache.delete(responseCache.keys().next().value);
    }
    responseCache.set(key, value);
}

// Strip ASCII control characters to prevent prompt injection via query
function sanitizeQuery(raw) {
    return raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/plan', async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'query is required and must be a string.' });
    }
    const trimmed = query.trim();
    if (trimmed.length === 0) {
        return res.status(400).json({ error: 'query must not be empty.' });
    }
    if (trimmed.length > 500) {
        return res.status(400).json({ error: 'query must be 500 characters or fewer.' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service is not configured. Set GEMINI_API_KEY.' });
    }

    const sanitized = sanitizeQuery(trimmed);
    logInfo(`Planning trip for query: ${sanitized}`); // fire-and-forget — don't block the response

    const cacheKey = sanitized.toLowerCase();
    const cached = cacheGet(cacheKey);
    if (cached) {
        res.setHeader('Cache-Control', 'max-age=3600');
        return res.json(cached);
    }

    try {
        const prompt = `
            You are a world-class travel planner. Based on the user request: "${sanitized}",
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
            Return ONLY the raw JSON, no markdown fences.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in Gemini response');

        const jsonData = JSON.parse(jsonMatch[0]);
        cacheSet(cacheKey, jsonData);

        res.setHeader('Cache-Control', 'max-age=3600');
        return res.json(jsonData);
    } catch (err) {
        console.error("Gemini Error:", err);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({ error: 'Failed to generate itinerary. Please try again.' });
    }
});

// Google Services: Places API — fetch real destination metadata
app.get('/api/places', async (req, res) => {
    const { destination } = req.query;

    if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
        return res.status(400).json({ error: 'destination query parameter is required.' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
        return res.status(503).json({ error: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY.' });
    }

    try {
        const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        url.searchParams.set('query', destination.trim());
        url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const place = data.results[0];
            return res.json({
                name: place.name,
                rating: place.rating || null,
                userRatingsTotal: place.user_ratings_total || null,
                photoReference: place.photos?.[0]?.photo_reference || null,
                mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            });
        }

        return res.json({
            name: destination.trim(),
            rating: null,
            userRatingsTotal: null,
            photoReference: null,
            mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(destination.trim())}`,
        });
    } catch (err) {
        console.error('Places API error:', err);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({ error: 'Failed to fetch place information.' });
    }
});

app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
