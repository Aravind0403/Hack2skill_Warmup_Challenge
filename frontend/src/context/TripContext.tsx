import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';

export type Vibe = 'spiritual' | 'adventure' | 'beach' | 'culture' | 'luxury';

export interface ItineraryItem {
    day: number;
    title: string;
    activities: string[];
    vibe: string;
}

export interface TripState {
    destination: string;
    budget: string;
    pace: string;
    vibe: Vibe;
    itinerary: ItineraryItem[];
    loading: boolean;
    error: string | null;
}

interface TripContextType {
    state: TripState;
    setTripData: (data: Partial<TripState>) => void;
    planTrip: (query: string) => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

const DEFAULT_STATE: TripState = {
    destination: '',
    budget: 'moderate',
    pace: 'balanced',
    vibe: 'adventure',
    itinerary: [],
    loading: false,
    error: null,
};

export const TripProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<TripState>(DEFAULT_STATE);
    const abortRef = useRef<AbortController | null>(null);

    const setTripData = (data: Partial<TripState>) => {
        setState((prev) => ({ ...prev, ...data }));
    };

    const planTrip = async (query: string) => {
        // Cancel any in-flight request before starting a new one
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await fetch('/api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
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
                itinerary: data.itinerary,
                loading: false,
            }));
        } catch (err) {
            if ((err as Error).name === 'AbortError') return; // intentional cancel — don't update state
            setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }));
        }
    };

    return (
        <TripContext.Provider value={{ state, setTripData, planTrip }}>
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
