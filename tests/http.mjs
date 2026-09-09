import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
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
  uploaded;
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
  r = await call("admin");
  assert.equal(r.status, 401);
  pass("Anonymous admin read rejected");
  await call("session");
  r = await call("save", { kind: "categories", record: {} }, { token: "" });
  assert.equal(r.status, 403);
  pass("CSRF-less write rejected");
  r = await call("login", { email: "test@example.test", password: "wrong" });
  assert.equal(r.status, 401);
  r = await call("login", { email: "test@example.test", password });
  assert.equal(r.status, 200);
  await call("session");
  r = await call("admin");
  assert.equal(r.status, 200);
  pass("Staff sign-in and authenticated CMS access");
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
  assert.match(uploaded, /^uploads\/[a-f0-9]{32}\.jpg$/);
  assert.ok((await readFile("public/" + uploaded)).length > 100);
  pass("Image upload is re-encoded with generated filename");
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
  pass("Backup includes uploaded media as well as database");
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
  pass("Restore command recovers the database and uploaded media");
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
  if (uploaded) await rm(path.join(root, "public", uploaded), { force: true });
  await rm(temp, { recursive: true, force: true });
}
