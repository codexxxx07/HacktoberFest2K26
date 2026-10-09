# BUILD PROMPT — "Pixel Players"

## 0. Your Mission

Build a production-quality, deployable React + Vite single-page web app called **Pixel Players** — an AI-powered cognitive gaming and memory-assistance platform for elderly users, with a separate caregiver monitoring experience. Tagline: **"Helping Memories Stay Meaningful."**

It is a frontend-only SPA (no backend). Use realistic in-memory demo data. It must look and feel polished enough to demo at a hackathon: warm, accessible, playful, "cozy pixel + skeuomorphic" design. **All UI text is in English (hardcoded) — no translation system.**

---

## 1. Tech Stack (use exactly this)

- **React 19** + **Vite 8** (`@vitejs/plugin-react`, JSX — no TypeScript)
- **React Router DOM v7** (`BrowserRouter`, `<Routes>/<Route>`, `NavLink`, `Outlet`)
- **Tailwind CSS 4** via `@tailwindcss/vite` (CSS-first config: `@import "tailwindcss"`, `@theme`, `@custom-variant dark`)
- **lenis** for smooth scrolling
- **motion** for component animations
- Route-level code splitting with `React.lazy` + `Suspense`
- ESLint flat config
- Deploy target: **Vercel** (SPA rewrite to `index.html`)

Do **not** add a server, database, real auth provider, Redux, Zustand, TypeScript, or any i18n library. Auth is mocked; state lives in React Context.

---

## 2. Brand & Design Language

### Personality
Warm, nostalgic, reassuring, accessible for older adults. Retro pixel-art meets soft skeuomorphic "candy button" UI. Never clinical or cold.

### Typography
- Display/headings: **"Press Start 2P"** (pixel font) → token `--font-pixel`, class `font-pixel`
- Body: **"Nunito"** → token `--font-body`, class `font-body`
- Load both from Google Fonts.

### Color palette (CSS custom properties)
- **Primary teal ramp:** `#14b8a6` (primary), plus `light #2dd4bf`, `lighter #5eead4`, `dark #0d9488`, `darker #115e59`, `deep #134e4a`
- **Warm cream ramp** `--color-warm-50…950`: page base `#fffaf3`, surfaces `#fff8f0`, borders `#f6dfc1`, ink `#5f3d28`
- **Category accent pairs** (color + `-dark`):
  - memory = blue `#60a5fa`, attention = amber `#fbbf24`, reasoning = violet `#a78bfa`, language = emerald `#34d399`, recognition = rose `#fb7185`, daily = orange `#fb923c`
- Semantic tokens: `--pp-bg`, `--pp-surface`, `--pp-surface-2`, `--pp-surface-elevated`, `--pp-text`, `--pp-text-secondary`, `--pp-border`, `--pp-navbar`, `--pp-navbar-solid`, `--pp-footer-bg`, `--pp-accent`, `--pp-success`, `--pp-warning`, `--pp-danger`

### Dark mode
- Class-based: toggle `.dark` on `<html>`.
- **No flash of wrong theme:** inline `<script>` in `index.html` `<head>` reads `localStorage["pixelplayers-theme"]`, falls back to `prefers-color-scheme`, sets `.dark` + `data-theme` + `<meta name="theme-color">` **before** first paint.
- Dark palette must be hue-locked to the background image (teal/cyan water tones), not generic grey. Remap Tailwind's warm/teal/gray/amber/red/emerald/blue/purple/rose/orange ramps under `.dark`.
- Remap `--color-white` in dark mode to a teal-tinted card surface; re-pin `.text-white`/`.border-white` to true white.
- Add `ThemeToggle` plus a decorative lamp **`ThemePullCord`**.

