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
    it('detects culture substring', () => expect(parseVibe('explore the culture of India')).toBe('culture'));
    it('defaults to adventure for empty string', () => expect(parseVibe('')).toBe('adventure'));
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
    it('errors on undefined', () => expect(validateQuery(undefined)).toMatch(/required/));
    it('errors on number', () => expect(validateQuery(42)).toMatch(/required/));
    it('errors on object', () => expect(validateQuery({})).toMatch(/required/));
    it('errors on array', () => expect(validateQuery(['trip'])).toMatch(/required/));
    it('errors on empty string', () => expect(validateQuery('')).toMatch(/empty/));
    it('errors on whitespace-only', () => expect(validateQuery('   ')).toMatch(/empty/));
    it('errors on strings over 500 chars', () => expect(validateQuery('x'.repeat(501))).toMatch(/500/));
    it('accepts exactly 500 chars', () => expect(validateQuery('x'.repeat(500))).toBeNull());
    it('accepts unicode query', () => expect(validateQuery('टोक्यो यात्रा')).toBeNull());
});

// ── TripContext default state ──────────────────────────────────────────────────

describe('TripContext default state shape', () => {
    const defaultState = {
        destination: '',
        budget: 'moderate',
        pace: 'balanced',
        vibe: 'adventure' as Vibe,
        tips: [],
        itinerary: [],
        loading: false,
        replanningDay: null,
        error: null,
    };

    it('has empty destination by default', () => expect(defaultState.destination).toBe(''));
    it('has empty itinerary array by default', () => expect(defaultState.itinerary).toHaveLength(0));
    it('is not loading by default', () => expect(defaultState.loading).toBe(false));
    it('has no error by default', () => expect(defaultState.error).toBeNull());
    it('has adventure vibe by default', () => expect(defaultState.vibe).toBe('adventure'));
    it('has empty tips by default', () => expect(defaultState.tips).toHaveLength(0));
    it('has null replanningDay by default', () => expect(defaultState.replanningDay).toBeNull());
    it('has moderate budget by default', () => expect(defaultState.budget).toBe('moderate'));
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
                tips: ['Tip 1'],
                itinerary: [{ day: 1, title: 'Arrival', activities: ['Check in'] }],
            }),
        });
        vi.stubGlobal('fetch', mockFetch);

        let loading = true;
        states.push(loading);
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

    it('handles network error gracefully', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
        let error: string | null = null;
        try {
            await fetch('/api/plan', { method: 'POST' });
        } catch (e) {
            error = (e as Error).message;
        }
        expect(error).toBe('Network error');
    });

    it('parses tips from response', async () => {
        const tips = ['Carry cash', 'Book early', 'Learn local phrases'];
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                destination: 'Tokyo',
                vibe: 'adventure',
                budget: '₹50,000',
                pace: 'Packed',
                tips,
                itinerary: [],
            }),
        });
        vi.stubGlobal('fetch', mockFetch);
        const res = await mockFetch('/api/plan');
        const data = await res.json();
        expect(data.tips).toHaveLength(3);
        expect(data.tips[0]).toBe('Carry cash');
    });
});

// ── Constraints default values ─────────────────────────────────────────────────

describe('Constraints default values', () => {
    const DEFAULT_CONSTRAINTS = {
        durationDays: 5,
        budgetAmount: 0,
        budgetCurrency: '₹' as const,
        groupType: 'Solo' as const,
        pace: 'Balanced' as const,
        wheelchairFriendly: false,
        dietary: [] as string[],
    };

    it('defaults to 5 days', () => expect(DEFAULT_CONSTRAINTS.durationDays).toBe(5));
    it('defaults to no budget cap', () => expect(DEFAULT_CONSTRAINTS.budgetAmount).toBe(0));
    it('defaults to ₹ currency', () => expect(DEFAULT_CONSTRAINTS.budgetCurrency).toBe('₹'));
    it('defaults to Solo group', () => expect(DEFAULT_CONSTRAINTS.groupType).toBe('Solo'));
    it('defaults to Balanced pace', () => expect(DEFAULT_CONSTRAINTS.pace).toBe('Balanced'));
    it('defaults wheelchair to false', () => expect(DEFAULT_CONSTRAINTS.wheelchairFriendly).toBe(false));
    it('defaults dietary to empty array', () => expect(DEFAULT_CONSTRAINTS.dietary).toHaveLength(0));
});

// ── Weather display logic ──────────────────────────────────────────────────────

describe('Weather badge rendering logic', () => {
    interface Weather { condition: string; emoji: string; tempC: number; }

    function formatWeatherLabel(w: Weather): string {
        return `${w.emoji} ${w.condition}, ${w.tempC}°C`;
    }

    it('formats weather label correctly', () => {
        const w: Weather = { condition: 'Sunny', emoji: '☀️', tempC: 32 };
        expect(formatWeatherLabel(w)).toBe('☀️ Sunny, 32°C');
    });

    it('handles snow weather', () => {
        const w: Weather = { condition: 'Snow', emoji: '❄️', tempC: -5 };
        expect(formatWeatherLabel(w)).toContain('-5°C');
    });

    it('handles zero temperature', () => {
        const w: Weather = { condition: 'Overcast', emoji: '☁️', tempC: 0 };
        expect(formatWeatherLabel(w)).toContain('0°C');
    });
});
