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

// ── Startup warnings ───────────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
    console.warn('[WARN] GEMINI_API_KEY is not set. AI features will return 503.');
}
if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn('[WARN] GOOGLE_MAPS_API_KEY is not set. Places features will return 503.');
}

// ── Request ID ─────────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('X-Request-ID', crypto.randomUUID());
    next();
});

// ── Security ───────────────────────────────────────────────────────────────────
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

app.use(compression());

const allowedOrigin = process.env.ALLOWED_ORIGIN || null;
app.use(cors({
    origin: allowedOrigin ? allowedOrigin : false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '32kb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Google Cloud Logging ───────────────────────────────────────────────────────
let log = null;
try {
    const logging = new Logging();
    log = logging.log('travel-engine-logs');
} catch { /* no GCP credentials locally — console fallback */ }

function logInfo(message) {
    if (log) {
        const entry = log.entry({ resource: { type: 'global' } }, { message });
        log.write(entry).catch(() => {});
    }
    console.info('[INFO]', message);
}

// ── Gemini setup ───────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ── WMO weather code → label + emoji ──────────────────────────────────────────
const WMO = {
    0: ['Sunny', '☀️'],          1: ['Mainly clear', '🌤️'],
    2: ['Partly cloudy', '⛅'],   3: ['Overcast', '☁️'],
    45: ['Foggy', '🌫️'],         48: ['Rime fog', '🌫️'],
    51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'],     55: ['Heavy drizzle', '🌧️'],
    61: ['Light rain', '🌧️'],    63: ['Rain', '🌧️'],          65: ['Heavy rain', '🌧️'],
    71: ['Light snow', '❄️'],    73: ['Snow', '❄️'],           75: ['Heavy snow', '❄️'],
    80: ['Showers', '🌦️'],       81: ['Heavy showers', '🌧️'], 82: ['Violent showers', '⛈️'],
    95: ['Thunderstorm', '⛈️'],  96: ['Hail storm', '⛈️'],    99: ['Heavy hail', '⛈️'],
};

function wmoToWeather(code, tempC) {
    const [condition, emoji] = WMO[code] || ['Unknown', '🌡️'];
    return { condition, emoji, tempC: Math.round(tempC) };
}

// ── In-memory FIFO cache ───────────────────────────────────────────────────────
const CACHE_MAX = 100;
const responseCache = new Map();

function cacheGet(key) { return responseCache.get(key) || null; }
function cacheSet(key, value) {
    if (responseCache.size >= CACHE_MAX) responseCache.delete(responseCache.keys().next().value);
    responseCache.set(key, value);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sanitizeQuery(raw) {
    return raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

function buildConstraintRules(c) {
    if (!c) return '';
    const lines = [
        `- Trip duration: exactly ${c.durationDays} day${c.durationDays === 1 ? '' : 's'}`,
    ];
    if (c.budgetAmount > 0) lines.push(`- Budget: strictly under ${c.budgetCurrency}${c.budgetAmount} total`);
    if (c.groupType) lines.push(`- Group type: ${c.groupType}`);
    if (c.pace) lines.push(`- Pace: ${c.pace}`);
    if (c.wheelchairFriendly) lines.push('- All venues must be wheelchair accessible');
    if (c.dietary && c.dietary.length > 0) lines.push(`- Dietary requirements: ${c.dietary.join(', ')}`);
    return `\nHARD RULES (follow exactly):\n${lines.join('\n')}\n`;
}

async function fetchWeather(destination, days) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) return null;

        const { latitude, longitude } = geoData.results[0];
        const clampedDays = Math.max(1, Math.min(days, 16));
        const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max&forecast_days=${clampedDays}&timezone=auto`;
        const wxRes = await fetch(wxUrl);
        const wxData = await wxRes.json();

        if (!wxData.daily) return null;
        return wxData.daily.weathercode.map((code, i) =>
            wmoToWeather(code, wxData.daily.temperature_2m_max[i])
        );
    } catch {
        return null;
    }
}

// ── Static files ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── POST /api/plan ─────────────────────────────────────────────────────────────
app.post('/api/plan', async (req, res) => {
    const { query, constraints } = req.body;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'query is required and must be a string.' });
    }
    const trimmed = query.trim();
    if (trimmed.length === 0) return res.status(400).json({ error: 'query must not be empty.' });
    if (trimmed.length > 500) return res.status(400).json({ error: 'query must be 500 characters or fewer.' });

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service is not configured. Set GEMINI_API_KEY.' });
    }

    const sanitized = sanitizeQuery(trimmed);
    logInfo(`Planning trip: "${sanitized}"`);

    const cacheKey = `${sanitized.toLowerCase()}|${JSON.stringify(constraints || {})}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
        res.setHeader('Cache-Control', 'max-age=3600');
        return res.json(cached);
    }

    const constraintRules = buildConstraintRules(constraints);
    const days = constraints?.durationDays || 5;

    const prompt = `
You are a world-class travel planner.
User request: "${sanitized}"
${constraintRules}
Generate a structured JSON travel itinerary for exactly ${days} days.

Return ONLY this raw JSON (no markdown fences):
{
  "destination": "City, Country",
  "vibe": "one of: spiritual|adventure|beach|culture|luxury",
  "budget": "estimated total spend as string e.g. ₹12,000",
  "pace": "one of: Relaxed|Balanced|Packed",
  "tips": ["local tip 1", "local tip 2", "local tip 3"],
  "itinerary": [
    {
      "day": 1,
      "title": "Day title",
      "activities": ["Activity 1", "Activity 2", "Activity 3"],
      "estimated_cost": "₹800",
      "must_do": "Single most important experience"
    }
  ]
}
The itinerary array must have exactly ${days} objects.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in Gemini response');
        const jsonData = JSON.parse(jsonMatch[0]);

        // Attach weather per day
        const weatherList = await fetchWeather(jsonData.destination, jsonData.itinerary.length);
        if (weatherList) {
            jsonData.itinerary = jsonData.itinerary.map((item, i) => ({
                ...item,
                weather: weatherList[i] || null,
            }));
        }

        cacheSet(cacheKey, jsonData);
        res.setHeader('Cache-Control', 'max-age=3600');
        return res.json(jsonData);
    } catch (err) {
        console.error('Gemini Error:', err);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({ error: 'Failed to generate itinerary. Please try again.' });
    }
});

// ── POST /api/replan-day ───────────────────────────────────────────────────────
app.post('/api/replan-day', async (req, res) => {
    const { destination, day, dayTitle, activities, currentWeather, constraints } = req.body;

    if (!destination || !day || !dayTitle) {
        return res.status(400).json({ error: 'destination, day, and dayTitle are required.' });
    }
    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service is not configured. Set GEMINI_API_KEY.' });
    }

    const constraintRules = buildConstraintRules(constraints);
    const weatherNote = currentWeather
        ? `Current weather: ${currentWeather.emoji} ${currentWeather.condition}, ${currentWeather.tempC}°C`
        : '';

    const prompt = `
You are a travel planner. Replan only Day ${day} of a trip to ${destination}.
${weatherNote}
${constraintRules}
Original activities were: ${activities.join(', ')}.
Create fresh, weather-appropriate activities for this single day.

Return ONLY this raw JSON (no markdown):
{
  "day": ${day},
  "title": "Updated day title",
  "activities": ["Activity 1", "Activity 2", "Activity 3"],
  "estimated_cost": "amount string",
  "must_do": "Single most important experience"
}
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in Gemini response');
        const updatedDay = JSON.parse(jsonMatch[0]);

        // Re-fetch weather for that day
        const weatherList = await fetchWeather(destination, day);
        if (weatherList && weatherList[day - 1]) {
            updatedDay.weather = weatherList[day - 1];
        }

        return res.json(updatedDay);
    } catch (err) {
        console.error('Replan error:', err);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({ error: 'Failed to replan day. Please try again.' });
    }
});

// ── GET /api/places ────────────────────────────────────────────────────────────
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

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
