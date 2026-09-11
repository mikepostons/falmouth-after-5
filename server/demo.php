<?php
function seedDemo(): void {
    if(db()->query("SELECT value FROM meta WHERE key='demo_seeded'")->fetchColumn())return;
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(db()->query("SELECT value FROM meta WHERE key='demo_seeded'")->fetchColumn()){db()->exec('COMMIT');return;}
        $date=(new DateTimeImmutable('first friday of next month',new DateTimeZone('Europe/London')))->format('Y-m-d');
        rawSave('dates',['id'=>'demo-friday','date'=>$date,'label'=>'Sample preview date','status'=>'published']);
        applyDemoCampaign($date);
        db()->exec("INSERT INTO meta VALUES('demo_seeded','1')");db()->exec('COMMIT');
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}
function applyDemoCampaign(string $date): void {
    $locations=json_decode(file_get_contents(__DIR__.'/demo-locations.json'),true,512,JSON_THROW_ON_ERROR);
    $images=json_decode(file_get_contents(__DIR__.'/demo-images.json'),true,512,JSON_THROW_ON_ERROR);
    $offers=json_decode(file_get_contents(__DIR__.'/demo-offers.json'),true,512,JSON_THROW_ON_ERROR);
    foreach($offers as $id=>$offer) {
        $bid=$offer['business_id'];$l=$locations[$bid];
        if(!record('businesses',$bid))rawSave('businesses',['id'=>$bid,'name'=>$l['name'],'address'=>$l['address'],'lat'=>$l['lat'],'lng'=>$l['lng'],'description'=>'Campaign participation on the preview date requires confirmation.','status'=>'published','image'=>$images[$l['name']]['image']??'','image_alt'=>$images[$l['name']]['image_alt']??'','website'=>'','booking'=>'','phone'=>''],'campaign-source');
        $existing=record('offers',$id)??['id'=>$id,'image'=>'','image_alt'=>''];
        $record=array_merge($existing,$offer,['status'=>'published','occurrences'=>[['date_id'=>'demo-friday','start'=>$date.'T'.$offer['start'],'end'=>$date.'T'.$offer['end']]]]);
        unset($record['start'],$record['end']);rawSave('offers',$record,'campaign-source');
    }
    foreach(['demo-offer-7','demo-offer-15'] as $id)if($o=record('offers',$id)){ $o['status']='archived';rawSave('offers',$o,'campaign-source'); }
}
