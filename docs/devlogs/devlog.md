# Falmouth After Five — system development log

Last reviewed: 10 September 2026.

This document describes the implemented source at the time of review. Paths are relative to the application repository root (`APP/fal-after-5` within the wider project workspace). No credentials, account addresses, access links, tokens, database contents or private workstation paths are included.

## 1. Purpose and deployment model

Falmouth After Five is a local-business offer directory and interactive map organised by Falmouth BID. Staff maintain businesses, offers, categories and campaigns. Visitors discover the next available campaign's offers using a map, list, search and category filters.

The public frontend is built with React 19 and Vite 7. Mapbox GL JS 3 provides the map. PHP 8.2+ handles JSON API requests, authentication, uploads and SQLite storage. Node is a development/build dependency, not a production server requirement. There is no MySQL, Firebase or Supabase dependency.

Two public experiences are retained:

- `/?experience=app`: the current map-first web-app interface.
- `/`: the original webpage-style experience, retained as an alternative.
- `/?admin`: the staff interface.

These are query-string routes served by the same entry point. The application can live in a website subdirectory or at a subdomain root. Public files and private runtime/storage must be deployed separately.

## 2. Repository and storage map

| Location | Purpose | Storage/publication rules |
| --- | --- | --- |
| `src/` | Editable React components, helpers and CSS | Source of truth for frontend changes |
| `index.html` | Vite source entry | Not the PHP production entry |
| `vite.config.js` | Relative asset URLs, build output and development API proxy | Build configuration |
| `public/index.php` | Serves the built HTML and sets response headers | Public entry point |
| `public/api.php` | API routing and request handling | Public PHP endpoint; private data is access-controlled |
| `public/assets/` | Supplied logos, fonts/assets and optimised business imagery | Public, version-controlled assets |
| `public/uploads/` | Generated photo and category-icon files | Public media; generated files ignored by Git |
| `public/uploads/.htaccess` | Apache upload-directory restrictions and SVG headers | Deploy with media directory |
| `public/build/` | Vite-generated HTML, JavaScript, CSS and font assets | Ignored by Git; rebuilt from source |
| `server/bootstrap.php` | Configuration, schema, validation, content resolution and shared functions | Private runtime code in deployment |
| `server/demo.php` and `server/demo-*.json` | Local demo seed and content mappings | Development-only data; excluded from production package |
| `scripts/` | Local server, account, import, validation, packaging and backup tools | Only the approved operational subset is packaged |
| `tests/` | Domain, API, package and local map checks | Development tools |
| `docs/` | Operational, content-source and developer documentation | Non-sensitive documentation |
| `.env.example` | Configuration key template | Safe to track; contains no configured secrets |
| `.env` | Actual environment configuration | Private, ignored by Git; never copy values into documentation |
| `private/` | Default local data directory | Ignored by Git; never serve over HTTP |
| `release/` | Generated release folders and ZIP files | Ignored by Git; historical snapshots, not editable source |
| `node_modules/` | Installed development dependencies | Ignored by Git |

The wider workspace has a sibling `RESOURCES/` directory containing supplied branding and business images. The running app does not read that directory; selected assets are copied/processed into `public/assets/`.

### Runtime data locations

`APP_DATA_DIR` chooses private persistent storage. When unset, local storage defaults to `private/` under the runtime root. Development demo mode uses `demo.sqlite`; other modes use `content.sqlite`. A deployed production data directory must be outside the complete website document root, not simply outside the app's subdirectory.

Database files are created with restrictive permissions. SQLite uses a busy timeout and the default DELETE journal mode. Its directory must support persistent local storage and reliable file locking. A synced development workspace is convenient for source work but is not a production hosting model.

PHP sessions use the host's configured PHP session storage. Session data is not stored in the content database. Actual runtime data, local access files, activation links and backups must remain private.

## 3. Frontend responsibilities

