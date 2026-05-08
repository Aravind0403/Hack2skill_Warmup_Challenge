import React, { memo, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { SkeletonTimeline } from './SkeletonCard';
import { Calendar, MapPin, CheckCircle2, ExternalLink, RefreshCw, Star, Banknote, Lightbulb } from 'lucide-react';
import type { ItineraryItem } from '../context/TripContext';

// ── Day card ───────────────────────────────────────────────────────────────────

interface DayCardProps {
    item: ItineraryItem;
    index: number;
    destination: string;
    vibe: string;
    isReplanning: boolean;
    onReplan: () => void;
}

const DayCard = memo(({ item, index, destination, vibe, isReplanning, onReplan }: DayCardProps) => {
    const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${destination} ${item.title}`)}`;

    return (
        <li className="relative pl-8 md:pl-12">
            {/* Day marker */}
            <div
                className="absolute -left-3 md:-left-4 top-0 w-6 h-6 md:w-8 md:h-8 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold text-xs md:text-sm shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                aria-label={`Day ${item.day}`}
            >
                {item.day}
            </div>

            <article className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 md:p-8 transition-all duration-300 group ${isReplanning ? 'opacity-60' : 'hover:bg-white/10'}`}>
                {/* Header row */}
                <header className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
                        <h3 className="text-xl md:text-2xl font-bold text-white">{item.title}</h3>
                    </div>

                    {/* Weather badge */}
                    {item.weather && (
                        <div
                            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full shrink-0"
                            aria-label={`Weather: ${item.weather.condition}, ${item.weather.tempC}°C`}
                        >
                            <span role="img" aria-hidden="true">{item.weather.emoji}</span>
                            <span className="text-xs font-semibold text-white/60">{item.weather.tempC}°C</span>
                            <span className="text-xs text-white/40 hidden sm:inline">{item.weather.condition}</span>
                        </div>
                    )}
                </header>

                {/* Must-do highlight */}
                {item.must_do && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <Star className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                        <span className="text-sm font-semibold text-amber-300">Must do: {item.must_do}</span>
                    </div>
                )}

                {/* Activities */}
                <ul className="space-y-3">
                    {item.activities.map((activity, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/70 group-hover:text-white/90 transition-colors">
                            <CheckCircle2 className="w-5 h-5 mt-0.5 text-amber-500/50 group-hover:text-amber-500 transition-colors shrink-0" aria-hidden="true" />
                            <span className="text-sm md:text-base leading-relaxed">{activity}</span>
                        </li>
                    ))}
                </ul>

                {/* Footer row */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500/80">
                            <MapPin className="w-4 h-4" aria-hidden="true" />
                            <span>{vibe} Experience</span>
                        </div>
                        {item.estimated_cost && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white/40">
                                <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{item.estimated_cost}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Refresh / replan button */}
                        <button
                            type="button"
                            onClick={onReplan}
                            disabled={isReplanning}
                            aria-label={isReplanning ? `Replanning day ${item.day}` : `Refresh day ${item.day} plan`}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white/30 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin' : ''}`} aria-hidden="true" />
                            {isReplanning ? 'Replanning…' : 'Refresh day'}
                        </button>

                        {/* Google Maps link */}
                        <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${item.title} on Google Maps`}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white/30 hover:text-amber-400 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            Google Maps
                        </a>
                    </div>
                </div>
            </article>
        </li>
    );
});

DayCard.displayName = 'DayCard';

// ── Hero image with fallback ───────────────────────────────────────────────────

const HeroImage = ({ destination }: { destination: string }) => {
    const [failed, setFailed] = useState(false);
    const initials = destination
        .split(/[\s,]+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');

    if (failed) {
        return (
            <div className="w-full h-48 md:h-64 rounded-3xl mb-12 relative shadow-2xl bg-gradient-to-br from-amber-900/40 to-theme-bg flex items-center justify-center">
                <span className="text-6xl font-black text-white/20 tracking-widest">{initials}</span>
                <div className="absolute bottom-6 left-8">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
                        {destination}
                    </h2>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-48 md:h-64 rounded-3xl overflow-hidden mb-12 relative group shadow-2xl">
            <img
                src={`https://loremflickr.com/1200/600/${destination || 'travel'}`}
                alt={destination ? `Travel destination photo for ${destination}` : 'Travel destination photo'}
                loading="lazy"
                onError={() => setFailed(true)}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-theme-bg via-transparent to-transparent" aria-hidden="true" />
            <div className="absolute bottom-6 left-8">
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
                    {destination}
                </h2>
            </div>
        </div>
    );
};

// ── Timeline ───────────────────────────────────────────────────────────────────

export const ItineraryTimeline = () => {
    const { state, replanDay } = useTrip();

    if (state.loading) {
        return <SkeletonTimeline days={state.constraints.durationDays} />;
    }

    if (!state.itinerary.length) return null;

    return (
        <section className="w-full max-w-4xl mx-auto px-4 py-12" aria-label="Travel itinerary">
            <HeroImage destination={state.destination} />

            <ol className="relative border-l-2 border-white/20 ml-4 md:ml-8 space-y-12" aria-label="Day-by-day itinerary">
                {state.itinerary.map((item, index) => (
                    <DayCard
                        key={item.day}
                        item={item}
                        index={index}
                        destination={state.destination}
                        vibe={state.vibe}
                        isReplanning={state.replanningDay === index}
                        onReplan={() => replanDay(index)}
                    />
                ))}
            </ol>

            {/* Tips section */}
            {state.tips.length > 0 && (
                <aside className="mt-12 bg-white/5 border border-white/10 rounded-3xl p-6" aria-label="Local tips">
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-5 h-5 text-amber-500" aria-hidden="true" />
                        <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Local Tips</h3>
                    </div>
                    <ul className="space-y-2">
                        {state.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-3 text-white/60 text-sm leading-relaxed">
                                <span className="text-amber-500/60 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </aside>
            )}
        </section>
    );
};