### Signature UI patterns
- **Skeuomorphic buttons** `.skeuo-btn` / `-primary` / `-sos` / `-ghost` / `-block` / `-pixel`: gradient fill, 2px border, inset top highlight, hard 4px bottom shadow that "presses down" on `:active`.
- **Skeuomorphic cards** `.skeuo-card` / `.skeuo-card-inset`: soft warm translucent gradient, 2px border, hard drop shadow, hover lift.
- **Pixel borders** `.pixel-border` / `-teal`, `.pixel-chip`, `.pixel-shadow`.
- Category chips `.chip-memory`, `.chip-attention`, etc.
- Animated progress bars `.progress-track` / `.progress-fill`.
- Global `:focus-visible` outline (3px teal); custom teal scrollbar.
- A **`ClickSpark`** wrapper emitting small teal pixel sparks at the cursor on click.

### Background art
One element `.site-background` owns a full-bleed photo (`src/assets/BG.jpg`) plus a theme gradient overlay (`--pp-bg-overlay`). It starts exactly at the navbar's bottom edge and spans `<main>` + `<Footer>` so the photo shows through the footer's transparent scrim. `background-attachment: fixed` on desktop; tile the image on mobile. The navbar gets an opaque `.navbar-surface` layer so nothing bleeds through while scrolling.

---

## 3. Application Shell

`main.jsx` provider order (outermost → innermost):

```
StrictMode
└─ BrowserRouter
   └─ ThemeProvider
      └─ AuthProvider            # mock auth (localStorage)
         └─ AppProvider
            └─ SmoothScrollProvider
               └─ Suspense fallback={<BootShell/>}
                  └─ App
```

`App.jsx`:
- If `location.pathname.startsWith("/caregiver")` → render `CareProvider` → `CaregiverShell` → nested routes.
- Otherwise → `SkeletonErrorBoundary` → `ClickSpark` → `Navbar` + `.site-background`(`<main>` + `Footer`) + `ClaraLauncher`.
- All pages loaded via `React.lazy`, wrapped in `Suspense fallback={<RouteSkeleton/>}`.

---

## 4. Routing Map

**Public:** `/` Home, `/about`, `/features`, `/games`, `/games/:gameId`, `/welcome`, `/login`, `/signup`, `*` NotFound.

**Elder (protected, `role="elder"`):** `/dashboard`, `/progress`, `/support`, `/settings`, plus feature-gated `/routine`, `/memory`, `/reminders`, `/assistant`.

**Caregiver (protected, `role="caregiver"`, nested under `/caregiver`):** index redirect → `dashboard`, then `elder`, `meals`, `medicines`, `routine`, `reminders`, `activities`, `messages`, `orders`, `settings`.

**Route guard `ProtectedRoute({ feature, role })`:**
1. Signed out: if `feature` is set → render an inline `FeaturePreview` teaser page; else redirect to `/login` with `state.from`.
2. Signed in but no role → redirect to `/welcome` with `state.from`.
3. Signed in with wrong role → redirect to that role's home.
4. Otherwise → `<Outlet/>`.

---

## 5. Auth & Roles (Mock only)

Build a lightweight **`AuthContext`** (`src/context/AuthContext.jsx`) — no third-party provider:

- State: `{ isLoaded, isSignedIn, user, role, signIn, signUp, signOut, claimRole }`.
- Persist the mock session to `localStorage["pixelplayers-auth"]` (stores a fake user object + role). Always resolve `isLoaded` to `true` after a short tick so guards/skeletons behave realistically.
- `user` shape: `{ firstName, fullName, username, email }`. Expose `getUserDisplayName(user)`.
- Login/Signup pages: friendly large forms (name + email, any password) using an `AuthShell` + `AuthField`; on submit, create the mock session and route by role (no role → `/welcome`).
- Roles: `elder` (home `/dashboard`), `caregiver` (home `/caregiver/dashboard`). Store on `user.role`.
- `/welcome`: two big cards (Elder 🌸 / Caregiver 🧡). Clicking one calls `claimRole(role)` and redirects to that role's home; if not signed in, send to `/login` carrying the intended role.
- The navbar shows a `UserButton`-like avatar/name with a sign-out action instead of a Clerk widget.
- **No `.env`, no API keys, no Clerk dependency.**

