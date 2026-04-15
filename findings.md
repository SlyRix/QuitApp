# KahootPlus — Findings & Research

**Project:** KahootPlus
**Last Updated:** 2026-04-15

---

## Kahoot Feature Audit (What We Must Match)

### Core Kahoot Features
| Feature | Priority | Notes |
|---|---|---|
| Multiple choice questions (4 options) | P0 | Core mechanic |
| True/False questions | P0 | |
| Timer per question (5–240s) | P0 | |
| PIN-based game joining | P0 | 6-digit PIN |
| QR code joining | P0 | |
| Live leaderboard | P0 | After each question |
| Final podium (top 3) | P0 | |
| Host controls (start/skip/pause) | P0 | |
| Mobile player view | P0 | Phone as controller |
| Quiz creation UI | P0 | |
| Image on questions | P1 | |
| Video on questions | P1 | |
| Audio on questions | P1 | |
| Nickname/avatar selection | P1 | |
| Point scoring (speed bonus) | P0 | |
| Poll questions | P1 | |
| Word cloud | P1 | |
| Slider questions | P1 | |
| Puzzle/ordering | P2 | |
| Type answer (open-ended) | P1 | |
| Team mode | P1 | |
| Blind mode | P2 | |
| Practice/solo mode | P1 | |
| Quiz library / discovery | P2 | |
| Post-game reports | P1 | |
| Question bank | P2 | |

### Kahoot Pricing Tiers (for reference)
- **Basic (free):** 10 players, basic question types
- **Plus:** Unlimited players, all question types
- **Pro:** Analytics, collaboration
- **Business:** SSO, custom branding

**Our advantage:** Everything free or freemium, self-hosted option.

---

## Features That Surpass Kahoot (12 Ways We Beat Them)

### 1. Power-Ups System
- **50/50:** Eliminate 2 wrong answers
- **Double Points:** Next question worth 2x
- **Time Freeze:** Add 10 seconds to timer
- **Shield:** Block a point deduction on wrong answer
- Players earn power-ups through streaks, not purchase

### 2. AI-Assisted Quiz Creation (Cloudflare Workers AI)
- Input: topic, subject, difficulty, number of questions
- Output: complete quiz with questions, answers, explanations
- Uses: `@cf/mistral/mistral-7b-instruct-v0.1` or Llama models
- Also: suggest improvements to existing questions

### 3. Advanced Game Modes
- **Survivor Mode:** Wrong answer = eliminated (last player standing)
- **Blind Mode:** No leaderboard shown during game (reveal at end)
- **Speed Run:** No timer, first to answer correctly wins points
- **Collaborative:** Team works together to agree on answer

### 4. Richer Analytics
- Response time heatmap per question
- Answer distribution visualization
- Player engagement score
- Export to CSV/PDF
- Teacher dashboard with class tracking

### 5. Offline/PWA Support
- Practice solo quizzes without internet
- Service worker caches quiz content from R2
- Sync scores when back online

### 6. Custom Branding
- Upload logo, set colors per quiz
- Custom end screen
- Useful for corporate training

### 7. Embed Widget
- Embed quiz in any website via `<iframe>` or JS snippet
- Results sync back to host's dashboard

### 8. Streak Combos
- 3-in-a-row = 1.5x multiplier
- 5-in-a-row = 2x multiplier
- Miss = reset streak

### 9. Spectator Mode
- Join after game starts, view-only
- See live leaderboard
- React with emoji

### 10. No Account Required to Play
- Players join with PIN, choose nickname — that's it, game starts
- **No optional account linking** — nickname is the only identity for players
- Scores and history are tied to the session, visible in the host's post-game report
- Only quiz *creators* need an account (to build and host quizzes)

### 11. Deep Avatar Customization on Join
- **Layer system:** base body → skin tone → hair style/color → eyes → outfit → accessories (hats, glasses, items)
- **Preset gallery:** 10+ pre-built characters (selectable in 1 tap for quick join)
- **Custom builder:** step-through editor, changes preview live on avatar
- **Photo upload:** take/upload photo → auto-cropped to circle → stored in R2
- **Persistence:** avatar saved to KV keyed by `{pin}:{nickname}` so refreshing the page doesn't reset it
- **Avatar visible on:** lobby player list, leaderboard, podium, chat messages
- Implementation: SVG-based layered avatar (like DiceBear Avataaars or custom SVG stack) — no heavy image assets