| File | Responsibility |
| --- | --- |
| `src/main.jsx` | App entry, shared state, original frontend, shared dialogs and business/offer details, URL state and analytics integration |
| `src/AppExplorer.jsx` | Map-first layout, list sidebar, filters/settings, search and mobile controls |
| `src/app-explorer.css` | Map-first responsive styling and accumulated layout refinements |
| `src/MapView.jsx` | Mapbox lifecycle, camera controls, marker grouping, hover cards, venue focusing and staff location picker |
| `src/ExplorerMenu.jsx` | Information, privacy and business-submission menu/forms |
| `src/Admin.jsx` | Staff login, records, tabbed editors, publication controls, uploads and account settings |
| `src/AdminSelect.jsx` | Searchable custom combobox with keyboard selection and scrollable options |
| `src/PhotoDropzone.jsx` | Photo drag/drop and keyboard-accessible choose-file button |
| `src/AdminUsers.jsx` | Super-admin user management and account activation/password setup |
| `src/api.js` | Same-origin fetch wrapper, CSRF handling, JSON/FormData requests and errors |
| `src/domain.js` | UK dates, filtering, next available campaign and draft campaign-occurrence helper |
| `src/icons.jsx` | Phosphor icon mapping and validated uploaded SVG image rendering |
| `src/style.css` | Shared/public styling, staff UI, dialogs, drop zones and custom scrollbars |

### Visitor experience

The app experience fills the viewport with a pitched map. Desktop list mode overlays the map and logo. Mobile list mode covers the main map header. Desktop marker hover cards show business imagery, name and offer types. Grouped markers zoom into their area rather than displaying a multi-business menu; coincident markers spread at high zoom.

Desktop selection focuses the venue on the map before opening its detail dialog. Mobile business details use a bottom drawer with a drag-to-dismiss handle. Detail tabs separate offers, about text and location. Offer conditions use expandable details sections.

The search field shows a results dropdown on desktop and an overlay on mobile. Category filters and map settings share a popover. The mobile menu contains project information, business submission and privacy links. Desktop and mobile use the supplied blue/white logo variants as appropriate.

The app chooses the next campaign with an unexpired occurrence. It does not expose the campaign-date selector in its public controls. The original frontend retains its earlier date controls. Public content and current-time state refresh approximately every 30 seconds. An offer may be browsed before its start time; its end time controls expiry.

### Map details

The current public initial camera uses zoom 15.28, bearing 94 degrees and pitch 65 degrees, centred on Falmouth. `START_CAMERA` in `MapView.jsx` is authoritative. The business picker starts flat and north-up, centred on the edited venue. Its click and drag handlers update latitude/longitude fields; saving persists the selected location. A ResizeObserver handles layout changes. Picker markers are not recreated on idle frames, avoiding interruptions during dragging.

The public Mapbox token is supplied by the public API and is necessarily browser-visible. Its actual value must not be committed or documented. Retain Mapbox/OpenStreetMap attribution and configure allowed origins on the provider account.

## 4. Database model and edits

SQLite stores the following tables:

- `records`: keyed by content kind and ID, with JSON content, record version, update time and updating staff name.
- `users`: account identity, password hash, active state, session version and role.
- `attempts`: counters/time windows for login and public-submission throttling.
- `account_tokens`: hashes of single-use account setup/reset tokens, target user IDs and expiry timestamps.
- `meta`: auxiliary metadata storage.

`db()` creates missing tables and adds the role column to older user tables. There is no general versioned migration framework yet. Backups and explicit migration/rollback planning are required for future incompatible changes.

Content kinds are `businesses`, `offers`, `dates` (labelled Campaigns in the UI), `categories` and private `submissions`.

Business records contain profile text, address, coordinates, contact/booking links, image/alt text and publication status. Offers reference one business and multiple categories; they contain offer copy, redemption instructions, conditions, schedule settings, image/alt text and publication status. Categories store a name, icon, hex colour, ordering and active state. Campaigns hold an actual date, display label and publication status.

Writes are validated server-side. `saveRecord()` performs version checks inside a SQLite transaction. A stale editor receives a conflict rather than silently overwriting another editor's changes. `updated_by`/`updated_at` record the most recent change; this is not a complete historical audit trail.

## 5. Campaigns, hours and roll-over

