#!/usr/bin/env node
// Check the JSON files in /data against the data contract.
// Usage: node tools/validate_data.mjs [dataDir]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VALIDATORS } from "../js/contract.js";

const dir = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "data");
let failed = false;

for (const [name, validate] of Object.entries(VALIDATORS)) {
  const file = join(dir, `${name}.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.log(`✗ ${name}.json: cannot read/parse (${err.message})`);
    failed = true;
    continue;
  }
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
process.exit(failed ? 1 : 0);
