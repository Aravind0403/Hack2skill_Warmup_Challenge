require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { GoogleAuth } = require('google-auth-library');
const { Logging } = require('@google-cloud/logging');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Startup warnings ───────────────────────────────────────────────────────────
if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn('[WARN] GOOGLE_MAPS_API_KEY is not set. Places features will return 503.');
}

// ── Trust proxy (required for Cloud Run / load-balanced environments) ──────────
// Cloud Run sits behind a Google-managed load balancer that sets X-Forwarded-For.
// Without this, express-rate-limit throws a ValidationError on every request.
app.set('trust proxy', 1);

// ── Request ID ─────────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('X-Request-ID', crypto.randomUUID());
    next();
});

// ── Security headers ───────────────────────────────────────────────────────────
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
            upgradeInsecureRequests: [],
        },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
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
// K_SERVICE is automatically set by Cloud Run — only enable GCP logging there.
// Locally we fall through to console.info to avoid credential errors.
let log = null;
if (process.env.K_SERVICE) {
    try {
        const logging = new Logging();
        log = logging.log('travel-engine-logs');
    } catch { /* ignore — console fallback below */ }
}

/**
 * Writes an informational log entry to Cloud Logging (Cloud Run) or console.
 * @param {string} message - Human-readable log message.
 */
function logInfo(message) {
    if (log) {
        const entry = log.entry({ resource: { type: 'global' } }, { message });
        log.write(entry).catch(() => {});
    }
    console.info('[INFO]', message);
}

// ── Gemini via Generative Language API (paid tier, OAuth) ─────────────────────
// On Cloud Run the default service account provides ADC automatically.
// Requests authenticated by a service account use the PAID-tier quota
// (10 000 req/day for gemini-2.0-flash), bypassing the free-tier limit of 0
// that affects API keys from AI Studio.
// Locally: set GEMINI_API_KEY in .env as a fallback.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const geminiAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/generative-language'],
});

/**
 * Calls the Gemini 2.0 Flash model with the given prompt text.
 * Prefers service-account OAuth (paid tier); falls back to API key if set.
 * @param {string} prompt
 * @returns {Promise<string>} Model response text.
 */
