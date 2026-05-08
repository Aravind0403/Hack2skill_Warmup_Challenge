# Travel Engine — AI-Powered Trip Planner

> Live: https://travel-engine-269130133009.asia-south1.run.app

## What it does
Describe your dream trip in plain English and get a full day-by-day itinerary with real-time weather, cost estimates, local tips, and Google Maps links — powered by Gemini AI.

## Features
- **AI Itinerary** — Gemini generates structured multi-day plans from a single sentence
- **Preferences Panel** — set duration, budget, group type, pace, dietary, wheelchair access
- **Live Weather** — Open-Meteo forecast per day, no API key needed
- **Refresh Day** — replan any single day on demand
- **Google Maps** — deep-link per day card, Places API integration
- **Themes** — auto-switches between spiritual / adventure / beach / culture / luxury

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express |
| AI | Google Gemini 2.0 Flash Lite |
| Deploy | Google Cloud Run (asia-south1) |
| Logging | Google Cloud Logging |

## Run locally
```bash
# 1. Clone and install
git clone https://github.com/Aravind0403/Hack2skill_Warmup_Challenge
cd Hack2skill_Warmup_Challenge

# 2. Add keys
cp backend/.env.example backend/.env
# edit backend/.env with GEMINI_API_KEY and GOOGLE_MAPS_API_KEY

# 3. Start backend
cd backend && npm install && node server.js

# 4. Start frontend (new terminal)
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

## Deploy to Cloud Run
```bash
gcloud run deploy travel-engine \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=xxx,GOOGLE_MAPS_API_KEY=xxx"
```

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio key |
| `GOOGLE_MAPS_API_KEY` | Optional | Enables Places API endpoint |
| `ALLOWED_ORIGIN` | Optional | Lock CORS to your domain |
