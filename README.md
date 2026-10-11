# Campus Lost & Found System

Web app where students, teachers and staff report, search for and recover lost belongings.
Built with a **hybrid architecture: MVC + Event-Driven**.

## Run it

```bash
npm install
cp .env.example .env      # set SESSION_SECRET for anything beyond local use
npm run seed              # optional demo data
npm start                 # http://localhost:3000
npm test                  # unit + integration tests
```

Demo accounts (after `npm run seed`): `admin@campus.edu / Admin1234`, `ayesha@campus.edu / Student123`, `bilal@campus.edu / Student123`.
Log in as Ayesha to see a match already identified between her lost wallet and Bilal's found wallet.

Requires Node 22.13 or newer (uses the built-in `node:sqlite`, so nothing needs compiling). Stack: Express, EJS, SQLite, bcryptjs, helmet, multer.

## Enhanced user experience

- Refreshed responsive landing page with a modern hero, clear lost/found actions, live summary metrics, and latest-report cards.
- Feature highlights explain advanced search, automatic matching, and safe ownership verification.
- Updated cards, forms, navigation, typography, focus states, hover feedback, reduced-motion support, and light/dark theme styling.
- Existing application capabilities include account registration/login, lost/found reports with optional photos, filtered search, similarity-based matching, notifications, claim review, profile management, and administrator moderation.

## Architecture

```
Browser -> routes -> Controller -> Model / Service -> SQLite
                                        |
                                  (after commit)
                                        v
                                    Event bus --> Matching handler --> PotentialMatchIdentified
                                        |                                       |
                                        +-------------> Notification handler <-+
```

| Layer | Folder | Responsibility |
|---|---|---|
| View | `src/views`, `public` | EJS templates, CSS |
| Controller | `src/controllers`, `src/routes` | Validate input, call models/services, render or redirect |
| Model | `src/models` | All SQL (parameterised queries only) |
| Service | `src/services` | Matching score, claim workflow (transactions) |
| Events | `src/events` | Bus, event names, handlers |

Events: `LostItemReported`, `FoundItemReported`, `PotentialMatchIdentified`, `ClaimSubmitted`, `ClaimReviewed`, `ItemRecovered`, `ReportModerated`.

Reliability decisions:
- Events are published only **after** the database write succeeds.
- Every event is stored in `event_log`.
- `UNIQUE(lost_item_id, found_item_id)` on matches and `UNIQUE(user_id, ref_key)` on notifications mean re-delivered events never create duplicate matches or alerts.
- A failing handler is logged and never breaks the request or other handlers.
- The bus API (`subscribe` / `publish`) can be backed by a broker later; for stronger delivery guarantees use a transactional outbox.

## Matching

`src/services/matchingService.js` returns 0 to 100: category (35, must be equal) + keyword overlap (35) + location (20) + date proximity (10). Pairs at or above `MATCH_THRESHOLD` (default 55) become suggestions. A score is similarity, not proof of ownership.

## Requirement coverage

| Requirement | Where |
|---|---|
| FR-01, FR-12 register, login, logout | `authController`, bcrypt, session regeneration |
| FR-02, FR-03 report lost / found | `itemController`, `/report/:type` |
| FR-04 search and filter | `/search` (keyword, type, category, location, status, dates) |
| FR-05 matching | `matchingHandler`, `matchingService` |
| FR-06 notifications | `notificationHandler`, `/notifications` |
| FR-07, FR-08 claims | `claimService`, `/items/:id/claim`, `/admin/claims` |
| FR-09 status updates | owner closes own lost report; admin marks recovered (found items need an approved claim) |
| FR-10 admin | `/admin`, `/admin/items`, `/admin/users` (role, deactivate, hide, delete) |
| FR-11 histories | `claims`, `item_matches`, `event_log`, `audit_log` |

Security: bcrypt hashing, role-based access, CSRF tokens, helmet CSP, login rate limiting, upload type/size checks with random filenames, owners edit only their own reports, private details and claim evidence visible only to owner/admin, admin actions audited.

## Known limits / next steps
- Sessions use the in-memory store; use a persistent store (e.g. Redis) when deploying.
- Email is not wired up; add a handler subscribed to `PotentialMatchIdentified` and `ClaimReviewed`.
- Use HTTPS and `NODE_ENV=production` when hosting.
