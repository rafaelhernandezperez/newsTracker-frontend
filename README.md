# NewsTracker Frontend

Angular application for company watchlists, market charts, localized news, and browser notifications.

Install dependencies with `npm install`, then run `npm start` and open `http://localhost:4200/`.
The development proxy forwards `/api` requests to `http://127.0.0.1:8080`, removing the `/api` prefix.
Start the backend separately or update `proxy.conf.json` to match its address.

Available commands:

- `npm run build` creates a production build in `dist/newsTracker-frontend/`.
- `npm test -- --watch=false` runs the Vitest suite once; `npm test` watches for changes.
- `npm run format` formats project files with Prettier.
- `npm run format:check` checks formatting without changing files.

Firebase browser configuration lives in `src/app/core/firebase/firebase.config.ts` and
`public/firebase-messaging-sw.js`; keep both copies aligned. The VAPID key is configured in the
TypeScript file.