### 12. Live In-Game Chat
- **Where it appears:** lobby waiting room + between questions (results screen) — NOT during active countdown
- **Who can chat:** all players + host (host messages highlighted differently)
- **Message types:** text (up to 120 chars) + players can react to any message with emoji
- **Host controls:**
  - Mute individual player
  - Slow mode (one message per player per 10s)
  - Disable chat entirely
  - Delete a message
- **Moderation:** optional profanity filter (word list in KV, configurable per quiz)
- **Implementation:** routed through the GameRoom Durable Object alongside game events — same WebSocket, different message type
- **Chat log:** saved to D1 for post-game review by host

---

## Cloudflare Account Inventory

**Account ID:** `a3000146f2714841e3bdd91d655aef9c`
**Account name:** Rushelsilvester@outlook.com

### Existing D1 Databases (do not touch)
| Name | ID | Used By |
|---|---|---|
| `wedding-db` | `71f98b31-...` | Wedding RSVP app |
| `rs-wedding-chat` | `376bbde1-...` | Wedding chat |
| `ferienplanung-db` | `5182147d-...` | Vacation planner |
| `roulette-history` | `271e46f2-...` | Roulette app |

**→ Create new:** `kahootplus-db`

### Existing KV Namespaces (do not touch)
| Title | ID | Used By |
|---|---|---|
| `ROULETTE_ROOMS` | `c1dffcacaf9c40cc...` | Roulette app |

**→ Create new:** `KAHOOTPLUS_SESSIONS`

### Existing R2 Buckets (do not touch)
| Name | Used By |
|---|---|
| `wedding-images` | Wedding app |

**→ Create new:** `kahootplus-media`

### Existing Workers (do not touch)
- `wedding-api`, `rs-wedding-chat-api`, `roulette-api`, `sivani-jahrestag2026`, `frosty-disk-3483`

**→ Create new:** `kahootplus-api` (+ Durable Object: `GameRoom`)

### GitHub
- Repo: `https://github.com/SlyRix/QuitApp.git`
- Cloudflare Pages will auto-deploy on push to `main`
- Two Pages projects: `kahootplus-host` + `kahootplus-player`

---

## Domain Setup

| URL | Who Uses It | Purpose |
|---|---|---|
| `quiz.rushelwedsivani.com` | Quiz creators (hosts) | Create quizzes, host games, dashboard |
| `quiz-player.rushelwedsivani.com` | Players | Join page, game view, avatar builder |
| `api.quiz.rushelwedsivani.com` | Internal | Workers API + WebSocket endpoint |

**Why separate player subdomain:**
- Clean separation: hosts never accidentally land on the player join page
- QR codes and share links always point to `quiz-player.rushelwedsivani.com/{pin}` — memorable and obvious
- Can be styled differently (full-screen, mobile-optimized, no nav chrome)
- Easy to rate-limit and secure the player subdomain independently

**Join URL format:**
```
https://quiz-player.rushelwedsivani.com/join/{PIN}
```
QR code encodes this URL — scanning it on any phone goes straight to the join screen for that game.

**Cloudflare DNS config:**
- `quiz` CNAME → Pages project (host/creator app)
- `quiz-player` CNAME → Pages project (player app, same repo different entry point OR separate Pages project)
- `api.quiz` CNAME → Workers route
- All handled within the same Cloudflare account — SSL auto-provisioned on all three

**Implementation options for player subdomain:**
- Option A: Same Vite project, different `index.html` entry → deploy both to same Pages project, use `_redirects` to route by subdomain
- Option B: Separate Pages project (`kahootplus-player`) — cleaner separation, independent deploys
- **Recommendation: Option B** — player experience can be optimized independently, smaller JS bundle for mobile

**wrangler.toml routes:**
```toml
routes = [
  { pattern = "api.quiz.rushelwedsivani.com/*", zone_name = "rushelwedsivani.com" }
]
```

---

## Player Identity: Nickname Only

- No registration, no email, no password for players
- Join flow: enter PIN → enter nickname → pick/build avatar → in lobby
- Player record in D1 is ephemeral: only exists for the duration of the session
- `game_players` table rows are deleted or archived after session ends
- Avatar stored temporarily in KV (`player:{sessionId}:{nickname}:avatar`) with TTL matching session
- Host's post-game report shows all nicknames + scores — no PII collected from players

---

## Cloudflare Architecture Deep Dive

### Durable Objects for Real-Time Game Rooms

```
GameRoom Durable Object (one per active game):
├── State: { phase, players, currentQuestion, scores, answers }
├── WebSocket: all connected clients (host + players)
├── Alarms: question timer countdown
└── Auto-cleanup: after game ends + 1 hour
```

