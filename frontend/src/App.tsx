import React from 'react'
import { TripProvider } from './context/TripContext'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { SearchBar } from './components/SearchBar'
import { ItineraryTimeline } from './components/ItineraryTimeline'
import { Compass } from 'lucide-react'

function App() {
  return (
    <TripProvider>
      <ThemeSwitcher>
        <div className="container mx-auto min-h-screen flex flex-col items-center pt-20 pb-32">
          {/* Header */}
          <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="p-4 bg-white/5 rounded-3xl border border-white/10 mb-6 shadow-2xl">
              <Compass className="w-12 h-12 text-amber-500 animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              TRAVEL ENGINE
            </h1>
            <p className="text-white/40 text-lg md:text-xl font-medium tracking-tight">
              AI-Powered Personalized Itineraries
            </p>
          </div>

          <SearchBar />
          
          {/* Action Bar */}
          {state.itinerary.length > 0 && (
            <div className="flex justify-center mb-8">
              <button 
                onClick={() => window.print()}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 text-xs font-bold tracking-widest uppercase transition-all"
              >
                Export Itinerary
              </button>
            </div>
          )}

          <ItineraryTimeline />

          {/* Footer Decoration */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-white/30 text-xs font-bold tracking-[0.2em] uppercase">
            <span>Powered by Gemini</span>
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <span>Cloud Run Ready</span>
          </div>
        </div>
      </ThemeSwitcher>
    </TripProvider>
  )
}

export default App
