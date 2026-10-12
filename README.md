# Safety Detection Frontend

Repository: https://github.com/Bibek1604/safety-detection-frontend-

Deploy this directory as a Render Static Site. Leave Root Directory blank.
Use the included render.yaml with New > Blueprint, or configure:

- Build: npm ci --include=dev && npm run build
- Publish directory: dist
- Node: 22
- Rewrite: /* to /index.html (required for React route refreshes)
- Environment: VITE_API_URL=https://YOUR-ACTUAL-BACKEND.onrender.com/api

Use your backend's actual Render URL. VITE_API_URL is substituted at build time; rebuild whenever it changes. Set the backend CORS_ORIGIN to this site's actual origin, without a trailing slash.

Do not commit .env, node_modules or dist. Keep public/assets in Git; these contain the game's 3D models and sounds.

Local setup: npm ci followed by npm run dev. With VITE_API_URL unset, /api uses the local Vite proxy to localhost:5000.

After deployment, verify signup, login, Case 001 completion, Case 002 unlocking, model loading, and direct navigation to /dashboard. The frontend production build still needs verification on your terminal or Render because the editing host blocks subprocess execution.
