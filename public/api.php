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
        $settings=siteSettings();
        respond(publicContent()+['settings'=>array_diff_key($settings,array_flip(['updated_by','updated_at','id','version'])),'config'=>['mapboxToken'=>str_starts_with($token,'pk.')?$token:'','mapStyle'=>envv('MAPBOX_STYLE','mapbox://styles/mapbox/standard'),'gaIds'=>$settings['gaIds']??(preg_match('/^G-[A-Z0-9]+$/',envv('GA_MEASUREMENT_ID'))?[envv('GA_MEASUREMENT_ID')]:[]),'gaId'=>preg_match('/^G-[A-Z0-9]+$/',envv('GA_MEASUREMENT_ID'))?envv('GA_MEASUREMENT_ID'):'']]);
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
    if(isset($_SESSION['user'])){$q=db()->prepare('SELECT id,email,name,role,session_version FROM users WHERE id=? AND active=1');$q->execute([$_SESSION['user']]);$user=$q->fetch()?:null;if(!$user||$user['session_version']!==($_SESSION['sv']??0)){unset($_SESSION['user']);$user=null;}}
    if($action==='session'&&$method==='GET')respond(['user'=>$user?array_intersect_key($user,array_flip(['id','email','name','role'])):null,'csrf'=>$_SESSION['csrf'],'demo'=>demo()]);
    if($method!=='GET' && !hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))fail('Your session has changed. Reload and try again.',403);
    if($action==='submit-business'&&(int)($_SERVER['CONTENT_LENGTH']??0)>5*1024*1024)fail('Submission is too large. Use two photos under 2 MB each.',413);
    $multipartSubmission=$action==='submit-business'&&str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'multipart/form-data');
    $input=$multipartSubmission?json_decode(is_string($_POST['data']??null)?$_POST['data']:'',true):(in_array($action,['upload','upload-icon'])?[]:json_decode(file_get_contents('php://input')?:'{}',true));
    if(!is_array($input))fail('Invalid request.');
    if($action==='submit-business'&&$method==='POST') {
        submissionAttemptLimit();
        if(strlen(json_encode($input))>24000)fail('Submission text is too large.',413);
        $submission=validateSubmission($input);
        foreach(array_keys($_FILES) as $slot)if(!in_array($slot,['business_image','offer_image'],true))fail('Unexpected file attachment.');
        $savedPhotos=[];
        $key='submission:'.hash('sha256',($_SERVER['REMOTE_ADDR']??'local'));
        db()->exec('BEGIN IMMEDIATE');
        try {
            $q=db()->prepare('SELECT * FROM attempts WHERE key=?');$q->execute([$key]);$at=$q->fetch();
            if($at&&$at['started']>time()-3600&&$at['count']>=5)fail('Too many submissions. Please try again in an hour.',429);
            foreach(['business_image'=>'business','offer_image'=>'offer_details'] as $slot=>$target) {
                if(isset($_FILES[$slot])&&($_FILES[$slot]['error']??-1)!==UPLOAD_ERR_NO_FILE) {
                    if(!$submission[$target]['image_alt'])fail('Add a short description for the '.($target==='business'?'business':'offer').' photo.');
                    if(($input['image_rights']??'')!=='yes')fail('Confirm that you have permission to use the photos.');
                    $savedPhotos[]=submissionImage($_FILES[$slot]);
                    $submission[$target]['image']=end($savedPhotos);
                }
            }
            $submission['image_rights_confirmed']=count($savedPhotos)>0;
            rawSave('submissions',$submission,'public-submission');
            $q=db()->prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started < ? THEN 1 ELSE count+1 END,started=CASE WHEN started < ? THEN excluded.started ELSE started END');$q->execute([$key,time(),time()-3600,time()-3600]);
            db()->exec('COMMIT');
        } catch(Throwable $e){db()->exec('ROLLBACK');foreach($savedPhotos as $name)@unlink(dataDir().'/submission-images/'.$name);throw $e;}
        respond(['ok'=>true],201);
    }
    if($action==='activate-account'&&$method==='POST') {
        $token=(string)($input['token']??'');$password=(string)($input['password']??'');
        if(strlen($password)<12||strlen($password)>200)fail('Use a password between 12 and 200 characters.');
        db()->exec('BEGIN IMMEDIATE');
        try{$q=db()->prepare('SELECT user_id FROM account_tokens WHERE hash=? AND expires>?');$q->execute([hash('sha256',$token),time()]);$id=$q->fetchColumn();if(!$id)fail('This link has expired or already been used. Ask your super-admin for a new link.');
        db()->prepare('UPDATE users SET password=?,active=1,session_version=session_version+1 WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$id]);db()->prepare('DELETE FROM account_tokens WHERE user_id=?')->execute([$id]);db()->exec('COMMIT');}catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
        respond(['ok'=>true]);
    }
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
    if($action==='settings'&&$method==='GET')respond(siteSettings());
    if($action==='settings'&&$method==='POST')respond(saveSiteSettings($input,$user));
    if($action==='submission-image'&&$method==='GET') {
        $r=record('submissions',cleanText($_GET['id']??'',80));$slot=$_GET['slot']??'';
        if(!$r||!in_array($slot,['business','offer_details'],true))fail('Photo not found.',404);
        $name=$r[$slot]['image']??'';
        if(!preg_match('/^[a-f0-9]{32}\.webp$/',$name)||!is_file(dataDir().'/submission-images/'.$name))fail('Photo not found.',404);
        header('Content-Type: image/webp');header('Content-Security-Policy: default-src \'none\'; sandbox');readfile(dataDir().'/submission-images/'.$name);exit;
    }
    if($action==='logout'&&$method==='POST'){$_SESSION=[];session_destroy();respond(['ok'=>true]);}
    if($action==='admin'&&$method==='GET')respond(['categories'=>records('categories'),'businesses'=>records('businesses'),'dates'=>records('dates'),'offers'=>array_map(fn($o)=>array_replace($o,['occurrences'=>offerOccurrences($o,records('dates'))]),records('offers')),'submissions'=>records('submissions'),'visibility'=>publicationVisibility(),'demo'=>demo()]);
    if(in_array($action,['delete-submission','restore-submission','review-submission'],true)&&$method==='POST') {
        db()->exec('BEGIN IMMEDIATE');
        try {
            $record=record('submissions',req($input,'id',80));if(!$record)fail('Submission not found.',404);
            if($action==='delete-submission'&&$record['status']!=='deleted') {
                $record['previous_status']=$record['status'];$record['status']='deleted';$record['deleted_at']=gmdate('c');
            } elseif($action==='restore-submission'&&$record['status']==='deleted') {
                $record['status']=in_array($record['previous_status']??'',['new','reviewed'],true)?$record['previous_status']:'new';
                unset($record['previous_status'],$record['deleted_at']);
            } elseif($action==='review-submission') {
                if($record['status']==='deleted')fail('Restore this request before marking it reviewed.');
                $record['status']='reviewed';
            }
            rawSave('submissions',$record,$user['name']);db()->exec('COMMIT');
        }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
        respond(['ok'=>true]);
    }
    if(in_array($action,['users','invite-user','reset-user','disable-user'])) {
        if($user['role']!=='super-admin')fail('Super-admin access required.',403);
        if($action==='users'&&$method==='GET')respond(['users'=>db()->query('SELECT id,name,email,role,active FROM users ORDER BY name')->fetchAll()]);
        if($method!=='POST')fail('Method not allowed.',405);
        if($action==='invite-user'){
            $email=strtolower(req($input,'email',254));if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Enter a valid email.');$name=req($input,'name',120);
            $q=db()->prepare('SELECT id FROM users WHERE email=?');$q->execute([$email]);if($q->fetchColumn())fail('This email already has an account. Use reset access instead.');
            $id=bin2hex(random_bytes(16));db()->prepare("INSERT INTO users(id,email,name,password,active,role) VALUES(?,?,?,?,0,'admin')")->execute([$id,$email,$name,password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT)]);
        }else{
            $id=req($input,'id',80);$q=db()->prepare('SELECT id,role FROM users WHERE id=?');$q->execute([$id]);$target=$q->fetch();if(!$target)fail('Account not found.',404);
            if($target['role']==='super-admin')fail('Super-admin access is managed by the server administrator.');
        }
        if($action==='disable-user') {db()->exec('BEGIN IMMEDIATE');try{db()->prepare('UPDATE users SET active=0,session_version=session_version+1 WHERE id=?')->execute([$id]);db()->prepare('DELETE FROM account_tokens WHERE user_id=?')->execute([$id]);db()->exec('COMMIT');}catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}respond(['ok'=>true]);}
        respond(['token'=>accountLink($id)]);
    }
    if($action==='upload-icon'&&$method==='POST'){
        $f=$_FILES['image']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>102400||strtolower(pathinfo($f['name'],PATHINFO_EXTENSION))!=='svg')fail('Upload an SVG under 100 KB.');
        $svg=safeCategorySvg(file_get_contents($f['tmp_name']));$path='uploads/'.bin2hex(random_bytes(16)).'.svg';if(file_put_contents(__DIR__.'/'.$path,$svg)===false)fail('Unable to save icon.',500);respond(['path'=>$path]);
    }
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
        if(!function_exists('imagewebp'))fail('The server needs GD WebP support for uploads.',503);$path='uploads/'.bin2hex(random_bytes(16)).'.webp';if(!imagewebp($out,__DIR__.'/'.$path,82))fail('Could not save the image. Check upload permissions.',500);imagedestroy($im);imagedestroy($out);respond(['path'=>$path]);
    }
    fail('Route not found.',404);
}catch(DomainError $e){respond(['error'=>$e->getMessage()],$e->getCode()?:422);}catch(Throwable $e){error_log('Falmouth After Five: '.$e->getMessage());respond(['error'=>'The service is temporarily unavailable. Please try again or contact the website administrator.'],500);}
