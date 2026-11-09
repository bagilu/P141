import { DemandRegistry, createInvite } from './core.js?v=0.001';
const samples = [
  ['歡迎參加今天的導覽，我們將一起探索這個地方的故事。', 'Welcome to today’s tour. Together, we will explore the stories of this place.'],
  ['請留意右手邊的展品，我們會在這裡停留十分鐘。', 'Please look at the exhibit on your right. We will stay here for ten minutes.'],
  ['我們下午三點二十分在入口集合，請不要遲到。', 'We will meet at the entrance at 3:20 p.m. Please be on time.']
];
export class DemoTour {
  constructor(onEvent) { this.onEvent = onEvent; this.registry = new DemandRegistry(); this.id = crypto.randomUUID(); this.version = 0; this.preference = { enabled: false, language: 'zh' }; this.sequence = 0; this.active = false; }
  async connect({ invite, guide = false }) {
    if (!globalThis.BroadcastChannel) throw new Error('此瀏覽器不支援分頁示範，請使用較新的 Chrome 或 Safari。');
    this.guide = guide; this.roomId = invite || createInvite();
    this.channel = new BroadcastChannel(`P141.demo.${this.roomId}`);
    this.channel.onmessage = ({ data }) => this.receive(data);
    this.active = true; this.lastGuide = Date.now();
    this.timer = setInterval(() => this.tick(), 3000);
    this.onEvent({ type: 'connected', roomId: this.roomId, guide, mode: 'demo' });
    this.tick();
  }
  send(data) { this.channel?.postMessage({ ...data, roomId: this.roomId }); }
  tick() {
    if (!this.active) return;
    if (this.guide) this.publishDemand();
    else {
      this.send({ type: 'preference', id: this.id, ...this.preference, version: this.version });
      if (Date.now() - this.lastGuide > 15000) this.onEvent({ type: 'waiting', message: '尚未收到導遊分頁回應。請保持同一瀏覽器的導遊分頁開啟。' });
    }
  }
  publishDemand() {
    const event = { type: 'demand', ...this.registry.summary() };
    this.onEvent(event); this.send(event);
  }
  receive(data) {
    if (!data || data.roomId !== this.roomId || !this.active) return;
    if (this.guide && data.type === 'preference') {
      try { this.registry.update(data.id, data, data.version); this.publishDemand(); } catch { /* Ignore malformed demo messages. */ }
    } else if (this.guide && data.type === 'leave') { this.registry.remove(data.id); this.publishDemand(); }
    else if (!this.guide && ['demand', 'caption', 'ended'].includes(data.type)) {
      this.lastGuide = Date.now(); this.onEvent(data);
      if (data.type === 'ended') this.close();
    }
  }
  async setPreference(preference) { this.preference = preference; this.version++; this.tick(); }
  sample() {
    if (!this.guide || !this.active) return;
    const demand = this.registry.summary();
    if (!demand.stt) return;
    const [zh, en] = samples[this.sequence % samples.length];
    const sequence = this.sequence++;
    for (const language of ['zh', ...demand.translations]) {
      const caption = { roomId: this.roomId, segmentId: String(sequence), sequence, revision: 1, language, text: language === 'zh' ? zh : en, final: true };
      this.send({ type: 'caption', caption });
      this.onEvent({ type: 'sample-sent', language });
    }
  }
  async leave() { if (this.active) this.send({ type: this.guide ? 'ended' : 'leave', id: this.id }); this.close(); }
  close() { clearInterval(this.timer); this.active = false; this.channel?.close(); }
}
