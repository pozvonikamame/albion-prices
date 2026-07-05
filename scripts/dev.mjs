import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", process.env.DEV_PORT || "3000"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-dev" },
});

child.on("exit", (code) => process.exit(code ?? 0));
