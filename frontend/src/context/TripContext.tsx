import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';

export type Vibe = 'spiritual' | 'adventure' | 'beach' | 'culture' | 'luxury';

export interface Constraints {
    durationDays: number;
    budgetAmount: number;
    budgetCurrency: '₹' | '$' | '€';
    groupType: 'Solo' | 'Couple' | 'Family' | 'Group';
    pace: 'Relaxed' | 'Balanced' | 'Packed';
    wheelchairFriendly: boolean;
    dietary: string[];
}

export const DEFAULT_CONSTRAINTS: Constraints = {
    durationDays: 5,
    budgetAmount: 0,
    budgetCurrency: '₹',
    groupType: 'Solo',
    pace: 'Balanced',
    wheelchairFriendly: false,
    dietary: [],
};

export interface Weather {
    condition: string;
    emoji: string;
    tempC: number;
}

export interface ItineraryItem {
    day: number;
    title: string;
    activities: string[];
    estimated_cost?: string;
    must_do?: string;
    weather?: Weather;
}

export interface TripState {
    destination: string;
    budget: string;
    pace: string;
    vibe: Vibe;
    tips: string[];
    itinerary: ItineraryItem[];
    constraints: Constraints;
    loading: boolean;
    replanningDay: number | null;
    error: string | null;
}

interface TripContextType {
    state: TripState;
    setTripData: (data: Partial<TripState>) => void;
    setConstraint: (patch: Partial<Constraints>) => void;
    planTrip: (query: string, constraints?: Constraints) => Promise<void>;
    replanDay: (dayIndex: number) => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

const DEFAULT_STATE: TripState = {
    destination: '',
    budget: 'moderate',
    pace: 'balanced',
    vibe: 'adventure',
    tips: [],
    itinerary: [],
    constraints: DEFAULT_CONSTRAINTS,
    loading: false,
    replanningDay: null,
    error: null,
};

export const TripProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<TripState>(DEFAULT_STATE);
    const abortRef = useRef<AbortController | null>(null);

    const setTripData = (data: Partial<TripState>) => {
        setState((prev) => ({ ...prev, ...data }));
    };

    const setConstraint = (patch: Partial<Constraints>) => {
        setState((prev) => ({
            ...prev,
            constraints: { ...prev.constraints, ...patch },
        }));
    };

    const planTrip = async (query: string, constraints?: Constraints) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await fetch('/api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, constraints: constraints ?? state.constraints }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `Request failed with status ${response.status}`);
            }

            const data = await response.json();
            setState((prev) => ({
                ...prev,
                destination: data.destination,
                vibe: data.vibe,
                budget: data.budget,
                pace: data.pace,
                tips: data.tips ?? [],
                itinerary: data.itinerary ?? [],
                loading: false,
            }));
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }));
        }
    };

    const replanDay = async (dayIndex: number) => {
        const item = state.itinerary[dayIndex];
        if (!item) return;

        setState((prev) => ({ ...prev, replanningDay: dayIndex }));

        try {
            const response = await fetch('/api/replan-day', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination: state.destination,
                    day: item.day,
                    dayTitle: item.title,
                    activities: item.activities,
                    currentWeather: item.weather,
                    constraints: state.constraints,
                }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to replan day');
            }

            const updated = await response.json();
            setState((prev) => {
                const newItinerary = [...prev.itinerary];
                newItinerary[dayIndex] = { ...newItinerary[dayIndex], ...updated };
                return { ...prev, itinerary: newItinerary, replanningDay: null };
            });
        } catch (err) {
            setState((prev) => ({
                ...prev,
                replanningDay: null,
                error: (err as Error).message,
            }));
        }
    };

    return (
        <TripContext.Provider value={{ state, setTripData, setConstraint, planTrip, replanDay }}>
            {children}
        </TripContext.Provider>
    );
};

export const useTrip = () => {
    const context = useContext(TripContext);
    if (context === undefined) {
        throw new Error('useTrip must be used within a TripProvider');
    }
    return context;
};