**Flow:**
1. Host hits `POST /api/games` → Worker creates GameRoom DO, returns PIN + roomId
2. QR code generated server-side (qrcode npm package in Worker)
3. Players hit `GET /api/games/{pin}/join` → redirected to WebSocket endpoint
4. All WS messages routed through GameRoom DO
5. DO broadcasts to all connected clients

### D1 Schema Overview

```sql
-- Users
users (id, email, name, avatar_url, created_at)
oauth_accounts (id, user_id, provider, provider_id)

-- Quizzes
quizzes (id, owner_id, title, description, cover_image, theme, is_public, created_at)
questions (id, quiz_id, type, text, media_url, time_limit, points, order_index)
answer_options (id, question_id, text, is_correct, order_index)
question_media (id, question_id, type, r2_key, url)

-- Game Sessions
game_sessions (id, quiz_id, host_id, pin, status, created_at, ended_at)
game_players (id, session_id, nickname, avatar, joined_at)
game_answers (id, session_id, player_id, question_id, answer_id, response_time_ms, points_earned)

-- Analytics
quiz_analytics (id, quiz_id, session_id, question_id, correct_count, wrong_count, avg_time_ms)
```

### KV Usage

```
sessions:{token}           → user session data (TTL: 7 days)
game:{pin}:meta            → game room metadata (TTL: 24h)
game:{pin}:leaderboard     → cached leaderboard (TTL: per question)
ratelimit:{ip}:{endpoint}  → rate limiting counters
```

### R2 Bucket Structure

```
kahootplus-media/
├── quizzes/{quiz_id}/cover.{ext}
├── questions/{question_id}/media.{ext}
├── avatars/{user_id}/avatar.{ext}
└── sounds/
    ├── lobby-music.mp3
    ├── question-music.mp3
    ├── correct.mp3
    └── wrong.mp3
```

---

## Tech Stack Finalized

### Frontend (Cloudflare Pages)
```
React 18 + Vite + TypeScript
Tailwind CSS + shadcn/ui components
Framer Motion (animations)
Zustand (state management)
React Query / TanStack Query (server state)
Socket-like hook (native WebSocket wrapper)
qrcode.react (QR code display)
recharts (analytics charts)
react-beautiful-dnd (drag & drop quiz builder)
```

### Backend (Cloudflare Workers)
```
Hono.js (API routing, middleware)
Drizzle ORM (D1 type-safe queries)
Zod (validation)
jose (JWT handling)
qrcode (server-side QR generation)
Workers AI (quiz generation)
```

### Infrastructure
```
Cloudflare D1      — Primary database
Cloudflare KV      — Sessions + cache
Cloudflare R2      — Media storage
Cloudflare DO      — Real-time game rooms
Cloudflare Pages   — Frontend hosting
Cloudflare Workers — API + game logic
```

---

## UI/UX Direction — Fun × Professional × Interactive

### The Core Principle
> Feels like playing a premium game. Not a classroom toy, not a corporate dashboard. The kind of app people show their friends.

Kahoot's weakness: it looks dated, the animations are basic, and the player experience is passive — you just tap and wait. We fix all three.

### Interaction Design

**Every action has a reaction:**
| Player Action | UI Response |
|---|---|
| Tap answer button | Button scales down (press feel) + color floods in + haptic pulse |
| Correct answer | Green burst animation, score counter ticks up with easing, confetti shower |
| Wrong answer | Button shakes, brief red flash, avatar does a sad wobble |
| New question appears | Question slides in from right, answer options stagger in one by one (100ms apart) |
| Timer running low (<5s) | Timer pulses red, subtle heartbeat sound, screen vignette darkens |
| Leaderboard reveal | Ranks slide in from bottom, #1 drops in last with gold flash + sound |
| Podium screen | 3 podium blocks rise with physics bounce, avatars land on top, confetti |
| Streak hit | Flame icon ignites next to score, multiplier badge appears with pop |
| Power-up activated | Screen-wide ripple effect in power-up color, brief slow-motion feel |
| New player joins lobby | Avatar bounces in from side, name types itself in |

**Framer Motion sequences used throughout:**
- `staggerChildren` for answer option reveal
- `spring` physics for leaderboard reordering
- `layoutId` for seamless avatar movement (lobby → podium)
- `AnimatePresence` for screen transitions (no hard cuts)

### Visual Identity

