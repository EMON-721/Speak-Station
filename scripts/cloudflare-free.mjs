import fs from "node:fs";
import { spawnSync } from "node:child_process";

const command = process.argv[2] || "build";
const templateFile = "wrangler.cloudflare.jsonc";
const generatedFile = "wrangler.cloudflare.generated.jsonc";
const placeholderId = "00000000-0000-4000-8000-000000000000";

function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function preparedConfig() {
  let raw = fs.readFileSync(templateFile, "utf8");
  const dbId = process.env.SPEAK_D1_DATABASE_ID?.trim();
  const origin = process.env.SPEAK_APP_ORIGIN?.trim();
  const owner = process.env.SPEAK_ADMIN_EMAIL?.trim();

  if (dbId) {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(dbId)) {
      throw new Error("SPEAK_D1_DATABASE_ID must be the UUID shown in your Cloudflare D1 database.");
    }
    raw = raw.replace(placeholderId, dbId);
  }
  if (origin) {
    let url;
    try { url = new URL(origin); } catch { throw new Error("SPEAK_APP_ORIGIN must be a full HTTPS URL."); }
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("SPEAK_APP_ORIGIN must be the site's HTTPS origin without any path or query.");
    }
    raw = raw.replace("https://speak-station.YOUR_SUBDOMAIN.workers.dev", url.origin);
  }
  if (owner) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)) {
      throw new Error("SPEAK_ADMIN_EMAIL must be the owner's verified Google email.");
    }
    raw = raw.replace("YOUR_VERIFIED_GOOGLE_EMAIL", owner);
  }

  const missing = [];
  if (raw.includes(placeholderId)) missing.push("SPEAK_D1_DATABASE_ID");
  if (raw.includes("YOUR_SUBDOMAIN")) missing.push("SPEAK_APP_ORIGIN");
  if (raw.includes("YOUR_VERIFIED_GOOGLE_EMAIL")) missing.push("SPEAK_ADMIN_EMAIL");
  if (missing.length) throw new Error(
    "Cloudflare deployment not configured. Add the following Cloudflare BUILD variables (or fill the template file): " +
    missing.join(", ")
  );
  if (/"r2_buckets"\s*:/.test(raw)) throw new Error("Standalone Free hosting must not bind paid R2.");
  if (!raw.includes('"CONTENT_UPDATES_ALLOWED": "disabled"')) {
    throw new Error("Standalone hosting must disable the private Sites content updater.");
  }
  if (!/"AUTH_MODE"\s*:\s*"google"/.test(raw)) {
    throw new Error("Standalone hosting requires verified Google identity.");
  }
  // Same directory as the source config keeps main/assets/migration relative paths correct.
  // Ignored by Git; values are inserted only in the build workspace, never committed.
  fs.writeFileSync(generatedFile, raw, { mode: 0o600 });
  return generatedFile;
}

if (command === "build") {
  run(["scripts/run-framework.mjs", "build"], { SPEAK_CLOUDFLARE_BUILD: "1" });
  const generated = JSON.parse(fs.readFileSync("dist/server/wrangler.json", "utf8"));
  if (generated.r2_buckets?.length) throw new Error("Standalone Free build must not require R2.");
  console.log("Cloudflare Free build ready. Deploy with the standalone configuration.");
} else if (command === "check") {
  preparedConfig();
  console.log("Cloudflare account-specific configuration is ready; secrets and database permissions still need to be set in Cloudflare.");
} else if (command === "migrate") {
  const config = preparedConfig();
  run(["node_modules/wrangler/bin/wrangler.js", "d1", "migrations", "apply", "DB", "--remote", "--config", config]);
} else if (command === "deploy") {
  const config = preparedConfig();
  if (!fs.existsSync("dist/server/wrangler.json") ||
      JSON.parse(fs.readFileSync("dist/server/wrangler.json", "utf8")).r2_buckets?.length) {
    throw new Error("Run build:cloudflare first; do not deploy the native Sites configuration.");
  }
  run(["node_modules/wrangler/bin/wrangler.js", "deploy", "--config", config]);
} else {
  throw new Error("Use build, check, migrate or deploy.");
}