Campaign dates are created centrally in Campaigns. A month shortcut selects its first Friday, while a date input allows exceptions. Campaign pickers identify entries by month/year and actual date. Offers cannot create arbitrary campaign dates within their editor.

New offers use:

- `schedule_mode: all`: **No dates set**; available on all applicable published campaigns, including those created later.
- `schedule_mode: specific`: **Set specific campaigns**; `campaign_ids` lists existing campaign IDs.
- `roll_over`: when specific campaigns are selected, include campaigns after the last selected campaign's date. It does not fill gaps between selected dates.
- `start_time` / `end_time`: UK local hours applied on each campaign date. An end earlier than the start means the next morning. Equal hours are rejected.

`offerOccurrences()` in the PHP runtime resolves these rules on reads. It generates the dated occurrences consumed by the public frontend, with timezone-aware ISO timestamps added to public output. New campaigns do not require a cron task or resaving every offer. Draft/archived campaigns are excluded from public output; they can still exist as staff scheduling records. No campaign dates are automatically invented.

A published offer also needs a published business, an active category and an applicable published campaign to appear. Once an occurrence ends, the frontend excludes it and selects the next available campaign. With roll-over off, an explicitly scheduled offer ends after its final selected occurrence. Archiving an offer or business hides it publicly regardless of schedule.

Legacy offers retain explicit occurrences. Existing campaign selections and individual hours are preserved during unrelated edits. Changing their scheduling controls adopts the new common-hours model. Legacy occurrence dates are rebased to centrally edited campaign dates. The `legacy_schedule` flag is editor-only and is removed before persistence.

## 6. Staff editor design

Business editors use Details, Location, Contact and Photo tabs; offers use Offer, Campaigns & hours, Redemption & terms and Photo. Their headers hold tabs at the left and Save/Cancel buttons at the right. The content region scrolls beneath the header with a custom scrollbar. Editing eyebrows and last-saved lines are removed. There are no business/offer preview buttons.

Business fields use two columns on desktop, including location fields beside the picker. Columns stack on narrow screens. Publication status appears only in the business Details or offer Offer tab. Category and campaign editors retain their own publication/active controls.

Admin dropdowns are searchable and scroll after approximately eight rows. Offer-table search matches both title and business name. Discard and account-action confirmations are styled dialogs; a dirty page's close/reload warning is necessarily owned by the browser.

## 7. Upload pipeline

Photo tabs share a styled drop zone and choose-file button. The browser rejects unsupported file types and files over 8 MB; the server independently validates uploads. JPG, PNG and WebP inputs are decoded with GD, checked against the 24-megapixel limit, resized to at most 1800px wide and encoded to WebP at quality 82. Generated filenames use random identifiers. Existing images are not retroactively converted. Offer imagery falls back to the business photo when absent.

Category icons accept SVG only, up to 100 KB. PHP DOM parses the document, rejects entities and validates a limited element/attribute allowlist. Scripts, handlers, external resources and unsupported SVG features are rejected. Sanitised files are rendered as image elements, not injected HTML. Icons with complex gradients, styles, text or other unsupported constructs may need conversion to simple outlined shapes.

Image paths are stored in records; image bytes live in `public/uploads/` or shipped `public/assets/`. Uploading occurs before record saving. Cancelling an editor or replacing an image can leave an unreferenced file; no automatic orphan-media cleanup exists. Never delete media without checking references and backups.

## 8. API and authentication

All API actions use `public/api.php?action=...`. `src/api.js` sends cookies with same-origin requests and attaches the session CSRF token to mutations.

| Access | Actions |
| --- | --- |
| Public content | `public` |
| Session / sign-in | `session`, `login`, `activate-account` |
| Public submission with CSRF/throttling | `submit-business` |
| Authenticated staff | `admin`, `save`, `upload`, `upload-icon`, `review-submission`, `password`, `logout` |
| Super-admin only | `users`, `invite-user`, `reset-user`, `disable-user` |

