import { spawn } from "child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  RUN_SCRAPE_ON_START: "true",
};

function start(label, args) {
  const child = spawn(npmCmd, args, {
    stdio: "inherit",
    shell: true,
    env,
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${label} exited with code ${code}`);
    }
  });

  return child;
}

console.log("Local mode: dashboard + background scraper (Instagram + TikTok)");
console.log("- Dashboard: http://localhost:3000");
console.log("- Scraper runs on start, then daily on CRON_SCHEDULE");
console.log("Press Ctrl+C to stop both.\n");

const dev = start("dev", ["run", "dev"]);
const cron = start("cron", ["run", "cron"]);

function shutdown() {
  dev.kill();
  cron.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
