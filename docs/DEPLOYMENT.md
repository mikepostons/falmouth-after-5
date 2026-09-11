# Falmouth After Five: installation and operations

## What is delivered

A built React interface and a PHP/SQLite application. Node is used only to build the interface locally; the website server needs PHP, not Node or a database service. The release ZIP contains `site/` (public files) and `runtime/` (private backend/configuration). No Mapbox token, staff credentials, demo data or live database is included.

The local app is a preview with 15 historical example offers and approximate map positions. These are clearly labelled and stored in `demo.sqlite`. Production uses a separate `content.sqlite` and starts with five categories and no businesses or offers.

## Host requirements

- PHP 8.2 or newer with PDO_SQLITE, mbstring, GD, fileinfo and sessions.
- HTTPS with PHP receiving `HTTPS=on`. If TLS terminates at a proxy, the host must set the trusted server variable; the app deliberately does not trust arbitrary forwarded headers.
- A private directory outside the entire website document root, writable by PHP, with local persistent storage and SQLite file locking. A directory on a network filesystem or an ephemeral deployment filesystem is unsuitable.
- A writable `uploads/` directory in the public app, configured to serve images and never execute scripts. Apache rules are included; an Nginx host must configure the equivalent restrictions.
- PHP upload limits: `upload_max_filesize=8M`, `post_max_size=10M` or higher; a suitable memory limit for image re-encoding, recommended 256M.

## Install at the proposed campaign URL

Target: `https://www.falmouth.co.uk/discover-falmouth/falmouth-after-5/app/`.

1. Upload the **contents** of `site/` into the website's `discover-falmouth/falmouth-after-5/app/` directory. Preserve dotfiles. The existing promotion page can link to this URL.
2. Upload `runtime/` to a private location outside the website document root, for example `/home/account/falmouth-after-five-runtime`. This is a folder containing files, not a separate database service.
3. Edit the public `bootstrap-path.php` to return the absolute path from step 2.
4. Copy private `.env.example` to `.env`. Set `APP_ENV=production`, `DEMO_MODE=false`, `APP_DATA_DIR` to a private persistent data directory and `APP_PUBLIC_DIR` to the absolute public app directory. Set `MAPBOX_PUBLIC_TOKEN` to a public `pk.` token. Set `MAPBOX_STYLE` to the approved Mapbox style. Keep `.env` private and readable only by its owner/PHP as required by the host.
5. In the private runtime directory, run `php scripts/check.php`. This verifies PHP extensions, data storage, upload storage, configuration and built assets. The first request or command creates the SQLite schema automatically.
6. Create each of the two staff accounts with `php scripts/user.php create editor@example.org 'Editor name'`. Enter the password when prompted; it is not printed. Use the real nominated email addresses. No default production account exists.
7. Open the app URL and its `?admin` staff area. Confirm login, create a draft business, upload an image, place its map pin and preview it. Then add a campaign date and offer. Publishing the offer requires a published business and date for public visibility.
8. Verify that `.env`, runtime scripts, SQLite files, journal files and backup folders cannot be fetched over HTTP. They should be outside the document root. Confirm image directories do not execute scripts and directory listings are disabled.
9. Confirm assets, API requests and offer links work under the complete `/app/` path, including refresh. The app uses query-string routing, so no SPA rewrite or WordPress route change is required. The host must let the real `/app/` directory take precedence over any catch-all CMS routing.

For `https://fal-after-5.falmouth.co.uk/`, configure DNS and HTTPS and use the `site/` directory as the subdomain's document root. The private runtime directory must still be outside the web-accessible root. The app uses relative URLs and requires no frontend rebuild to change between these locations.

A single upload entirely inside a public folder is intentionally not the default installation: SQLite, sessions and account data need private storage. The private directory is the one host setup step beyond uploading the public package.

## Mapbox

The frontend receives only the public token through the public API. It is visible to visitors by design; `.env` keeps it out of source control, not out of the browser. Never use an `sk.` token. Configure URL restrictions in Mapbox for the chosen production URL and separately for any staging/local preview URL. Keep Mapbox attribution visible. The map is loaded only when opened, reducing unnecessary map initialisations.

The implementation uses Mapbox Standard by default, a 48-degree pitched view, category markers, overlapping-marker groups, 2D/3D switching and reset controls. Building detail depends on Mapbox coverage and zoom. Staff should verify the actual entrance location of every venue before launch. Example map positions are not verified venue coordinates.

## Google Analytics

`GA_MEASUREMENT_ID` is optional. Set it to the approved GA4 `G-…` measurement ID to enable the analytics choice. Nothing is loaded until the visitor allows analytics; the choice is saved locally and can be changed in Privacy & cookies. Demo and staff views do not initialise app analytics.

