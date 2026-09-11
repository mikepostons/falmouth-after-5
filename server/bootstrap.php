<?php
declare(strict_types=1);
const ROOT = __DIR__ . '/..';
function envv(string $key, string $default = ''): string {
    static $vars;
    if ($vars === null) $vars = is_file(ROOT.'/.env') ? (parse_ini_file(ROOT.'/.env', false, INI_SCANNER_RAW) ?: []) : [];
    return (string)(getenv($key) !== false ? getenv($key) : ($vars[$key] ?? $default));
}
function publicDir(): string { return defined('APP_PUBLIC_DIR') ? APP_PUBLIC_DIR : (envv('APP_PUBLIC_DIR') ?: ROOT.'/public'); }
function demo(): bool { return envv('APP_ENV','production') === 'development' && envv('DEMO_MODE') === 'true'; }
function dataDir(): string {
    $path = envv('APP_DATA_DIR', ROOT.'/private');
    if (!$path) $path = ROOT.'/private';
    if (!is_dir($path) && !mkdir($path,0700,true)) throw new RuntimeException('Cannot create private storage.');
    $real = realpath($path);
    if (envv('APP_ENV','production') === 'production') {
        $web = realpath(($_SERVER['DOCUMENT_ROOT'] ?? '') ?: publicDir());
        if ($web && ($real === $web || str_starts_with($real, $web.'/'))) throw new RuntimeException('APP_DATA_DIR must be outside the website document root.');
    }
    return $real;
}
function db(): PDO {
    static $db;
    if ($db) return $db;
    $file = dataDir().(demo()?'/demo.sqlite':'/content.sqlite');
    $db = new PDO('sqlite:'.$file, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    chmod($file,0600);
    $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    // DELETE journal mode avoids WAL coordination issues on simple shared hosting.
    $db->exec('CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, session_version INTEGER NOT NULL DEFAULT 1); CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, started INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $columns=$db->query('PRAGMA table_info(users)')->fetchAll(PDO::FETCH_COLUMN,1);
    if(!in_array('role',$columns))$db->exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
    $db->exec('CREATE TABLE IF NOT EXISTS account_tokens (hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL)');
    return $db;
}
function records(string $kind): array {
    $s=db()->prepare('SELECT * FROM records WHERE kind=? ORDER BY updated_at DESC');$s->execute([$kind]);
    return array_map(fn($r)=>array_merge(json_decode($r['data'],true),['id'=>$r['id'],'version'=>(int)$r['version'],'updated_at'=>$r['updated_at'],'updated_by'=>$r['updated_by']]),$s->fetchAll());
}
function record(string $kind,string $id): ?array { foreach(records($kind) as $r) if($r['id']===$id)return $r; return null; }
function rawSave(string $kind,array $data,string $who='system'): array {
    $id=$data['id']??bin2hex(random_bytes(8)); $version=(int)($data['version']??0)+1;
    unset($data['id'],$data['version'],$data['updated_at'],$data['updated_by']);
    $s=db()->prepare('INSERT INTO records(kind,id,data,version,updated_at,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at,updated_by=excluded.updated_by');
    $s->execute([$kind,$id,json_encode($data,JSON_THROW_ON_ERROR),$version,gmdate('c'),$who]);
    return record($kind,$id);
}
function fail(string $message,int $code=422): never { throw new DomainError($message,$code); }
class DomainError extends RuntimeException {}
function cleanText(mixed $value,int $max=3000): string { if(!is_string($value))return ''; $v=trim($value); if(mb_strlen($v)>$max)fail('Text exceeds the maximum length of '.$max.' characters.'); return $v; }
function req(array $d,string $key,int $max=200): string { $v=cleanText($d[$key]??'',$max);if($v==='')fail(ucfirst(str_replace('_',' ',$key)).' is required.');return $v; }
function validURL(mixed $value): string { $v=cleanText($value,1000); if($v && (!filter_var($v,FILTER_VALIDATE_URL)||!in_array(strtolower(parse_url($v,PHP_URL_SCHEME)??''),['https','http'])))fail('Links must be complete http:// or https:// addresses.');return $v; }
function ukDateTime(string $value): DateTimeImmutable {
    $date=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$value,new DateTimeZone('Europe/London'));
    if(!$date || $date->format('Y-m-d\TH:i')!==$value)fail('Enter a valid UK date and time.');
    return $date;
}
function validateRecord(string $kind,array $d): array {
    $status=$d['status']??'draft';if(!in_array($status,['draft','published','archived']))fail('Invalid publication status.');
    $base=['status'=>$status];
    if($kind==='categories') {
        $colour=$d['colour']??''; $icon=$d['icon']??'';
        if(!is_string($colour)||!preg_match('/^#[a-fA-F0-9]{6}$/',$colour))fail('Enter a six-digit hex colour.');
        if(!in_array($icon,['drinks','food','shopping','entertainment','experiences','wellbeing','stay']) && !(is_string($icon)&&preg_match('~^uploads/[a-f0-9]{32}\.svg$~',$icon)&&is_file(publicDir().'/'.$icon)))fail('Choose an available icon.');
        $out=['name'=>req($d,'name',40),'colour'=>$colour,'icon'=>$icon,'sort'=>(int)($d['sort']??0),'active'=>(bool)($d['active']??true)];
        if(!$out['active'] && isset($d['id'])) foreach(records('offers') as $o) {
            if($o['status']==='published' && in_array($d['id'],$o['categories']??[]) && !array_filter($o['categories'],fn($c)=>$c!==$d['id'] && (record('categories',$c)['active']??false))) fail('Reassign published offers before deactivating their only active category.');
        }
        return $out;
    }
    if($kind==='dates') {
        $date=req($d,'date',10);ukDateTime($date.'T00:00');
        foreach(records('dates') as $r)if($r['date']===$date && $r['id']!==($d['id']??''))fail('This campaign date already exists.');
        return $base+['date'=>$date,'label'=>req($d,'label',100)];
    }
    if($kind==='businesses') {
        $out=$base+['name'=>req($d,'name',120),'description'=>cleanText($d['description']??''),'address'=>cleanText($d['address']??'',400),'lat'=>is_numeric($d['lat']??null)?(float)$d['lat']:null,'lng'=>is_numeric($d['lng']??null)?(float)$d['lng']:null,'website'=>validURL($d['website']??''),'booking'=>validURL($d['booking']??''),'facebook'=>validURL($d['facebook']??''),'instagram'=>validURL($d['instagram']??''),'phone'=>cleanText($d['phone']??'',40),'image'=>cleanText($d['image']??'',200),'image_alt'=>cleanText($d['image_alt']??'',200)];
        if($out['lat']!==null && ($out['lat'] < -90||$out['lat']>90))fail('Latitude must be between -90 and 90.');
        if($out['lng']!==null && ($out['lng'] < -180||$out['lng']>180))fail('Longitude must be between -180 and 180.');
        if($status==='published' && (!$out['address']||$out['lat']===null||$out['lng']===null))fail('Published venues need an address and map location.');
    } elseif($kind==='offers') {
        $cats=array_values(array_unique(array_filter($d['categories']??[],fn($c)=>is_string($c))));
        foreach($cats as $c)if(!record('categories',$c))fail('Unknown category.');
        $business=record('businesses',cleanText($d['business_id']??''));if(!$business)fail('Select a business.');
        $schedule=[];
        if(isset($d['schedule_mode'])) {
            if(!in_array($d['schedule_mode'],['all','specific'],true))fail('Choose a valid campaign setting.');
            $ids=$d['campaign_ids']??[];if(!is_array($ids))fail('Choose existing campaigns.');
            $ids=array_values(array_unique($ids));foreach($ids as $id)if(!is_string($id)||!record('dates',$id))fail('Choose existing campaigns.');
            if($d['schedule_mode']==='specific'&&!$ids)fail('Choose at least one campaign, or untick Set specific campaigns.');
            $start=req($d,'start_time',5);$end=req($d,'end_time',5);
            foreach([$start,$end] as $time)if(!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',$time))fail('Enter valid offer hours.');
            if($start===$end)fail('Offer start and end times must differ.');
            $schedule=['schedule_mode'=>$d['schedule_mode'],'campaign_ids'=>$d['schedule_mode']==='specific'?$ids:[],'roll_over'=>$d['schedule_mode']==='specific'&&(bool)($d['roll_over']??false),'start_time'=>$start,'end_time'=>$end];
        }
        $occ=[];foreach(($schedule?offerOccurrences($schedule,records('dates')):($d['occurrences']??[])) as $o) {
            $date=record('dates',cleanText($o['date_id']??''));if(!$date)fail('Select a campaign date.');
            $start=ukDateTime(cleanText($o['start']??''));$end=ukDateTime(cleanText($o['end']??''));
            if($end<=$start)fail('Offer end must be after its start.');
            if($start->format('Y-m-d')!==$date['date'])fail('Offer start must fall on its campaign date.');
            if($end>$start->modify('+2 days'))fail('An offer occurrence cannot last longer than two days.');
            $occ[]=['date_id'=>$date['id'],'start'=>$start->format('Y-m-d\TH:i'),'end'=>$end->format('Y-m-d\TH:i')];
        }
        if($status==='published' && ((!$schedule&&!$occ) || !array_filter($cats,fn($c)=>record('categories',$c)['active'])))fail('Published offers need a campaign setting and at least one active category.');
        $out=$base+$schedule+['business_id'=>$business['id'],'title'=>req($d,'title',160),'description'=>cleanText($d['description']??''),'terms'=>cleanText($d['terms']??''),'time_note'=>cleanText($d['time_note']??'',200),'redemption'=>cleanText($d['redemption']??'',1000),'categories'=>$cats,'occurrences'=>$occ,'image'=>cleanText($d['image']??'',200),'image_alt'=>cleanText($d['image_alt']??'',200)];
    } else fail('Unknown content type.',404);
    if($out['image'] && !preg_match('~^(uploads/[a-f0-9]{32}\.(jpg|png|webp)|assets/[a-zA-Z0-9._-]+\.(jpg|png|webp))$~',$out['image']))fail('Choose an uploaded image.');
    if($out['image'] && !is_file(publicDir().'/'.$out['image']))fail('The selected image is missing.');
    if($out['image'] && !$out['image_alt'])fail('Add a short image description.');
    return $out;
}
function saveRecord(string $kind,array $d,string $who): array {
    db()->exec('BEGIN IMMEDIATE');
    try {
        $old=isset($d['id'])?record($kind,$d['id']):null;
        if(isset($d['id']) && (!$old || $old['version']!==($d['version']??null)))fail('Someone changed this record. Copy your changes, reload the latest record, then try again.',409);
        $clean=validateRecord($kind,$d);if($old){$clean['id']=$old['id'];$clean['version']=$old['version'];}
        $r=rawSave($kind,$clean,$who);db()->exec('COMMIT');return $r;
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}
function publicContent(): array {
    $dates=array_values(array_filter(records('dates'),fn($d)=>$d['status']==='published'));
    $businesses=array_values(array_filter(records('businesses'),fn($d)=>$d['status']==='published'));
    $categories=array_values(array_filter(records('categories'),fn($d)=>$d['active']));
    $di=array_column($dates,'id');$bi=array_column($businesses,'id');$ci=array_column($categories,'id');$offers=[];
    foreach(records('offers') as $o) {
        if($o['status']!=='published'||!in_array($o['business_id'],$bi))continue;
        $o['categories']=array_values(array_intersect($o['categories'],$ci));
        $o['occurrences']=array_values(array_filter(offerOccurrences($o,records('dates')),fn($v)=>in_array($v['date_id'],$di)));
        if(!$o['categories']||!$o['occurrences'])continue;
        foreach($o['occurrences'] as &$v){$v['start_iso']=ukDateTime($v['start'])->format('c');$v['end_iso']=ukDateTime($v['end'])->format('c');}unset($v);
        $offers[]=$o;
    }
    $strip=fn($r)=>array_diff_key($r,array_flip(['version','updated_by','status','updated_at']));
    return ['dates'=>array_map($strip,$dates),'businesses'=>array_map($strip,$businesses),'categories'=>array_map($strip,$categories),'offers'=>array_map($strip,$offers),'now'=>(new DateTimeImmutable('now',new DateTimeZone('Europe/London')))->format('c'),'demo'=>demo()];
}
function seedCategories(): void {
    if(records('categories'))return;
    foreach([['drinks','Drinks','#cf167c'],['food','Food','#1269b0'],['shopping','Shopping','#28783b'],['entertainment','Entertainment','#9250b1'],['experiences','Experiences','#ae6200']] as $i=>$r)rawSave('categories',['id'=>$r[0],'name'=>$r[1],'colour'=>$r[2],'icon'=>$r[0],'sort'=>$i,'active'=>true]);
}

function submissionText(array $d,string $key,int $max,bool $required=false): string {
    $value=$d[$key]??'';
    if(!is_string($value))fail(ucfirst(str_replace('_',' ',$key)).' must be text.');
    if(preg_match('/<\/?[a-z!]|[\x00-\x08\x0b\x0c\x0e-\x1f]/i',$value))fail('Use plain text without HTML in '.str_replace('_',' ',$key).'.');
    return $required?req($d,$key,$max):cleanText($value,$max);
}
function submissionIds(array $d,string $key,string $kind): array {
    $ids=$d[$key]??[];
    if(!is_array($ids)||!array_is_list($ids)||count($ids)>60)fail('Choose valid '.$key.'.');
    foreach($ids as $id) {
        if(!is_string($id)||strlen($id)>80)fail('Choose valid '.$key.'.');
        $r=record($kind,$id);
        if(!$r||($kind==='categories'?!($r['active']??false):(($r['status']??'')!=='published'||$r['date']<(new DateTimeImmutable('now',new DateTimeZone('Europe/London')))->format('Y-m-d'))))fail('One of the selected '.$key.' is no longer available. Please refresh the form.');
    }
    return array_values(array_unique($ids));
}
function validateSubmission(array $d): array {
    if(!empty($d['website_confirm']))fail('Unable to accept this submission.');
    if(($d['consent']??'')!=='yes')fail('Please agree to being contacted about your submission.');
    $business=[];
    foreach(['name'=>120,'description'=>500,'address'=>400,'phone'=>40,'website'=>1000,'booking'=>1000,'facebook'=>1000,'instagram'=>1000,'image_alt'=>200] as $key=>$max)
        $business[$key]=submissionText($d,$key,$max,in_array($key,['name','description','address']));
    foreach(['website','booking','facebook','instagram'] as $key)$business[$key]=validURL($business[$key]);
    if($business['phone']&&!preg_match('/^[+0-9 () .-]{5,40}$/',$business['phone']))fail('Enter a phone number using numbers, spaces, +, brackets or hyphens.');
    foreach(['lat'=>90,'lng'=>180] as $key=>$bound) {
        $v=$d[$key]??null;
        if((!is_int($v)&&!is_float($v))||!is_finite((float)$v)||abs($v)>$bound)fail('Place the business on the map or enter valid coordinates.');
        $business[$key]=round((float)$v,6);
    }
    $offer=[];
    foreach(['title'=>160,'description'=>250,'terms'=>1500,'redemption'=>1000,'time_note'=>200,'image_alt'=>200] as $key=>$max)
        $offer[$key]=submissionText($d,'offer_'.$key,$max,in_array($key,['title','description','redemption']));
    $offer['categories']=submissionIds($d,'categories','categories');
    if(!$offer['categories'])fail('Choose at least one offer category.');
    $offer['schedule_mode']=$d['schedule_mode']??'all';
    if(!in_array($offer['schedule_mode'],['all','specific'],true))fail('Choose a valid campaign setting.');
    $offer['campaign_ids']=submissionIds($d,'campaign_ids','dates');
    if($offer['schedule_mode']==='specific'&&!$offer['campaign_ids'])fail('Choose at least one campaign.');
    if($offer['schedule_mode']==='all')$offer['campaign_ids']=[];
    if(isset($d['roll_over'])&&!is_bool($d['roll_over']))fail('Choose a valid roll-over setting.');
    $offer['roll_over']=$offer['schedule_mode']==='specific'&&($d['roll_over']??false);
    foreach(['start_time','end_time'] as $key) {
        $v=submissionText($d,$key,5,true);
        if(!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',$v))fail('Enter valid offer hours.');
        $offer[$key]=$v;
    }
    if($offer['start_time']===$offer['end_time'])fail('Offer start and end times must differ.');
    $contact=submissionText($d,'contact',120,true);$email=strtolower(submissionText($d,'email',254,true));
    if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Enter a valid email address.');
    return ['name'=>$business['name'],'address'=>$business['address'],'contact'=>$contact,'email'=>$email,'offer'=>$offer['title'],'business'=>$business,'offer_details'=>$offer,'consent_at'=>gmdate('c'),'status'=>'new'];
}
// Count attempts before expensive image decoding, including invalid submissions.
function submissionAttemptLimit(): void {
    $key='submission-attempt:'.hash('sha256',$_SERVER['REMOTE_ADDR']??'local');
    db()->exec('BEGIN IMMEDIATE');
    try {
        $q=db()->prepare('SELECT * FROM attempts WHERE key=?');$q->execute([$key]);$at=$q->fetch();
        if($at&&$at['started']>time()-3600&&$at['count']>=30)fail('Too many attempts. Please try again in an hour.',429);
        db()->prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started < ? THEN 1 ELSE count+1 END,started=CASE WHEN started < ? THEN excluded.started ELSE started END')->execute([$key,time(),time()-3600,time()-3600]);
        db()->exec('COMMIT');
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}
function submissionImage(array $file): string {
    if(($file['error']??-1)!==UPLOAD_ERR_OK||($file['size']??0)>2*1024*1024||!is_uploaded_file($file['tmp_name']??''))fail('Each converted photo must be smaller than 2 MB.');
    $info=@getimagesize($file['tmp_name']);
    if(!$info||$info['mime']!=='image/webp'||$info[0]>1800||$info[1]>1800)fail('Choose a valid WebP photo no larger than 1800 pixels on either side.');
    if(!function_exists('imagewebp'))fail('Image processing is unavailable. Please contact the organiser.',503);
    $im=@imagecreatefromwebp($file['tmp_name']);if(!$im)fail('The photo could not be read.');
    $dir=dataDir().'/submission-images';if(!is_dir($dir)&&!mkdir($dir,0700))fail('Could not store the photo.',500);
    $name=bin2hex(random_bytes(16)).'.webp';
    try { if(!imagewebp($im,$dir.'/'.$name,82))fail('Could not store the photo.',500);chmod($dir.'/'.$name,0600); } finally {imagedestroy($im);}
    return $name;
}

// Rebuild SVGs from an allowlist; never retain active content or external references.
function safeCategorySvg(string $source): string {
    if(strlen($source)>102400 || preg_match('/<!DOCTYPE|<!ENTITY/i',$source))fail('Use a simple SVG under 100 KB without entities.');
    $doc=new DOMDocument();$old=libxml_use_internal_errors(true);
    try{$ok=$doc->loadXML($source,LIBXML_NONET);}finally{libxml_clear_errors();libxml_use_internal_errors($old);}
    if(!$ok||$doc->documentElement->localName!=='svg')fail('Choose a valid SVG.');
    $elements=['svg','g','path','circle','ellipse','rect','line','polyline','polygon','title','desc'];
    $attrs=['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform'];
    foreach($doc->getElementsByTagName('*') as $el){
        if(!in_array($el->tagName,$elements))fail('SVG contains unsupported elements. Export simple vector outlines.');
        foreach($el->attributes as $a){
            if(!in_array($a->name,$attrs)||preg_match('/url\s*\(|javascript:|data:|https?:/i',$a->value)&&$a->name!=='xmlns')fail('SVG contains unsupported attributes or external content.');
            if($a->name==='xmlns'&&$a->value!=='http://www.w3.org/2000/svg')fail('Invalid SVG namespace.');
        }
    }
    return $doc->saveXML($doc->documentElement);
}
function accountLink(string $id): string {
    $token=bin2hex(random_bytes(32));db()->exec('BEGIN IMMEDIATE');
    try{db()->prepare('DELETE FROM account_tokens WHERE user_id=? OR expires<?')->execute([$id,time()]);
    db()->prepare('INSERT INTO account_tokens VALUES(?,?,?)')->execute([hash('sha256',$token),$id,time()+86400]);db()->exec('COMMIT');}catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
    return $token;
}

// Resolve campaigns on each read so new campaigns and edited dates take effect automatically.
function offerOccurrences(array $offer,array $campaigns): array {
    if(!isset($offer['schedule_mode'])) {
        $dates=array_column($campaigns,'date','id');$out=[];
        foreach($offer['occurrences']??[] as $occ){
            if(!isset($dates[$occ['date_id']]))continue;
            $days=(int)(new DateTimeImmutable(substr($occ['start'],0,10)))->diff(new DateTimeImmutable(substr($occ['end'],0,10)))->format('%r%a');
            $date=$dates[$occ['date_id']];$endDate=(new DateTimeImmutable($date))->modify('+'.$days.' days')->format('Y-m-d');
            $out[]=['date_id'=>$occ['date_id'],'start'=>$date.'T'.substr($occ['start'],11,5),'end'=>$endDate.'T'.substr($occ['end'],11,5)];
        }
        return $out;
    }
    $ids=$offer['campaign_ids']??[];$last='';
    foreach($campaigns as $campaign)if(in_array($campaign['id'],$ids,true))$last=max($last,$campaign['date']);
    $out=[];
    foreach($campaigns as $campaign){
        $selected=in_array($campaign['id'],$ids,true);
        if($offer['schedule_mode']!=='all'&&!$selected&&!(!empty($offer['roll_over'])&&$last!==''&&$campaign['date']>$last))continue;
        $start=ukDateTime($campaign['date'].'T'.$offer['start_time']);
        $endDay=$offer['end_time']<=$offer['start_time']?$start->modify('+1 day')->format('Y-m-d'):$campaign['date'];
        $end=ukDateTime($endDay.'T'.$offer['end_time']);
        $out[]=['date_id'=>$campaign['id'],'start'=>$start->format('Y-m-d\TH:i'),'end'=>$end->format('Y-m-d\TH:i')];
    }
    return $out;
}

function publicationVisibility(): array {
    $public=publicContent();$now=strtotime($public['now']);$dates=$public['dates'];
    usort($dates,fn($a,$b)=>strcmp($a['date'],$b['date']));
    foreach($dates as $date){$count=0;foreach($public['offers'] as $offer){foreach($offer['occurrences'] as $occ){if($occ['date_id']===$date['id']&&strtotime($occ['end_iso'])>$now){$count++;break;}}}
        if($count)return ['next_campaign'=>$date,'offer_count'=>$count];
    }
    return ['next_campaign'=>null,'offer_count'=>0];
}
