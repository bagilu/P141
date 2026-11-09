import { acceptCaption, LANGUAGES, normalizePreference } from './core.js?v=0.001';
import { DemoTour } from './demo.js?v=0.001';
import { CloudTour } from './cloud.js?v=0.001';

const $ = id => document.getElementById(id);
let role = 'guide', mode = 'demo', tour, connected = false, busy = false, microphoneOn = false, micStream;
let roomId, shareUrl, captions = [], preference = { enabled: false, language: 'zh' }, joinSequence = -1;
const hash = new URLSearchParams(location.hash.slice(1));
const initialInvite = hash.get('demo') || hash.get('invite');
const requestedMode = hash.has('invite') ? 'cloud' : 'demo';
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
let config;

function message(text, ok = false) { $('feedback').textContent = text; $('feedback').className = `feedback${ok ? ' ok' : ''}`; $('feedback').hidden = !text; }
function setRole(value) {
  if (connected || busy) return;
  role = value;
  $('guideRole').setAttribute('aria-pressed', String(value === 'guide'));
  $('visitorRole').setAttribute('aria-pressed', String(value === 'visitor'));
  $('guideEntry').hidden = value !== 'guide'; $('visitorEntry').hidden = value !== 'visitor';
}
function empty(title, text) {
  const box = document.createElement('div'); box.className = 'empty-state';
  const mark = document.createElement('span'); mark.className = 'caption-mark'; mark.textContent = 'Aa'; mark.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h3'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = text;
  box.append(mark, heading, description); $('captionArea').replaceChildren(box);
}
function renderCaptions() {
  $('captionBadge').textContent = preference.enabled ? LANGUAGES[preference.language] : '已關閉';
  $('captionBadge').classList.toggle('active', preference.enabled);
  if (!connected) return empty('專心聽，也可以。', '加入導覽後，可自行開啟字幕並選擇語言。');
  if (role === 'guide') return empty('字幕由每位遊客選擇。', mode === 'demo' ? '請開啟遊客示範分頁，設定語言後傳送範例字幕。這裡不會啟動額外字幕需求。' : '導遊端不啟動字幕需求；請由遊客裝置選擇。');
  if (!preference.enabled) return empty('字幕已關閉。', mode === 'demo' ? '示範不播放聲音。開啟字幕即可測試個人語言選擇。' : '您仍可收聽導遊原音，隨時開啟字幕。');
  const visible = captions.filter(c => c.language === preference.language && c.sequence > joinSequence);
  if (!visible.length) return empty('等待下一段文字…', mode === 'demo' ? '請在導遊分頁按「傳送一段範例字幕」。' : '字幕服務可能需要啟動時間；只顯示開啟後的新內容。');
  const nodes = visible.map(c => {
    const p = document.createElement('p'); p.className = 'caption-line';
    const stamp = document.createElement('time'); stamp.textContent = `${mode === 'demo' ? '範例' : '字幕'} ${String(c.sequence + 1).padStart(2, '0')}`;
    const text = document.createElement('span'); text.textContent = c.text;
    p.append(stamp, text); return p;
  });
  const area = $('captionArea'); const follow = area.scrollHeight - area.scrollTop - area.clientHeight < 60;
  area.replaceChildren(...nodes); if (follow) area.scrollTop = area.scrollHeight;
}
function renderDemand(data) {
  $('listenerCount').textContent = String(data.listeners ?? 0);
  $('sttState').textContent = data.stt ? (mode === 'demo' ? '有需求' : '已請求') : '未啟動';
  $('translationState').textContent = (data.translations || []).map(l => l === 'en' ? '英文' : l).join('、') || '無';
  $('sampleButton').disabled = !data.stt || !connected;
}
function onEvent(event) {
  if (event.type === 'connected') {
    connected = true; roomId = event.roomId;
    const url = new URL(location.href); url.search = ''; url.hash = new URLSearchParams({ [mode === 'demo' ? 'demo' : 'invite']: event.invite || roomId }).toString(); shareUrl = url.href;
    $('roomDisplay').textContent = roomId.slice(0, 8).toUpperCase();
    $('connectionBadge').textContent = mode === 'demo' ? '示範中' : '已連線'; $('connectionBadge').classList.add('active');
    $('guideEntry').hidden = true; $('visitorEntry').hidden = true; $('roomPanel').hidden = false;
    for (const id of ['guideRole', 'visitorRole']) $(id).disabled = true;
    const guide = role === 'guide';
    $('sharePanel').hidden = !guide; $('micPanel').hidden = !guide; $('sampleButton').hidden = !guide || mode !== 'demo';
    $('captionToggle').disabled = guide; $('language').disabled = true;
    $('leaveRoom').textContent = guide ? `結束${mode === 'demo' ? '示範' : ''}群組` : '離開導覽';
    $('openVisitor').href = shareUrl; $('openVisitor').textContent = mode === 'demo' ? '開啟遊客示範分頁 ↗' : '開啟遊客加入頁 ↗';
    if (guide && typeof globalThis.qrcode === 'function') {
      const code = globalThis.qrcode(0, 'M'); code.addData(shareUrl); code.make();
      // Only trusted QR-library generated markup is used here; captions always use textContent.
      $('qr').innerHTML = code.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    }
    $('microphone').textContent = mode === 'demo' ? '測試本機麥克風' : '開始導遊發話';
    $('micStatus').textContent = mode === 'demo' ? '只測裝置許可，不傳送聲音。' : '點選後才授權麥克風並向群組發話。';
    $('sourceLabel').textContent = mode === 'demo' ? '操作示範 · 無語音' : '導遊原音';
    renderCaptions();
  } else if (event.type === 'demand') { renderDemand(event); }
  else if (event.type === 'caption' && role === 'visitor' && preference.enabled) {
    if (event.caption?.language !== preference.language) return;
    captions = acceptCaption(captions, event.caption, roomId); renderCaptions();
  } else if (event.type === 'ended') { void disconnect(true); }
  else if (event.type === 'waiting') { message(event.message); }
  else if (event.type === 'audio-blocked') { $('resumeAudio').hidden = false; }
  else if (event.type === 'sample-sent') { message('已送出範例文字；這不是語音辨識或即時 AI 翻譯。', true); }
}
function parseInvite(value) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('請先貼上導遊的加入連結或邀請碼。');
  if (trimmed.includes('://')) {
    const url = new URL(trimmed); const params = new URLSearchParams(url.hash.slice(1));
    const selectedMode = params.has('invite') ? 'cloud' : 'demo';
    if (selectedMode !== mode) throw new Error('此邀請與目前模式不同，請在下方切換對應模式。');
    const code = params.get(mode === 'demo' ? 'demo' : 'invite') || '';
    if (!/^[A-Za-z0-9_-]{24,256}$/.test(code)) throw new Error('這個連結沒有有效邀請，請使用導遊產生的完整連結。');
    return code;
  }
  if (!/^[A-Za-z0-9_-]{24,256}$/.test(trimmed)) throw new Error('邀請碼格式不完整，請貼上完整加入連結。');
  return trimmed;
}
async function connect(invite) {
  if (busy || connected) return;
  busy = true; message(''); $('createRoom').disabled = true; $('visitorEntry').querySelector('button').disabled = true;
  const pending = mode === 'demo' ? new DemoTour(onEvent) : new CloudTour(onEvent, config);
  tour = pending;
  try { await tour.connect({ guide: role === 'guide', invite }); }
  catch (e) { try { await pending.leave(); } catch { /* Original error retained; expiry also cleans server membership. */ } reset(); message(e.message); }
  finally { busy = false; $('createRoom').disabled = false; $('visitorEntry').querySelector('button').disabled = false; }
}
function stopMic() { micStream?.getTracks().forEach(t => t.stop()); micStream = undefined; microphoneOn = false; $('microphone').setAttribute('aria-pressed', 'false'); }
function reset() {
  stopMic(); connected = false; tour = undefined; roomId = undefined; shareUrl = undefined; captions = []; joinSequence = -1; preference = { enabled: false, language: 'zh' };
  $('roomPanel').hidden = true; $('resumeAudio').hidden = true; $('sampleButton').hidden = true;
  $('captionToggle').checked = false; $('captionToggle').disabled = true; $('language').value = 'zh'; $('language').disabled = true;
  $('connectionBadge').textContent = '尚未加入'; $('connectionBadge').classList.remove('active');
  for (const id of ['guideRole', 'visitorRole']) $(id).disabled = false;
  renderDemand({}); renderCaptions();
  $('guideEntry').hidden = role !== 'guide'; $('visitorEntry').hidden = role !== 'visitor';
}
async function disconnect(ended = false) {
  if (!tour) return;
  let error;
  try { await tour.leave(); } catch (e) { error = e; }
  reset(); message(error?.message || (ended ? '導遊已結束這場導覽。' : '已離開導覽，您的麥克風已停止。'), !error);
}
function updateMode(next) {
  if (connected || busy) return message('請先離開目前的群組，再切換連線模式。');
  mode = next;
  $('createRoom').firstChild.textContent = next === 'demo' ? '建立示範群組 ' : '建立導覽群組 ';
  $('modeNotice').querySelector('p').replaceChildren();
  const strong = document.createElement('strong'); strong.textContent = next === 'demo' ? '目前為操作示範' : '雲端連線模式 · 待實機驗收';
  $('modeNotice').querySelector('p').append(strong, document.createElement('br'), next === 'demo' ? '範例字幕不是語音辨識；示範只在同一瀏覽器的分頁間運作，不傳送語音、不呼叫 AI。' : '語音將送至已設定的 P141 服務；使用前須確認服務部署、隱私與免費配額。');
}
async function changePreference() {
  if (!connected || role === 'guide' || busy) return;
  const old = { ...preference };
  const next = normalizePreference({ enabled: $('captionToggle').checked, language: $('language').value });
  $('captionToggle').disabled = true; $('language').disabled = true;
  try {
    await tour.setPreference(next);
    if (next.language !== old.language || (!old.enabled && next.enabled)) { captions = []; }
    preference = next; renderCaptions(); message('');
  } catch (e) { $('captionToggle').checked = old.enabled; $('language').value = old.language; message(`設定未成功：${e.message}`); }
  finally { $('captionToggle').disabled = !connected; $('language').disabled = !connected || !preference.enabled; }
}
$('guideRole').onclick = () => setRole('guide'); $('visitorRole').onclick = () => setRole('visitor');
$('createRoom').onclick = () => void connect();
$('visitorEntry').onsubmit = event => { event.preventDefault(); try { void connect(parseInvite($('inviteInput').value)); } catch (e) { message(e.message); } };
$('leaveRoom').onclick = () => void disconnect();
$('captionToggle').onchange = () => void changePreference(); $('language').onchange = () => void changePreference();
$('sampleButton').onclick = () => tour?.sample();
$('copyLink').onclick = async () => { try { await navigator.clipboard.writeText(shareUrl); message('加入連結已複製。', true); } catch { message('無法複製，請使用下方的遊客加入連結。'); } };
$('microphone').onclick = async () => {
  if (!connected) return;
  $('microphone').disabled = true;
  try {
    if (mode === 'cloud') { await tour.microphone(!microphoneOn); microphoneOn = !microphoneOn; }
    else if (microphoneOn) stopMic();
    else { micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); microphoneOn = true; }
    $('microphone').setAttribute('aria-pressed', String(microphoneOn));
    $('microphone').textContent = microphoneOn ? (mode === 'demo' ? '停止麥克風測試' : '暫停導遊發話') : (mode === 'demo' ? '測試本機麥克風' : '開始導遊發話');
    $('micStatus').textContent = microphoneOn ? (mode === 'demo' ? '裝置許可正常；僅本機測試，沒有傳送聲音。' : '正在向本群組傳送導遊原音。') : '麥克風已停止。';
  } catch (e) { message(e.name === 'NotAllowedError' ? '麥克風尚未允許；請在瀏覽器設定允許後再試。' : '無法啟用麥克風，請確認裝置、權限與安全連線。'); }
  finally { $('microphone').disabled = false; }
};
$('resumeAudio').onclick = async () => { try { await tour.startAudio(); $('resumeAudio').hidden = true; } catch { message('聲音播放尚未成功，請確認瀏覽器與音量。'); } };
$('modeButton').onclick = () => { $('cloudDetails').open = true; $('cloudDetails').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('useDemo').onclick = () => updateMode('demo'); $('useCloud').onclick = () => { if (config) updateMode('cloud'); };
addEventListener('pagehide', () => { stopMic(); if (tour instanceof DemoTour) { void tour.leave(); } });

// Optional deployment configuration. A missing file keeps the application in explicit demo mode.
try {
  const response = await fetch(new URL('config.js', location.href), { cache: 'no-store' });
  if (response.ok) await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = './config.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
  const candidate = globalThis.P141_CONFIG;
  if (candidate?.SUPABASE_URL && candidate?.SUPABASE_PUBLISHABLE_KEY && new URL(candidate.SUPABASE_URL).protocol === 'https:') config = candidate;
} catch { /* A malformed/missing config never enables cloud mode. */ }
$('cloudStatus').textContent = config ? '已找到公開設定。雲端 RPC、語音授權與 AI Worker 仍須部署及驗收，才可完成真實導覽。' : '尚未設定雲端服務。目前可以先做零費用的操作示範；私鑰不需要填在這個網站。';
$('useCloud').disabled = !config;
if (initialInvite) { setRole('visitor'); $('inviteInput').value = initialInvite; if (requestedMode === 'cloud' && config) updateMode('cloud'); else if (requestedMode === 'cloud') { $('inviteInput').value = ''; message('這是雲端邀請，但網站尚未設定服務。請待接線完成後重新開啟邀請。'); } }
