# Falmouth After Five

A responsive Mapbox offers explorer and PHP/SQLite campaign manager for Falmouth BID.

## Local preview

Requirements: Node 20.19+ or a compatible newer release, PHP 8.2+ with PDO_SQLITE, GD and mbstring.

```bash
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:8787/`. Staff area: `http://127.0.0.1:8787/?admin`.

Two frontend options share the same API, offers and staff CMS:

- Original webpage: `/` (unchanged default).
- Map-first app: `/?experience=app`; add `&view=list` to open its floating offers panel. The app opens directly on the full-screen map, with a desktop/tablet sidebar and mobile bottom sheet. Filters open above the bottom controls. The logo button reveals campaign, privacy and original-version links. The filter menu switches to map settings for 2D/3D and reset. Clustered pins zoom in; coincident pins fan out at street scale. App offer details reserve the right third for imagery, moving it above the content on phones.

Copy `.env.example` to `.env` when setting up a fresh checkout. For local demonstration set `APP_ENV=development` and `DEMO_MODE=true`. Put a public Mapbox token after `MAPBOX_PUBLIC_TOKEN=`. `.env` and `private/` are ignored by Git; secrets must never be committed. Public Mapbox tokens are necessarily visible to the browser.

Run `php scripts/local-access.php` once in demo mode to generate a local staff account. Its credentials are written to `private/local-access.txt` and are not printed. That account and all sample content are absent from the production release.

For frontend development, start the PHP preview server first, then run `npm run dev`. Vite proxies API calls to port 8787. Production uses the built assets and PHP only.

## Verification and release

```bash
npm test
npm run test:http
npm run check:php
npm run package
```

HTTP tests start a separate loopback server on port 8788 and use an isolated temporary database. The release ZIP is written under `release/`; it contains public files and a separate private runtime, with no database or credentials.

- [Deployment and operations](docs/DEPLOYMENT.md)
- [Staff guide](docs/STAFF-GUIDE.md)
- [Verification record](docs/VERIFICATION.md)
- [Working PRD](../../Falmouth-After-Five-PRD.md)

## Structure

- `src/`: React public explorer, staff UI, map and shared domain logic.
- `public/`: PHP entrypoints, built assets and uploaded media.
- `server/`: configuration, SQLite persistence, validation, public projection and local sample data.
- `scripts/`: local preview, account setup, backup, restore, host check and packaging.
- `tests/`: domain and HTTP integration coverage.
- `private/`: ignored local configuration state, SQLite and preview credentials.

SQLite stores versioned content records with validated business/date/category references. Server transactions protect updates and reject stale editor versions. Published data is projected into a public response without staff metadata; expiry is applied against UK time in the explorer. There is no public registration, payment handling or booking engine.

Initial categories: Drinks, Food, Shopping, Entertainment and Experiences. Staff can add, rename, reorder and deactivate categories. Offers may use multiple categories.
