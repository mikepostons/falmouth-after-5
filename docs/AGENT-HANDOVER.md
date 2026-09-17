# Agent handover — Falmouth After Five

Updated: 10 September 2026. This is a source-state handover, not a deployment certificate.

## Start here

The application repository is `APP/fal-after-5` within the wider Falmouth After Five workspace. Run commands from that repository, not the wider project folder. The organiser is Falmouth BID.

Read [the system devlog](devlogs/devlog.md) for architecture and storage, then inspect the relevant source before editing. Existing operational references are [STAFF-GUIDE.md](STAFF-GUIDE.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [VERIFICATION.md](VERIFICATION.md). Some older paragraphs in these documents predate recent changes; source and the current devlog take precedence when describing current behaviour.

Do not include credentials, configured tokens, account addresses, activation URLs, session data, submission details or private database contents in logs, responses, screenshots or commits unless the user specifically authorises a necessary disclosure. This handover intentionally contains none of those values.

## Current product decisions to preserve

- Keep both frontends. `?experience=app` is the current map-first design; the original `/` frontend remains available.
- The public app shows the next upcoming campaign automatically. Do not reintroduce public campaign-date selectors without a request.
- The desktop list overlays the map/logo. Mobile list mode covers the main map controls.
- Desktop business selection focuses the map before opening details. Mobile details are drawers with drag-to-close.
- Staff access is at `?admin`, with separate accounts and a super-admin role. Do not replace it with a shared hard-coded login.
- Admin offer search matches business names and titles.
- Business/offer editor headers hold tabs and Save/Cancel actions. No editing eyebrows, last-saved line or preview buttons.
- Business tabs use two columns on desktop and stack on mobile. Publication status appears only in Details/Offer.
- Photo tabs use `PhotoDropzone.jsx`; uploads are WebP-encoded server-side.
- Campaign dates are managed centrally. New offers default to all published campaigns. Specific selections and roll-over are optional. Roll-over starts after the last selected campaign, not between selected campaigns.
- Existing legacy offers retain explicit dates/hours during unrelated edits. Avoid accidentally broadening those offers to every campaign.

## Files to change for common tasks

| Task | Start with |
| --- | --- |
| Public app layout/search/filter/menu controls | `src/AppExplorer.jsx`, `src/app-explorer.css`, `src/ExplorerMenu.jsx` |
| Shared business details or original frontend | `src/main.jsx`, `src/style.css` |
| Camera, clusters, tooltips or location picker | `src/MapView.jsx` |
| Staff editors and table search | `src/Admin.jsx`, `src/style.css` |
| Staff dropdowns / photo interactions | `src/AdminSelect.jsx`, `src/PhotoDropzone.jsx` |
| User management / activation UI | `src/AdminUsers.jsx` |
| Authentication, permissions, API routes, uploads | `public/api.php`, `server/bootstrap.php` |
| Campaign visibility / roll-over | PHP `offerOccurrences()` and `publicContent()`, JS `src/domain.js`, admin scheduling controls |
| Production contents | `scripts/package.php`, `.env.example`, public entry and upload restrictions |
| Demo content provenance | `server/demo-*.json`, `scripts/import-demo-*.php`, content-source docs |

## Safe working procedure

1. Inspect `git status` and any applicable repository instructions. The workspace has accumulated uncommitted changes; do not reset, clean or overwrite unrelated work.
2. Do not read `.env` or private account files merely to discover settings. Use `.env.example` for configuration names. Read private values only when needed for an explicitly authorised task, without printing them.
3. Make focused source edits. Do not edit generated `public/build/` or historical release directories.
4. Run checks proportionate to the change. Build after frontend edits. Use domain/API tests for scheduling, authentication, permissions or upload changes.
5. Check layouts at desktop and mobile sizes when changing responsive UI. Use current browser state rather than assuming old tab IDs or screenshots remain valid.
6. Discard test content edits and avoid creating uploads/accounts in the working dataset when isolated fixtures can be used.
7. Report exactly what changed, what was verified and what remains uncertain. Do not imply deployment or a security certification.

## Local commands

```bash
npm ci
npm run build
npm run preview
```

The PHP preview normally uses port 8787. A server may already be running; inspect before starting another. Vite development mode is `npm run dev` and proxies API calls to PHP. A PHP-preview browser needs a fresh build to show source changes.

```bash
npm test
npm run check:php
npm run test:http
npm run test:package
node tests/map-picker.mjs
```

HTTP/package tests use temporary databases and ports 8788/8789. Restricted environments may need local-network permission. The map test uses installed Chrome, a local map style and a local demo account, and discards changes. External Mapbox tile loading previously made a headless test unreliable; the local-style test isolates actual marker and click behaviour. Do not remove attribution or weaken production settings to make a test pass.

The picker must not recreate its draggable marker on every idle frame. Maintain the resize handling when editing layout or tab visibility.

## Data and security boundaries

- Private: configuration, SQLite files, PHP session storage, token hashes, account information, submissions and backups.
- Public: built frontend, approved static assets, uploaded media and filtered public campaign data.
- The provider's public map token is browser-visible by design, but its actual value must stay out of source and handover documents.
- Server-side validation and role checks remain authoritative; hiding UI controls is not an access-control mechanism.
- Preserve optimistic-concurrency checks and transaction boundaries.
- Setup/reset links are single-use, expire in 24 hours and are manually shared. No email provider is configured. Super-admin recovery/promotion uses the CLI.
- Photo and SVG validation are intentionally separate. Do not allow raw SVG markup into React HTML or arbitrary file paths into record images.
- Do not deploy the private runtime or data under a website document root.

## Verification history and remaining limitations

Previously completed checks include domain/contrast tests, PHP syntax checks, API security/upload/backup checks, nested-path release checks and actual Mapbox marker drag/click tests with a local style. Campaign tests cover selected dates, gaps, expiry, future campaigns, overnight hours, unpublished campaigns and centrally edited dates.

The most recent business-column/drop-zone changes were built and visually checked. A real drag/drop upload round-trip was not newly exercised after replacing the file input. Use an isolated upload test when changing that component further. Existing backend upload tests cover conversion and unsafe-file rejection.

Potential follow-up work, only when relevant to the next request:

- Bring older deployment/staff-guide paragraphs into line with the current UI, camera and scheduling rules.
- Add focused UI coverage for the new drop zone, campaign controls, validation across hidden tabs and user-management screens.
- Review deployment SVG headers after restore: `scripts/restore.php` recreates basic upload restrictions but does not currently reproduce all SVG-specific headers.
- Plan migrations explicitly; the current bootstrap performs limited additive schema setup, not a full migration framework.
- Consider orphan-media cleanup and a fuller audit trail if requested. Neither exists now.
- Consolidate repeated CSS overrides carefully after visual regression checks; do not treat earlier rules as authoritative without checking later overrides.
- Review local demo business content and imagery against approved live campaign information before deployment. Historical offers are not current availability guarantees.

## Packaging and delivery

Run `npm run package` to generate a fresh matched frontend/backend ZIP, then validate it. Existing ZIPs are snapshots and may predate recent editor changes. Preserve deployed `.env`, database, uploads and configured `bootstrap-path.php` during upgrades. Back up first and use the documented offline restore procedure if rollback is required.

The package script copies an explicit document allowlist. `docs/devlogs/devlog.md` and this handover currently remain repo-only; do not assume they ship in release ZIPs. No production deployment, email delivery service, scheduled backup job or monitoring automation is established by this handover.

## Continuing the devlog

Append dated entries to `docs/devlogs/devlog.md` for material changes. Record the user-visible behaviour, files touched, data compatibility, checks actually run and unresolved follow-ups. Never paste credentials, private links, full API/session dumps or database exports into a devlog.

### Public submission wizard (10 September 2026)

`BusinessSubmission.jsx` is a six-step public form mounted from `ExplorerMenu.jsx`, with MapView picker and local image preparation in `submission-image.js`. It submits JSON (`data`) and up to two WebP files in one multipart request; no public staging upload endpoint exists. Server `validateSubmission` constructs allowed business/offer fields, with public-only 500/250 description limits. `submit-business` retains CSRF, adds attempt throttling, validates/re-encodes images and stores them in `dataDir()/submission-images/` outside the public root. The staff-only `submission-image` route resolves the record and slot instead of accepting file paths. `SubmissionDetails.jsx` presents complete submissions and photo downloads in admin; reviewed status still does not create or publish records. Backup/restore now includes private photos. Old stored submissions remain readable; the former minimal incoming submission payload is superseded. `tests/submission-ui.mjs` exercises the local mobile form with a mocked submission response and never saves content. HTTP tests use an isolated database for security/upload checks.


### Website settings (14 September 2026)

`src/AdminSettings.jsx` and `src/site-copy.js` manage editable public copy; authenticated `settings` API persists to the SQLite settings/site record. Only super-admins may change GA4 configuration. Pasted snippets are reduced to validated measurement IDs, never executed verbatim. `main.jsx` loads Google tags in head only with consent outside demo/admin, and shows the notice after ten seconds of map view after intro. See the devlog for deployment and validation details.


### Krystal deployment (15 September 2026)

Initial production app and client data installed at `/home/deepmedi/fal-after-5.falmouth.co.uk`; public document root is its `public/` child. SSH connection uses the user-authorised local key, account deepmedi, host 77.72.2.42, port 722. No secrets in docs. Production storage is private/content.sqlite. Do not repeat the initial data upload for code updates. HTTP origin checks pass; DNS and valid HTTPS certificate are still pending. See latest devlog entry before continuing cutover.