**Color system:**
```
Background:  #0D0F14  (near-black with blue undertone — immersive, not harsh)
Surface:     #161B27  (cards, panels)
Border:      #232B3E  (subtle structure)
Accent:      #6EE7F7  (electric cyan — primary brand color)
Correct:     #22C55E  (vivid green)
Wrong:       #EF4444  (vivid red)
Gold:        #F59E0B  (leaderboard #1)
Text:        #F0F4FF  (near-white, warm)
```

**Typography pairing:**
- Display / questions / scores: `Bricolage Grotesque` or `Space Grotesk` — wide, confident, readable on projector
- UI chrome / body: `DM Sans` — clean, friendly, professional
- Numbers / timer / points: Tabular variant for no-jitter score counting

**Layout principles:**
- Player screen: single focus zone — one thing at a time, huge tap targets (min 64px), no clutter
- Host screen: split — left = game control, right = live player grid with real-time status
- Quiz builder: kanban-feel with drag handles, inline editing, no modal overload

### Moments of Delight (things players will remember)
1. **Avatar bounce in lobby** — your avatar wiggles when someone reacts to your chat message
2. **Answer rush** — as the timer hits 0, a wave animation sweeps across all locked-in answers
3. **Score reveal suspense** — 2-second pause before showing if you were right, builds tension
4. **Streak flame** — fire emoji that grows with each consecutive correct answer (3→4→5 = bigger flame)
5. **Podium drop** — #1 winner's avatar literally falls from the top of the screen onto the gold block
6. **Confetti burst** — device-edge confetti that respects the player's reduce-motion setting
7. **Chat message float** — new chat messages float up from the bottom like bubbles
8. **Countdown pulse** — the entire background subtly pulses in sync with the last 3 seconds

### Accessibility Guardrails
- All animations respect `prefers-reduced-motion` — graceful fallback to fade/none
- Color is never the only signal — icons + text always accompany green/red feedback
- Tap targets minimum 48×48px on mobile
- Timer always shown as both visual ring AND number
- Screen reader announcements for question reveal and score update

### Sound Design
| Moment | Sound | Character |
|---|---|---|
| Lobby waiting | Lo-fi loop (gentle) | Calm, not annoying |
| Question countdown | Subtle tick every second | Building tension |
| Last 5 seconds | Faster ticks + low rumble | Urgency |
| Correct answer | Bright ascending chime | Satisfying |
| Wrong answer | Low dull buzz | Clear but not harsh |
| Leaderboard reveal | Drum roll → cymbal crash | Dramatic |
| Streak hit | Rising tone sequence | Rewarding |
| Game end / podium | Short fanfare | Celebratory |

All sounds stored in R2, loaded once on game start, controlled by a single mute toggle. Default: on.

---

## Player Reconnection Strategy

### The Problem
Mobile players on shaky WiFi or switching between WiFi/cell will drop their WebSocket connection. They must be able to rejoin seamlessly without losing their score, nickname, or avatar.

### Session Token (the key mechanism)
- When a player successfully joins, the GameRoom DO issues a **short-lived session token** (UUID) tied to `{sessionId}:{nickname}`
- Token stored in `localStorage` on the player's device
- On every reconnect attempt, the player sends this token — DO recognises them and restores their slot

```
KV key: player-session:{token}
Value:  { sessionId, nickname, avatarData, score, currentStreak }
TTL:    2 hours (covers longest possible game)
```

### WebSocket Reconnection (client-side)
```
Disconnect detected
  → wait 500ms → attempt 1
  → wait 1s    → attempt 2
  → wait 2s    → attempt 3
  → wait 4s    → attempt 4
  → wait 8s    → attempt 5
  → wait 15s   → attempts 6–10 (capped at 15s)
  → after 10 failed attempts → show "Can't reconnect" screen with manual rejoin button
```
- Reconnect URL is the same: `wss://api.quiz.rushelwedsivani.com/game/{pin}/ws?token={sessionToken}`
- No need to re-enter nickname or rebuild avatar — token handles identity

### Durable Object behaviour on disconnect
- Player WebSocket closes → DO marks player as `status: "disconnected"`
- DO holds the player slot for **60 seconds** before considering them dropped
- During those 60s: their score is preserved, they remain on the leaderboard (greyed out on host view)
- If they reconnect within 60s: status flips back to `"connected"`, full state snapshot sent immediately
- If 60s expires: player marked `"dropped"`, slot freed — but score remains in final results

### State snapshot on rejoin
When DO accepts a reconnect, it sends a single `SYNC` message with:
```json
{
  "type": "SYNC",
  "phase": "question_active | results | lobby | ended",
  "currentQuestion": { ...full question data... },
  "timeRemainingMs": 8400,
  "myScore": 3200,
  "myStreak": 2,
  "leaderboard": [ ... ],
  "hasAnswered": false
}
```
Client uses this to instantly render the correct screen — player feels like they never left.

