#!/bin/bash
# 1. Enable necessary Google Cloud services
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project hack2skill-hackathon-495705

# 2. Create Artifact Registry repository (if it doesn't exist)
gcloud artifacts repositories create travel-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Travel Engine Repository" --project hack2skill-hackathon-495705 || true

# 3. Build and Submit to Artifact Registry
gcloud builds submit --tag us-central1-docker.pkg.dev/hack2skill-hackathon-495705/travel-repo/travel-engine-warmup --project hack2skill-hackathon-495705

# 4. Deploy to Cloud Run
gcloud run deploy travel-engine-warmup \
    --image us-central1-docker.pkg.dev/hack2skill-hackathon-495705/travel-repo/travel-engine-warmup \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated --project hack2skill-hackathon-495705