Events: `explorer_open`, `view_change`, `category_filter`, `offer_view`, `directions_click`, `booking_click`, `website_click`. The app sends selected campaign date IDs and relevant business/offer/category IDs, never raw search strings or visitor location. Before production, verify the Falmouth website's consent integration and existing analytics setup so the same event/page view is not tracked twice. Approve the privacy copy and register event parameters as custom dimensions where required for reporting. No GA property has been created or configured by this build.

## Updates

Run `npm ci` and `npm run package` locally to create a new release. Back up the current database and uploads before updating. Replace `site/build/`, `site/index.php`, `site/api.php` and the backend scripts as a matched release. Preserve the installed `bootstrap-path.php`, private `.env`, data directory and `uploads/`. Do not replace the live database with a local/demo database. Keep the previous code release for rollback. Retain old hashed asset files briefly if visitors may have older pages open, then remove obsolete assets after the rollout window.

The current schema is version 1. Changes to stored content or schema in future releases must include an explicit migration and rollback plan; merely uploading new code is not a data migration.

## Backup and restore

Run from the private runtime:

```bash
php scripts/backup.php /private/backups/faf-2026-09-11
```

The destination must not already exist. The command uses SQLite `VACUUM INTO` for a consistent database snapshot and copies uploaded media. Store backups privately: they include staff password hashes. Suggested operating policy for Falmouth BID to approve: daily backups, a backup before every release, 30 days of retention and one off-server encrypted copy. Assign a named owner; the build does not create a scheduled backup job.

To restore, take the app offline and stop staff writes, then run:

```bash
php scripts/restore.php /private/backups/faf-2026-09-11 --confirm-offline
```

It validates database integrity and environment mode, retains the current database and uploads as pre-restore copies, then installs the snapshot. Review content, uploaded images and account access before reopening. A demo backup cannot be restored into production. Keep retained pre-restore copies private or remove them after verification; any media copies under the public directory contain previously public images.

## Staff account maintenance

- Reset: `php scripts/user.php reset editor@example.org`, then enter the new password securely. This invalidates existing sessions for that account.
- Disable: `php scripts/user.php disable editor@example.org`.
- Staff can change their own password in the app's account settings.
- Login attempts are limited per IP over a 15-minute window. After ten failed attempts, wait 15 minutes before retrying.
- Inactive sessions expire after two hours. There is no public account registration or email password-reset dependency.

## Before public launch

Confirm the final URL, service-account ownership, privacy/analytics integration, HTTPS and private storage. Verify all business addresses and pins, authorised imagery, approved offers, exact dates/times and conditions. Nominate both staff users and the backup/maintenance owner. The provisional 11 September launch is an app launch target, not evidence that historical offers are valid on that date.

### Staff access and image requirements

PHP GD must support WebP encoding; PHP DOM is required for safe SVG validation. Run `php scripts/check.php` on the server. After creating Mike's account with `scripts/user.php create mike@3deepmedia.com Mike`, grant its role with `php scripts/user.php promote mike@3deepmedia.com`. All other accounts default to ordinary admins. Staff invitations and reset links are generated in the super-admin UI and shared manually, with no email integration required. They expire in 24 hours. Do not include account-link query strings in analytics or logs. Configure the web server to redact query strings for staff URLs. Serve uploads with `nosniff` and SVGs with a restrictive CSP; deploy the provided uploads `.htaccess` for Apache, or equivalent rules for other servers.

## Public submission wizard and private photos

The public form now submits a multipart request with JSON in `data` and optional `business_image` / `offer_image` WebP files. Allow at least 5 MB request bodies (`post_max_size` and reverse-proxy limits) and at least 2 MB per uploaded file (`upload_max_filesize`); existing 8 MB staff-upload settings are sufficient. GD with WebP decoding/encoding is required. The server re-encodes images, generates filenames and stores them under `APP_DATA_DIR/submission-images/`, outside the public document root. The runtime creates this directory with restricted permissions. Do not expose this folder as a static URL. Staff retrieve images through an authenticated API endpoint.

Updated backup/restore scripts include private submission photos. Submissions remain private until staff create and publish approved CMS records; marking a submission reviewed does not publish it. No email notifications or email verification are sent. Before launch, agree who reviews submissions and how long rejected/unused applications and photos should be retained. Per-IP submission/attempt throttles and a honeypot are included; a managed anti-bot challenge can be added if public abuse requires it. Keep PHP/GD patched. Upload and input checks follow layered guidance from the [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) and [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).

## Direct repository deployment

When pointing the host document root at the repo's `public/` directory, keep `.env` and `private/` in the repo root outside that document root. Retain the repo-root `Require all denied`. The public `.htaccess` must include `Require all granted` outside its FilesMatch block to override the inherited parent denial; dotfiles remain denied. Without this override, Apache-compatible hosts can return 403 for the whole app. Configure environment paths for the actual host rather than copying local workstation paths.