### Answer submission fallback
- If WebSocket drops at the exact moment a player taps an answer:
  - Client queues the answer locally
  - On reconnect, sends it immediately with the original `answeredAtMs` timestamp
  - DO accepts it only if within the question's time window (prevents abuse)
  - If time already expired, answer is discarded gracefully — player sees "time's up" screen

### What the player sees
| Scenario | Player experience |
|---|---|
| Brief drop (<5s), reconnects | Spinning overlay for a moment, then back in game seamlessly |
| Longer drop, mid-question | Reconnects, sees question still active (if time left), can still answer |
| Drops during results screen | Reconnects, sees results — score intact |
| Drops, rejoins next question | Misses one question, but back in game with full score history |
| Completely fails to reconnect | "Reconnecting failed" screen + button: "Tap to try again" with the join URL pre-filled |

### Host view
- Disconnected players shown with a **grey wifi icon** next to their name in the player list
- NOT removed from leaderboard during the 60s grace window
- Host can manually kick a player who has been disconnected for a long time

---

## Kahoot Quiz Import

### How Kahoot Export Works
- Kahoot lets users export quizzes as a `.xlsx` (Excel) or JSON file from their dashboard
- The JSON structure looks like this:
```json
{
  "title": "My Quiz",
  "questions": [
    {
      "type": "quiz",
      "question": "What is 2+2?",
      "time": 20000,
      "pointsMultiplier": 1,
      "image": { "url": "https://media.kahoot.it/..." },
      "choices": [
        { "answer": "3", "correct": false },
        { "answer": "4", "correct": true },
        { "answer": "5", "correct": false },
        { "answer": "6", "correct": false }
      ]
    }
  ]
}
```

### Question Type Mapping

| Kahoot Type | KahootPlus Equivalent | Notes |
|---|---|---|
| `quiz` | Multiple Choice | Direct 1:1 map |
| `true_false` | True/False | Direct 1:1 map |
| `type_answer` | Type Answer | Direct 1:1 map |
| `poll` | Poll | Direct 1:1 map |
| `slider` | Slider | Direct 1:1 map |
| `word_cloud` | Word Cloud | Direct 1:1 map |
| `puzzle` | Puzzle/Ordering | Direct 1:1 map |
| `drop_pin` | Image Map | Best-effort, may need manual review |

### Import Flow
1. User uploads `.json` file on the import page
2. Worker parses and validates the JSON against known Kahoot schema
3. Show a **preview screen**: quiz title, question count, any unsupported types flagged
4. For each question with a Kahoot-hosted image URL:
   - Worker fetches the image server-side
   - Uploads to R2 under `quizzes/{newQuizId}/imported/q{n}.{ext}`
   - Replaces URL reference in the question record
5. User confirms → quiz saved to D1, redirected to quiz editor for any touch-ups

### Edge Cases
- Kahoot image URLs may expire or be access-restricted → flag to user if fetch fails, allow manual re-upload
- `.xlsx` import: parse with `xlsx` npm package in Worker, convert to same JSON shape before processing
- Time values in Kahoot JSON are in milliseconds → convert to seconds for D1

### No Monetization
- All features fully free, no tiers, no paywalls
- No rate limits on quiz creation, game size, or question count beyond Cloudflare's infrastructure limits

---

## Feasibility Assessment

| Concern | Assessment | Solution |
|---|---|---|
| WebSocket at scale | ✅ DO handles 1000s of concurrent rooms | One DO per game room |
| Database at scale | ✅ D1 handles millions of rows | Proper indexing |
| Media upload size | ✅ R2 supports large files | 100MB limit per file |
| Real-time latency | ✅ <50ms at edge | DO co-location |
| Free tier limits | ⚠️ DO has 1M req/day free | Fine for MVP |
| AI generation speed | ⚠️ Workers AI can be slow | Show spinner, stream response |

**Verdict: Fully feasible on Cloudflare stack. No blockers.**

---

## Security Considerations

- Game PINs: 6-digit, expire after game ends, regenerated each session
- Rate limiting on join endpoint (KV-based): 10 attempts/minute/IP
- Media uploads: validate file type server-side (magic bytes), enforce size limits
- SQL injection: prevented by Drizzle ORM parameterized queries
- XSS: React escapes by default; sanitize any user HTML
- CORS: strict origin allowlist in Workers
- Auth tokens: short-lived (1h) + refresh token in KV (7 days)
