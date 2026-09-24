// NifrAmp: minimal player for Navidrome (Subsonic API), served from the same site.
const $ = id => document.getElementById(id);
let creds = null, songs = [], list = [], cur = -1;

const hex = s => [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0')).join('');
const q = (extra = {}) => new URLSearchParams({ u: creds.u, p: 'enc:' + hex(creds.p), v: '1.16.1', c: 'niframp', f: 'json', ...extra });

async function api(method, extra) {
  const r = await fetch(`/rest/${method}.view?${q(extra)}`);
  const j = (await r.json())['subsonic-response'];
  if (j.status !== 'ok') throw new Error(j.error?.message || 'Error');
  return j;
}

function show(loggedIn) {
  $('login').hidden = loggedIn;
  $('lib').hidden = $('logout').hidden = $('player').hidden = !loggedIn;
}

function render() {
  const f = $('filter').value.toLowerCase();
  list = songs.filter(s => `${s.title} ${s.artist} ${s.album}`.toLowerCase().includes(f));
  $('songs').innerHTML = '';
  list.forEach((s, i) => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.textContent = s.title;
    const sm = document.createElement('small');
    sm.textContent = `${s.artist || ''} · ${s.album || ''}`;
    li.append(sm);
    if (s.id === list[cur]?.id) li.className = 'on';
    li.onclick = li.onkeydown = e => { if (!e.key || e.key === 'Enter') play(i); };
    $('songs').append(li);
  });
}

function play(i) {
  if (i < 0 || i >= list.length) return;
  cur = i;
  const s = list[i];
  $('audio').src = `/rest/stream.view?${q({ id: s.id })}`;
  $('audio').play();
  $('now').textContent = `${s.title} — ${s.artist || ''}`;
  render();
}

async function load() {
  const j = await api('search3', { query: '', songCount: 500, artistCount: 0, albumCount: 0 });
  songs = j.searchResult3.song || [];
  show(true);
  render();
}

$('login').onsubmit = async e => {
  e.preventDefault();
  creds = { u: $('user').value, p: $('pass').value };
  try { await load(); localStorage.setItem('niframp', JSON.stringify(creds)); }
  catch (err) { $('err').textContent = err.message; }
};
$('logout').onclick = () => { localStorage.removeItem('niframp'); location.reload(); };
$('filter').oninput = render;
$('next').onclick = () => play(cur + 1);
$('prev').onclick = () => play(cur - 1);
$('audio').onended = () => play(cur + 1);

try { creds = JSON.parse(localStorage.getItem('niframp')); } catch {}
if (creds) load().catch(() => show(false)); else show(false);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
