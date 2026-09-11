<?php
if (PHP_SAPI !== 'cli') exit;
require __DIR__.'/../server/bootstrap.php';
if (!demo()) throw new RuntimeException('This importer only supports the local demonstration database.');
$locations=json_decode(file_get_contents(__DIR__.'/../server/demo-locations.json'),true,512,JSON_THROW_ON_ERROR);
db()->exec('BEGIN IMMEDIATE');
try {
    $before=records('businesses');
    $snapshot=dataDir().'/locations-before-'.date('Ymd-His').'.json';
    file_put_contents($snapshot,json_encode($before,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));chmod($snapshot,0600);
    foreach($locations as $id=>$location) {
        $business=record('businesses',$id);
        if (!$business) throw new RuntimeException('Missing demo business '.$id);
        foreach(['name','address','lat','lng'] as $key) $business[$key]=$location[$key];
        $business['description']=str_replace('Demo profile: address and map pin require verification before publication.','Demo profile: campaign participation and offers require confirmation before publication.',$business['description']);
        rawSave('businesses',$business,'location-audit');
        echo $business['name']." updated\n";
    }
    db()->exec('COMMIT');
} catch(Throwable $e) { db()->exec('ROLLBACK');throw $e; }
