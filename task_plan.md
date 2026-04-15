# KahootPlus — Task Plan

**Project:** Full-featured Kahoot Clone (KahootPlus)
**Domains:**
- Host/Creator app: `quiz.rushelwedsivani.com`
- Player join app:  `quiz-player.rushelwedsivani.com`
- API + WebSocket:  `api.quiz.rushelwedsivani.com`
**GitHub:** https://github.com/SlyRix/QuitApp.git
**Stack:** React + Cloudflare Workers + D1 + R2 + KV + Durable Objects
**Cloudflare Account:** a3000146f2714841e3bdd91d655aef9c (Rushelsilvester@outlook.com)
**Languages:** English + German (i18n from day one)
**Last Updated:** 2026-04-15
**Status:** Planning Phase

---

## Goal

Build a real-time multiplayer quiz platform that matches Kahoot feature-for-feature and surpasses it with advanced question types, AI-assisted quiz creation, offline support, analytics, and a self-hostable Cloudflare-native architecture.

---

## Architecture Decision: Cloudflare Stack

| Need | Cloudflare Tool | Why |
|---|---|---|
| Relational data (users, quizzes, questions) | **D1** | SQLite-on-edge, free tier generous |
| Real-time game state & pub/sub | **Durable Objects** | Stateful WebSocket rooms per game session |
| Media storage (images, audio, video) | **R2** | S3-compatible, zero egress fees |
| Sessions, auth tokens, leaderboard cache | **KV** | Low-latency edge reads |
| API & game logic | **Workers** | Serverless, runs at edge globally |
| Frontend | **Pages** | Git-integrated deploy, CDN |
| QR Code generation | **Workers** (qrcode lib) | Generate server-side, no external service |
| AI quiz generation | **Workers AI** | Llama / mistral on Cloudflare |

**Verdict:** ✅ 100% feasible on Cloudflare. No external services required.

---

## Phases

### Phase 1 — Foundation & Auth (Week 1)
- [x] 1.1 Project scaffold: React + Vite + TypeScript (Pages)
- [x] 1.2 Cloudflare Workers API project (Hono framework)
- [x] 1.3 D1 database schema: quiz creators (accounts), quizzes, questions, sessions, players (nickname-only)
- [x] 1.4 Auth system for quiz creators only: email/password + OAuth (Google)
- [x] 1.5 KV-based JWT session management (creators only)
- [x] 1.6 Basic creator dashboard UI
- [ ] 1.7 Host app domain: quiz.rushelwedsivani.com → Cloudflare Pages (creator/host UI)
- [ ] 1.8 Player app domain: quiz-player.rushelwedsivani.com → separate Cloudflare Pages project (mobile-optimized)
- [ ] 1.9 Workers API on api.quiz.rushelwedsivani.com (custom domain via Workers route)
- [x] 1.10 QR code generation: encodes https://quiz-player.rushelwedsivani.com/join/{PIN}
- [ ] 1.11 GitHub repo: https://github.com/SlyRix/QuitApp.git → connect to Cloudflare Pages CI/CD (needs GitHub auth)
- [x] 1.12 i18n setup: react-i18next, EN + DE locale files from day one
- [x] 1.13 Quiz visibility: private (default) and public toggle per quiz
- [x] 1.14 Create D1 database: kahootplus-db (257c1f00-5331-45eb-aa0e-8529819b708f)
- [x] 1.15 Create KV namespace: KAHOOTPLUS_SESSIONS (f108aa4c259d4706917d2d7c22fa6180)
- [x] 1.16 Create R2 bucket: kahootplus-media
- [x] 1.17 Apply D1 migration via MCP (all 8 tables + 10 indexes confirmed)
- [x] 1.18 Deploy Worker: https://kahootplus-api.rushelsilvester.workers.dev
- [x] 1.19 Add JWT_SECRET wrangler secret (random 64-char hex)

