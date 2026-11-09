export const LANGUAGES = Object.freeze({ zh: '中文（原文）', en: 'English 英文' });
export function normalizePreference(value) {
  if (!value || typeof value.enabled !== 'boolean' || !Object.hasOwn(LANGUAGES, value.language)) throw new Error('不支援的字幕設定');
  return { enabled: value.enabled, language: value.language };
}
export function summarizeDemand(members, now = Date.now()) {
  const active = members.filter(m => m.expiresAt > now);
  const captions = active.filter(m => m.enabled);
  const languages = [...new Set(captions.map(m => m.language).filter(l => l !== 'zh'))].sort();
  return { listeners: active.length, captionUsers: captions.length, stt: captions.length > 0, translations: languages };
}
export class DemandRegistry {
  constructor({ leaseMs = 20000 } = {}) { this.members = new Map(); this.leaseMs = leaseMs; }
  update(id, preference, version, now = Date.now()) {
    if (typeof id !== 'string' || !id || !Number.isSafeInteger(version) || version < 0) return false;
    const p = normalizePreference(preference);
    const old = this.members.get(id);
    if (old && old.version > version) return false;
    if (old && old.version === version && (old.enabled !== p.enabled || old.language !== p.language)) return false;
    this.members.set(id, { ...p, version, expiresAt: now + this.leaseMs });
    return true;
  }
  remove(id) { this.members.delete(id); }
  summary(now = Date.now()) {
    for (const [id, member] of this.members) if (member.expiresAt <= now) this.members.delete(id);
    return summarizeDemand([...this.members.values()], now);
  }
}
export function acceptCaption(previous, event, roomId) {
  if (!event || event.roomId !== roomId || typeof event.segmentId !== 'string' || !event.segmentId || event.segmentId.length > 128 ||
      typeof event.text !== 'string' || event.text.length > 4000 || !Object.hasOwn(LANGUAGES, event.language) ||
      !Number.isSafeInteger(event.sequence) || event.sequence < 0 || !Number.isSafeInteger(event.revision) || event.revision < 0 || typeof event.final !== 'boolean') return previous;
  const key = `${event.segmentId}:${event.language}`;
  const old = previous.find(c => c.key === key);
  if (old && (old.revision >= event.revision || (old.final && !event.final))) return previous;
  return [...previous.filter(c => c.key !== key), { ...event, key }].sort((a, b) => a.sequence - b.sequence).slice(-100);
}
export function createInvite() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
