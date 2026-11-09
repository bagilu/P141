import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const html = await readFile('index.html', 'utf8');
for (const path of ['app.js', 'core.js', 'demo.js', 'cloud.js', 'scripts/serve.mjs']) execFileSync(process.execPath, ['--check', path]);
for (const path of [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(p => !p.startsWith('http') && p !== './')) await readFile(path.split('?')[0]);
for (const asset of ['style.css', 'app.js', 'vendor/qrcode.js', 'vendor/supabase.js', 'vendor/livekit-client.umd.js']) assert.ok(html.includes(`${asset}?v=0.001`), `cache version: ${asset}`);
for (const path of ['app.js', 'cloud.js']) {
  const source = await readFile(path, 'utf8');
  assert.ok(!/\.from\s*\(/.test(source), `No direct database access: ${path}`);
  assert.ok(!/api\.qrserver|SpeechRecognition|webkitSpeechRecognition/.test(source));
}
assert.ok(html.includes('Web Version V0.001'));
assert.ok(html.includes('尚未完成驗收'));
assert.ok(!(await readdir('vendor')).includes('config.js'));
console.log('PASS: syntax, local assets, versioning, RPC-only frontend and explicit verification labels.');
