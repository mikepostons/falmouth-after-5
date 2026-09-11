<?php
require __DIR__.'/../server/bootstrap.php';
if(PHP_SAPI!=='cli')exit;
$action=$argv[1]??'';$email=strtolower($argv[2]??'');
if(!in_array($action,['create','reset','disable','promote'])||!filter_var($email,FILTER_VALIDATE_EMAIL)){fwrite(STDERR,"Usage: php scripts/user.php create|reset|disable|promote email [name]\nFor create/reset enter a password on the next line (12+ characters).\n");exit(1);}
if($action==='disable'){db()->prepare('UPDATE users SET active=0, session_version=session_version+1 WHERE email=?')->execute([$email]);db()->prepare('DELETE FROM account_tokens WHERE user_id IN (SELECT id FROM users WHERE email=?)')->execute([$email]);echo "Account disabled.\n";exit;}
if($action==='promote'){ $q=db()->prepare("UPDATE users SET role='super-admin',session_version=session_version+1 WHERE email=?");$q->execute([$email]);if(!$q->rowCount())exit("Account not found.\n");echo "Super-admin role granted.\n";exit;}
$tty=function_exists('stream_isatty')&&stream_isatty(STDIN);if($tty){fwrite(STDERR,'Password: ');system('stty -echo');}
try{$password=rtrim(fgets(STDIN)?:'',"\r\n");}finally{if($tty){system('stty echo');fwrite(STDERR,"\n");}}
if(strlen($password)<12||strlen($password)>200){fwrite(STDERR,"Password must contain 12–200 characters.\n");exit(1);}
if($action==='create'){$q=db()->prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)');$q->execute([bin2hex(random_bytes(8)),$email,$argv[3]??'Campaign editor',password_hash($password,PASSWORD_DEFAULT)]);}else{$q=db()->prepare('UPDATE users SET password=?,active=1,session_version=session_version+1 WHERE email=?');$q->execute([password_hash($password,PASSWORD_DEFAULT),$email]);if(!$q->rowCount()){fwrite(STDERR,"Account not found.\n");exit(1);}}
db()->prepare('DELETE FROM account_tokens WHERE user_id IN (SELECT id FROM users WHERE email=?)')->execute([$email]);
echo "Account ready in ".(demo()?'demo':'live')." database.\n";
