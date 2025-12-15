#!/bin/bash
set -e

echo "🔨 Building SubRoute app..."
npm run build

echo "🚀 Deploying to App Engine..."
gcloud app deploy --quiet

echo "✅ Deployment complete!"
echo "Your app is now live at: https://YOUR-PROJECT-ID.uc.r.appspot.com"
