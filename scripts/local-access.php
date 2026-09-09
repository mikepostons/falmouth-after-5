<?php
require __DIR__.'/../server/bootstrap.php';
if(PHP_SAPI!=='cli'||!demo())exit('Local demo mode is required.');
$path=dataDir().'/local-access.txt';if(is_file($path)){echo "Local credentials already exist in private/local-access.txt\n";exit;}
$password=bin2hex(random_bytes(14));
$q=db()->prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)');$q->execute(['local-editor','preview@falmouth.test','Preview editor',password_hash($password,PASSWORD_DEFAULT)]);
file_put_contents($path,"Local demo only\nURL: http://127.0.0.1:8787/?admin\nEmail: preview@falmouth.test\nPassword: ".$password."\n");chmod($path,0600);echo "Local preview credentials written to private/local-access.txt (not displayed).\n";
