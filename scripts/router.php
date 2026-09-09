<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(str_contains($path,'..')||preg_match('~(^|/)\.~',$path)){http_response_code(404);exit;}
$file=__DIR__.'/../public'.$path;
if(is_file($file))return false;
require __DIR__.'/../public/index.php';
