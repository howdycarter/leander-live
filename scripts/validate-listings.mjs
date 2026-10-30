// Validate src/data/submitted-listings.json. Exits 1 when it is invalid.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateSubmittedListings } from './lib/submitted-listings.mjs';

const path = join(import.meta.dirname, '..', 'src', 'data', 'submitted-listings.json');
const { ok, problems } = validateSubmittedListings(JSON.parse(readFileSync(path, 'utf8')));
if (!ok) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log('submitted-listings.json is valid');
