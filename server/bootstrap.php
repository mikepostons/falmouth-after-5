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
        if(!in_array($colour,['#cf167c','#1269b0','#28783b','#9250b1','#ae6200','#00828f','#414d62']))fail('Choose a colour from the palette.');
        if(!in_array($icon,['drinks','food','shopping','entertainment','experiences','wellbeing','stay']))fail('Choose an available icon.');
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
        $out=$base+['name'=>req($d,'name',120),'description'=>cleanText($d['description']??''),'address'=>cleanText($d['address']??'',400),'lat'=>is_numeric($d['lat']??null)?(float)$d['lat']:null,'lng'=>is_numeric($d['lng']??null)?(float)$d['lng']:null,'website'=>validURL($d['website']??''),'booking'=>validURL($d['booking']??''),'phone'=>cleanText($d['phone']??'',40),'image'=>cleanText($d['image']??'',200),'image_alt'=>cleanText($d['image_alt']??'',200)];
        if($out['lat']!==null && ($out['lat'] < -90||$out['lat']>90))fail('Latitude must be between -90 and 90.');
        if($out['lng']!==null && ($out['lng'] < -180||$out['lng']>180))fail('Longitude must be between -180 and 180.');
        if($status==='published' && (!$out['address']||$out['lat']===null||$out['lng']===null))fail('Published venues need an address and map location.');
    } elseif($kind==='offers') {
        $cats=array_values(array_unique(array_filter($d['categories']??[],fn($c)=>is_string($c))));
        foreach($cats as $c)if(!record('categories',$c))fail('Unknown category.');
        $business=record('businesses',cleanText($d['business_id']??''));if(!$business)fail('Select a business.');
        $occ=[];foreach(($d['occurrences']??[]) as $o) {
            $date=record('dates',cleanText($o['date_id']??''));if(!$date)fail('Select a campaign date.');
            $start=ukDateTime(cleanText($o['start']??''));$end=ukDateTime(cleanText($o['end']??''));
            if($end<=$start)fail('Offer end must be after its start.');
            if($start->format('Y-m-d')!==$date['date'])fail('Offer start must fall on its campaign date.');
            if($end>$start->modify('+2 days'))fail('An offer occurrence cannot last longer than two days.');
            $occ[]=['date_id'=>$date['id'],'start'=>$start->format('Y-m-d\TH:i'),'end'=>$end->format('Y-m-d\TH:i')];
        }
        if($status==='published' && (!$occ || !array_filter($cats,fn($c)=>record('categories',$c)['active'])))fail('Published offers need a date/time and at least one active category.');
        $out=$base+['business_id'=>$business['id'],'title'=>req($d,'title',160),'description'=>cleanText($d['description']??''),'terms'=>cleanText($d['terms']??''),'redemption'=>cleanText($d['redemption']??'',1000),'categories'=>$cats,'occurrences'=>$occ,'image'=>cleanText($d['image']??'',200),'image_alt'=>cleanText($d['image_alt']??'',200)];
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
        $o['occurrences']=array_values(array_filter($o['occurrences'],fn($v)=>in_array($v['date_id'],$di)));
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
