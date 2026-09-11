# Supplied business images

Fourteen images from `RESOURCES/BUSINESSES` are assigned to local demo business profiles and included as optimised WebP assets. Original files are unchanged. Descriptive alt text is stored with each profile. New demo databases receive the same mapping from `server/demo-images.json`; `php scripts/import-demo-images.php` applies it to existing demo profiles only when their image is empty.

| Source | Business |
| --- | --- |
| harrys.jpg | Harry’s Taqueria (confirmed by client) |
| boathouse.jpg | The Boathouse |
| games-room.jpg | The Games Room |
| pennycomequick.avif | Pennycomequick |
| pocket-full-of-stones.jpg | Pocketful of Stones |
| windjammer.jpg | Windjammer |
| fives-cyder-house.jpg | Fives Cyderhouse |
| harbour-hights.webp | Harbour Lights |
| the-greebank.jpg | The Greenbank |
| the-grapes.jpeg | The Grapes |
| the-working-boat.jpg | The Working Boat |
| chainlocker.avif | Chain Locker |
| kernowine.webp | Kernowine |
| marchants-manor.jpg | Merchants Manor |

The client confirmed `harrys.jpg` is the correct image for Harry’s Taqueria; it is assigned despite the signage in the supplied photograph.

The four additional venue images were assigned when importing the published campaign offer list on 9 September 2026.

Verified the Pennycomequick image in the desktop right-hand panel and mobile top section (390 × 844). Images are shared by both frontend versions through the existing business-image fallback. Production releases include the assets but do not include the local demo database.
