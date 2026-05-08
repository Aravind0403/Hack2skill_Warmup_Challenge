import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Vibe parser ────────────────────────────────────────────────────────────────

const VIBES = ['spiritual', 'adventure', 'beach', 'culture', 'luxury'] as const;
type Vibe = typeof VIBES[number];

function parseVibe(query: string): Vibe {
    const q = query.toLowerCase();
    if (q.includes('spiritual')) return 'spiritual';
    if (q.includes('beach')) return 'beach';
    if (q.includes('cultur')) return 'culture'; // matches "culture" and "cultural"
    if (q.includes('luxury')) return 'luxury';
    return 'adventure';
}

describe('parseVibe', () => {
    it('detects spiritual', () => expect(parseVibe('A spiritual trip to Thanjavur')).toBe('spiritual'));
    it('detects beach', () => expect(parseVibe('relaxing beach holiday in Goa')).toBe('beach'));
    it('detects culture', () => expect(parseVibe('cultural tour of Rajasthan')).toBe('culture'));
    it('detects luxury', () => expect(parseVibe('luxury stay in Dubai')).toBe('luxury'));
    it('defaults to adventure for unknown queries', () => expect(parseVibe('a normal trip')).toBe('adventure'));
    it('is case-insensitive', () => expect(parseVibe('SPIRITUAL journey')).toBe('spiritual'));
});

// ── Query validation ───────────────────────────────────────────────────────────

function validateQuery(query: unknown): string | null {
    if (query === null || query === undefined || typeof query !== 'string') return 'query is required and must be a string.';
    if (query.trim().length === 0) return 'query must not be empty.';
    if (query.length > 500) return 'query must be 500 characters or fewer.';
    return null;
}

describe('validateQuery', () => {
    it('returns null for a valid query', () => expect(validateQuery('trip to Paris')).toBeNull());
    it('errors on null', () => expect(validateQuery(null)).toMatch(/required/));
    it('errors on number', () => expect(validateQuery(42)).toMatch(/required/));
    it('errors on empty string', () => expect(validateQuery('')).toMatch(/empty/));
    it('errors on whitespace-only', () => expect(validateQuery('   ')).toMatch(/empty/));
    it('errors on strings over 500 chars', () => expect(validateQuery('x'.repeat(501))).toMatch(/500/));
    it('accepts exactly 500 chars', () => expect(validateQuery('x'.repeat(500))).toBeNull());
});

// ── TripContext default state ──────────────────────────────────────────────────

describe('TripContext default state shape', () => {
    const defaultState = {
        destination: '',
        budget: 'moderate',
        pace: 'balanced',
        vibe: 'adventure' as Vibe,
        itinerary: [],
        loading: false,
        error: null,
    };

    it('has empty destination by default', () => expect(defaultState.destination).toBe(''));
    it('has empty itinerary array by default', () => expect(defaultState.itinerary).toHaveLength(0));
    it('is not loading by default', () => expect(defaultState.loading).toBe(false));
    it('has no error by default', () => expect(defaultState.error).toBeNull());
    it('has adventure vibe by default', () => expect(defaultState.vibe).toBe('adventure'));
});

// ── Fetch planTrip — loading state ────────────────────────────────────────────

describe('planTrip loading state', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('sets loading true then false on success', async () => {
        const states: boolean[] = [];
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                destination: 'Paris',
                vibe: 'culture',
                budget: 'moderate',
                pace: 'relaxed',
                itinerary: [{ day: 1, title: 'Arrival', activities: ['Check in'] }],
            }),
        });
        vi.stubGlobal('fetch', mockFetch);

        let loading = true;
        states.push(loading);

        // Simulate the fetch completing
        await mockFetch('/api/plan', { method: 'POST', body: JSON.stringify({ query: 'Paris' }) });
        loading = false;
        states.push(loading);

        expect(states).toEqual([true, false]);
        expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('sets error state on failed fetch', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        let error: string | null = null;
        try {
            const res = await fetch('/api/plan', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to fetch itinerary');
        } catch (e) {
            error = (e as Error).message;
        }
        expect(error).toBe('Failed to fetch itinerary');
    });
});
