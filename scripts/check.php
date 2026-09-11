<?php
require __DIR__.'/../server/bootstrap.php';
if(PHP_SAPI!=='cli')exit;
$ok=true;function report($pass,$message){global $ok;$ok=$ok&&$pass;echo ($pass?'PASS: ':'FAIL: ').$message.PHP_EOL;}
report(version_compare(PHP_VERSION,'8.2','>='),'PHP 8.2 or newer');foreach(['pdo_sqlite','mbstring','gd','fileinfo','dom'] as $ext)report(extension_loaded($ext),'PHP extension '.$ext);
report(function_exists('imagewebp'),'GD WebP encoding support');
try{db();report(true,'SQLite initialised in private storage');report(is_writable(dataDir()),'Private storage writable');}catch(Throwable $e){report(false,$e->getMessage());}
report(is_dir(publicDir().'/uploads')&&is_writable(publicDir().'/uploads'),'Public uploads directory configured and writable');
report(str_starts_with(envv('MAPBOX_PUBLIC_TOKEN'),'pk.'),'Public Mapbox token configured (value hidden)');
report(envv('APP_ENV')==='production'&&!demo(),'Production mode; demo content disabled');
report(is_file(publicDir().'/build/index.html'),'Built frontend present');
echo "Also verify HTTPS, URL restrictions, privacy integration and file access on the actual web host.\n";exit($ok?0:1);
