import test from 'node:test';
import assert from 'node:assert/strict';
import { DemandRegistry, acceptCaption, normalizePreference, createInvite } from '../core.js';
test('mixed preferences share one transcription and one translation per language', () => {
  const registry = new DemandRegistry();
  registry.update('a', { enabled: false, language: 'zh' }, 0, 100);
  registry.update('b', { enabled: true, language: 'zh' }, 0, 100);
  registry.update('c', { enabled: true, language: 'en' }, 0, 100);
  registry.update('d', { enabled: true, language: 'en' }, 0, 100);
  assert.deepEqual(registry.summary(101), { listeners: 4, captionUsers: 3, stt: true, translations: ['en'] });
  registry.update('c', { enabled: false, language: 'en' }, 1, 102);
  assert.deepEqual(registry.summary(103).translations, ['en']);
  registry.remove('d');
  assert.deepEqual(registry.summary(104).translations, []);
  assert.equal(registry.summary(104).stt, true);
  registry.update('b', { enabled: false, language: 'zh' }, 1, 105);
  assert.equal(registry.summary(106).stt, false);
});
test('lease expiry recovers demand when a tab vanishes', () => {
  const registry = new DemandRegistry({ leaseMs: 1000 });
  registry.update('a', { enabled: true, language: 'en' }, 1, 0);
  assert.equal(registry.summary(999).stt, true);
  assert.deepEqual(registry.summary(1000), { listeners: 0, captionUsers: 0, stt: false, translations: [] });
});
test('stale updates cannot re-enable cancelled demand', () => {
  const registry = new DemandRegistry();
  registry.update('a', { enabled: true, language: 'en' }, 1, 0);
  registry.update('a', { enabled: false, language: 'en' }, 2, 1);
  assert.equal(registry.update('a', { enabled: true, language: 'en' }, 1, 2), false);
  assert.equal(registry.update('a', { enabled: true, language: 'en' }, 2, 2), false);
  assert.equal(registry.summary(3).stt, false);
});
test('unsupported languages cannot create demand', () => {
  assert.throws(() => normalizePreference({ enabled: true, language: 'arbitrary' }));
  assert.throws(() => normalizePreference({ enabled: 'true', language: 'en' }));
});
const event = { roomId: 'r1', segmentId: 's1', sequence: 0, revision: 1, language: 'zh', text: '你好', final: false };
test('caption isolation, revisions and finality', () => {
  let captions = acceptCaption([], event, 'r1');
  assert.equal(captions.length, 1);
  assert.equal(acceptCaption(captions, { ...event, roomId: 'r2' }, 'r1'), captions);
  assert.equal(acceptCaption(captions, { ...event, text: 'stale' }, 'r1'), captions);
  captions = acceptCaption(captions, { ...event, revision: 2, final: true, text: '你好。' }, 'r1');
  assert.equal(captions.length, 1);
  assert.equal(captions[0].text, '你好。');
  assert.equal(acceptCaption(captions, { ...event, revision: 3 }, 'r1'), captions);
});
test('caption languages coexist and history stays bounded', () => {
  let captions = [];
  for (let i = 0; i < 110; i++) captions = acceptCaption(captions, { ...event, segmentId: String(i), sequence: i }, 'r1');
  assert.equal(captions.length, 100);
  captions = acceptCaption(captions, { ...event, segmentId: '109', sequence: 109, language: 'en', text: 'Hello' }, 'r1');
  assert.equal(captions.filter(c => c.segmentId === '109').length, 2);
});
test('malformed or oversized captions are rejected', () => {
  assert.deepEqual(acceptCaption([], { ...event, text: 'x'.repeat(4001) }, 'r1'), []);
  assert.deepEqual(acceptCaption([], { ...event, sequence: NaN }, 'r1'), []);
  assert.deepEqual(acceptCaption([], { ...event, language: '__proto__' }, 'r1'), []);
});
test('invite entropy is independent of four-digit display codes', () => {
  const a = createInvite(), b = createInvite();
  assert.match(a, /^[a-f0-9]{48}$/); assert.notEqual(a, b);
});
