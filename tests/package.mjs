import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import {
  mkdtemp,
  readFile,
  writeFile,
  cp,
  mkdir,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const root = process.cwd(),
  made = spawnSync("php", ["scripts/package.php"], { encoding: "utf8" });
assert.equal(made.status, 0, made.stderr);
const zip = made.stdout.trim(),
  release = zip.replace(/\.zip$/, "");
const manifest = JSON.parse(await readFile(release + "/SHA256.json", "utf8"));
assert.ok(
  !Object.keys(manifest).some(
    (f) =>
      f.endsWith(".sqlite") ||
      f.endsWith("/.env") ||
      f.includes("local-access") ||
      f.includes("demo.php"),
  ),
);
console.log("PASS: Release omits local credentials, demo seed and databases");
const envText = await readFile(".env", "utf8");
const token = envText.match(/^MAPBOX_PUBLIC_TOKEN=(.*)$/m)?.[1]?.trim();
if (token)
  for (const f of Object.keys(manifest)) {
    const content = await readFile(release + "/" + f);
    assert.ok(
      !content.includes(Buffer.from(token)),
      `Token unexpectedly included in ${f}`,
    );
  }
console.log("PASS: Configured Mapbox token is absent from release files");
const temp = await mkdtemp(path.join(tmpdir(), "faf-package-"));
const site = temp + "/web/discover-falmouth/falmouth-after-5/app",
  runtime = temp + "/runtime";
await mkdir(site, { recursive: true });
await cp(release + "/site", site, { recursive: true });
await cp(release + "/runtime", runtime, { recursive: true });
await writeFile(
  site + "/bootstrap-path.php",
  `<?php return ${JSON.stringify(runtime)};\n`,
);
await writeFile(
  runtime + "/.env",
  `APP_ENV=production\nDEMO_MODE=false\nAPP_DATA_DIR=${temp}/data\nAPP_PUBLIC_DIR=${site}\nMAPBOX_PUBLIC_TOKEN=\n`,
);
const check = spawnSync("php", [runtime + "/scripts/check.php"], {
  env: { ...process.env, MAPBOX_PUBLIC_TOKEN: "pk.test-only" },
  encoding: "utf8",
});
assert.equal(check.status, 0, check.stdout + check.stderr);
console.log(
  "PASS: Packaged production runtime and host check work from private directory",
);
const server = spawn("php", ["-S", "127.0.0.1:8789", "-t", temp + "/web"], {
  stdio: "ignore",
});
const base = "http://127.0.0.1:8789/discover-falmouth/falmouth-after-5/app/";
try {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(base);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const page = await fetch(base + "?offer=missing&view=list");
  assert.equal(page.status, 200);
  const html = await page.text();
  const assets = [
    ...html.matchAll(/(?:src|href)="(\.\/build\/assets\/[^\"]+)"/g),
  ].map((m) => m[1]);
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    const r = await fetch(new URL(asset, base));
    assert.equal(r.status, 200);
  }
  console.log(
    "PASS: Nested /app/ path serves frontend assets and direct-link refresh",
  );
  const pub = await (await fetch(base + "api.php?action=public")).json();
  assert.equal(pub.demo, false);
  assert.equal(pub.offers.length, 0);
  assert.equal(pub.categories.length, 5);
  assert.equal(pub.config.mapboxToken, "");
  console.log("PASS: Packaged public API starts with clean production content");
  const session = await fetch(base + "api.php?action=session");
  assert.equal(session.status, 403);
  console.log("PASS: Production staff endpoints reject plain HTTP");
  for (const privatePath of [
    "/runtime/.env",
    "/data/content.sqlite",
    base.replace("http://127.0.0.1:8789", "") + ".env",
  ]) {
    const r = await fetch("http://127.0.0.1:8789" + privatePath);
    const body = await r.text();
    assert.ok(
      !body.includes("APP_DATA_DIR=") && !body.includes("SQLite format 3"),
    );
    if (!privatePath.endsWith("/app/.env")) assert.equal(r.status, 404);
  }
  console.log(
    "PASS: Private runtime and data are unreachable from public document root",
  );
  console.log("Package smoke checks passed.");
} finally {
  server.kill();
  await rm(temp, { recursive: true, force: true });
}