---

## 6. Feature List

### Elder Experience
1. **Home / Landing** — hero with rotating text, 3 headline feature cards (Cognitive Games, Memory Vault, AI Assistant), a "how it works" 4-step flow, and a personalization steps strip. (No language showcase.)
2. **Games catalog** — 13 games grouped by category with title, emoji, short description, "dementia benefit" bullets, "how to play" steps, "why this activity" copy, and an external `gameUrl`. Detail page reads `:gameId`.
3. **Memory Vault** — categorized memory archive (hobbies, food, places, occupation, childhood, people, songs, memories, preferences). Add / edit / delete / favorite. Seed ~20 realistic Indian-context memories.
4. **Routine** — daily schedule (breakfast, game, lunch, rest, walk, dinner, evening) with times, icons, completable state.
5. **Reminders** — medication, hydration, appointment, activity types; recurring + important flags; add/delete/toggle.
6. **Progress** — games completed, accuracy %, average response time, day streak, weekly breakdown.
7. **Support** — trusted support network plus an **SOS** flow: `SosButton` (navbar/floating/menu variants) + `SosModal`; if signed out, show a "sign in to use SOS" modal.
8. **Settings** — text size, voice on/off, voice input, read-aloud, notifications, high contrast, reduce animations, large icons, sharing permissions, emergency SOS. (No language setting.)
9. **Dashboard** — time-of-day greeting, today's snapshot, quick actions, activity log, announcements banner.
10. **Assistant (Clara)** — see below.

### Clara — AI Companion
- Floating launcher bubble (bottom-right) opening a chat panel, plus a dedicated `/assistant` full page (hide the launcher there).
- Streamed AI replies (typed-in effect), suggestion chips, contextual action buttons that deep-link into the app, **voice input** + animated `Waveform`, and **text-to-speech** (`speechSynthesis`, `en-IN`).
- Rule/keyword intent engine over live app data: greetings, "who are you", "how are you", "what am I doing today", "what comes next", "do I have reminders", "tell me about a memory", "start a game", "I feel lost/scared" (with the date + reach-family action), "what time is it", thanks, bye, help, and a friendly default.
- Suggestion chips: "What's happening today?", "What comes next?", "Tell me about a memory", "Start a gentle game", "Do I have reminders?", "I feel a little lost".

### Caregiver Experience
- Shell: collapsible **sidebar** (brand "PixelPlay Care", 10 nav links, signed-in user avatar/name/role) + **top bar** (page title, `ElderSwitcher`, theme pull-cord, avatar) + content + footer with "Switch Experience" back to `/welcome`.
- Pages: dashboard, elder status, meals, medicines, routine, reminders, activities, messages, orders, settings.
- **Elder scoping:** `CareContext` links every signed-in caregiver to one demo elder (`elder-demo`, "Maya", 72, "Mother") via a link graph in `services/care/links.js`; `selectedElder` is always re-derived and authorization-checked.
- Use a `.cg-*` class namespace in `caregiver.css`.
- Responsive: collapsible desktop sidebar, mobile drawer with scrim.

---

## 7. State Management (React Context only)

- **ThemeContext** — `{ theme, isDark, isLight, toggleTheme, setTheme }`, persisted to `localStorage["pixelplayers-theme"]`, OS-aware.
- **AuthContext** — mock auth described in §5.
- **AppContext** — elder store: `user`, `currentTime` (ticks every 30s), `memories`, `routine`, `reminders`, `games`, `progressData`, `supportNetwork`, `activityLog`, `announcements`, `settings`, plus mutators (`addMemory`, `deleteMemory`, `updateMemory`, `addReminder`, `toggleReminder`, `deleteReminder`, `addSupportPerson`, `updateSettings`, `toggleRoutine`, `logActivity`, `addAnnouncement`, `dismissAnnouncement`). Seed all with realistic demo data.
- **CareContext** — `caregiverId`, `graph`, `authorizedElders`, `selectedElder`, `selectElder`, `checkLink`, `orders` (+ add/update/cancel).
- **ScrollContext** — see §9.

