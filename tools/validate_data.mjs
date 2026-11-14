#!/usr/bin/env node
// Check the JSON files in /data against the data contract.
// Usage: node tools/validate_data.mjs [dataDir]
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VALIDATORS, validateScenariosCover } from "../js/contract.js";
import { OPTIONAL_FILES } from "../js/config.js";

const dir = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "data");
let failed = false;
const loaded = {};

for (const [name, validate] of Object.entries(VALIDATORS)) {
  const file = join(dir, `${name}.json`);
  if (OPTIONAL_FILES.includes(name) && !existsSync(file)) {
    console.log(`- ${name}.json: not present (optional)`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.log(`✗ ${name}.json: cannot read/parse (${err.message})`);
    failed = true;
    continue;
  }
  loaded[name] = data;
  const problems = validate(data);
  const prov = JSON.stringify(Array.isArray(data) ? data[0]?.provenance : data.provenance);
  if (problems.length) {
    failed = true;
    console.log(`✗ ${name}.json (${problems.length} problems)`);
    problems.slice(0, 15).forEach((p) => console.log("   - " + p));
  } else {
    console.log(`✓ ${name}.json  provenance=${prov}`);
  }
}
const cover = validateScenariosCover(loaded.scenarios, loaded.rotations);
if (cover.length) {
  failed = true;
  console.log(`✗ scenarios.json does not cover every rotation (${cover.length} problems)`);
  cover.slice(0, 15).forEach((p) => console.log("   - " + p));
} else if (loaded.scenarios && loaded.rotations) console.log("✓ scenarios.json scores and ranks every rotation");
process.exit(failed ? 1 : 0);
