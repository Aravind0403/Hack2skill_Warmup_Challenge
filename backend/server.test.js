const request = require('supertest');

process.env.PORT = '0';
process.env.NODE_ENV = 'test';

let app, server;

beforeAll(() => {
    ({ app, server } = require('./server'));
});

afterAll((done) => {
    server.close(done);
});

describe('GET /health', () => {
    it('returns 200 with status ok and timestamp', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.timestamp).toBe('string');
    });
});

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

    it('returns 400 when query is not a string', async () => {
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
});

describe('POST /api/plan — missing API key', () => {
    const saved = process.env.GEMINI_API_KEY;

    beforeEach(() => {
        delete process.env.GEMINI_API_KEY;
    });

    afterEach(() => {
        if (saved) process.env.GEMINI_API_KEY = saved;
    });

    it('returns 503 when GEMINI_API_KEY is not set', async () => {
        const res = await request(app)
            .post('/api/plan')
            .send({ query: 'trip to Paris' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(503);
        expect(res.body.error).toBeDefined();
    });
});

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

describe('Response headers', () => {
    it('includes X-Request-ID on /health', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-request-id']).toBeDefined();
    });

    it('includes Cache-Control on successful /health', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['cache-control']).toBeDefined();
    });
});
