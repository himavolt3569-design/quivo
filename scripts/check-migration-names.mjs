#!/usr/bin/env node
/**
 * Reject migration filenames that share a YYYYMMDDHHMMSS prefix.
 *
 * Two files with the same timestamp run in filesystem order, which is
 * undefined across machines. The plan-cement-rule is: every migration filename
 * matches `^YYYYMMDDHHMMSS_<snake_case>.sql$` and the timestamp is unique.
 *
 * Usage:
 *   node scripts/check-migration-names.mjs
 *
 * Exit codes:
 *   0  all good
 *   1  collision or malformed name detected
 */

import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const NAME_RE = /^(\d{14})_[a-z0-9][a-z0-9_]*\.sql$/;

// Historical timestamp collisions that pre-date this check. They are already
// applied to every existing deployment so renaming them would break the
// `supabase_migrations.schema_migrations` audit trail. New collisions are
// rejected; these two stay grandfathered.
const LEGACY_COLLISION_ALLOWLIST = new Set([
  "20240101000007", // dashboard_upgrade ↔ profiles_insert_font_size
  "20240101000012", // decouple_ui_scaling ↔ owner_foundation
]);

async function main() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (err) {
    console.error(`✗ Cannot read ${MIGRATIONS_DIR}: ${err.message}`);
    process.exit(1);
  }

  const sqlFiles = entries.filter((e) => e.endsWith(".sql"));
  if (sqlFiles.length === 0) {
    console.log("✓ No migrations to check.");
    return;
  }

  const malformed = [];
  const byTimestamp = new Map();

  for (const file of sqlFiles) {
    const match = NAME_RE.exec(file);
    if (!match) {
      malformed.push(file);
      continue;
    }
    const ts = match[1];
    const list = byTimestamp.get(ts) ?? [];
    list.push(file);
    byTimestamp.set(ts, list);
  }

  const collisions = [...byTimestamp.entries()].filter(
    ([ts, files]) => files.length > 1 && !LEGACY_COLLISION_ALLOWLIST.has(ts),
  );

  const grandfathered = [...byTimestamp.entries()].filter(
    ([ts, files]) => files.length > 1 && LEGACY_COLLISION_ALLOWLIST.has(ts),
  );

  if (malformed.length === 0 && collisions.length === 0) {
    if (grandfathered.length > 0) {
      console.log(
        `✓ ${sqlFiles.length} migrations look healthy (${grandfathered.length} grandfathered legacy collision[s] ignored).`,
      );
    } else {
      console.log(`✓ ${sqlFiles.length} migrations look healthy.`);
    }
    return;
  }

  if (malformed.length > 0) {
    console.error(`✗ ${malformed.length} migration(s) have malformed names:`);
    for (const file of malformed) {
      console.error(`    ${file}`);
    }
    console.error("  Expected: YYYYMMDDHHMMSS_short_snake_case.sql");
  }

  if (collisions.length > 0) {
    console.error(`✗ ${collisions.length} timestamp collision(s):`);
    for (const [ts, files] of collisions) {
      console.error(`    [${ts}]`);
      for (const f of files) console.error(`      - ${f}`);
    }
  }

  process.exit(1);
}

main().catch((err) => {
  console.error(`✗ Unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
