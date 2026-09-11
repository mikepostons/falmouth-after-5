<?php
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/demo.php';
if(!demo())throw new RuntimeException('Local demo only.');
$date=record('dates','demo-friday');if(!$date)throw new RuntimeException('Missing sample date.');
db()->exec('BEGIN IMMEDIATE');
try {
 $snapshot=dataDir().'/campaign-before-'.date('Ymd-His').'.json';file_put_contents($snapshot,json_encode(['businesses'=>records('businesses'),'offers'=>records('offers')],JSON_PRETTY_PRINT));chmod($snapshot,0600);
 applyDemoCampaign($date['date']);db()->exec('COMMIT');echo "Published source set applied to sample preview date.\n";
}catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