Hooks: `useApp()`, `useCare()`, `useTheme()`, `useAuth()`, `useSmoothScroll()`, `useConversation()`.

---

## 8. Services Layer (`src/services/`)

- `api.js` — `formatDate`/`formatTime` (`en-IN`), `getGreeting`, `getTimeOfDay`, `generateId`, `shuffleArray`, `delay`.
- `chat.js` — Clara suggestion list, `speakText` (TTS), `buildGreeting`, `getResponse(text, data)` intent matcher.
- `useConversation.js` — messages, input, `thinking`, `streamingId`, `voiceState`, `voiceTranscript`, `submit`, `toggleVoice`, `stopVoice`, `resetChat`, `handleAction`, `handleChip`.
- `care/` — `activity.js`, `dailyUpdate.js`, `links.js`, `meals.js`, `medicines.js`, `messaging.js`, `orders.js`, `routine.js`, `streak.js`.

Keep UI components dumb; put logic here.

---

## 9. Scroll Experience (Lenis)

One Lenis instance, one rAF-synced scroll bus, one IntersectionObserver for the whole app. Pages declare intent via data attributes:

- `data-pp-reveal` — one-shot entrance: default rise, `drop`, `left`, `right`, `zoom`, `pixel` (stepped sprite snap).
- `data-pp-reveal-group` — CSS stagger of direct `[data-pp-reveal]` children.
- `data-pp-drift="0.6"` — clamped decorative parallax (max ±46px).
- `data-pp-fade` — continuous, reversible scroll-linked opacity (smoothstep of block position vs viewport).

Guarantees: content visible by default (hidden state only after `html.pp-reveal-armed` / `pp-fade-armed` are added once JS is live — blocked JS never hides a page); no React state updates per scroll frame (direct DOM writes only); `prefers-reduced-motion` or the in-app "reduce animations" toggle never instantiates Lenis and never arms reveals/fade. Drive a 3px segmented `.pp-scroll-progress` rail under the navbar; scroll-to-top on route change.

---

## 10. Loading, Error & Boot System

Full skeleton kit in `src/components/Skeleton/`:
- Primitives: `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonButton`, `SkeletonCard`, `SkeletonImage`, `SkeletonBadge`, `SkeletonSectionTitle`.
- Orchestration: `PageLoader`, `SectionLoader`, `RouteSkeleton`, `BootShell`, `ErrorState`, `SkeletonErrorBoundary`, `DefaultPageSkeleton`, `SkeletonRegistry` (`resolveSkeletonForPath`).
- Layout shells: `SkeletonNavbar`, `SkeletonFooter`, `SkeletonHero`, `SkeletonPageHeader`.
- Per-page skeletons for every major route.

Use `--sk-*` tokens (warm in light, teal-tinted in dark) with a slow sheen disabled under reduced motion. `index.html` ships a pure-CSS inline `BootShell` that renders before React hydrates and matches the real navbar/footer so there's no pop.

---

## 11. Required File/Folder Structure