Production staff/session access requires HTTPS. Cookies use HttpOnly, SameSite Strict and HTTPS-dependent Secure settings. Login rotates the session ID and CSRF token. Account session versions invalidate old sessions after disabling or password changes. Sessions expire after two hours of inactivity. Failed login attempts are throttled by IP.

Normal admins manage campaign content. Super-admins additionally create invitations, issue reset links and disable ordinary admin accounts. Accounts created by invitation remain inactive until a password is set. Setup/reset links are random, valid for 24 hours, hashed in storage and single-use. Reissuing a link invalidates previous links; disabling revokes pending tokens and sessions. Links are shared manually: no automatic email delivery exists. Super-admin promotion/recovery is available through `scripts/user.php` on the server. No real account identifiers or credentials belong in source documentation.

Public business submissions collect contact/profile/proposed-offer information and consent. Validation, a honeypot and rate limiting protect the route. They are private staff records, never automatically published. Staff can mark submissions reviewed; publication still requires creating/editing the normal business/offer records. No notification email is sent.

## 9. Configuration and local workflow

Configuration names (values deliberately omitted):

| Key | Purpose |
| --- | --- |
| `APP_ENV` | Development or production behaviour |
| `DEMO_MODE` | Enables demo seeding only alongside development mode |
| `APP_DATA_DIR` | Private persistent database directory |
| `APP_PUBLIC_DIR` | Public site location for CLI tools |
| `MAPBOX_PUBLIC_TOKEN` | Public map access configuration |
| `MAPBOX_STYLE` | Map style |
| `GA_MEASUREMENT_ID` | Optional GA4 integration |

From the repository root:

```bash
npm ci
npm run build
npm run preview
```

The PHP preview listens on `http://127.0.0.1:8787`. `npm run dev` runs Vite with an API proxy to the PHP preview. Use the built PHP preview when verifying deployable output. Do not run two servers on the same port. Avoid refreshing a browser while Vite is deleting/replacing build output.

Google Analytics is optional and consent-gated. App analytics are not initialised in staff or demo mode. Consent is stored locally. There is no configured mail service or scheduled background worker. Verify any host-wide analytics/consent integration separately before launch.

## 10. Verification commands and scope

| Command | Scope |
| --- | --- |
| `npm test` | JS domain/contrast checks and PHP domain/backup checks |
| `npm run check:php` | PHP syntax checks |
| `npm run test:http` | Isolated API/authentication/upload/security and backup/restore integration tests; uses port 8788 |
| `npm run test:package` | Release contents, private/public separation and nested-path smoke checks; uses port 8789 |
| `node tests/map-picker.mjs` | Local preview pin drag/click check using installed Chrome and a local Mapbox style; discards edits |
| `npm run build` | Production frontend build |
| `npm run package` | Build followed by release packaging |

Local HTTP tests need permission to bind/connect to their ports in restricted environments. A sandbox networking error is not an application test failure. The map test intentionally avoids external tile dependencies; visually inspect the real Mapbox style separately. It depends on local demo fixtures and the private local preview account file, whose contents must not be printed or copied.

Recorded checks during this development sequence include passing domain, API and package tests; map pin drag/click checks; and visual checks of admin tabs, dropdowns, headers and photo layouts. The latest business-column/drop-zone changes received a build and visual checks, not a new complete security audit. Documentation edits do not imply a fresh test run.

## 11. Packaging and production operations

`scripts/package.php` generates a timestamped directory/ZIP containing:

- `site/`: built frontend, public assets, PHP entry/API, upload restrictions and a configurable bootstrap path.
- `runtime/`: private bootstrap, selected operational scripts and configuration template.
- An allowlisted set of deployment/content documents, dependency lock and SHA256 manifest.

It excludes actual configuration, account credentials, databases, demo seeds and uploaded live media. These new devlog/handover files are repository documentation and are not automatically included by the current document allowlist.

A ZIP is a snapshot. Later source changes do not update older ZIPs. Run `npm run package` when preparing the actual delivery and validate that package. Production needs PHP extensions for SQLite, mbstring, GD with WebP, fileinfo and DOM, plus session support and appropriate upload limits. Apache restrictions are provided; other web servers need equivalent rules.

