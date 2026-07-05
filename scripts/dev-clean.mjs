import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const distDir = process.env.NEXT_DIST_DIR || ".next-dev";
const port = process.env.DEV_PORT || "3000";

async function freePort(targetPort) {
  try {
    const killPort = require("kill-port");
    await killPort(targetPort, "tcp");
    console.log(`Freed port ${targetPort}`);
  } catch {
    // Port already free or kill-port unavailable.
  }
}

rmSync(distDir, { recursive: true, force: true });
console.log(`Removed ${distDir}`);

await freePort(Number(port));

const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: distDir },
});

child.on("exit", (code) => process.exit(code ?? 0));
