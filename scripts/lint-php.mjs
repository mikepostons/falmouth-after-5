import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (file === "public/build") continue;
    if (entry.isDirectory()) await walk(file);
    else if (file.endsWith(".php")) {
      const r = spawnSync("php", ["-l", file], { encoding: "utf8" });
      process.stdout.write(r.stdout);
      if (r.status !== 0) {
        process.stderr.write(r.stderr);
        process.exit(r.status || 1);
      }
    }
  }
}
for (const dir of ["server", "public", "scripts", "tests"]) await walk(dir);
