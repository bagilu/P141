import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('vendor', { recursive: true });
const assets = [
  ['node_modules/livekit-client/dist/livekit-client.umd.js', 'vendor/livekit-client.umd.js'],
  ['node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'vendor/supabase.js'],
  ['node_modules/qrcode-generator/dist/qrcode.js', 'vendor/qrcode.js']
];
for (const [source, destination] of assets) await copyFile(source, destination);
await copyFile('node_modules/livekit-client/LICENSE', 'vendor/LICENSE-livekit.txt');
const licenses = [];
for (const name of ['livekit-client', '@supabase/supabase-js', 'qrcode-generator']) {
  const manifest = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'));
  licenses.push(`${name} ${manifest.version}: ${manifest.license}`);
}
await writeFile('vendor/NOTICE.txt', licenses.join('\n') + '\n');
console.log('Browser libraries copied locally; invite links never go to a QR image service.');