async function callGemini(prompt) {
    let headers = { 'Content-Type': 'application/json' };
    let url = GEMINI_ENDPOINT;

    try {
        // ADC is available on Cloud Run; this fails locally without credentials.
        const client = await geminiAuth.getClient();
        const { token } = await client.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
    } catch {
        // No ADC — fall back to API key for local development.
        if (!GEMINI_API_KEY) throw new Error('No Gemini credentials available. Set GEMINI_API_KEY for local dev.');
        url = `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`;
    }

    const body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const resp = await fetch(url, { method: 'POST', headers, body });
    const data = await resp.json();

    if (!resp.ok) {
        throw new Error(data.error?.message || `Gemini API error ${resp.status}`);
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

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

/**
 * Converts a WMO weather code and temperature to a human-readable weather object.
 * @param {number} code - WMO weather code.
 * @param {number} tempC - Temperature in degrees Celsius.
 * @returns {{ condition: string, emoji: string, tempC: number }}
 */
function wmoToWeather(code, tempC) {
    const [condition, emoji] = WMO[code] || ['Unknown', '🌡️'];
    return { condition, emoji, tempC: Math.round(tempC) };
}

// ── In-memory FIFO cache ───────────────────────────────────────────────────────
const CACHE_MAX = 100;
const responseCache = new Map();

/** @param {string} key @returns {object|null} */
function cacheGet(key) { return responseCache.get(key) || null; }

/**
 * Stores a value in the bounded FIFO cache, evicting the oldest entry when full.
 * @param {string} key
 * @param {object} value
 */
function cacheSet(key, value) {
    if (responseCache.size >= CACHE_MAX) responseCache.delete(responseCache.keys().next().value);
    responseCache.set(key, value);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Strips ASCII control characters from a string and trims whitespace.
 * @param {string} raw - Untrusted user input.
 * @returns {string} Sanitized string safe to embed in prompts.
 */
function sanitizeQuery(raw) {
    return raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Validates and normalises an inbound constraints object.
 * Returns null when the object is absent or structurally invalid.
 * @param {unknown} c - Raw value from request body.
 * @returns {object|null} Sanitized constraints or null.
 */
function validateConstraints(c) {
    if (!c || typeof c !== 'object') return null;
    const VALID_CURRENCIES = ['₹', '$', '€'];
    const VALID_GROUP = ['Solo', 'Couple', 'Family', 'Group'];
    const VALID_PACE = ['Relaxed', 'Balanced', 'Packed'];

    return {
        durationDays: Math.max(1, Math.min(14, Number.isFinite(Number(c.durationDays)) ? Number(c.durationDays) : 5)),
        budgetAmount: Math.max(0, Number(c.budgetAmount) || 0),
        budgetCurrency: VALID_CURRENCIES.includes(c.budgetCurrency) ? c.budgetCurrency : '₹',
        groupType: VALID_GROUP.includes(c.groupType) ? c.groupType : 'Solo',
        pace: VALID_PACE.includes(c.pace) ? c.pace : 'Balanced',
        wheelchairFriendly: Boolean(c.wheelchairFriendly),
        dietary: Array.isArray(c.dietary) ? c.dietary.filter((d) => typeof d === 'string').slice(0, 5) : [],
    };
}

/**
 * Builds a HARD RULES block to inject into the Gemini prompt.
 * @param {object|null} c - Validated constraints object.
 * @returns {string} Formatted rule block, or empty string when constraints absent.
 */
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

/**
 * Fetches a multi-day weather forecast for the given destination using Open-Meteo.
 * Returns null silently on any network or parsing error.
 * @param {string} destination - City or region name.
 * @param {number} days - Number of forecast days (clamped to 1–16).
 * @returns {Promise<Array<{condition:string,emoji:string,tempC:number}>|null>}
 */
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
    const { query, constraints: rawConstraints } = req.body;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'query is required and must be a string.' });
    }
    const trimmed = query.trim();
    if (trimmed.length === 0) return res.status(400).json({ error: 'query must not be empty.' });
    if (trimmed.length > 500) return res.status(400).json({ error: 'query must be 500 characters or fewer.' });

    const sanitized = sanitizeQuery(trimmed);
    const constraints = validateConstraints(rawConstraints);
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
        const text = await callGemini(prompt);
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
    const { destination, day, dayTitle, activities, currentWeather, constraints: rawConstraints } = req.body;

    if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
        return res.status(400).json({ error: 'destination is required and must be a non-empty string.' });
    }
    if (day === undefined || day === null || isNaN(Number(day)) || Number(day) < 1) {
        return res.status(400).json({ error: 'day is required and must be a positive number.' });
    }
    if (!dayTitle || typeof dayTitle !== 'string' || dayTitle.trim().length === 0) {
        return res.status(400).json({ error: 'dayTitle is required and must be a non-empty string.' });
    }
    if (!Array.isArray(activities)) {
        return res.status(400).json({ error: 'activities must be an array.' });
    }

    const constraints = validateConstraints(rawConstraints);
    const constraintRules = buildConstraintRules(constraints);
    const weatherNote = currentWeather
        ? `Current weather: ${currentWeather.emoji} ${currentWeather.condition}, ${currentWeather.tempC}°C`
        : '';

    const safeDestination = sanitizeQuery(String(destination));
    const safeDayTitle = sanitizeQuery(String(dayTitle));
    const safeActivities = activities.map((a) => sanitizeQuery(String(a)));

    const prompt = `
You are a travel planner. Replan only Day ${Number(day)} of a trip to ${safeDestination}.
${weatherNote}
${constraintRules}
Original activities were: ${safeActivities.join(', ')}.
Create fresh, weather-appropriate activities for this single day.

Return ONLY this raw JSON (no markdown):
{
  "day": ${Number(day)},
  "title": "Updated day title",
  "activities": ["Activity 1", "Activity 2", "Activity 3"],
  "estimated_cost": "amount string",
  "must_do": "Single most important experience"
}
`;

    try {
        const text = await callGemini(prompt);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in Gemini response');
        const updatedDay = JSON.parse(jsonMatch[0]);

        // Re-fetch weather for that day
        const weatherList = await fetchWeather(safeDestination, Number(day));
        if (weatherList && weatherList[Number(day) - 1]) {
            updatedDay.weather = weatherList[Number(day) - 1];
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

module.exports = { app, server, sanitizeQuery, validateConstraints, buildConstraintRules, wmoToWeather };
