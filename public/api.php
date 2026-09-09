<?php
declare(strict_types=1);
define('APP_PUBLIC_DIR', __DIR__);
$runtime = is_file(__DIR__.'/bootstrap-path.php') ? require __DIR__.'/bootstrap-path.php' : __DIR__.'/..';
require $runtime.'/server/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function respond(array $data,int $status=200): never {http_response_code($status);echo json_encode($data,JSON_THROW_ON_ERROR);exit;}
try {
    seedCategories();
    if(demo()){require_once ROOT.'/server/demo.php';seedDemo();}
    $action=$_GET['action']??'public';$method=$_SERVER['REQUEST_METHOD'];
    if($action==='public'&&$method==='GET'){
        $token=envv('MAPBOX_PUBLIC_TOKEN');
        respond(publicContent()+['config'=>['mapboxToken'=>str_starts_with($token,'pk.')?$token:'','mapStyle'=>envv('MAPBOX_STYLE','mapbox://styles/mapbox/standard'),'gaId'=>preg_match('/^G-[A-Z0-9]+$/',envv('GA_MEASUREMENT_ID'))?envv('GA_MEASUREMENT_ID'):'']]);
    }
    $https=($_SERVER['HTTPS']??'')==='on';
    if(envv('APP_ENV','production')==='production' && !$https)fail('Staff access requires HTTPS. Configure HTTPS at the web server.',403);
    ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');
    session_name('faf_'.substr(hash('sha256',ROOT),0,10));
    session_set_cookie_params(['httponly'=>true,'secure'=>$https,'samesite'=>'Strict','path'=>rtrim(dirname(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)), '/').'/']);session_start();
    $_SESSION['csrf']??=bin2hex(random_bytes(32));
    if(isset($_SESSION['last'])&&time()-$_SESSION['last']>7200)unset($_SESSION['user']);
    $_SESSION['last']=time();
    $user=null;
    if(isset($_SESSION['user'])){$q=db()->prepare('SELECT id,email,name,session_version FROM users WHERE id=? AND active=1');$q->execute([$_SESSION['user']]);$user=$q->fetch()?:null;if(!$user||$user['session_version']!==($_SESSION['sv']??0)){unset($_SESSION['user']);$user=null;}}
    if($action==='session'&&$method==='GET')respond(['user'=>$user?array_intersect_key($user,array_flip(['id','email','name'])):null,'csrf'=>$_SESSION['csrf'],'demo'=>demo()]);
    if($method!=='GET' && !hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))fail('Your session has changed. Reload and try again.',403);
    $input=$action==='upload'?[]:json_decode(file_get_contents('php://input')?:'{}',true);
    if(!is_array($input))fail('Invalid request.');
    if($action==='login'&&$method==='POST') {
        $email=strtolower(cleanText($input['email']??'',254));$key=hash('sha256',($_SERVER['REMOTE_ADDR']??'local'));
        $q=db()->prepare('SELECT * FROM attempts WHERE key=?');$q->execute([$key]);$at=$q->fetch();
        if($at&&$at['started']>time()-900&&$at['count']>=10)fail('Too many attempts. Please wait 15 minutes.',429);
        $q=db()->prepare('SELECT * FROM users WHERE email=? AND active=1');$q->execute([$email]);$u=$q->fetch();
        $hash=$u['password']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        if(!password_verify((string)($input['password']??''),$hash)||!$u){$q=db()->prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started < ? THEN 1 ELSE count+1 END,started=CASE WHEN started < ? THEN excluded.started ELSE started END');$q->execute([$key,time(),time()-900,time()-900]);fail('Email or password is incorrect.',401);}
        db()->prepare('DELETE FROM attempts WHERE key=?')->execute([$key]);session_regenerate_id(true);$_SESSION['user']=$u['id'];$_SESSION['sv']=$u['session_version'];$_SESSION['csrf']=bin2hex(random_bytes(32));respond(['ok'=>true]);
    }
    if(!$user)fail('Please sign in to continue.',401);
    if($action==='logout'&&$method==='POST'){$_SESSION=[];session_destroy();respond(['ok'=>true]);}
    if($action==='admin'&&$method==='GET')respond(['categories'=>records('categories'),'businesses'=>records('businesses'),'dates'=>records('dates'),'offers'=>records('offers'),'demo'=>demo()]);
    if($action==='save'&&$method==='POST')respond(['record'=>saveRecord(cleanText($input['kind']??''),$input['record']??[],$user['name'])]);
    if($action==='password'&&$method==='POST') {
        $q=db()->prepare('SELECT password FROM users WHERE id=?');$q->execute([$user['id']]);
        if(!password_verify((string)($input['current']??''),$q->fetchColumn()))fail('Current password is incorrect.');
        $new=(string)($input['password']??'');if(strlen($new)<12||strlen($new)>200)fail('Use a password between 12 and 200 characters.');
        db()->prepare('UPDATE users SET password=?,session_version=session_version+1 WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$user['id']]);$_SESSION['sv']++;session_regenerate_id(true);respond(['ok'=>true]);
    }
    if($action==='upload'&&$method==='POST'){
        $f=$_FILES['image']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>8*1024*1024)fail('Upload a JPG, PNG or WebP image smaller than 8 MB.');
        $info=getimagesize($f['tmp_name']);if(!$info||!in_array($info['mime'],['image/jpeg','image/png','image/webp'])||$info[0]*$info[1]>24000000)fail('Choose a valid image under 24 megapixels.');
        $im=imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$im)fail('Could not read this image.');
        $w=min(1800,imagesx($im));$h=(int)round(imagesy($im)*$w/imagesx($im));$out=imagecreatetruecolor($w,$h);$white=imagecolorallocate($out,255,255,255);imagefill($out,0,0,$white);imagecopyresampled($out,$im,0,0,0,0,$w,$h,imagesx($im),imagesy($im));
        $path='uploads/'.bin2hex(random_bytes(16)).'.jpg';if(!imagejpeg($out,__DIR__.'/'.$path,86))fail('Could not save the image. Check upload permissions.',500);imagedestroy($im);imagedestroy($out);respond(['path'=>$path]);
    }
    fail('Route not found.',404);
}catch(DomainError $e){respond(['error'=>$e->getMessage()],$e->getCode()?:422);}catch(Throwable $e){error_log('Falmouth After Five: '.$e->getMessage());respond(['error'=>'The service is temporarily unavailable. Please try again or contact the website administrator.'],500);}
