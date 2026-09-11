# Build verification

Verification record, 9 September 2026. This describes local software verification, not a production deployment or client acceptance sign-off.

## Automated checks

- `npm test`: seven JavaScript domain/contrast tests and fourteen PHP checks pass. They cover First Friday selection, category OR matching without duplicates, text/date/category combination, UK calendar dates, overnight expiry, draft privacy, publication, stale-write conflicts, category deactivation constraints, venue archiving, invalid dates/coordinates/URLs, and SQLite snapshot integrity.
- `npm run test:http`: isolated PHP server and fresh database. Checks staff sign-in, anonymous access rejection, CSRF enforcement, publication visibility, multi-category data, overnight offsets, stale writes, invalid upload rejection, image re-encoding, media backup, password changes, logout and login throttling. Includes two independent staff sessions attempting conflicting edits, and actual backup/restore commands with media. All checks passed.
- `npm run build`: production frontend builds successfully. Mapbox is a separate, lazily loaded chunk; its size warning is expected and does not block the list or welcome screen.

## Browser checks performed

- Desktop welcome and map/list layouts visually reviewed in the Codex browser.
- Actual Mapbox map loaded using the configured public token, with 48-degree pitch, category markers, marker groups and required attribution.
- Food + text search for Pennycomequick produced exactly one offer and one matching Food marker.
- Offer detail showed date/time, terms, business information and an external directions URL.
- Escape closed the detail dialog; switching to List preserved filters; an unmatched search displayed the empty state.
- Staff sign-in, sign-out and immediate re-login succeeded using a temporary local QA account. The QA account was disabled and its test draft removed after verification.
- Duplicating an offer preserved its content/categories while clearing dates and using Draft status. Added a date, previewed the content, saved the draft and confirmed it appeared in the staff list.

- Mobile welcome, list and map layouts reviewed at 390 CSS pixels; the headline was adjusted to avoid an isolated final word. Mobile offer details use a bottom sheet.
- Actual 3D buildings verified after zooming to street level in Falmouth.
- Grouped map pins activate with Enter and expose every matching venue offer.
- Business map clicks update latitude/longitude. The test movement was discarded without changing the saved location.
- Map-unavailable preview verified with a separate local server and no token: the 15 demo offers remain accessible.
- Development server verified with the PHP API proxy and local logo assets.
- Privacy policy link checked against the official website and corrected to `/information/privacy-policy/`.
- `npm run check:php`: all application, script and test PHP files pass syntax checks.
- `npm run test:package`: release smoke test passed under `/discover-falmouth/falmouth-after-5/app/`. Built assets and direct-link refresh work; a fresh production API contains five categories and zero demo offers; staff endpoints reject plain HTTP; private runtime/data are outside the public document root.
- Release files were scanned against the configured token without printing it. The archive excludes the token, `.env`, local accounts, SQLite files and demo seeding code.

## Requirement coverage

| PRD requirement              | Implementation and evidence                                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-01 Welcome/navigation     | Both entry actions, list/map switch and query-string offer links; desktop/mobile browser checks.                                                                                                                                                               |
| P0-02 Date selection         | Published dates, UK today/next selection, empty and expired states; date/overnight tests.                                                                                                                                                                      |
| P0-03 Search/filter          | Shared `matchingOffers` function, category OR and search/date AND, unique offers and empty state; unit/browser checks.                                                                                                                                         |
| P0-04 Map parity             | Map consumes the same matching offer array as the list, groups close/overlapping venue pins and labels category rings; browser filter/group/keyboard checks.                                                                                                   |
| P0-05 Details/links          | Reusable detail view, images, terms, dates, address and optional directions/booking/website/phone links; rendered detail and HTTP image checks.                                                                                                                |
| P0-06 Staff access           | Individual hashed-password accounts, session validation, CSRF, throttling and no public registration; two-account HTTP tests.                                                                                                                                  |
| P0-07 Business editing       | Form, map placement, preview, publishing validation and archive; UI and domain/HTTP checks.                                                                                                                                                                    |
| P0-08 Offer editing          | Multi-offer businesses, draft/preview/publish/archive, duplication and 30-second public refresh; UI/domain/HTTP checks.                                                                                                                                        |
| P0-09 Schedules              | Explicit UK occurrences, overnight boundaries, invalid/DST date rejection and expiry; domain/HTTP tests.                                                                                                                                                       |
| P0-10 Editing reliability    | Server validation, retained editor state on errors, version conflict rejection and recorded editor/time; stale-write and independent-session tests.                                                                                                            |
| P0-11 Fallback/accessibility | Map-independent list, native labelled controls/dialogs, keyboard marker activation, contrast palette, reduced-motion CSS and missing-map browser check. Formal client accessibility acceptance remains a launch review; no full WCAG certification is claimed. |
| P0-12 Package/operations     | Clean ZIP, private runtime configuration, nested-path smoke test, account/check/backup/restore scripts and handover guides. Actual host acceptance is required before deployment.                                                                              |
| P0-13 Categories             | Managed categories, multiple offer assignments, colour/icon/order and deactivation validation; domain/HTTP checks and staff forms.                                                                                                                             |

