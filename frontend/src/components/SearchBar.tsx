import React, { useState } from 'react';
import { useTrip } from '../context/TripContext';
import { Search, Loader2 } from 'lucide-react';

export const SearchBar = () => {
    const [query, setQuery] = useState('');
    const { state, planTrip } = useTrip();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            planTrip(query);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-8">
            <form onSubmit={handleSubmit} className="relative group" role="search" aria-label="Trip planning search">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Enter your dream trip description"
                    placeholder="e.g., A spiritual solo trip to Thanjavur on a budget"
                    className="w-full px-6 py-4 text-lg bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300 group-hover:border-white/40 shadow-2xl"
                />
                <button
                    type="submit"
                    disabled={state.loading}
                    aria-label={state.loading ? "Generating itinerary" : "Search trip"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {state.loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Search className="w-6 h-6" />
                    )}
                </button>
            </form>
            {state.error && (
                <p className="mt-2 text-red-400 text-center text-sm">{state.error}</p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['Thanjavur', 'Goa', 'Ladakh', 'Bali'].map(dest => (
                    <button
                        key={dest}
                        onClick={() => { setQuery(dest); planTrip(dest); }}
                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[10px] font-bold text-white/40 uppercase tracking-widest transition-all"
                    >
                        {dest}
                    </button>
                ))}
            </div>
        </div>
    );
};