On updates, preserve installed private configuration, data, uploads and the site's configured bootstrap path. Replace frontend/backend as a matched release. No production deployment is recorded by this devlog.

Backups use `scripts/backup.php`: SQLite `VACUUM INTO` plus uploaded-media copies and a manifest. Backups contain private account/contact data. Restore requires offline confirmation, checks integrity/environment mode and retains pre-restore copies. Restore currently recreates basic upload execution restrictions but not every SVG-specific header from the current upload `.htaccess`; reapply the current header rules and verify after restoration. Backups and monitoring are not scheduled by the application.

## 12. Development sequence and current cautions

The build evolved through these stages:

1. Original frontend, PHP/SQLite backend, staff content editing and private/public deployment split.
2. Alternative map-first responsive frontend, supplied branding and imagery, researched venue/content mappings.
3. Map hover cards, cluster zoom, desktop focus transitions, mobile navigation/search and business drawers.
4. Multi-user staff management, WebP uploads, validated SVG icons, custom category colours and searchable admin dropdowns.
5. Compact tabbed editor headers, campaign-based offer scheduling and roll-over.
6. Business two-column layouts, photo drop zones, details-only publication status and removal of editor previews.
7. This system log and agent handover.

Older documents contain superseded examples (offer counts, camera pitch, preview actions or initial account setup). Consult current code and the latest staff-guide sections before repeating those instructions. The local demo is not evidence of current promotional availability. Production content, business imagery permissions, map coordinates, host configuration and account ownership still require launch verification.

Known engineering considerations: accumulated CSS overrides; no general migration framework; no full change-history audit; no orphan-image cleanup; no automatic mail; no scheduled backups; and limited end-to-end coverage of newer UI interactions. Do not present these as implemented services.

### 10 September 2026 — two-column offer editor

Offer editor tabs now use two desktop columns: business/title/publication beside description/categories, campaign selection beside hours, and redemption beside conditions. The existing photo columns are retained. Layouts stack below 700px. Publication status remains in the Offer tab. Changes are in `src/Admin.jsx` and `src/style.css`; scheduling, persistence and upload behaviour are unchanged.

### 10 September 2026 — business social and contact links

Added optional Facebook and Instagram URL fields to the business Contact tab. PHP validates and persists both alongside the existing website, booking and phone fields. Existing records without these fields continue to work. The public business About tab renders styled icon links only for populated phone, website, booking, Facebook and Instagram values. Web/social links open in a new tab with safe rel attributes; phone links use a cleaned telephone URI. Social clicks use the existing consent-gated tracking function with a platform identifier, not the destination URL. Files: `src/Admin.jsx`, `src/main.jsx`, `src/icons.jsx`, `src/style.css`, `server/bootstrap.php` and `tests/domain.php`. New validation checks cover retained URLs and rejected unsafe schemes.

### 10 September 2026 — refreshed logo assets and favicon

Imported the new blue/white wordmarks and motif from the wider workspace's `RESOURCES/LOGO-NEW` folder into `public/assets/`. Desktop public views and backend use the blue wordmark; public mobile views use the motif. The supplied motif retained a full-width wordmark canvas, so only the deployed app copy's SVG viewBox/dimensions were fitted to its artwork with a small margin. Source artwork is unchanged. The white wordmark is retained for future use. Added `public/favicon.png`, its HTML link and explicit release-package inclusion. Frontend changes are in `src/AppExplorer.jsx`, `src/main.jsx`, `src/app-explorer.css` and `src/style.css`; favicon wiring is in `index.html` and `scripts/package.php`.

### 10 September 2026 — revised mobile motif

Replaced the app's motif with the latest supplied SVG, including its white circular background. Fitted the app copy's canvas to the revised artwork with a small margin; retained the 54px mobile display size. The original source file, desktop wordmark and favicon were not changed.

### 10 September 2026 — latest motif revision

Installed the subsequent user-supplied motif revision from `RESOURCES/LOGO-NEW`. This supersedes the previous motif artwork. Only the app copy's canvas was fitted around the artwork, retaining the existing mobile display size; the supplied source, other logos and favicon remain unchanged.

