import { normalizePreference } from './core.js?v=0.001';
export class CloudTour {
  constructor(onEvent, config) {
    this.onEvent = onEvent;
    this.client = globalThis.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, { auth: { storageKey: 'P141.auth', persistSession: true, detectSessionInUrl: false } });
    this.preferenceVersion = 0;
    this.preference = { enabled: false, language: 'zh' };
    this.audioElements = new Set();
  }
  async rpc(name, args = {}) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new Error(error.code === 'PGRST202' ? 'P141 雲端資料服務尚未部署，請先完成平台接線。' : `雲端操作失敗：${error.message}`);
    return Array.isArray(data) ? data[0] : data;
  }
  async connect({ guide, invite }) {
    this.guide = guide;
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) {
      const { error } = await this.client.auth.signInAnonymously();
      if (error) throw new Error('尚無法取得免帳密身分，請確認 P141 的匿名身分設定。');
    }
    const membership = await this.rpc(guide ? 'P141_CreateRoom' : 'P141_JoinRoom', guide ? {} : { p_invite: invite });
    if (!membership?.room_id) throw new Error('P141 群組服務回應不完整。');
    this.roomId = membership.room_id;
    const { data, error } = await this.client.functions.invoke('P141_livekit_token', { body: { room_id: this.roomId } });
    if (error || !data?.token || !data?.url) throw new Error('P141 語音授權服務尚未就緒。');
    this.captionIdentity = data.caption_identity;
    this.guideIdentity = data.guide_identity;
    const { Room, RoomEvent, Track } = globalThis.LivekitClient;
    this.room = new Room();
    this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (!guide && track.kind === Track.Kind.Audio && participant.identity === this.guideIdentity) {
        const audio = track.attach(); audio.autoplay = true; document.body.append(audio); this.audioElements.add(audio);
      }
    });
    this.room.on(RoomEvent.TrackUnsubscribed, track => { for (const el of track.detach()) { el.remove(); this.audioElements.delete(el); } });
    this.room.on(RoomEvent.Disconnected, () => this.onEvent({ type: 'waiting', message: '語音連線已中斷，請離開後重新加入。' }));
    this.room.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!this.room.canPlaybackAudio) this.onEvent({ type: 'audio-blocked' }); });
    this.room.registerTextStreamHandler('P141.caption.v1', async (reader, participant) => {
      if (participant.identity !== this.captionIdentity) return;
      try { this.onEvent({ type: 'caption', caption: JSON.parse(await reader.readAll()) }); } catch { /* Invalid worker event. */ }
    });
    await this.room.connect(data.url, data.token, { autoSubscribe: !guide });
    if (!guide) await this.room.startAudio();
    this.onEvent({ type: 'connected', guide, roomId: this.roomId, invite: guide ? membership.invite : invite, mode: 'cloud' });
    this.timer = setInterval(() => this.heartbeat().catch(() => this.onEvent({ type: 'waiting', message: '群組狀態更新失敗；原音若仍有連線可繼續播放。' })), 8000);
    await this.heartbeat();
  }
  async heartbeat() {
    const data = await this.rpc('P141_Heartbeat', { p_room_id: this.roomId, p_caption_enabled: this.preference.enabled, p_language: this.preference.language, p_version: this.preferenceVersion });
    if (data?.closed) this.onEvent({ type: 'ended' });
    else if (data) this.onEvent({ type: 'demand', ...data });
  }
  async setPreference(value) {
    this.preference = normalizePreference(value); this.preferenceVersion++;
    await this.heartbeat();
  }
  async microphone(enabled) { if (this.guide) await this.room.localParticipant.setMicrophoneEnabled(enabled); }
  async startAudio() { await this.room?.startAudio(); }
  async leave() {
    clearInterval(this.timer);
    let error;
    try { if (this.roomId) await this.rpc(this.guide ? 'P141_CloseRoom' : 'P141_LeaveRoom', { p_room_id: this.roomId }); } catch (e) { error = e; }
    await this.room?.disconnect();
    for (const el of this.audioElements) el.remove();
    this.audioElements.clear();
    if (error) throw new Error('本機已離線，但雲端結束未獲確認；請勿將此視為工作已停止。');
  }
}