### Phase 2 — Quiz Creation Engine (Week 2)
- [ ] 2.1 Quiz builder UI (drag-and-drop question ordering)
- [ ] 2.2 Question type: Multiple Choice (4 options)
- [ ] 2.3 Question type: True / False
- [ ] 2.4 Question type: Type Answer (free text)
- [ ] 2.5 Question type: Poll (no correct answer)
- [ ] 2.6 Question type: Puzzle (order items)
- [ ] 2.7 Question type: Slider (numeric range)
- [ ] 2.8 Question type: Word Cloud
- [ ] 2.9 Question type: Image Map (click on image)
- [ ] 2.10 Media upload per question (image/audio/video → R2)
- [ ] 2.11 Quiz settings: time limits, points, theme, music
- [ ] 2.12 Question bank / search and reuse
- [ ] 2.13 Kahoot quiz import: upload Kahoot JSON export → auto-convert to KahootPlus format
- [ ] 2.14 Import validation: detect unsupported question types, show mapping preview before confirming
- [ ] 2.15 Preserve imported media: download Kahoot-hosted images → re-upload to R2

### Phase 3 — Live Game Engine (Week 3)
- [ ] 3.1 Durable Object: GameRoom (one per live session)
- [ ] 3.2 Host creates game → gets PIN + QR code
- [ ] 3.3 Players join via PIN or QR code (no login needed)
- [ ] 3.4 Lobby screen with live player list
- [ ] 3.5 Game flow: question broadcast → countdown → answer collection → results
- [ ] 3.6 Real-time leaderboard after each question
- [ ] 3.7 Final podium screen
- [ ] 3.8 Spectator mode (join late, view only)
- [ ] 3.9 Team mode (players grouped into teams)
- [ ] 3.10 Player reconnection: auto-retry WebSocket with exponential backoff
- [ ] 3.11 Player session token: issued on join, stored in localStorage — used to reclaim identity on reconnect
- [ ] 3.12 GameRoom DO: hold player slot for 60s after disconnect before marking as dropped
- [ ] 3.13 Rejoin UI: "Reconnecting..." overlay with spinner + attempt counter shown to player
- [ ] 3.14 On successful rejoin: DO sends full current game state snapshot to catch player up
- [ ] 3.15 If reconnect during active question: player can still answer if time remains
- [ ] 3.16 If reconnect after question ended: player sees results screen, scores preserved
- [ ] 3.17 Host view: disconnected players shown with grey indicator, not removed from leaderboard
- [ ] 3.18 Answer submission fallback: if WS drops mid-answer, retry over HTTP POST before giving up

### Phase 4 — Player Experience (Week 4)
- [ ] 4.1 Mobile-first player view (phone as controller)
- [ ] 4.2 Nickname selection on join
- [ ] 4.3 Avatar builder on join: choose base character, skin tone, hair, accessories, outfit color
- [ ] 4.4 Avatar presets (10+ ready-made characters) + custom builder mode
- [ ] 4.5 Upload own photo as avatar (cropped to circle, stored in R2)
- [ ] 4.6 Avatar persisted per nickname (KV cache) so returning players keep theirs
- [ ] 4.7 Animated answer feedback (correct/wrong)
- [ ] 4.8 Streak bonuses and combo multipliers
- [ ] 4.9 Power-ups (50/50, double points, shield)
- [ ] 4.10 Sound effects and music (royalty-free, stored in R2)
- [ ] 4.11 Live chat: players can type messages visible to all during lobby + between questions
- [ ] 4.12 Chat moderation: host can mute individual players or enable slow mode
- [ ] 4.13 Chat message reactions (players can react to chat messages with emoji)
- [ ] 4.14 Profanity filter on chat messages (configurable by host)

### Phase 5 — Host Controls & Game Modes (Week 5)
- [ ] 5.1 Host dashboard: pause, skip, kick players
- [ ] 5.2 Game mode: Classic (competitive)
- [ ] 5.3 Game mode: Team Battle
- [ ] 5.4 Game mode: Practice / Solo
- [ ] 5.5 Game mode: Blind (no live leaderboard)
- [ ] 5.6 Game mode: Survivor (wrong = eliminated)
- [ ] 5.7 Timer customization per question
- [ ] 5.8 Point customization (standard / no points / double)

### Phase 6 — AI Features (Week 6)
- [ ] 6.1 AI quiz generator (topic → full quiz via Workers AI)
- [ ] 6.2 AI question suggestion while building
- [ ] 6.3 AI image generation for questions (via Workers AI)
- [ ] 6.4 Difficulty auto-calibration based on player answers
- [ ] 6.5 AI-powered question translation (multilingual quizzes)

