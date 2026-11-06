#!/usr/bin/env node
/**
 * Operator-only: upsert src/data/businesses.json into Convex
 * `directoryBusinesses` in batches.
 *
 * Requires CONVEX_URL (https://<deployment>.convex.cloud) and
 * DIRECTORY_SEED_KEY matching the Convex env of the same name.
 * Never run this from CI. It does not set credentials.
 */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const BATCH = 80;
const listings = JSON.parse(
  readFileSync(new URL("../src/data/businesses.json", import.meta.url), "utf8"),
);
const url = process.env.CONVEX_URL?.trim();
const adminKey = process.env.DIRECTORY_SEED_KEY?.trim();

if (!url || !adminKey) {
  console.log(
    `Dry run: would upsert ${listings.length} listings in batches of ${BATCH}. Set CONVEX_URL and DIRECTORY_SEED_KEY to seed.`,
  );
  process.exit(0);
}

const client = new ConvexHttpClient(url);
const seedBatch = makeFunctionReference("directory:seedBatch");
let upserted = 0;
for (let i = 0; i < listings.length; i += BATCH) {
  const slice = listings.slice(i, i + BATCH);
  const result = await client.mutation(seedBatch, { adminKey, listings: slice });
  upserted += result.upserted;
  console.log(`seeded ${upserted}/${listings.length}`);
}
console.log(`done: ${upserted} listings`);