```
src/
├─ auth/                roles.js
├─ caregiver/           CaregiverShell.jsx, CareSidebar.jsx, CareTopBar.jsx, caregiver.css, components/
├─ components/          Navbar, Footer, PixelCard, PixelButton, GameCard, MemoryCard, RoutineCard,
│  │                    ProgressCard, VoiceButton, Waveform, ClaraAvatar, ClaraChat, ClaraLauncher,
│  │                    SosButton, ProtectedRoute, FeaturePreview, ClickSpark, ScrollProgress,
│  │                    ThemeToggle, ThemePullCord, AuthShell, AuthField, AnnouncementsBanner,
│  │                    PixelBuddy, LampIcon, RotatingText, index.js barrels
│  └─ Skeleton/         (full kit above)
├─ config/              featureGates.js
├─ context/             AppContext, AuthContext, CareContext, ThemeContext, ScrollContext
├─ games/               games.js (13-game catalog)
├─ pages/               Home, About, Features, Games, GameDetails, Memory, Routine, Reminders,
│  │                    Assistant, Dashboard, Progress, Support, Settings, Login, Signup, Welcome,
│  │                    NotFound, ComingSoon
│  └─ caregiver/        CareDashboard, ElderStatus, Meals, Medicines, CareRoutine, CareReminders,
│                       Activities, Messages, Orders, CareSettings
├─ services/            api.js, chat.js, useConversation.js, care/*
├─ utils/               displayName.js
├─ assets/              Logo.png, hero.png, BG.jpg, Clara.png
├─ App.jsx
├─ main.jsx
└─ index.css            Tailwind theme + tokens + component classes + scroll CSS
```

Also create: `index.html` (theme boot script + inline boot shell + SEO meta + favicon), `vite.config.js`, `eslint.config.js`, `vercel.json`, `README.md`. **No `.env` file needed.**

---

## 12. Demo Data to Seed

- **Persona:** elder "Maya", 72, teacher for 32 years. Greeting computed by time of day.
- **Memories (≥20):** knitting shawls, rose garden, evening bhajans, Hyderabadi biryani, dal chawal, cutting chai, Ladakh trip, Basavanagudi market, school teacher, household accounts, the village well, mango tree, husband Ramesh, son Arjun, film songs, cradle song, wedding day, Diwali night, strong milky chai, morning walks.
- **Routine:** 7 items 08:30→20:30.
- **Reminders:** 5 (morning/night meds, water, doctor appointment, call with Arjun).
- **Progress:** 128 games, 86% accuracy, 12.4s avg, 9-day streak, 7-day weekly array.
- **Support network:** Arjun (son, primary), Meera (friend), Lakshmi (caregiver).
- **Games (13):** Tetris, Memory Sequence, Stone Paper Scissor, Colour the Same, Spot the Difference, 2048, Chess, Rapid Fire Calculation, Memory Card Game, Running GOAT, Simon Says, Who Is That?, Where Is That? — each with the full fields above and an external `gameUrl`.

---

## 13. Accessibility & Quality Bar

- Large default font sizes, high contrast, big tap targets (≥44px).
- Keyboard navigable, visible focus rings, `aria-label`s on icon buttons, `aria-live` on chat, focus trapping in modals, ESC to close.
- Respect `prefers-reduced-motion` everywhere.
- Fully responsive: mobile hamburger drawer, tablet, desktop.
- `npm run build` and `npm run lint` must pass with zero errors.

---

## 14. Definition of Done

1. App boots with no theme flash and no layout shift; boot skeleton is seamless.
2. Public pages render with navbar/footer/background/Clara; lazy routes show page-accurate skeletons.
3. Mock sign-in/sign-up work; new users pick a role on `/welcome`; guards redirect correctly by role.
4. Elder can play/launch games, manage memories/routine/reminders, view progress, edit settings, trigger SOS, and chat with Clara (text + voice + TTS).
5. Caregiver sees the sidebar dashboard for the linked elder and can navigate all 10 pages.
6. Theme toggle switches light/dark with correct, artwork-matched palettes and persists.
7. Smooth scroll reveals/fade/drift work and are fully disabled under reduced motion.
8. `npm run lint` passes, `npm run build` succeeds, deploys to Vercel with SPA rewrites.

---

**Extra instruction to the agent:** Keep all demo data in Context/game files (never hardcode inside JSX), use the design tokens instead of raw hex in components, and DO NOT add comments explaining what code does — only where a decision is non-obvious.
