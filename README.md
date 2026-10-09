# Pixel Players

> An AI-powered cognitive gaming and memory-assistance platform for elderly users.
> Helping memories stay meaningful.

Pixel Players is a two-experience web app: a warm, large-text **Elder experience**
(games, memory vault, routine, reminders and an AI companion named Clara) and a
data-rich **Caregiver experience** (a dashboard to monitor and support a linked
elder). It ships as a single React + Vite SPA with Clerk authentication, a full
multi-language UI, a light/dark theme system, and a custom "pixel/skeuomorphic"
design language.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Application Shell](#application-shell)
- [Routing Map](#routing-map)
- [Roles & Authentication](#roles--authentication)
- [The Two Experiences](#the-two-experiences)
  - [Elder Experience](#elder-experience)
  - [Caregiver Experience](#caregiver-experience)
- [UI & Design System](#ui--design-system)
- [State Management](#state-management)
- [Services Layer](#services-layer)
- [Internationalization](#internationalization)
- [Loading, Error & Boot System](#loading-error--boot-system)
- [Scroll Experience](#scroll-experience)
- [Project Structure](#project-structure)
- [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19 |
| Build tool | Vite 8 (`@vitejs/plugin-react`) |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) + custom CSS layers |
| Auth | Clerk (`@clerk/react`) |
| i18n | i18next + react-i18next |
| Animation | `motion` (Framer Motion successor) |
| Smooth scroll | `lenis` |
| Linting | ESLint 10 (flat config) |
| Hosting | Vercel (`vercel.json` SPA rewrites) |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
copy .env.example .env.local      # Windows PowerShell
# cp .env.example .env.local      # macOS / Linux

# 3. Add your Clerk publishable key to .env.local (see below)

# 4. Run the dev server
npm run dev
```

The app boots at `http://localhost:5173` (Vite default).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key. Public, safe in the browser. |
| `CLERK_SECRET_KEY` | No | Backend-only secret. Never expose via a `VITE_*` var. |

Get keys from the [Clerk dashboard](https://dashboard.clerk.com).

---

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite` | Start dev server with HMR |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview the production build |
| `lint` | `eslint .` | Lint the codebase |

---

## Application Shell

Provider order (from `src/main.jsx`):

```
StrictMode
└─ BrowserRouter
   └─ ThemeProvider          # light/dark, persisted, OS-aware
      └─ ClerkProviderWithRouter   # Clerk auth wired to the router
         └─ AppProvider      # global elder-facing data (memories, routine, …)
            └─ SmoothScrollProvider   # single Lenis instance + scroll bus
               └─ Suspense (BootShell)  # pre-hydration skeleton
                  └─ App          # routes + Navbar/Footer/Clara
```

`App` (`src/App.jsx`) branches on the URL:

- **`/caregiver/*`** → renders the `CareProvider` + `CaregiverShell` (sidebar layout).
- **everything else** → renders `Navbar` → background wrapper `<main>` → `Footer`,
  plus the floating `ClaraLauncher`. All non-caregiver pages are wrapped in a
  `SkeletonErrorBoundary` and a `ClickSpark` cursor effect.

Route-level code splitting is done with `React.lazy` + `Suspense`.

---

## Routing Map

### Public routes

| Path | Page | Notes |
| --- | --- | --- |
| `/` | `Home` | Marketing landing page |
| `/about` | `About` | |
| `/features` | `Features` | |
| `/games` | `Games` | Cognitive game catalog |
| `/games/:gameId` | `GameDetails` | Game info + external launch URL |
| `/welcome` | `Welcome` | Role selection (Elder vs Caregiver) |
| `/login` | `Login` | Clerk sign-in |
| `/signup` | `Signup` | Clerk sign-up |
| `*` | `NotFound` | 404 |

### Protected — Elder (`role="elder"`)

| Path | Page | Feature-gated |
| --- | --- | --- |
| `/dashboard` | `Dashboard` | |
| `/progress` | `Progress` | |
| `/support` | `Support` | |
| `/settings` | `Settings` | |
| `/routine` | `Routine` | `feature="routine"` |
| `/memory` | `Memory` | `feature="memory"` |
| `/reminders` | `Reminders` | `feature="reminders"` |
| `/assistant` | `Assistant` | `feature="assistant"` |

### Protected — Caregiver (`role="caregiver"`)

Mounted under `/caregiver` with nested routes:

| Path | Page |
| --- | --- |
| `/caregiver` | redirect → `/caregiver/dashboard` |
| `/caregiver/dashboard` | `CareDashboard` |
| `/caregiver/elder` | `ElderStatus` |
| `/caregiver/meals` | `Meals` |
| `/caregiver/medicines` | `Medicines` |
| `/caregiver/routine` | `CareRoutine` |
| `/caregiver/reminders` | `CareReminders` |
| `/caregiver/activities` | `Activities` |
| `/caregiver/messages` | `Messages` |
| `/caregiver/orders` | `Orders` |
| `/caregiver/settings` | `CareSettings` |

The route guard `ProtectedRoute` (`src/components/ProtectedRoute.jsx`) handles:

1. **Signed out** on a feature route → renders an inline `FeaturePreview` teaser;
   otherwise redirects to `/login` preserving the `from` location.
2. **Signed in, no role** → redirects to `/welcome` for a one-time role claim.
3. **Signed in, wrong role** → redirects to that role's home (`getHomeForRole`).

---

## Roles & Authentication

Roles live in `src/auth/roles.js`:

- `elder` → home `/dashboard`
- `caregiver` → home `/caregiver/dashboard`

The canonical role is read from Clerk `publicMetadata.role`, falling back to
`unsafeMetadata.role` (`getRole`). `useRole()` exposes `{ isLoaded, user, role }`,
and `claimRole(user, role)` writes `unsafeMetadata.role` for new users.

---

## The Two Experiences

### Elder Experience

The primary, accessibility-first experience. Key surfaces:

- **Dashboard** — a glance at the day, quick actions, streak and progress.
- **Memory Vault** (`/memory`) — a personal, categorized memory archive (hobbies,
  food, places, people, songs, childhood, etc.) with add/edit/delete and favorites.
- **Cognitive Games** (`/games`) — a catalog of 13 games grouped by category
  (Memory, Attention, Reasoning, Recognition), each with "how to play" and
  dementia-benefit copy, launching external playable games.
- **Routine** (`/routine`) — a daily schedule with completable items.
- **Reminders** (`/reminders`) — medication, hydration, appointments and calls.
- **Progress** (`/progress`) — accuracy, response time, streaks and weekly trends.
- **Support** (`/support`) — trusted support network and SOS options.
- **Settings** (`/settings`) — text size, voice, notifications, sharing, contrast.
- **Clara** — the AI companion (see below).

### Clara (AI Companion)

Clara is both a floating launcher (`ClaraLauncher`) and a full page (`/assistant`).

- Chat UI with streamed replies, suggestion chips, voice input and text-to-speech.
- `src/services/chat.js` implements intent matching over live app data (routine,
  reminders, memories, games, time, "I feel lost") and returns replies plus
  contextual action buttons that deep-link into the app.
- `src/services/useConversation.js` manages messages, streaming, and voice state.

### Caregiver Experience

A dashboard-style, sidebar-driven layout (`CaregiverShell`):

- **Sidebar** (`CareSidebar`) — collapsible desktop nav + mobile drawer, brand
  ("PixelPlay Care"), 10 nav items, and the signed-in caregiver's avatar/name/role.
- **Top bar** (`CareTopBar`) — page title, `ElderSwitcher`, theme pull-cord and
  Clerk `UserButton`.
- **Pages** — dashboard, elder status, meals, medicines, routine, reminders,
  activities, messages, orders and settings.
- **Elder scoping** — `CareContext` links every signed-in caregiver to a demo
  elder (`DEMO_ELDER_ID = "elder-demo"`) through a link graph; `selectedElder`
  is always derived and authorization-checked via `services/care/links.js`.
- Footer includes a "switch experience" link back to `/welcome`.

---

## UI & Design System

The look is a "cozy pixel + skeuomorphic" style: warm cream surfaces, teal/amber
accents, chunky raised buttons with hard drop shadows, and a pixel display font.

### Typography

- **Display / headings:** `Press Start 2P` (token `--font-pixel`, class `font-pixel`).
- **Body:** `Nunito` (token `--font-body`, class `font-body`).

### Color Tokens

Defined in `src/index.css` under `@theme` and `:root`:

- **Primary (teal):** `--color-primary #14b8a6` and a full `primary-light/dark/…` ramp.
- **Warm cream ramp:** `--color-warm-50 … warm-950` (page base `#fffaf3`).
- **Category accents:** memory (blue), attention (amber), reasoning (violet),
  language (emerald), recognition (rose), daily (orange) — each with a `-dark` pair.
- **Semantic tokens:** `--pp-bg`, `--pp-surface`, `--pp-text`, `--pp-border`,
  `--pp-accent`, `--pp-success/warning/danger`, plus skeleton tokens `--sk-*`.

### Theme System

- Class-based dark mode: `.dark` on `<html>`, driven by `ThemeContext`.
- **No flash of wrong theme:** an inline script in `index.html` reads
  `localStorage` (`pixelplayers-theme`) and the OS preference before first paint.
- Dark palette is hue-locked to the background artwork (teal/cyan), not generic grey.
- Toggle via `ThemeToggle` and the decorative `ThemePullCord` (retro lamp cord).

### Background Art

A single element, `.site-background`, owns the `BG.jpg` photo plus a theme overlay.
It begins exactly at the navbar's bottom edge, spans `<main>` + `Footer`, and is
`background-attachment: fixed` on desktop (tiled on mobile). The navbar uses an
opaque `.navbar-surface` layer so nothing bleeds through while scrolling.

### Reusable Components (`src/components/`)

| Component | Role |
| --- | --- |
| `Navbar` / `Footer` | Global chrome (logo, nav, auth, SOS, theme) |
| `PixelCard`, `PixelButton` | Core pixel/skeuo primitives |
| `TopicCard`-family | `GameCard`, `MemoryCard`, `RoutineCard`, `ProgressCard` |
| `ClaraAvatar`, `ClaraChat`, `ClaraLauncher` | AI companion UI |
| `VoiceButton`, `Waveform` | Voice input + audio waveform |
| `SosButton`, `SosModal` | Emergency SOS flow (+ login-required modal) |
| `ProtectedRoute`, `FeaturePreview` | Auth/feature gating |
| `ClickSpark` | Cursor spark effect on click |
| `ScrollProgress` | 3px segmented scroll rail under the navbar |
| `ThemeToggle`, `ThemePullCord` | Theme controls |
| `AuthShell`, `AuthField` | Auth page scaffolding |
| `AnnouncementsBanner`, `PixelBuddy`, `LampIcon`, `RotatingText` | Supporting UI |

### Motion & Effects

- Tailwind-based animations: `pixel-fade-in`, `gentle-bounce`, `pulse-ring`,
  `slide-up`, `progress-fill`, `buddy-float`, `voice-ring`, `thinking-pixel`.
- Skeuomorphic shadow system (`.skeuo-btn`, `.skeuo-card`, `--shadow-skeuo/pixel`).
- Full `prefers-reduced-motion` support plus an in-app "reduce animations" toggle.

---

## State Management

No external store — React Context only:

| Context | File | Responsibility |
| --- | --- | --- |
| `ThemeContext` | `src/context/ThemeContext.jsx` | Light/dark theme + persistence |
| `AppContext` | `src/context/AppContext.jsx` | Elder data: user, memories, routine, reminders, games, progress, support network, activity log, announcements, settings |
| `CareContext` | `src/context/CareContext.jsx` | Caregiver→elder link graph, selected elder, orders |
| `ScrollContext` | `src/context/ScrollContext.jsx` | Lenis instance, reveals, drift, fade, progress rail |

`AppContext` seeds realistic demo data and exposes mutators (`addMemory`,
`toggleRoutine`, `addReminder`, `updateSettings`, `logActivity`, etc.).

---

## Services Layer

`src/services/` separates logic from UI:

- `api.js` — date/time formatting (`en-IN`), greeting, `getTimeOfDay`, `generateId`,
  `shuffleArray`, `delay`.
- `chat.js` — Clara's intent engine + suggestion list + `speakText` (TTS).
- `useConversation.js` — chat/voice state machine hook.
- `care/` — caregiver domain services: `activity`, `dailyUpdate`, `links`,
  `meals`, `medicines`, `messaging`, `orders`, `routine`, `streak`.

---

## Internationalization

`src/i18n/index.js` initializes i18next with **14 locales** and persists the choice
in `localStorage` (`pixelplayers-language`):

`en`, `hi`, `bn`, `or`, `as`, `pa`, `ta`, `te`, `ur`, `mr`, `gu`, `kn`, `ml`, and
`hinglish`. Fallback is `en`. All user-facing strings are looked up via `t(key)`.

---

## Loading, Error & Boot System

A complete skeleton system lives in `src/components/Skeleton/`:

- **Primitives:** `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonButton`,
  `SkeletonCard`, `SkeletonImage`, `SkeletonBadge`, `SkeletonSectionTitle`.
- **Orchestration:** `PageLoader`, `SectionLoader`, `RouteSkeleton`, `BootShell`,
  `ErrorState`, `SkeletonErrorBoundary`, `DefaultPageSkeleton`, `SkeletonRegistry`.
- **Layout shells:** `SkeletonNavbar`, `SkeletonFooter`, `SkeletonHero`, `SkeletonPageHeader`.
- **Per-page skeletons:** one for each major route (Home, About, Features, Games,
  Memory, Routine, Assistant, Dashboard, Progress, Support, Settings, Auth, …).

`SkeletonRegistry.resolveSkeletonForPath(path)` maps a route to its skeleton, so
`RouteSkeleton` renders a page-accurate placeholder during lazy loading. A pure-CSS
`BootShell` (also inlined in `index.html`) renders before React hydrates.

---

## Scroll Experience

Driven entirely by `ScrollContext` — one Lenis instance, one rAF-synced scroll bus,
one IntersectionObserver. Pages only declare intent with data attributes:

| Attribute | Effect |
| --- | --- |
| `data-pp-reveal` | One-shot entrance (`rise` default, `drop`, `left`, `right`, `zoom`, `pixel`) |
| `data-pp-reveal-group` | Staggers its direct `[data-pp-reveal]` children |
| `data-pp-drift="0.6"` | Clamped decorative parallax drift |
| `data-pp-fade` | Continuous, reversible scroll-linked opacity |

Design guarantees: content is visible by default (hidden state is armed only after
JS is live), no React state updates per scroll frame, and reduced motion never
instantiates Lenis or arms the effects.

---

## Project Structure

```
PixelPlayers/
├─ public/                       # Static assets (favicon, etc.)
├─ src/
│  ├─ assets/                    # Logo, hero, BG, Clara images
│  ├─ auth/
│  │  ├─ roles.js                # Roles, role homes, getRole/getHomeForRole
│  │  └─ useRole.js              # useRole hook + claimRole
│  ├─ caregiver/                 # Caregiver layout chrome
│  │  ├─ CaregiverShell.jsx      # Sidebar + topbar + content + footer
│  │  ├─ CareSidebar.jsx         # Collapsible nav + user block
│  │  ├─ CareTopBar.jsx          # Page title, elder switcher, theme, avatar
│  │  ├─ caregiver.css           # Caregiver (.cg-*) styles
│  │  └─ components/             # CareCard, MetricTile, ElderSwitcher, …
│  ├─ components/                # Shared UI (see UI & Design System)
│  │  └─ Skeleton/               # Full loading/error/boot system
│  ├─ config/
│  │  └─ featureGates.js         # Feature preview metadata (memory/reminders/assistant/routine)
│  ├─ context/
│  │  ├─ AppContext.jsx          # Elder data store
│  │  ├─ CareContext.jsx         # Caregiver→elder graph
│  │  ├─ ThemeContext.jsx        # Theme
│  │  └─ ScrollContext.jsx       # Lenis + reveal/fade engine
│  ├─ games/
│  │  └─ games.js               # 13-game catalog + copy
│  ├─ i18n/
│  │  ├─ index.js                # i18next setup
│  │  └─ locales/                # 14 locale JSON files
│  ├─ pages/                     # Public + elder routes
│  │  └─ caregiver/              # Caregiver route pages
│  ├─ services/
│  │  ├─ api.js                  # Formatting/util helpers
│  │  ├─ chat.js                 # Clara intent engine
│  │  ├─ useConversation.js      # Chat/voice hook
│  │  └─ care/                   # Caregiver domain services
│  ├─ utils/
│  │  └─ displayName.js         # Clerk display-name resolver
│  ├─ App.jsx                    # Routes + app shell
│  ├─ main.jsx                   # Providers + mount
│  └─ index.css                  # Tailwind theme, tokens, components, scroll CSS
├─ .env.example                  # Env template
├─ eslint.config.js              # ESLint flat config
├─ index.html                    # Boot shell + theme boot script
├─ package.json
├─ vercel.json                   # SPA rewrite to index.html
└─ vite.config.js                # React + Tailwind plugins
```

---

## Deployment

Configured for Vercel. `vercel.json` rewrites all paths to `/index.html` so client
routing (React Router) works on refresh/deep links.

```bash
npm run build      # outputs to dist/
```

Set `VITE_CLERK_PUBLISHABLE_KEY` in the Vercel project's environment variables.