P1 geolocation, a dedicated share button and bulk date duplication remain deferred as agreed in the short-launch PRD. Stable offer URLs already exist. Optional GA4 integration is implemented but is inactive until an approved property is configured; external GA reporting has not been tested without that property.

## Release boundaries

No production URL, hosting account or GA4 property has been configured. Host-specific HTTPS, private storage, URL routing and access checks remain deployment acceptance steps. Demo offers and coordinates are not approved live content. Falmouth BID needs to approve the next campaign dates, offers, terms, images and venue pins and nominate staff and maintenance owners before public launch.

## Alternative map-first frontend (9 September 2026)

`?experience=app` adds a separate full-viewport map interface; the default frontend and shared staff CMS remain available. Verified locally in the browser at desktop, 820 × 1180 tablet and 390 × 844 phone sizes: floating list/sidebar, mobile bottom sheet, category popover, Escape dismissal, combined Food + Shopping filters (9 demo offers), search for Penny (1 result), offer detail and directions. Mapbox rendered with the existing 48-degree pitch; the same map stays mounted when toggling the list. Category selection updates pins and list together. Production build, 7 JavaScript tests, 14 PHP domain/backup checks and `git diff --check` passed. This addition has not been deployed to the public website.

### Map-first refinement

Replaced the app logo with the supplied SVG; removed the filter heading, apply button, bottom-left count and separate info control. Map settings replace the categories inside the same popover. Browser checks confirmed 2D/3D controls, cluster expansion from zoom 14.8 to individual pins at zoom 19 while retaining the 48-degree pitch, direct single-offer opening, desktop right-third media placeholder and mobile top media section at 390 × 844. Uploaded images use the same area; demo venues without images display an explicit placeholder. Map idle redraw handles tile loading after camera changes. Existing tests and the production build passed.

### Focus styling and location audit

Replaced brown 3px outlines with compact 2px brand-blue focus rings, including both search layouts and staff colour choices. Filled controls retain a white separation ring for keyboard visibility. Browser checks confirmed the search ring and Tab focus on the popup directions link. All 15 local demo locations match `server/demo-locations.json`; all 9 supplied business images remain attached. Mangos directions retain the exact supplied coordinates. See `BUSINESS-LOCATIONS.md` for per-venue sources, Windjammer's unresolved entrance precision and The Orgia's trading-status question. Existing JavaScript and PHP domain/backup tests passed.

### Split logo panel

The map-first desktop brand panel now pairs the supplied logo on white with “Rediscover Falmouth After Dark” in self-hosted Yellowtail script on dark blue-grey, rotated -8 degrees. The desktop sidebar starts at 160px, leaving approximately 29px below the panel. Mobile hides the tagline and spaces the search below the logo. Browser screenshots checked the desktop composition, narrow desktop fit and 390 × 844 mobile layout. The font’s Apache licence is included in third-party notices.

## Admin update — September 2026

- Built frontend successfully; PHP syntax checks passed.
- Eight JavaScript domain tests and PHP domain/backup checks passed, including new SVG rejection and custom hex colour cases.
- HTTP integration suite passed for WebP uploads, SVG upload/category persistence, role enforcement, invitation rotation, single-use activation, account disable/session revocation, password changes, CSRF, throttling and private-data protection.
- Business dropdown filtering and styled discard dialog verified in the app browser.
- Business map visually inspected with the live Mapbox style. `node tests/map-picker.mjs` verified drag and click coordinate updates with a local Mapbox style to avoid external tile dependencies. All test edits were discarded. This local-only check requires installed Chrome and the local preview account.
- Picker now starts centred on the business and avoids recreating the draggable marker on idle frames.
