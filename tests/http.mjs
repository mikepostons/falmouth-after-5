import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, readdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
const root = process.cwd(),
  temp = await mkdtemp(path.join(tmpdir(), "faf-http-"));
const env = {
  ...process.env,
  APP_ENV: "development",
  DEMO_MODE: "false",
  APP_DATA_DIR: temp,
  MAPBOX_PUBLIC_TOKEN: "",
  GA_MEASUREMENT_ID: "",
};
const password = randomBytes(20).toString("hex");
const setup = spawnSync(
  "php",
  ["scripts/user.php", "create", "test@example.test", "Integration editor"],
  { env, input: password + "\n", encoding: "utf8" },
);
assert.equal(setup.status, 0, setup.stderr);
const second = spawnSync(
  "php",
  ["scripts/user.php", "create", "second@example.test", "Second editor"],
  { env, input: password + "\n", encoding: "utf8" },
);
assert.equal(second.status, 0, second.stderr);
const server = spawn(
  "php",
  ["-S", "127.0.0.1:8788", "-t", "public", "scripts/router.php"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
server.stderr.on("data", (d) => (log += d));
let cookie = "",
  csrf = "",
  uploaded,
  uploadedIcon;
async function call(action, body, { token = csrf, cookies = cookie } = {}) {
  const headers = { Cookie: cookies };
  const options = { headers };
  if (body !== undefined) {
    options.method = "POST";
    headers["X-CSRF-Token"] = token;
    if (body instanceof FormData) options.body = body;
    else {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }
  const r = await fetch(
    "http://127.0.0.1:8788/api.php?action=" + action,
    options,
  );
  const sc = r.headers.getSetCookie();
  if (sc.length) cookie = sc.map((s) => s.split(";")[0]).join("; ");
  const d = await r.json();
  if (d.csrf) csrf = d.csrf;
  return { status: r.status, data: d, headers: r.headers };
}
function pass(name) {
  console.log("PASS: " + name);
}
try {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch("http://127.0.0.1:8788/");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  let r = await call("public");
  assert.equal(r.data.demo, false);
  assert.equal(r.data.offers.length, 0);
  pass("Fresh live database contains no demo offers");
  const submissionCategory = r.data.categories[0].id;
  r = await call("admin");
  assert.equal(r.status, 401);
  pass("Anonymous admin read rejected");
  await call("session");
  r = await call("save", { kind: "categories", record: {} }, { token: "" });
  assert.equal(r.status, 403);
  pass("CSRF-less write rejected");
  const submission = {
    name: "Submission test venue",
    address: "Falmouth",
    contact: "Test owner",
    email: "owner@example.test",
    description: "A local independent business.",
    lat: 50.1541, lng: -5.0678,
    offer_title: "Test Friday offer",
    offer_description: "Save on your evening meal.",
    offer_redemption: "Mention Falmouth After Five.",
    categories: [submissionCategory],
    schedule_mode: "all", campaign_ids: [], roll_over: false,
    start_time: "17:00", end_time: "21:00",
    consent: "yes",
    website_confirm: "",
  };
  assert.equal(
    (await call("submit-business", submission, { token: "" })).status,
    403,
  );
  assert.equal(
    (await call("submit-business", { ...submission, email: "invalid" })).status,
    422,
  );
  assert.equal(
    (await call("submit-business", { ...submission, consent: "" })).status,
    422,
  );
  assert.equal(
    (await call("submit-business", { ...submission, website_confirm: "spam" }))
      .status,
    422,
  );
  for (const patch of [
    {description: 'a'.repeat(501)}, {offer_description:'a'.repeat(251)},
    {description:'<script>alert(1)</script>'}, {website:'javascript:alert(1)'},
    {lat: 100}, {lat:'50.15'}, {categories:['unknown']},
    {categories:[{}]}, {schedule_mode:'specific',campaign_ids:[]},
    {start_time:'25:00'}, {phone:'call me'}, {description: {html:'bad'}}
  ]) assert.equal((await call('submit-business',{...submission,...patch})).status,422);
  const generatedWebp=spawnSync('php',['-r', '$im=imagecreatetruecolor(80,60);imagewebp($im);imagedestroy($im);'],{env});
  assert.equal(generatedWebp.status,0);
  const submissionPhoto = (patch={}, bad=false) => {
    const form=new FormData();form.set('data',JSON.stringify({...submission,image_alt:'Business exterior',offer_image_alt:'Special meal',image_rights:'yes',...patch}));
    form.set('business_image',new Blob([generatedWebp.stdout],{type:'image/webp'}),'business.webp');
    form.set('offer_image',new Blob([bad?'<svg onload="alert(1)"/>':generatedWebp.stdout],{type:'image/webp'}),'offer.webp');
    return form;
  };
  assert.equal((await call('submit-business',submissionPhoto(),{token:''})).status,403);
  assert.equal((await call('submit-business',submissionPhoto({image_alt:''}))).status,422);
  assert.equal((await call('submit-business',submissionPhoto({image_rights:''}))).status,422);
  assert.equal((await call('submit-business',submissionPhoto({},true))).status,422);
  assert.equal((await readdir(path.join(temp,'submission-images'))).length,0,'Partially stored photos are removed after a rejected submission');
  assert.equal((await call('submit-business',submissionPhoto())).status,201);
  assert.equal((await call('submission-image&id=unknown&slot=business')).status,401);
  for (let i = 0; i < 4; i++)
    assert.equal((await call("submit-business", submission)).status, 201);
  assert.equal((await call("submit-business", submission)).status, 429);
  const publicAfterSubmission = (await call("public")).data;
  assert.equal(publicAfterSubmission.businesses.length, 0);
  assert.equal(
    JSON.stringify(publicAfterSubmission).includes("owner@example.test"),
    false,
  );
  assert.equal(
    (await call("review-submission", { id: "unknown" })).status,
    401,
  );
  pass(
    "Business submissions validate input, require CSRF, rate limit and remain private",
  );
  r = await call("login", { email: "test@example.test", password: "wrong" });
  assert.equal(r.status, 401);
  r = await call("login", { email: "test@example.test", password });
  assert.equal(r.status, 200);
  await call("session");
  r = await call("admin");
  assert.equal(r.status, 200);
  pass("Staff sign-in and authenticated CMS access");
  assert.equal(r.data.submissions.length, 5);
  const withPhotos=r.data.submissions.find(s=>s.business?.image);
  assert.equal(withPhotos.business.description,submission.description);
  assert.equal(withPhotos.offer_details.description,submission.offer_description);
  const privatePhotoName=withPhotos.business.image;
  const privatePhotoResponse=await fetch(`http://127.0.0.1:8788/api.php?action=submission-image&id=${withPhotos.id}&slot=business`,{headers:{Cookie:cookie}});
  assert.equal(privatePhotoResponse.status,200);
  assert.equal(privatePhotoResponse.headers.get('content-type'),'image/webp');
  assert.ok((await privatePhotoResponse.arrayBuffer()).byteLength>20);
  assert.equal((await call('submission-image&id='+withPhotos.id+'&slot=../../.env')).status,404);
  const submissionId = r.data.submissions[0].id;
  assert.equal(
    (await call("review-submission", { id: submissionId })).status,
    200,
  );
  assert.equal(
    (await call("admin")).data.submissions.find((s) => s.id === submissionId)
      .status,
    "reviewed",
  );
  pass("Staff can read submissions and mark them reviewed");
  assert.equal((await call('delete-submission',{id:submissionId},{token:''})).status,403);
  const anonymousDelete=await fetch('http://127.0.0.1:8788/api.php?action=delete-submission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:submissionId})});
  assert.equal(anonymousDelete.status,403);
  assert.equal((await call('delete-submission',{id:'missing'})).status,404);
  assert.equal((await call('delete-submission',{id:submissionId})).status,200);
  let trashed=(await call('admin')).data.submissions.find(s=>s.id===submissionId);
  assert.equal(trashed.status,'deleted');assert.ok(trashed.deleted_at);
  assert.equal((await call('review-submission',{id:submissionId})).status,422);
  assert.equal((await call('restore-submission',{id:submissionId})).status,200);
  assert.equal((await call('admin')).data.submissions.find(s=>s.id===submissionId).status,'reviewed');
  assert.equal((await call('delete-submission',{id:withPhotos.id})).status,200);
  assert.ok((await readFile(path.join(temp,'submission-images',privatePhotoName))).length>20);
  assert.equal((await call('restore-submission',{id:withPhotos.id})).status,200);
  pass('Request deletion requires CSRF and staff access; trash restores status and preserves photos');

  r = await call("save", {
    kind: "businesses",
    record: {
      name: "HTTP venue",
      address: "Falmouth",
      lat: 50.15,
      lng: -5.06,
      status: "published",
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const business = r.data.record;
  r = await call("save", {
    kind: "dates",
    record: { date: "2026-10-02", label: "First Friday", status: "published" },
  });
  assert.equal(r.status, 200);
  const date = r.data.record;
  const record = {
    title: "Food and drinks",
    business_id: business.id,
    status: "draft",
    categories: ["food", "drinks"],
    occurrences: [
      { date_id: date.id, start: "2026-10-02T17:00", end: "2026-10-03T01:00" },
    ],
  };
  r = await call("save", { kind: "offers", record });
  assert.equal(r.status, 200);
  let offer = r.data.record;
  r = await call("public");
  assert.equal(r.data.offers.length, 0);
  pass("Draft excluded from public API");
  r = await call("save", {
    kind: "offers",
    record: { ...offer, status: "published" },
  });
  assert.equal(r.status, 200);
  offer = r.data.record;
  r = await call("public");
  assert.equal(r.data.offers.length, 1);
  assert.equal(r.data.offers[0].categories.length, 2);
  assert.equal(
    r.data.offers[0].occurrences[0].end_iso,
    "2026-10-03T01:00:00+01:00",
  );
  assert.equal(r.data.offers[0].updated_by, undefined);
  pass("Published multi-category offer and UK overnight timing");
  r = await call("save", {
    kind: "offers",
    record: { ...offer, version: offer.version - 1 },
  });
  assert.equal(r.status, 409);
  pass("HTTP edit conflict protects latest version");
  const firstCookie = cookie,
    firstCsrf = csrf;
  cookie = "";
  csrf = "";
  await call("session");
  await call("login", { email: "second@example.test", password });
  await call("session");
  const before = (await call("admin")).data.offers.find(
    (o) => o.id === offer.id,
  );
  r = await call(
    "save",
    { kind: "offers", record: { ...offer, title: "Updated by first editor" } },
    { token: firstCsrf, cookies: firstCookie },
  );
  assert.equal(r.status, 200);
  r = await call("save", {
    kind: "offers",
    record: { ...before, title: "Stale second edit" },
  });
  assert.equal(r.status, 409);
  cookie = firstCookie;
  csrf = firstCsrf;
  pass("Two independent staff sessions cannot silently overwrite each other");
  let f = new FormData();
  f.set(
    "image",
    new Blob(["<?php echo 1; ?>"], { type: "image/jpeg" }),
    "attack.jpg",
  );
  r = await call("upload", f);
  assert.equal(r.status, 422);
  pass("Disguised executable upload rejected");
  f = new FormData();
  f.set(
    "image",
    new Blob([await readFile("public/assets/logo.png")], { type: "image/png" }),
    "logo.png",
  );
  r = await call("upload", f);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  uploaded = r.data.path;
  assert.match(uploaded, /^uploads\/[a-f0-9]{32}\.webp$/);
  assert.ok((await readFile("public/" + uploaded)).length > 100);
  pass("Image upload is re-encoded with generated filename");
  const svgForm = new FormData();
  svgForm.set(
    "image",
    new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
      ],
      { type: "image/svg+xml" },
    ),
    "icon.svg",
  );
  r = await call("upload-icon", svgForm);
  assert.equal(r.status, 200);
  uploadedIcon = r.data.path;
  assert.match(uploadedIcon, /^uploads\/[a-f0-9]{32}\.svg$/);
  const custom = await call("save", {
    kind: "categories",
    record: {
      name: "Custom icon",
      colour: "#123ABC",
      icon: uploadedIcon,
      active: true,
    },
  });
  assert.equal(custom.status, 200);
  const badSvg = new FormData();
  badSvg.set(
    "image",
    new Blob(['<svg onload="alert(1)"/>'], { type: "image/svg+xml" }),
    "attack.svg",
  );
  assert.equal((await call("upload-icon", badSvg)).status, 422);
  pass("SVG upload validates content and custom categories persist");

  r = await call("save", {
    kind: "businesses",
    record: { ...business, status: "archived" },
  });
  assert.equal(r.status, 200);
  r = await call("public");
  assert.equal(r.data.offers.length, 0);
  pass("Archive removes venue offers publicly");
  const bdir = path.join(temp, "backup");
  const backup = spawnSync("php", ["scripts/backup.php", bdir], {
    env,
    encoding: "utf8",
  });
  assert.equal(backup.status, 0, backup.stderr);
  assert.ok((await readFile(path.join(bdir, uploaded))).length > 100);
  assert.ok((await readFile(path.join(bdir,'submission-images',privatePhotoName))).length>20);
  pass("Backup includes public and private submission media as well as database");
  const integrity = spawnSync(
    "php",
    [
      "-r",
      `$d=new PDO('sqlite:'.getenv('APP_DATA_DIR').'/backup/content.sqlite'); if($d->query('PRAGMA integrity_check')->fetchColumn()!=='ok')exit(1);`,
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(integrity.status, 0);
  const restorePublic = path.join(temp, "restored-site");
  await mkdir(path.join(restorePublic, "uploads"), { recursive: true });
  const restore = spawnSync(
    "php",
    ["scripts/restore.php", bdir, "--confirm-offline"],
    { env: { ...env, APP_PUBLIC_DIR: restorePublic }, encoding: "utf8" },
  );
  assert.equal(restore.status, 0, restore.stderr);
  assert.ok((await readFile(path.join(restorePublic, uploaded))).length > 100);
  assert.ok((await readFile(path.join(temp,'submission-images',privatePhotoName))).length>20);
  pass("Restore command recovers the database, uploads and private submission photos");
  assert.equal((await call("users")).status, 403);
  assert.equal(
    (await call("invite-user", { email: "forbidden@example.test", name: "No" }))
      .status,
    403,
  );
  const promoted = spawnSync(
    "php",
    ["scripts/user.php", "promote", "test@example.test"],
    { env, encoding: "utf8" },
  );
  assert.equal(promoted.status, 0);
  await call("session");
  await call("login", { email: "test@example.test", password });
  await call("session");
  assert.equal((await call("users")).status, 200);
  const invited = await call("invite-user", {
    email: "invited@example.test",
    name: "Invited editor",
  });
  assert.equal(invited.status, 200);
  const firstToken = invited.data.token;
  const invitedUser = (await call("users")).data.users.find(
    (u) => u.email === "invited@example.test",
  );
  assert.equal(invitedUser.active, 0);
  const secondToken = (await call("reset-user", { id: invitedUser.id })).data
    .token;
  assert.equal(
    (await call("activate-account", { token: firstToken, password })).status,
    422,
  );
  assert.equal(
    (await call("activate-account", { token: secondToken, password })).status,
    200,
  );
  assert.equal(
    (await call("activate-account", { token: secondToken, password })).status,
    422,
  );
  const adminCookie = cookie,
    adminCsrf = csrf;
  await call("logout", {});
  await call("session");
  await call("login", { email: "invited@example.test", password });
  await call("session");
  const invitedCookie = cookie;
  assert.equal((await call("users")).status, 403);
  // Re-authenticate the super-admin, then disable the invited user's active session.
  await call("logout", {});
  await call("session");
  await call("login", { email: "test@example.test", password });
  await call("session");
  assert.equal(
    (await call("disable-user", { id: invitedUser.id })).status,
    200,
  );
  const superCookie = cookie,
    superCsrf = csrf;
  assert.equal(
    (await call("admin", undefined, { cookies: invitedCookie })).status,
    401,
  );
  cookie = superCookie;
  csrf = superCsrf;
  pass(
    "Role enforcement, invitations, reset rotation, single-use activation and account disabling",
  );
  const oldCookie = cookie;
  r = await call("password", { current: password, password: password + "new" });
  assert.equal(r.status, 200);
  pass("Password change endpoint validates and updates password");
  r = await call("logout", {});
  assert.equal(r.status, 200);
  r = await call("admin");
  assert.equal(r.status, 401);
  pass("Logout revokes access");
  await call("session");
  for (let i = 0; i < 10; i++)
    await call("login", { email: "test@example.test", password: "wrong" });
  r = await call("login", {
    email: "test@example.test",
    password: password + "new",
  });
  assert.equal(r.status, 429);
  pass("Login throttling enforced");
  for (const resource of [
    "/.env",
    "/../.env",
    "/server/bootstrap.php",
    "/private/content.sqlite",
  ]) {
    const res = await fetch("http://127.0.0.1:8788" + resource);
    const body = await res.text();
    assert.ok(
      !body.includes("MAPBOX_PUBLIC_TOKEN=") &&
        !body.includes("SQLite format 3") &&
        !body.includes("function envv"),
    );
  }
  pass("Private runtime files are not served by the public document root");
  console.log("HTTP integration checks passed.");
} finally {
  server.kill();
  if (uploadedIcon)
    await rm(path.join(root, "public", uploadedIcon), { force: true });
  if (uploaded) await rm(path.join(root, "public", uploaded), { force: true });
  await rm(temp, { recursive: true, force: true });
}
