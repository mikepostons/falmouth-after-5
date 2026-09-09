<?php
function seedDemo(): void {
    if(db()->query("SELECT value FROM meta WHERE key='demo_seeded'")->fetchColumn())return;
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(db()->query("SELECT value FROM meta WHERE key='demo_seeded'")->fetchColumn()){db()->exec('COMMIT');return;}
        $date=(new DateTimeImmutable('first friday of next month',new DateTimeZone('Europe/London')))->format('Y-m-d');
        rawSave('dates',['id'=>'demo-friday','date'=>$date,'label'=>'First Friday','status'=>'published']);
        $rows=[
            ['The Shed','Discovery Quay, Falmouth',50.1503,-5.0649,'Two drinks. One good evening.',['drinks'],'Any two drinks for the price of one.','17:00','19:00'],
            ['The Boathouse','Beacon Street, Falmouth',50.1585,-5.0724,'Loaded fries + your favourite drink',['food','drinks'],'Loaded fries and a pint, wine or soft drink for £10.','17:00','21:00'],
            ['The Games Room','Market Street, Falmouth',50.1546,-5.0693,'A little friendly competition',['entertainment','drinks'],'Pool, games and a happy-hour pint.','17:00','19:00'],
            ['The Orgia','Church Street, Falmouth',50.1535,-5.0682,'Small plates, big Friday plans',['food','drinks'],'Three snacks for £10 or three plates for £18.','17:00','21:00'],
            ['Pennycomequick','The Moor, Falmouth',50.1558,-5.0715,'Burger or pizza. Pint included.',['food','drinks'],'A burger or pizza with a pint or small house wine for £15.','17:00','21:00'],
            ['Pocketful of Stones','High Street, Falmouth',50.1573,-5.0711,'Something spirited to take home',['shopping','experiences'],'An in-store promotion with a tasting prize draw.','17:00','20:00'],
            ['The Poly','Church Street, Falmouth',50.1532,-5.0679,'Make it a movie night',['entertainment','drinks'],'Cinema and cocktail offers for your Friday evening.','17:00','22:00'],
            ['Mangos','Church Street, Falmouth',50.1529,-5.0674,'Your next high score is on us',['entertainment'],'First 50 arcade games free between 5 and 7pm.','17:00','19:00'],
            ['Windjammer','Grove Place, Falmouth',50.1508,-5.0652,'Cocktails with a view',['drinks'],'Two of the same cocktails for £10.','17:00','21:00'],
            ['Fives Cyderhouse','Grove Place, Falmouth',50.1504,-5.0658,'Pizza night, sorted',['food','drinks'],'£12.50 pizzas and £5 house doubles.','17:00','22:00'],
            ['Harbour Lights','Arwenack Street, Falmouth',50.1511,-5.0659,'Fish, chips and a harbour evening',['food','drinks'],'A drink with your meal.','17:00','21:00'],
            ['The Greenbank','Harbourside, Falmouth',50.1623,-5.0733,'A waterside supper',['food','drinks'],'A house drink with every main course.','17:00','21:00'],
            ['The Grapes','Church Street, Falmouth',50.1538,-5.0686,'Meet you at the bar',['drinks'],'A Friday drinks special.','17:00','21:00'],
            ["Harry’s Taqueria",'Arwenack Street, Falmouth',50.1518,-5.0664,'Turn up the Friday flavour',['food','drinks'],'Habanero hot wings and a pint for £12.50.','17:00','21:00'],
            ['Maya’s','Falmouth town centre',50.1564,-5.0714,'Make something of your evening',['experiences','shopping'],'A creative printmaking experience.','17:00','20:00']
        ];
        foreach($rows as $i=>$r){
            $id='demo-venue-'.($i+1);
            rawSave('businesses',['id'=>$id,'name'=>$r[0],'address'=>$r[1],'lat'=>$r[2],'lng'=>$r[3],'description'=>'Discover a local favourite and make an evening of Falmouth. Demo profile: address and map pin require verification before publication.','status'=>'published','image'=>'','image_alt'=>'','website'=>'','booking'=>'','phone'=>'']);
            rawSave('offers',['id'=>'demo-offer-'.($i+1),'business_id'=>$id,'title'=>$r[4],'categories'=>$r[5],'description'=>$r[6],'terms'=>'Demonstration only. Based on historical campaign examples; this is not a confirmed current offer.','redemption'=>'Check with the venue for confirmed availability.','image'=>'','image_alt'=>'','status'=>'published','occurrences'=>[['date_id'=>'demo-friday','start'=>$date.'T'.$r[7],'end'=>$date.'T'.$r[8]]]]);
        }
        db()->exec("INSERT INTO meta VALUES('demo_seeded','1')");db()->exec('COMMIT');
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}
