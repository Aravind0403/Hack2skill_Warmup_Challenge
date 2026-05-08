const request = require('supertest');

process.env.PORT = '0';
process.env.NODE_ENV = 'test';

let app, server, sanitizeQuery, validateConstraints, buildConstraintRules, wmoToWeather;

beforeAll(() => {
    ({
        app, server,
        sanitizeQuery,
        validateConstraints,
        buildConstraintRules,
        wmoToWeather,
    } = require('./server'));
});

afterAll((done) => {
    server.close(done);
});

// ── GET /health ────────────────────────────────────────────────────────────────

describe('GET /health', () => {
    it('returns 200 with status ok and timestamp', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.timestamp).toBe('string');
    });

    it('includes X-Request-ID header', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-request-id']).toBeDefined();
        expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    it('sets Cache-Control: no-store', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['cache-control']).toMatch(/no-store/);
    });

    it('returns a valid ISO timestamp', async () => {
        const res = await request(app).get('/health');
        expect(() => new Date(res.body.timestamp)).not.toThrow();
        expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });
});

// ── POST /api/plan — input validation ─────────────────────────────────────────

describe('POST /api/plan — input validation', () => {
    it('returns 400 when body has no query field', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({})
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/);
    });

    it('returns 400 when query is whitespace only', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({ query: '   ' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/empty/);
    });

    it('returns 400 when query exceeds 500 characters', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({ query: 'x'.repeat(501) })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/500/);
    });

    it('returns 400 when query is a number', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({ query: 42 })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('returns 400 when query is null', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({ query: null })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('returns 400 when query is an array', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({ query: ['trip to Paris'] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('accepts exactly 500 character query (boundary)', async () => {
        // Should not return 400 for the length check (may return 502 from AI)
        const res = await request(app)
            .post('/api/plan')
            .send({ query: 'x'.repeat(500) })
            .set('Content-Type', 'application/json');
        expect(res.status).not.toBe(400);
    });
});

// ── POST /api/replan-day — input validation ───────────────────────────────────

describe('POST /api/replan-day — input validation', () => {
    it('returns 400 when destination is missing', async () => {
        const res = await request(app)
            .post('/api/replan-day')
            .send({ day: 1, dayTitle: 'Day 1', activities: [] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/destination/);
    });

    it('returns 400 when destination is empty string', async () => {
        const res = await request(app)
            .post('/api/replan-day')
            .send({ destination: '', day: 1, dayTitle: 'Day 1', activities: [] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('returns 400 when day is missing', async () => {
        const res = await request(app)
            .post('/api/replan-day')
            .send({ destination: 'Paris', dayTitle: 'Day 1', activities: [] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/day/);
    });

    it('returns 400 when day is zero', async () => {
        const res = await request(app)
            .post('/api/replan-day')
            .send({ destination: 'Paris', day: 0, dayTitle: 'Day 1', activities: [] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('returns 400 when dayTitle is missing', async () => {
        const res = await request(app)
            .post('/api/replan-day')
            .send({ destination: 'Paris', day: 1, activities: [] })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/dayTitle/);
    });

    it('returns 400 when activities is not an array', async () => {
        const res = await request(app)
            .post('/api/replan-day')
            .send({ destination: 'Paris', day: 1, dayTitle: 'Arrival', activities: 'explore' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/activities/);
    });
});

// ── GET /api/places — input validation ────────────────────────────────────────

describe('GET /api/places — input validation', () => {
    it('returns 400 when destination param is missing', async () => {
        const res = await request(app).get('/api/places');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('returns 400 when destination is empty string', async () => {
        const res = await request(app).get('/api/places?destination=');
        expect(res.status).toBe(400);
    });

    it('returns 503 when GOOGLE_MAPS_API_KEY is not set', async () => {
        const savedKey = process.env.GOOGLE_MAPS_API_KEY;
        delete process.env.GOOGLE_MAPS_API_KEY;
        const res = await request(app).get('/api/places?destination=Thanjavur');
        expect(res.status).toBe(503);
        if (savedKey) process.env.GOOGLE_MAPS_API_KEY = savedKey;
    });
});

// ── Security headers ───────────────────────────────────────────────────────────

describe('Security headers', () => {
    it('includes X-Request-ID on every response', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-request-id']).toBeDefined();
    });

    it('includes Content-Security-Policy header', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('sets X-Content-Type-Options: nosniff', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
});

// ── sanitizeQuery ──────────────────────────────────────────────────────────────

describe('sanitizeQuery', () => {
    it('removes ASCII control characters', () => {
        expect(sanitizeQuery('hello\x00world')).toBe('helloworld');
    });

    it('removes newlines and tabs', () => {
        expect(sanitizeQuery('trip\nto\tGoa')).toBe('triptoGoa');
    });

    it('trims leading and trailing whitespace', () => {
        expect(sanitizeQuery('  Paris  ')).toBe('Paris');
    });

    it('leaves normal characters unchanged', () => {
        expect(sanitizeQuery('3 days in Tokyo, Japan')).toBe('3 days in Tokyo, Japan');
    });

    it('handles empty string', () => {
        expect(sanitizeQuery('')).toBe('');
    });
});

// ── validateConstraints ────────────────────────────────────────────────────────

describe('validateConstraints', () => {
    it('returns null for null input', () => {
        expect(validateConstraints(null)).toBeNull();
    });

    it('returns null for non-object input', () => {
        expect(validateConstraints('string')).toBeNull();
        expect(validateConstraints(42)).toBeNull();
    });

    it('clamps durationDays to 1–14 range', () => {
        expect(validateConstraints({ durationDays: 0 }).durationDays).toBe(1);
        expect(validateConstraints({ durationDays: 99 }).durationDays).toBe(14);
        expect(validateConstraints({ durationDays: 7 }).durationDays).toBe(7);
    });

    it('rejects invalid budgetCurrency and falls back to ₹', () => {
        expect(validateConstraints({ budgetCurrency: 'GBP' }).budgetCurrency).toBe('₹');
        expect(validateConstraints({ budgetCurrency: '$' }).budgetCurrency).toBe('$');
    });

    it('rejects invalid groupType and falls back to Solo', () => {
        expect(validateConstraints({ groupType: 'Alien' }).groupType).toBe('Solo');
        expect(validateConstraints({ groupType: 'Family' }).groupType).toBe('Family');
    });

    it('rejects invalid pace and falls back to Balanced', () => {
        expect(validateConstraints({ pace: 'Turbo' }).pace).toBe('Balanced');
        expect(validateConstraints({ pace: 'Relaxed' }).pace).toBe('Relaxed');
    });

    it('coerces wheelchairFriendly to boolean', () => {
        expect(validateConstraints({ wheelchairFriendly: 1 }).wheelchairFriendly).toBe(true);
        expect(validateConstraints({ wheelchairFriendly: 0 }).wheelchairFriendly).toBe(false);
    });

    it('filters non-string dietary items and limits to 5', () => {
        const dietary = ['Veg', 42, 'Halal', null, 'Vegan', 'None', 'extra'];
        const result = validateConstraints({ dietary }).dietary;
        expect(result.every((d) => typeof d === 'string')).toBe(true);
        expect(result.length).toBeLessThanOrEqual(5);
    });
});

// ── buildConstraintRules ──────────────────────────────────────────────────────

describe('buildConstraintRules', () => {
    it('returns empty string for null input', () => {
        expect(buildConstraintRules(null)).toBe('');
    });

    it('includes trip duration', () => {
        const rules = buildConstraintRules({ durationDays: 3, budgetAmount: 0, groupType: '', pace: '', wheelchairFriendly: false, dietary: [] });
        expect(rules).toMatch(/exactly 3 days/);
    });

    it('includes budget when budgetAmount > 0', () => {
        const rules = buildConstraintRules({ durationDays: 5, budgetAmount: 10000, budgetCurrency: '₹', groupType: '', pace: '', wheelchairFriendly: false, dietary: [] });
        expect(rules).toMatch(/10000/);
        expect(rules).toMatch(/₹/);
    });

    it('omits budget when budgetAmount is 0', () => {
        const rules = buildConstraintRules({ durationDays: 5, budgetAmount: 0, groupType: '', pace: '', wheelchairFriendly: false, dietary: [] });
        expect(rules).not.toMatch(/Budget/);
    });

    it('includes wheelchair note when enabled', () => {
        const rules = buildConstraintRules({ durationDays: 2, budgetAmount: 0, groupType: '', pace: '', wheelchairFriendly: true, dietary: [] });
        expect(rules).toMatch(/wheelchair/i);
    });

    it('includes dietary requirements', () => {
        const rules = buildConstraintRules({ durationDays: 2, budgetAmount: 0, groupType: '', pace: '', wheelchairFriendly: false, dietary: ['Veg', 'Halal'] });
        expect(rules).toMatch(/Veg/);
        expect(rules).toMatch(/Halal/);
    });

    it('uses singular "day" for durationDays === 1', () => {
        const rules = buildConstraintRules({ durationDays: 1, budgetAmount: 0, groupType: '', pace: '', wheelchairFriendly: false, dietary: [] });
        expect(rules).toMatch(/exactly 1 day[^s]/);
    });
});

// ── wmoToWeather ──────────────────────────────────────────────────────────────

describe('wmoToWeather', () => {
    it('maps code 0 to Sunny', () => {
        const w = wmoToWeather(0, 32.6);
        expect(w.condition).toBe('Sunny');
        expect(w.emoji).toBe('☀️');
        expect(w.tempC).toBe(33);
    });

    it('rounds temperature', () => {
        expect(wmoToWeather(3, 20.4).tempC).toBe(20);
        expect(wmoToWeather(3, 20.5).tempC).toBe(21);
    });

    it('falls back to Unknown for unrecognised codes', () => {
        const w = wmoToWeather(999, 25);
        expect(w.condition).toBe('Unknown');
    });

    it('maps code 95 to Thunderstorm', () => {
        expect(wmoToWeather(95, 18).condition).toBe('Thunderstorm');
    });
});