### Phase 7 — Analytics & Reports (Week 7)
- [ ] 7.1 Post-game report: per-player stats
- [ ] 7.2 Per-question analytics: response distribution
- [ ] 7.3 Quiz performance over time dashboard
- [ ] 7.4 Export results (CSV / PDF)
- [ ] 7.5 Identify weak spots: which questions most got wrong
- [ ] 7.6 Class/group management for educators

### Phase 8 — Social & Discovery (Week 8)
- [ ] 8.1 Public quiz library (searchable)
- [ ] 8.2 Fork/clone public quizzes
- [ ] 8.3 Collections / folders for quiz organization
- [ ] 8.4 Quiz ratings and comments
- [ ] 8.5 Creator profiles
- [ ] 8.6 Trending quizzes feed

### Phase 9 — Polish & Launch (Week 9+)
- [ ] 9.1 Accessibility (WCAG 2.1 AA)
- [ ] 9.2 Offline/PWA support (practice solo offline)
- [ ] 9.3 Localization (i18n, 10 languages)
- [ ] 9.4 Custom branding for quiz (logo, colors)
- [ ] 9.5 Embed quiz in website (iframe widget)
- [ ] 9.6 Performance audit + Lighthouse score >90

### UI Design Process (all phases)
- All major screens designed using the `/frontend-design` skill before implementation
- Screens to design: landing page, creator dashboard, quiz builder, lobby (host), lobby (player), game screen (host), game screen (player), avatar builder, results/podium, post-game report, Kahoot import flow
- Design goal: bold, memorable aesthetic — NOT a Kahoot clone visually, clearly its own identity

### UI Philosophy — Fun + Professional + Interactive
- **The balance:** feels like a premium game, not a toy. Not childish like early Kahoot, not sterile like a corporate tool.
- **Motion-first:** every state change is animated. Answers fly in. Correct answers burst. Wrong answers shake. Leaderboard slots slide and reorder. Nothing just "appears".
- **Tactile feedback:** every button press has a micro-animation + haptic (mobile vibration API). Tapping an answer feels satisfying.
- **Personality without noise:** clean layout, generous whitespace, bold typography — but punctuated with moments of delight (confetti on correct answer, podium animation, avatar bounce in lobby).
- **Progressive reveal:** results don't dump all at once. Leaderboard reveals rank by rank, building suspense.
- **Sound design:** subtle UI sounds (button clicks, correct chime, wrong buzz, countdown beep) that add energy without being annoying. Player-controllable volume.
- **Dark-first design:** deep dark background (not pure black) with vivid accent colors — more immersive for game play, easier on eyes in a dark room/classroom.
- **Typography:** bold display font for questions/scores (commanding, readable from across a room on a projector), clean sans-serif for UI chrome.
- **Color language:** consistent — green = correct, red = wrong, gold = leader, blue = neutral info. Players learn it instantly.
- **Responsive excellence:** player view built mobile-first, pixel-perfect on 320px–430px screens. Host view optimized for laptop/projector 1080p+.

---

## Key Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Frontend framework | React + Vite + TypeScript | Ecosystem, fast HMR, CF Pages native |
| Styling | Tailwind CSS + shadcn/ui | Speed + consistency |
| API framework | Hono.js on Workers | Lightweight, edge-native, TS-first |
| Real-time | Durable Objects + WebSocket | No external pub/sub needed |
| Database | D1 (SQLite) | Relational, free, edge-native |
| ORM | Drizzle ORM | D1-native, type-safe |
| Auth | Custom JWT + KV (creators only) | No vendor lock-in |
| Player identity | Nickname only, no account | Zero friction to join |
| State management | Zustand | Lightweight, no boilerplate |
| Animations | Framer Motion | Kahoot-quality transitions |
| UI Design process | /frontend-design skill | Each major screen designed with the skill before coding |
| Host domain | quiz.rushelwedsivani.com | Creator/host app on Cloudflare Pages |
| Player domain | quiz-player.rushelwedsivani.com | Mobile-optimized player join app |
| API domain | api.quiz.rushelwedsivani.com | Workers API + WebSocket |
