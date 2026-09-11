// Local preview interaction check. Never saves any business changes.
import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const password=(await readFile('private/local-access.txt','utf8')).match(/Password: (.+)/)[1];
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);
await page.route('**/api.php?action=public',async route=>{const response=await route.fetch();const data=await response.json();assert.equal(data.demo,true);data.config.mapStyle={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#d7e8ef'}}]};await route.fulfill({json:data});});
try {
 await page.goto('http://127.0.0.1:8787/?admin');await page.getByLabel('Email address').fill('preview@falmouth.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:/^Businesses \d+$/}).click();await page.getByRole('button',{name:'Edit Mangos Sports Bar',exact:true}).click();await page.getByRole('tab',{name:'Location',exact:true}).click();
 const marker=page.locator('.picker-map .venue-marker');await marker.waitFor({state:'visible',timeout:25000});await marker.scrollIntoViewIfNeeded();
 const old=await page.getByLabel('Latitude',{exact:true}).inputValue();const box=await marker.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-60,box.y+box.height/2+40,{steps:20});await page.mouse.up();await page.waitForTimeout(400);
 const next=await page.getByLabel('Latitude',{exact:true}).inputValue();assert.notEqual(next,old,'Dragging must update coordinates');console.log('PASS: dragging marker updates coordinates');
 await page.locator('.picker-map canvas').click({position:{x:160,y:90}});await page.waitForTimeout(400);assert.notEqual(await page.getByLabel('Latitude',{exact:true}).inputValue(),next,'Map click must update coordinates');console.log('PASS: clicking map updates coordinates');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();console.log('PASS: test edits discarded');
} finally { await browser.close(); }
