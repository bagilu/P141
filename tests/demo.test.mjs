import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoTour } from '../demo.js';
const waitFor = async (predicate, timeout = 2000) => {
  const started = Date.now();
  while (!predicate()) { if (Date.now() - started > timeout) throw new Error('event timeout'); await new Promise(resolve => setTimeout(resolve, 10)); }
};
test('host + independent visitors: cancellation, shared languages and ended propagation', async () => {
  let hostDemand;
  const english = [], chinese = [];
  const host = new DemoTour(e => { if (e.type === 'demand') hostDemand = e; });
  const a = new DemoTour(e => english.push(e));
  const b = new DemoTour(e => chinese.push(e));
  try {
    await host.connect({ guide: true });
    await a.connect({ invite: host.roomId }); await b.connect({ invite: host.roomId });
    await a.setPreference({ enabled: true, language: 'en' });
    await b.setPreference({ enabled: true, language: 'zh' });
    await waitFor(() => hostDemand?.captionUsers === 2);
    host.sample();
    await waitFor(() => english.some(e => e.type === 'caption' && e.caption.language === 'en'));
    assert.equal(chinese.some(e => e.type === 'caption' && e.caption.language === 'zh'), true);
    await a.setPreference({ enabled: false, language: 'en' });
    await waitFor(() => hostDemand?.translations.length === 0);
    assert.equal(hostDemand.stt, true);
    await b.setPreference({ enabled: false, language: 'zh' });
    await waitFor(() => hostDemand?.stt === false);
    const count = english.filter(e => e.type === 'caption').length;
    host.sample(); await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(english.filter(e => e.type === 'caption').length, count);
    await host.leave();
    await waitFor(() => english.some(e => e.type === 'ended'));
  } finally { host.close(); a.close(); b.close(); }
});