### 10 September 2026 — mobile blue-wordmark trial

The app's non-desktop header now uses the blue full wordmark without a background or tagline, at the existing 760px mobile breakpoint. Desktop branding remains unchanged. The motif asset and preceding CSS rule remain available for reverting; restore the responsive image source and remove the final trial CSS block to revert. Source files: `src/AppExplorer.jsx` and `src/app-explorer.css`.

### 10 September 2026 — corrected desktop logo trial

Corrected the preceding trial's scope: mobile again uses the motif and its existing size/position rules. Desktop uses the blue wordmark without the white container or tagline. Original desktop lockup rules and tagline markup remain available for reverting by removing the final desktop trial CSS block.

### 10 September 2026 — missing markers traced to expired campaign

The CMS/public API connection was functioning: 19 businesses and 17 published offers were present, but the only published campaign was 4 September and every occurrence had expired. The user approved creating/publishing 11 September in the local demo. Five unrestricted offers became eligible automatically; the other twelve remained restricted to the expired campaign pending the user's scheduling decision. Added a private admin visibility summary and a notice linking to Campaigns when no upcoming public offers exist. Files: `server/bootstrap.php`, `public/api.php`, `src/Admin.jsx`. CMS/API integration checks and the frontend build passed; restored markers were observed in the public app. No expiry rules were bypassed and no production data was changed.

### 10 September 2026 — Offer scheduling column

The admin offers list now includes a Campaigns column. Offers without specific dates show “No specific dates” and “All published campaigns”; restricted offers show “Specific campaigns”, the number selected and roll-over when enabled. Legacy occurrence-based offers are treated as restricted, and empty legacy schedules are explicitly labelled “No campaigns selected”. On smaller screens, scheduling appears beneath each offer. This is display-only and does not change saved campaigns or offer eligibility. Validated with a production frontend build and the local admin preview.

### 10 September 2026 — Public welcome animation

Added `WelcomeSplash.jsx` and `welcome-splash.css` for the map-first experience. A translucent blurred white overlay holds a three-second circular dial around the motif. After the dial fades, the supplied blue wordmark assembles, holds for two seconds, then slides offscreen. Controls fade in one second after the overlay finishes leaving. The map mounts underneath; the sequence is a timed welcome animation, not measured network progress. Controls are inert until the intro ends. Reduced-motion visitors and direct offer links skip the intro. Two cropped SVG viewBoxes derived from the existing blue artwork live in `public/assets/splash-{circle,wordmark}.svg`; regenerate these if the logo changes. Public dialogs now fade/slide in, preserving mobile drawer gestures and respecting reduced motion. Production build checked; splash logo and blurred map inspected in the local preview.

### 10 September 2026 — Splash refinement and map readiness

The splash now starts in opaque light blue-grey and only transitions to glass after Mapbox's first `idle` event. Departure waits for both the six-second logo sequence and the 1.3-second glass transition; a 15-second fallback prevents a failed map from blocking access indefinitely. UI fade timing is relative to departure. Increased dial thickness to 3.5 with round caps and more space around the motif. Added the supplied `public/assets/logo-3deep.png`, linked to the 3deep Media website, centered at the bottom with a one-second delayed fade. The map-ready callback is optional, preserving existing map/picker consumers.

### 10 September 2026 — Clear editor validation

CMS editor saves now collect invalid fields into a persistent alert below the header. Each summary link opens the relevant tab and focuses its field. Invalid controls receive a red outline, `aria-invalid` and an inline description linked via `aria-describedby`. Errors update as fields are corrected, including picker-driven changes. API/save/upload errors also remain visible above the scrollable form. Photo description guidance explicitly states it is required when an image exists. Verified the production build and local browser behaviour for empty required fields, inline/summary messages, and automatic tab switching from Photo to Details; the new-business test was cancelled without creating a record.

### 10 September 2026 — Category-aware frontend search

