<?php
require __DIR__.'/../server/bootstrap.php';
if(PHP_SAPI!=='cli')exit;
$target=$argv[1]??'';
if(!$target||file_exists($target)){fwrite(STDERR,"Usage: php scripts/backup.php /private/path/new-backup-directory\nDestination must not exist.\n");exit(1);}
mkdir($target,0700,true);
// VACUUM INTO produces a consistent snapshot even when the source is open.
db()->exec('VACUUM INTO '.db()->quote($target.'/content.sqlite'));chmod($target.'/content.sqlite',0600);
mkdir($target.'/uploads',0700);foreach(glob(publicDir().'/uploads/*') as $file)if(is_file($file))copy($file,$target.'/uploads/'.basename($file));
file_put_contents($target.'/manifest.json',json_encode(['created_at'=>gmdate('c'),'demo'=>demo(),'schema'=>1,'includes'=>'database and uploaded media'],JSON_PRETTY_PRINT));
echo "Backup created. Store it privately; it contains staff password hashes.\n";
