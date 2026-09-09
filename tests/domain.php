<?php
$dir=sys_get_temp_dir().'/faf-test-'.bin2hex(random_bytes(6));putenv('APP_DATA_DIR='.$dir);putenv('APP_ENV=development');putenv('DEMO_MODE=false');require __DIR__.'/../server/bootstrap.php';
function check($condition,$name){if(!$condition)throw new RuntimeException('FAIL: '.$name);echo 'PASS: '.$name.PHP_EOL;}
function rejects($fn,$name,$code=422){try{$fn();throw new RuntimeException('FAIL: '.$name);}catch(DomainError $e){check($e->getCode()===$code,$name);}}
seedCategories();
$d=saveRecord('dates',['date'=>'2026-10-02','label'=>'First Friday','status'=>'published'],'Tester');
$b=saveRecord('businesses',['name'=>'Test venue','address'=>'Falmouth','lat'=>50.15,'lng'=>-5.06,'status'=>'published'],'Tester');
$o=['title'=>'Combined deal','business_id'=>$b['id'],'categories'=>['food','drinks'],'occurrences'=>[['date_id'=>$d['id'],'start'=>'2026-10-02T17:00','end'=>'2026-10-03T01:00']],'status'=>'published'];
$saved=saveRecord('offers',$o,'Tester');check(count(publicContent()['offers'])===1,'Published multi-category offer appears once');check(!isset(publicContent()['offers'][0]['updated_by']),'Public response omits editor identity');
$copy=$saved;$copy['status']='draft';saveRecord('offers',$copy,'Tester');check(count(publicContent()['offers'])===0,'Drafts are private');rejects(fn()=>saveRecord('offers',$saved,'Tester'),'Stale editor cannot overwrite',409);
$o['categories']=['food'];$foodOffer=saveRecord('offers',$o,'Tester');$cat=record('categories','food');$cat['active']=false;rejects(fn()=>saveRecord('categories',$cat,'Tester'),'Cannot orphan a published offer by deactivating category');
$b['status']='archived';saveRecord('businesses',$b,'Tester');check(count(publicContent()['offers'])===0,'Archiving venue hides all its offers');
rejects(fn()=>ukDateTime('2026-02-30T17:00'),'Invalid calendar date rejected');rejects(fn()=>ukDateTime('2026-03-29T01:30'),'Nonexistent DST time rejected');
rejects(fn()=>saveRecord('businesses',['name'=>'Bad','address'=>'x','lat'=>200,'lng'=>0,'status'=>'published'],'Tester'),'Invalid coordinates rejected');
rejects(fn()=>saveRecord('businesses',['name'=>'Bad','website'=>'javascript:alert(1)'],'Tester'),'Script URLs rejected');
$o['occurrences'][0]['end']='2026-10-02T16:00';rejects(fn()=>saveRecord('offers',$o,'Tester'),'End before start rejected');
$o['occurrences'][0]['start']='2026-10-01T17:00';$o['occurrences'][0]['end']='2026-10-02T18:00';rejects(fn()=>saveRecord('offers',$o,'Tester'),'Offer must start on campaign date');
$backup=$dir.'/snapshot.sqlite';db()->exec('VACUUM INTO '.db()->quote($backup));$restore=new PDO('sqlite:'.$backup);check($restore->query('PRAGMA integrity_check')->fetchColumn()==='ok','Backup restores with database integrity');check((int)$restore->query('SELECT count(*) FROM records')->fetchColumn()>0,'Restored snapshot retains content');
echo "Domain and backup checks passed.\n";
