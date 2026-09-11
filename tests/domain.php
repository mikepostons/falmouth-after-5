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

check(str_contains(safeCategorySvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0L24 24" stroke="#000"/></svg>'),'path'),'Simple SVG accepted');
rejects(fn()=>safeCategorySvg('<svg><script>alert(1)</script></svg>'),'SVG scripts rejected');
rejects(fn()=>safeCategorySvg('<svg onload="alert(1)"/>'),'SVG event handlers rejected');
rejects(fn()=>safeCategorySvg('<svg><path fill="url(https://example.com)"/></svg>'),'SVG external resources rejected');
rejects(fn()=>safeCategorySvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>'),'SVG entities rejected');
check(validateRecord('categories',['name'=>'Custom','colour'=>'#123ABC','icon'=>'food'])['colour']==='#123ABC','Custom hex colours accepted');

$campaigns=[['id'=>'nov','date'=>'2026-11-06'],['id'=>'dec','date'=>'2026-12-04'],['id'=>'jan','date'=>'2027-01-01'],['id'=>'feb','date'=>'2027-02-05']];
$any=['schedule_mode'=>'all','campaign_ids'=>[],'roll_over'=>false,'start_time'=>'17:00','end_time'=>'01:00'];
check(count(offerOccurrences($any,$campaigns))===4,'Unrestricted offers apply to all campaigns');
$specific=$any;$specific['schedule_mode']='specific';$specific['campaign_ids']=['nov','jan'];
check(array_column(offerOccurrences($specific,$campaigns),'date_id')===['nov','jan'],'Specific campaigns exclude gaps and later campaigns');
$specific['roll_over']=true;
check(array_column(offerOccurrences($specific,$campaigns),'date_id')===['nov','jan','feb'],'Roll-over starts after the final selected campaign, without filling gaps');
check(offerOccurrences($any,$campaigns)[0]['end']==='2026-11-07T01:00','Campaign overnight hours move to the next calendar day');
$campaigns[]=['id'=>'mar','date'=>'2027-03-05'];check(count(offerOccurrences($specific,$campaigns))===4,'New campaigns inherit rolled-over offers without resaving');
$custom=$o;$custom['schedule_mode']='all';$custom['campaign_ids']=[];$custom['start_time']='17:00';$custom['end_time']='21:00';$custom['roll_over']=false;$custom['occurrences']=[];
check(validateRecord('offers',$custom)['schedule_mode']==='all','Published unrestricted offers do not need manually selected dates');
$custom['schedule_mode']='specific';rejects(fn()=>validateRecord('offers',$custom),'Specific campaigns require a selection');
$custom['campaign_ids']=['not-a-campaign'];rejects(fn()=>validateRecord('offers',$custom),'Unknown campaigns rejected');
$publicBusiness=record('businesses',$b['id']);$publicBusiness['status']='published';saveRecord('businesses',$publicBusiness,'Tester');
$custom['schedule_mode']='all';$custom['campaign_ids']=[];$ongoing=saveRecord('offers',$custom,'Tester');
$later=saveRecord('dates',['date'=>'2027-02-05','label'=>'February 2027','status'=>'draft'],'Tester');
$readOffer=fn()=>array_values(array_filter(publicContent()['offers'],fn($v)=>$v['id']===$ongoing['id']))[0];
check(!in_array($later['id'],array_column($readOffer()['occurrences'],'date_id')),'Draft campaigns stay out of public occurrences');
$later['status']='published';$later=saveRecord('dates',$later,'Tester');check(in_array($later['id'],array_column($readOffer()['occurrences'],'date_id')),'Publishing a new campaign includes unrestricted offers automatically');
$later['date']='2027-02-12';saveRecord('dates',$later,'Tester');$matched=array_values(array_filter($readOffer()['occurrences'],fn($v)=>$v['date_id']===$later['id']))[0];check($matched['start']==='2027-02-12T17:00','Changing campaign dates updates offer occurrences');

$social=validateRecord('businesses',['name'=>'Social venue','facebook'=>'https://www.facebook.com/example','instagram'=>'https://www.instagram.com/example']);
check($social['facebook']==='https://www.facebook.com/example'&&$social['instagram']==='https://www.instagram.com/example','Business social links retained');
rejects(fn()=>validateRecord('businesses',['name'=>'Bad social','facebook'=>'javascript:alert(1)']),'Unsafe Facebook URL rejected');
rejects(fn()=>validateRecord('businesses',['name'=>'Bad social','instagram'=>'data:text/html,test']),'Unsafe Instagram URL rejected');
