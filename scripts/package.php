<?php
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);$out=$root.'/release/falmouth-after-five-'.date('Ymd-His');
mkdir($out.'/site',0755,true);mkdir($out.'/runtime/server',0755,true);mkdir($out.'/runtime/scripts',0755,true);
function copyTree($from,$to){if(!is_dir($to))mkdir($to,0755,true);foreach(new DirectoryIterator($from) as $f){if($f->isDot()||$f->getFilename()==='.DS_Store')continue;$dest=$to.'/'.$f->getFilename();if($f->isDir())copyTree($f->getPathname(),$dest);else copy($f->getPathname(),$dest);}}
copyTree($root.'/public/build',$out.'/site/build');copyTree($root.'/public/assets',$out.'/site/assets');mkdir($out.'/site/uploads');copy($root.'/public/uploads/.htaccess',$out.'/site/uploads/.htaccess');
foreach(['api.php','index.php','.htaccess'] as $f)copy($root.'/public/'.$f,$out.'/site/'.$f);
// Runtime path is configured during installation; no credentials or local database are packaged.
file_put_contents($out.'/site/bootstrap-path.php',"<?php\n// Set to the absolute runtime folder OUTSIDE the website document root.\nreturn '/set/private/path/to/falmouth-after-five-runtime';\n");
copy($root.'/server/bootstrap.php',$out.'/runtime/server/bootstrap.php');
foreach(['user.php','backup.php','restore.php','check.php'] as $f){if(!is_file($root.'/scripts/'.$f))throw new RuntimeException('Missing release script: '.$f);copy($root.'/scripts/'.$f,$out.'/runtime/scripts/'.$f);}
copy($root.'/.env.example',$out.'/runtime/.env.example');copy($root.'/.htaccess',$out.'/runtime/.htaccess');
foreach(['DEPLOYMENT.md','STAFF-GUIDE.md','VERIFICATION.md','THIRD-PARTY-NOTICES.txt'] as $f){if(!is_file($root.'/docs/'.$f))throw new RuntimeException('Missing release document: '.$f);copy($root.'/docs/'.$f,$out.'/'.$f);}
copy($root.'/package-lock.json',$out.'/dependency-lock.json');
$files=[];$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($out,FilesystemIterator::SKIP_DOTS));foreach($it as $f)if($f->isFile())$files[str_replace($out.'/','',$f->getPathname())]=hash_file('sha256',$f->getPathname());ksort($files);file_put_contents($out.'/SHA256.json',json_encode($files,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
$zip=new ZipArchive();$zip->open($out.'.zip',ZipArchive::CREATE|ZipArchive::OVERWRITE);$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($out,FilesystemIterator::SKIP_DOTS));foreach($it as $f)if($f->isFile())$zip->addFile($f->getPathname(),substr($f->getPathname(),strlen($out)+1));$zip->close();echo $out.".zip\n";
