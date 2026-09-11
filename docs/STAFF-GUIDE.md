# Falmouth BID campaign manager

Open the app and choose **Staff login** in the footer. Use your individual account. If access needs resetting, contact the website administrator.

## Prepare a First Friday

1. **Campaigns → Add date.** Choose a month to fill its first Friday, or enter any other date. Set the display label and save. A draft date stays hidden; publish it when the event is announced.
2. **Businesses → Add business.** Add the name, description, full address and optional contact/booking links. Click the map or drag its pin to the venue entrance. If the map is unavailable, enter latitude and longitude. Optionally upload a photo and describe it in the image-description field. Preview, then set the business to Published and save.
3. **Offers → Add offer.** Choose its business, write the offer title and details, select all relevant categories, and configure Campaigns & hours. Leave “Set specific campaigns” unticked for all campaigns, or select existing campaigns and optionally enable Roll-over. Include booking instructions and conditions. Preview before saving as Published.
4. **View website.** Check the exact campaign date, find the offer in the list and map, and check its directions and booking links.

An offer only appears publicly when it, its business and its campaign date are all published, it has an active category, and it has not reached its end time. The website refreshes its data every 30 seconds. An offer with Food and Drinks tags appears once and can be found under either filter.

Times are UK local time, including daylight saving. An end time earlier than the start automatically means the next morning. It belongs to the campaign date on which it starts. Do not infer venue opening hours from an offer's hours.

## Reuse and update

Use the copy icon next to an offer to create a new draft with the same campaign settings and hours. Reconfirm its campaigns and terms before publishing. Different terms should be separate offers.

Edit a record to change its content or status. **Draft** and **Archived** are hidden from visitors. Archiving a business also hides its offers. Historical records remain available to staff. If someone else saved the same record while you were editing, the app refuses to overwrite their changes: copy your pending text, close/reopen the latest record and reapply the changes.

## Categories

Initial categories are Drinks, Food, Shopping, Entertainment and Experiences. Use Entertainment for cinema, music, shows, quizzes and games; Experiences for workshops, tours, tastings and creative activities. Select both if relevant. Add future categories such as Wellbeing or Stay only when a campaign needs them.

In Categories, staff can add, rename, reorder and deactivate entries, choosing an icon and approved colour. A published offer must retain at least one active category. Reassign offers before deactivating their only category. Categories without offers on the selected date are hidden from public filters.

## Images and links

Upload JPG, PNG or WebP files up to 8 MB and 24 megapixels. The system resizes and re-encodes uploaded images. An offer uses its own image when supplied; otherwise it uses the business image. With no photo, a branded category panel is shown. Use images you are authorised to publish and provide an informative image description. Use full `https://` website/booking links.

## Local preview

The yellow demo banner identifies the local preview. Its historical example offers, sample dates and approximate pins are for testing only. They are not included in the live release. Local preview credentials are kept in the ignored `private/local-access.txt` file, not in this guide or source control.

## Business submissions

Visitors can open Menu → Add your business and complete six steps: Business, Location, Offer, Campaigns, Photos, and Review & contact. The form captures the public profile/contact links, map coordinates, offer copy, categories, redemption, conditions, campaign selections and hours. Public submission descriptions are limited to 500 characters for the business and 250 for the offer. Existing staff editor limits are unchanged. Photos are optional and need descriptions and permission confirmation. Submissions are saved privately, with consent and received time. They do not publish a profile or send an email notification.

Open **Business submissions** in the staff area to read incoming applications. Contact the applicant as appropriate, expand **View business, offer and photos**, download any approved photos, and create approved profiles and offers through the existing editors, and use **Mark reviewed** to record that an application has been handled. Review this inbox regularly. Include submissions in the council/BID's agreed retention and privacy procedures; backups include these private records and their photos. Photos can only be viewed/downloaded while signed in.

## Staff accounts and the updated editor

Super-admins have a **Staff users** button. Create an invitation with a name and email, then share the generated private link directly with that person. No email is sent automatically. Links expire after 24 hours and work once; creating a replacement invalidates the old link. Accounts remain inactive until the recipient sets a password (12–200 characters). **Reset / activate access** issues a new link. **Disable account** immediately revokes sessions and any pending links. Normal admins can manage campaign content but cannot list or manage accounts. Super-admin recovery is performed by the server administrator with `scripts/user.php reset`, and the role is granted with `scripts/user.php promote email`.

Business and offer editors now have tabs. Dropdowns support searching, keyboard selection and scrolling. Discarding unsaved edits uses a styled confirmation; the browser still owns the warning when closing or reloading a dirty page.

New photo uploads are resized to at most 1800px wide and encoded as WebP at quality 82. Existing images are unchanged. Categories accept six-digit hex colours and simple SVG icons up to 100 KB. SVGs reject scripts, event handlers, external resources and unsupported elements; export outlined vector shapes. Check custom colours for readability on the public map and cards.

Campaign dates are managed centrally in **Campaigns** (for example November 2026 and December 2026). New offers default to **No dates set**, meaning all published campaigns, including campaigns created later. No campaign is generated automatically; one must exist and be published before an offer can appear.

Tick **Set specific campaigns** to select one or more existing campaigns. **Roll-over onto future campaigns** includes later published campaigns after the last selected campaign; it does not fill gaps between selected campaigns. Without roll-over, the offer stops appearing after its final selected occurrence. Hours are applied in UK local time, with an earlier end time meaning the next morning. The frontend automatically advances to the next upcoming campaign. Existing offers retain their explicit selections; unrelated edits preserve their original individual hours.

### Organising business requests

The submissions inbox is a table. Use View to inspect the application and Mark reviewed when handled. Delete asks for confirmation and moves the request to Trash. Open Trash and choose Restore to recover it with its original review status and photos. Deleting a request does not remove any separately created business or offer. Trash is retained until a separate permanent-retention process is agreed; it is not an erasure mechanism.
