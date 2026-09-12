# NewsTracker — Frontend

Angular client for **NewsTracker**, a financial news tracker: build a watchlist, read AI-classified
company news in English or Spanish, follow price action on an interactive chart with news markers,
and get browser push notifications for high-impact stories, big price moves and a daily digest.

Angular 21 (standalone, signals, zoneless) · TypeScript · Tailwind CSS 4 · Lightweight Charts ·
Firebase Auth + Cloud Messaging · Vitest.

> The API and background pipeline live in a separate repository:
> [newsTracker-backend](https://github.com/rafaelhernandezperez/newsTracker-backend).

---

## Contents

- [Features](#features)
- [Screens](#screens)
- [Getting started](#getting-started)
- [Firebase configuration](#firebase-configuration)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Notes on security](#notes-on-security)
- [License](#license)

---

## Features

- **Watchlist portfolio** — add companies by symbol search, see live quotes in a ticker board and a
  scrolling ribbon.
- **AI-classified news** — each article carries a summary, a sentiment (positive / negative /
  neutral) and an importance grade, produced by the backend's LLM pipeline.
- **Chart with news markers** — price history rendered with
  [Lightweight Charts](https://tradingview.github.io/lightweight-charts/), annotated with the dated
  news events behind each move.
- **Bilingual UI (EN/ES)** — a runtime language toggle that also drives the language the backend
  summarizes and translates news into.
- **Currency toggle** — quotes converted on the fly.
- **Web push** — per-alert-type opt-in (high-impact news, big price moves, daily digest) via Firebase
  Cloud Messaging and a service worker, with rotating-token refresh handled for you.
- **Email/password auth** — route guards keep authenticated and unauthenticated views apart.

---

## Screens

| Route                | Guard        | What it is |
| -------------------- | ------------ | ---------- |
| `/login`             | `loginGuard` | Sign in / register |
| `/portfolio`         | `authGuard`  | Watchlist, ticker board, live quotes |
| `/portfolio/:symbol` | `authGuard`  | Company detail: chart with news markers, classified news feed |

---

## Getting started

**Prerequisites** — Node.js 22+ and a running instance of the backend.

```bash
git clone https://github.com/rafaelhernandezperez/newsTracker-frontend.git
cd newsTracker-frontend
npm install
npm start                     # http://localhost:4200
```

The dev server proxies `/api` to `http://127.0.0.1:8080` and strips the prefix — matching
`npm run dev` in the backend's `functions/` directory. Start the backend first, or edit
[`proxy.conf.json`](proxy.conf.json) to point somewhere else.

In production the same `/api` paths are served by a Firebase Hosting rewrite to the `api` function,
so no environment-specific base URL is needed.

---

## Firebase configuration

Browser Firebase config is **public by design** — it identifies the project, it does not authorize
anything. Access is controlled by Firebase Auth, Firestore security rules and the backend's token
verification. Point the app at your own project by editing both files:

1. [`src/app/core/firebase/firebase.config.ts`](src/app/core/firebase/firebase.config.ts) — the SDK
   config object and the **VAPID key** (Firebase console → Cloud Messaging → Web configuration).
2. [`public/firebase-messaging-sw.js`](public/firebase-messaging-sw.js) — the same config again. A
   service worker cannot import the app bundle, so this copy is unavoidable. **Keep the two in
   sync**; a mismatch shows up as push registration failing silently.

Enable **Authentication → Email/Password** and **Cloud Messaging** in the Firebase console.

### App Check

Sign-up is open, so a valid login proves nothing about *what* is calling the API. App Check fixes
that by attesting that requests come from this app. To turn it on:

1. Firebase console → **App Check → Apps** → register this web app with the **reCAPTCHA v3**
   provider.
2. Paste the **site** key into `appCheckSiteKey` in `firebase.config.ts`.

The auth interceptor then sends an `X-Firebase-AppCheck` header alongside the ID token. Leaving the
key empty keeps App Check off and the app works normally — useful for a fresh clone. Attestation
failures are non-fatal by design: a blocked reCAPTCHA domain or a privacy extension degrades to an
unattested request rather than a broken page, and the backend decides how to treat it
(see `APP_CHECK_ENFORCED` in the backend repo).

If you are running your own project, also set `ALLOWED_ORIGINS` in the backend so your origin passes
CORS.

---

## Scripts

| Command                     | Description |
| --------------------------- | ----------- |
| `npm start`                 | Dev server with the `/api` proxy on `http://localhost:4200` |
| `npm run build`             | Production build into `dist/newsTracker-frontend/` |
| `npm run watch`             | Development build, rebuilding on change |
| `npm test`                  | Vitest in watch mode |
| `npm test -- --watch=false` | Run the suite once (use this in CI) |
| `npm run format`            | Prettier write |
| `npm run format:check`      | Prettier check, no writes |

---

## Architecture

```
src/app/
├── core/
│   ├── firebase/       SDK init, VAPID key
│   ├── guards/         authGuard · loginGuard
│   ├── interceptors/   attaches the Firebase ID token to /api/ requests only
│   ├── services/       auth · watchlist · news-data · market-data · push ·
│   │                   ticker-search · user-preferences · alert-prefs ·
│   │                   language · currency · clock
│   ├── i18n/           EN/ES translations + news-text helpers
│   ├── models/         news · company · market
│   └── data/           bundled company reference data
├── pages/              login · portfolio · company-detail
└── shared/components/  ticker-board · ticker-ribbon · settings-modal ·
                        company-selector-modal · language-toggle · currency-toggle
```

**State** is held in Angular signals inside `providedIn: 'root'` services rather than a store
library — the app's shared state is small (auth user, watchlist, language, currency, alert prefs)
and signals keep it readable.

**UI preferences** (language, currency, selected companies, alert prefs, FCM token) are cached in
`localStorage` for instant startup, with the server as the source of truth once loaded. Every read
is guarded, so a browser blocking site data degrades to defaults instead of breaking.

**Push registration** requests notification permission *before* any `await`, so the browser's user
activation is still valid, then registers the resulting FCM token with the backend and refreshes it
when Firebase rotates it.

---

## Project layout

Standalone components with the Angular 21 defaults: lazy-loaded routes via `loadComponent`,
zoneless change detection, and one folder per component holding its `.ts`, `.html` and `.css`.
Tests sit next to the code they cover as `*.spec.ts` and run on Vitest with jsdom.

---

## Notes on security

- The auth interceptor attaches the Firebase ID token **only** to relative `/api/` URLs, so a token
  can never leak to a third-party host through an outbound request.
- No `innerHTML`, no `bypassSecurityTrust*` — all news content (untrusted publisher text) goes
  through Angular's default template escaping.
- The Firebase web API key, VAPID key and App Check site key in this repository are public values —
  they identify the project and are bound to registered domains. Keep the API key restricted to your
  Hosting domains in the Google Cloud console, and set a sign-up quota under
  **Authentication → Settings**: with Email/Password enabled, anyone can register an account.
- The production build sets `inlineCritical: false`. Critical-CSS inlining emits an inline
  `onload=` handler, which would force `script-src 'unsafe-inline'` and gut the Content-Security-
  Policy served by Hosting. Render-blocking CSS is the cheaper trade.
- `npm audit` reports clean. Re-check it before any release.

---

## License

MIT — see [LICENSE](LICENSE).

Built as a Master's thesis project. News content belongs to its respective publishers.
