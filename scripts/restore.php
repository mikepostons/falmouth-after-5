<?php
require __DIR__.'/../server/bootstrap.php';
if(PHP_SAPI!=='cli')exit;
$from=$argv[1]??'';
if(!$from||!is_file($from.'/content.sqlite')||($argv[2]??'')!=='--confirm-offline'){fwrite(STDERR,"Usage: php scripts/restore.php /private/backup --confirm-offline\nTake the app offline and stop staff writes first. Existing files are retained as a pre-restore copy.\n");exit(1);}
$manifest=json_decode(file_get_contents($from.'/manifest.json'),true);if(!$manifest||($manifest['demo']??null)!==demo()){fwrite(STDERR,"Backup mode does not match this environment.\n");exit(1);}
$source=new PDO('sqlite:'.$from.'/content.sqlite');if($source->query('PRAGMA integrity_check')->fetchColumn()!=='ok'){fwrite(STDERR,"Backup failed integrity check.\n");exit(1);}$source=null;
$target=dataDir().(demo()?'/demo.sqlite':'/content.sqlite');$stamp=date('Ymd-His').'-'.bin2hex(random_bytes(3));
if(is_file($target))rename($target,$target.'.before-restore-'.$stamp);
if(!copy($from.'/content.sqlite',$target))throw new RuntimeException('Could not install restored database.');chmod($target,0600);
$uploads=publicDir().'/uploads';if(is_dir($uploads))rename($uploads,$uploads.'.before-restore-'.$stamp);mkdir($uploads,0755,true);
foreach(glob($from.'/uploads/*') as $f)if(is_file($f))copy($f,$uploads.'/'.basename($f));
file_put_contents($uploads.'/.htaccess',"Options -Indexes -ExecCGI\n<FilesMatch \"\\.(php[0-9]?|phtml|phar|cgi|pl|html|svg)$\">\nRequire all denied\n</FilesMatch>\n");
echo "Backup restored. Verify content and staff access before reopening the app.\n";