`matchingOffers` now searches configured category names as well as business names and offer copy, with common category terms (e.g. dining/restaurants, pubs/bars, retail and activities). Search normalizes case/diacritics and matches each whitespace-separated term across this combined text; campaign expiry and category filters still apply. Custom category names are supported without relying on category IDs. The map-first frontend displays a blue circular matching-offer counter while a nonblank search is active, including the collapsed mobile search button; its sidebar count also turns blue. Counts include zero and describe the active query for assistive technology. Domain tests cover category-only matches, generic terms, combined queries, custom categories, and existing campaign/filter restrictions.

### 10 September 2026 — Stepped business and offer submissions

- Added six public steps: business profile and public contact links; address and draggable map location; offer/category/redemption/terms; existing published upcoming campaigns, all-campaign default, roll-over and UK hours; optional business/offer photos; review and private applicant contact/consent.
- Public descriptions enforce 500 characters for businesses and 250 for offers on both client and server. Staff editor limits and existing content are unchanged. Names, links, conditions, image descriptions and notes have separate bounds; links allow http(s), phone fields restrict characters, coordinates are finite/in range, categories/campaign IDs must exist and be available, and HTML/control characters are rejected. Rendering uses escaped React text, not raw HTML.
- `submission-image.js` converts JPG/PNG/WebP to WebP in memory before upload, with 8 MB / 24 MP input limits, 1800-pixel longest side and 2 MB output cap. Files are sent only on final submission. Server independently verifies real WebP content/dimensions and re-encodes with GD under random names. SVG and executable payloads are rejected. Permission confirmation and image descriptions are required with photos.
- Submissions and photos stay private. New image files live in `dataDir()/submission-images/` with restricted permissions, outside the document root in production. Only authenticated staff can retrieve a photo through its submission ID and approved slot. Failed partial submissions remove stored photos. Backup/restore includes these files.
- Retained CSRF, same-site sessions, five successful submissions per IP/hour and manual review; added a 30-attempt/hour throttle before image decoding and 5 MB request / 24 KB JSON bounds. No visitor can set publication status, overwrite CMS records or supply a storage path.
- Staff review displays all captured fields and authenticated photo downloads. Staff still create approved business/offer records manually; “Mark reviewed” is not publication. No automatic emails or visitor accounts are introduced.
- Added local form state, per-step errors, character counters and a final review. Leaving a dirty form prompts before discarding; browser reload warns. Unsent data/images are not stored persistently. Before launch, agree retention/deletion procedures and consider a managed anti-bot challenge if abuse warrants it. OWASP File Upload and Input Validation Cheat Sheets informed the layered checks; these do not replace keeping PHP/GD and hosting patched.

Validation: production frontend build, PHP syntax checks, domain tests, isolated HTTP integration suite and package smoke checks passed. HTTP coverage includes invalid types/lengths/HTML/URLs/coordinates/category IDs, missing CSRF, photo descriptions/rights, forged WebP uploads, partial-upload cleanup, anonymous image denial, authenticated image reads and backup/restore of private photos. The mobile Playwright test passed all six steps with a real draggable map and browser WebP conversion; its final submission request was intercepted, so it created no application. Desktop form and mobile review layouts were visually inspected.

### 10 September 2026 — Direct-repo hosting access fix

The deployed homepage and public API returned LiteSpeed 403 after the document root was changed to `public/`. Added an explicit `Require all granted` in `public/.htaccess` to override the repo-root denial for public assets and entry points, retaining dotfile denial and the private repo rule. The remote file must be replaced by the host operator; no remote files were changed. Local PHP development tests do not exercise .htaccess inheritance.

### 11 September 2026 — Request table and recoverable deletion

Business submissions now appear in a responsive, horizontally scrollable table with business/offer, contact, received date, status and actions. Requests are sorted newest received first; search includes contact names, emails and offer titles. View opens a details modal, including legacy requests, offer information and private photos. Delete requires a named confirmation and moves only that request to Trash; Restore reinstates its previous new/reviewed status. Private photos are retained for recovery and existing CMS business/offer records are untouched. API actions require staff login and CSRF, run transactionally, and prevent marking trashed requests reviewed. This is recoverable deletion, not permanent erasure; backups retain requests as before.
