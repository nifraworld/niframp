// NifrAmp: minimal player for Navidrome (Subsonic API), served from the same site.
const $ = id => document.getElementById(id);
let creds = null, songs = [], list = [], queue = [], cur = -1;
let view = 'songs', group = null; // group = value of album/artist/genre being opened

const hex = s => [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0')).join('');
const q = (extra = {}) => new URLSearchParams({ u: creds.u, p: 'enc:' + hex(creds.p), v: '1.16.1', c: 'niframp', f: 'json', ...extra });
const cover = id => id ? `/rest/getCoverArt.view?${q({ id, size: 96 })}` : 'icon.svg';
const val = (s, k) => s[k] || (k === 'year' ? 0 : 'Unknown');

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

function row(text, sub, img, onPick, on) {
  const li = document.createElement('li');
  li.tabIndex = 0;
  if (on) li.className = 'on';
  if (img) { const im = document.createElement('img'); im.src = img; im.alt = ''; im.loading = 'lazy'; li.append(im); }
  const d = document.createElement('div');
  d.textContent = text;
  const sm = document.createElement('small');
  sm.textContent = sub;
  d.append(sm);
  li.append(d);
  li.onclick = li.onkeydown = e => { if (!e.key || e.key === 'Enter') onPick(); };
  $('songs').append(li);
}

function sortSongs(a) {
  const k = $('sort').value;
  return a.sort((x, y) => k === 'year' ? val(y, k) - val(x, k) || x.title.localeCompare(y.title)
    : String(val(x, k)).localeCompare(String(val(y, k))) || (x.track || 0) - (y.track || 0));
}

function render() {
  const f = $('filter').value.toLowerCase();
  const match = s => `${s.title} ${s.artist} ${s.album} ${s.genre}`.toLowerCase().includes(f);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('sel', b.dataset.v === view));
  $('crumb').hidden = !group;
  $('gname').textContent = group || '';
  $('songs').innerHTML = '';

  if (view !== 'songs' && !group) {
    // Group list: one row per album / artist / genre
    const g = new Map();
    songs.filter(match).forEach(s => {
      const k = val(s, view);
      if (!g.has(k)) g.set(k, { n: 0, s });
      g.get(k).n++;
    });
    [...g].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).forEach(([k, { n, s }]) =>
      row(k, `${n} song${n > 1 ? 's' : ''}${view === 'album' ? ' · ' + val(s, 'artist') : ''}`,
        view === 'album' ? cover(s.coverArt) : null, () => { group = k; $('filter').value = ''; render(); }));
    return;
  }

  let a = songs.filter(s => match(s) && (!group || val(s, view) === group));
  a = view === 'album' && group ? a.sort((x, y) => (x.track || 0) - (y.track || 0)) : sortSongs(a);
  list = a;
  a.forEach((s, i) => row(s.title, `${val(s, 'artist')} · ${val(s, 'album')}${s.year ? ' · ' + s.year : ''}`,
    null, () => { queue = list; play(i); }, s.id === queue[cur]?.id));
}

function play(i) {
  if (i < 0 || i >= queue.length) return;
  cur = i;
  const s = queue[i];
  $('audio').src = `/rest/stream.view?${q({ id: s.id })}`;
  $('audio').play();
  $('now').textContent = `${s.title} — ${val(s, 'artist')}`;
  render();
}

async function load() {
  const j = await api('search3', { query: '', songCount: 5000, artistCount: 0, albumCount: 0 });
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
$('tabs').onclick = e => { if (e.target.dataset.v) { view = e.target.dataset.v; group = null; render(); } };
$('back').onclick = () => { group = null; render(); };
$('filter').oninput = $('sort').onchange = render;
$('next').onclick = () => play(cur + 1);
$('prev').onclick = () => play(cur - 1);
$('audio').onended = () => play(cur + 1);

try { creds = JSON.parse(localStorage.getItem('niframp')); } catch {}
if (creds) load().catch(() => show(false)); else show(false);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
