<?php
header('X-Content-Type-Options: nosniff');
// Mapbox requires the allowed site origin; never send admin paths or reset tokens.
header('Referrer-Policy: '.(isset($_GET['admin'])?'strict-origin':'strict-origin-when-cross-origin'));
header('X-Frame-Options: SAMEORIGIN');
header('Cache-Control: no-cache');
$file=__DIR__.'/build/index.html';
if(!is_file($file)){http_response_code(503);echo 'The app is being prepared. Please try again shortly.';exit;}
echo str_replace('./assets/','./build/assets/',file_get_contents($file));
