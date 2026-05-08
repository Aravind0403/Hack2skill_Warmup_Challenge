import React from 'react';

const SkeletonLine = ({ width = 'w-full', height = 'h-3' }: { width?: string; height?: string }) => (
    <div className={`${width} ${height} bg-white/10 rounded-full animate-pulse`} />
);

const SkeletonDayCard = ({ index }: { index: number }) => (
    <div className="relative pl-8 md:pl-12" aria-hidden="true">
        {/* Day marker */}
        <div className="absolute -left-3 md:-left-4 top-0 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full animate-pulse" />

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-white/10 rounded animate-pulse shrink-0" />
                <SkeletonLine width={index % 2 === 0 ? 'w-2/5' : 'w-1/3'} height="h-5" />
            </div>

            {/* Activity lines */}
            <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse shrink-0 mt-0.5" />
                    <SkeletonLine width="w-4/5" />
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse shrink-0 mt-0.5" />
                    <SkeletonLine width="w-3/4" />
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse shrink-0 mt-0.5" />
                    <SkeletonLine width="w-2/3" />
                </div>
            </div>

            {/* Footer badges */}
            <div className="flex items-center justify-between pt-2">
                <SkeletonLine width="w-24" height="h-2.5" />
                <SkeletonLine width="w-32" height="h-2.5" />
            </div>
        </div>
    </div>
);

export const SkeletonTimeline = ({ days = 3 }: { days?: number }) => (
    <div className="w-full max-w-4xl mx-auto px-4 py-12" aria-busy="true" aria-label="Generating itinerary">
        {/* Hero skeleton */}
        <div className="w-full h-48 md:h-64 rounded-3xl bg-white/5 animate-pulse mb-12" />

        <ol className="relative border-l-2 border-white/10 ml-4 md:ml-8 space-y-12">
            {Array.from({ length: days }).map((_, i) => (
                <SkeletonDayCard key={i} index={i} />
            ))}
        </ol>
    </div>
);
