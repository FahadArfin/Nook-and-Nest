import { cpSync, existsSync, mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The protected source manifest describes the original static handoff. The
// generated manifest includes the private-project DB and must survive packaging.
const build = resolve('dist');
for (const file of ['client/index.html', 'server/index.js', '.openai/hosting.json', '.openai/drizzle/meta/_journal.json']) {
  if (!existsSync(join(build, file))) throw new Error(`Run the production build first: missing ${file}`);
}
const source = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
const generated = JSON.parse(readFileSync(join(build, '.openai/hosting.json'), 'utf8'));
if (generated.project_id !== source.project_id || generated.d1 !== 'DB') throw new Error('Unexpected release identity or database binding');
const stage = mkdtempSync(join(tmpdir(), 'nook-nest-release-'));
mkdirSync(join(stage, '.openai'));
cpSync(build, join(stage, 'dist'), { recursive: true });
cpSync(join(build, '.openai/hosting.json'), join(stage, '.openai/hosting.json'));
cpSync(join(build, '.openai/drizzle'), join(stage, 'drizzle'), { recursive: true });
console.log(stage);
