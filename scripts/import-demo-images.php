<?php
// Add supplied photos to existing local demonstration profiles without replacing staff images.
require __DIR__.'/../server/bootstrap.php';
if (!demo()) throw new RuntimeException('This importer only supports the local demonstration database.');
$images=json_decode(file_get_contents(__DIR__.'/../server/demo-images.json'),true,512,JSON_THROW_ON_ERROR);
db()->exec('BEGIN IMMEDIATE');
try {
    foreach(records('businesses') as $business) {
        if (!isset($images[$business['name']]) || !str_starts_with($business['id'],'demo-venue-') || $business['image']) continue;
        $image=$images[$business['name']];
        if (!is_file(publicDir().'/'.$image['image'])) throw new RuntimeException('Missing image for '.$business['name']);
        rawSave('businesses',array_merge($business,$image),'local-photo-import');
        echo $business['name']." updated\n";
    }
    db()->exec('COMMIT');
} catch(Throwable $e) { db()->exec('ROLLBACK'); throw $e; }
