import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { join } from "path";

const root = process.cwd();

for (const dir of [".next", join("node_modules", ".cache")]) {
  const target = join(root, dir);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  }
}

for (const file of [".scrape.lock"]) {
  const target = join(root, file);
  if (existsSync(target)) {
    rmSync(target, { force: true });
    console.log(`Removed ${file}`);
  }
}

if (process.platform === "win32") {
  try {
    const output = execSync('netstat -ano | findstr ":3000"', { encoding: "utf8" });
    const pids = new Set(
      output
        .split("\n")
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid) => pid && /^\d+$/.test(pid)),
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Stopped process on port 3000 (pid ${pid})`);
      } catch {
        // ignore
      }
    }
  } catch {
    // nothing listening
  }
}

console.log("Clean complete. Run: npm run dev");
