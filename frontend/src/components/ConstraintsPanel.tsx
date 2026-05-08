import React, { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useTrip, Constraints } from '../context/TripContext';

const GROUP_TYPES: Constraints['groupType'][] = ['Solo', 'Couple', 'Family', 'Group'];
const PACE_OPTIONS: Constraints['pace'][] = ['Relaxed', 'Balanced', 'Packed'];
const DIETARY_OPTIONS = ['Veg', 'Vegan', 'Halal', 'None'];
const CURRENCIES: Constraints['budgetCurrency'][] = ['₹', '$', '€'];

const Pill = ({
    active,
    onClick,
    children,
    label,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    /** Accessible label used when button text alone is insufficient context. */
    label?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={label}
        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
            active
                ? 'bg-amber-500 border-amber-500 text-black'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
    >
        {children}
    </button>
);

export const ConstraintsPanel = () => {
    const { state, setConstraint } = useTrip();
    const c = state.constraints;
    const [open, setOpen] = useState(false);

    const toggleDietary = (option: string) => {
        if (option === 'None') {
            setConstraint({ dietary: [] });
            return;
        }
        const next = c.dietary.includes(option)
            ? c.dietary.filter((d) => d !== option)
            : [...c.dietary.filter((d) => d !== 'None'), option];
        setConstraint({ dietary: next });
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls="constraints-panel"
                className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs font-bold uppercase tracking-widest transition-colors mb-3"
            >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                Preferences & Constraints
                {open ? (
                    <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
            </button>

            {open && (
                <div
                    id="constraints-panel"
                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-5 mb-4"
                    role="group"
                    aria-label="Trip preferences"
                >
                    {/* Duration */}
                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                            Trip Duration — <span className="text-amber-400">{c.durationDays} {c.durationDays === 1 ? 'day' : 'days'}</span>
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={14}
                            value={c.durationDays}
                            onChange={(e) => setConstraint({ durationDays: Number(e.target.value) })}
                            className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-amber-500 cursor-pointer"
                            aria-label="Trip duration in days"
                            aria-valuemin={1}
                            aria-valuemax={14}
                            aria-valuenow={c.durationDays}
                        />
                        <div className="flex justify-between text-[10px] text-white/20 mt-1">
                            <span>1 day</span><span>14 days</span>
                        </div>
                    </div>

                    {/* Budget */}
                    <div>
                        <label htmlFor="budget-amount" className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                            Budget Cap <span className="text-white/25 normal-case font-normal">(0 = no limit)</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="flex rounded-xl overflow-hidden border border-white/10">
                                {CURRENCIES.map((cur) => (
                                    <button
                                        key={cur}
                                        type="button"
                                        onClick={() => setConstraint({ budgetCurrency: cur })}
                                        className={`px-3 py-2 text-sm font-bold transition-colors ${
                                            c.budgetCurrency === cur
                                                ? 'bg-amber-500 text-black'
                                                : 'bg-white/5 text-white/40 hover:bg-white/10'
                                        }`}
                                        aria-pressed={c.budgetCurrency === cur}
                                    >
                                        {cur}
                                    </button>
                                ))}
                            </div>
                            <input
                                id="budget-amount"
                                type="number"
                                min={0}
                                value={c.budgetAmount || ''}
                                onChange={(e) => setConstraint({ budgetAmount: Number(e.target.value) })}
                                placeholder="e.g. 15000"
                                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    {/* Group type */}
                    <div>
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Group Type</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Group type">
                            {GROUP_TYPES.map((g) => (
                                <Pill key={g} active={c.groupType === g} onClick={() => setConstraint({ groupType: g })} label={`Group type: ${g}`}>
                                    {g}
                                </Pill>
                            ))}
                        </div>
                    </div>

                    {/* Pace */}
                    <div>
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Pace</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Trip pace">
                            {PACE_OPTIONS.map((p) => (
                                <Pill key={p} active={c.pace === p} onClick={() => setConstraint({ pace: p })} label={`Trip pace: ${p}`}>
                                    {p}
                                </Pill>
                            ))}
                        </div>
                    </div>

                    {/* Dietary */}
                    <div>
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Dietary</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Dietary preferences">
                            {DIETARY_OPTIONS.map((d) => (
                                <Pill
                                    key={d}
                                    active={d === 'None' ? c.dietary.length === 0 : c.dietary.includes(d)}
                                    onClick={() => toggleDietary(d)}
                                    label={d === 'None' ? 'No dietary restrictions' : `Dietary: ${d}`}
                                >
                                    {d}
                                </Pill>
                            ))}
                        </div>
                    </div>

                    {/* Wheelchair */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="wheelchair"
                            checked={c.wheelchairFriendly}
                            onChange={(e) => setConstraint({ wheelchairFriendly: e.target.checked })}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        />
                        <label htmlFor="wheelchair" className="text-xs font-bold text-white/50 uppercase tracking-wider cursor-pointer select-none">
                            Wheelchair Accessible Venues Only
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};
