import React from 'react';
import { useTrip } from '../context/TripContext';
import { Calendar, MapPin, CheckCircle2 } from 'lucide-react';

export const ItineraryTimeline = () => {
    const { state } = useTrip();

    if (!state.itinerary.length && !state.loading) return null;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-12">
            {/* Hero Image */}
            <div className="w-full h-48 md:h-64 rounded-3xl overflow-hidden mb-12 relative group shadow-2xl">
                <img 
                    src={`https://loremflickr.com/1200/600/${state.destination || 'travel'}`} 
                    alt={state.destination}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-theme-bg via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-8">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
                        {state.destination}
                    </h2>
                </div>
            </div>

            <div className="relative border-l-2 border-white/20 ml-4 md:ml-8 space-y-12" role="list" aria-label="Itinerary Timeline">
                {state.itinerary.map((item, index) => (
                    <div key={index} className="relative pl-8 md:pl-12" role="listitem">
                        {/* Day Marker */}
                        <div 
                            className="absolute -left-3 md:-left-4 top-0 w-6 h-6 md:w-8 md:h-8 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold text-xs md:text-sm shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                            aria-label={`Day ${item.day}`}
                        >
                            {item.day}
                        </div>
                        
                        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 md:p-8 hover:bg-white/10 transition-all duration-300 group">
                            <header className="flex items-center gap-3 mb-4">
                                <Calendar className="w-5 h-5 text-amber-500" aria-hidden="true" />
                                <h3 className="text-xl md:text-2xl font-bold text-white">{item.title}</h3>
                            </header>
                            
                            <ul className="space-y-4">
                                {item.activities.map((activity, i) => (
                                    <li key={i} className="flex items-start gap-3 text-white/70 group-hover:text-white/90 transition-colors">
                                        <CheckCircle2 className="w-5 h-5 mt-0.5 text-amber-500/50 group-hover:text-amber-500 transition-colors shrink-0" />
                                        <span className="text-sm md:text-base leading-relaxed">{activity}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500/80">
                                <MapPin className="w-4 h-4" />
                                <span>{state.vibe} Experience</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
