import React, { useEffect, useRef } from 'react'
import { TripProvider, useTrip } from './context/TripContext'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { SearchBar } from './components/SearchBar'
import { ItineraryTimeline } from './components/ItineraryTimeline'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Compass } from 'lucide-react'

function AppContent() {
  const { state } = useTrip()
  const resultRef = useRef<HTMLDivElement>(null)

  // Move focus to results section once a new itinerary loads so keyboard /
  // screen-reader users don't have to manually navigate past the search form.
  useEffect(() => {
    if (!state.loading && state.itinerary.length > 0 && resultRef.current) {
      resultRef.current.focus()
    }
  }, [state.loading, state.itinerary.length])

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center pt-20 pb-32">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-black focus:rounded-lg focus:font-bold">
        Skip to main content
      </a>

      {/* Header */}
      <header className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="p-4 bg-white/5 rounded-3xl border border-white/10 mb-6 shadow-2xl" aria-hidden="true">
          <Compass className="w-12 h-12 text-amber-500 animate-pulse" />
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
          TRAVEL ENGINE
        </h1>
        <p className="text-white/40 text-lg md:text-xl font-medium tracking-tight">
          AI-Powered Personalized Itineraries
        </p>
      </header>

      <main id="main-content" className="w-full flex flex-col items-center">
        <SearchBar />

        {state.itinerary.length > 0 && (
          <div className="flex justify-center mb-8">
            <button
              onClick={() => window.print()}
              aria-label="Export itinerary to print"
              className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 text-xs font-bold tracking-widest uppercase transition-all"
            >
              Export Itinerary
            </button>
          </div>
        )}

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {state.loading ? 'Generating your itinerary, please wait.' : ''}
          {state.error ? `Error: ${state.error}` : ''}
        </div>

        {/* Focus anchor for keyboard / screen-reader navigation to results */}
        <div
          ref={resultRef}
          tabIndex={-1}
          className="outline-none"
          aria-hidden={state.itinerary.length === 0}
        />

        <ErrorBoundary context="ItineraryTimeline">
          <ItineraryTimeline />
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-white/30 text-xs font-bold tracking-[0.2em] uppercase" role="contentinfo">
        <span>Powered by Gemini</span>
        <div className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true"></div>
        <span>Cloud Run Ready</span>
      </div>
    </div>
  )
}

function App() {
  return (
    <TripProvider>
      <ThemeSwitcher>
        <AppContent />
      </ThemeSwitcher>
    </TripProvider>
  )
}

export default App
