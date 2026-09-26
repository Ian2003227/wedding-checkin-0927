let GUESTS = [];
let FAMILIES = [];
let CURRENT_GUEST = null;
let DATA_READY = false;

function api(action, params = {}) {
  const usp = new URLSearchParams({ action, key: CONFIG.API_KEY, ...params });
  return fetch(`${CONFIG.API_URL}?${usp.toString()}`).then(r => r.json());
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}

function boolify(v) { return v === true || v === 'TRUE' || v === 'true'; }

async function loadAll() {
  try {
    const res = await api('list');
    if (!res.ok) { toast('讀取失敗：' + res.error); return; }
    GUESTS = res.guests;
    FAMILIES = res.families;
    DATA_READY = true;
  } catch (err) {
    console.error('loadAll failed', err);
    toast('無法連線到資料庫，請重新整理再試一次');
  } finally {
    // 資料可能在使用者已經打字之後才回來，重新渲染一次
    renderSearch();
    renderCeremony();
  }
}

// ---------- Search tab ----------
function normalize(s) { return (s || '').toString().toLowerCase().trim(); }

let SIDE_FILTER = 'all';
let SELECTED_TABLE = null;

function sideMatches(g) {
  return SIDE_FILTER === 'all' || g.side === SIDE_FILTER;
}

function searchGuests(q) {
  const nq = normalize(q);
  if (!nq) return [];
  return GUESTS.filter(g => sideMatches(g) && (
    normalize(g.name).includes(nq) ||
    normalize(g.nickname).includes(nq) ||
    normalize(g.tag).includes(nq) ||
    String(g.table) === nq
  )).slice(0, 40);
}

// 第 1 桌男女方混坐，所以兩邊都會出現
function tablesForSide() {
  const tables = new Map();
  GUESTS.forEach(g => {
    if (!sideMatches(g)) return;
    const t = tables.get(g.table) || { table: g.table, title: g.tableTitle, total: 0, arrived: 0 };
    t.total++;
    if (boolify(g.checkedIn)) t.arrived++;
    tables.set(g.table, t);
  });
  return [...tables.values()].sort((a, b) => a.table - b.table);
}

function renderSearch() {
  const input = document.getElementById('searchInput');
  const q = input ? input.value.trim() : '';
  document.querySelectorAll('#searchView .side-chip').forEach(c => c.classList.toggle('active', c.dataset.side === SIDE_FILTER));
  if (q) {
    renderResults(searchGuests(q));
  } else if (SELECTED_TABLE !== null) {
    renderTableGuests(SELECTED_TABLE);
  } else {
    renderTableGrid();
  }
}

function renderTableGrid() {
  const box = document.getElementById('results');
  if (!DATA_READY) {
    box.innerHTML = `<div class="empty-hint">資料載入中，請稍候…</div>`;
    return;
  }
  box.innerHTML = `<div class="table-grid">` + tablesForSide().map(t => `
    <button class="table-tile" data-table="${t.table}">
      <span class="tt-num">${t.table}</span>
      <span class="tt-title">${t.title}</span>
      <span class="tt-count">${t.arrived}/${t.total}</span>
    </button>`).join('') + `</div>`;
  box.querySelectorAll('.table-tile').forEach(el => {
    el.addEventListener('click', () => { SELECTED_TABLE = Number(el.dataset.table); renderSearch(); });
  });
}

function renderTableGuests(table) {
  const list = GUESTS.filter(g => g.table === table && sideMatches(g));
  const title = list.length ? list[0].tableTitle : '';
  renderResults(list, `
    <div class="table-head">
      <span class="back" id="backToTables">← 全部桌次</span>
      <span class="th-title">第 ${table} 桌・${title}</span>
    </div>`);
  document.getElementById('backToTables').onclick = () => { SELECTED_TABLE = null; renderSearch(); };
}

// 綽號若是「本名(稱謂)」形式，只留稱謂，避免名字重複出現
function aliasOf(g) {
  let alias = g.nickname && g.nickname !== g.name ? g.nickname : '';
  if (alias.startsWith(g.name)) alias = alias.slice(g.name.length).replace(/^[（(]|[)）]$/g, '');
  return alias;
}

function sideBadge(side) {
  if (side === 'groom') return `<span class="badge groom">男方</span>`;
  if (side === 'bride') return `<span class="badge bride">女方</span>`;
  return '';
}

function renderResults(list, header = '') {
  const box = document.getElementById('results');
  if (!DATA_READY) {
    box.innerHTML = `<div class="empty-hint">資料載入中，請稍候…</div>`;
    return;
  }
  if (!list.length) {
    box.innerHTML = header + `<div class="empty-hint">查無符合的賓客</div>`;
    return;
  }
  box.innerHTML = header + list.map(g => `
    <div class="result-item ${boolify(g.checkedIn) ? 'arrived' : ''}" data-id="${g.id}">
      <div>
        <div class="name">${boolify(g.checkedIn) ? '✅ ' : ''}${g.name}${aliasOf(g) ? ' <span style="color:var(--text-dim);font-weight:400;font-size:13px">(' + aliasOf(g) + ')</span>' : ''}</div>
        <div class="meta">第 ${g.table} 桌・${g.tableTitle}</div>
      </div>
      ${sideBadge(g.side)}
    </div>
  `).join('');
  box.querySelectorAll('.result-item').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', renderSearch);
  document.querySelectorAll('#searchView .side-chip').forEach(c => {
    c.addEventListener('click', () => { SIDE_FILTER = c.dataset.side; SELECTED_TABLE = null; renderSearch(); });
  });
  document.querySelectorAll('#cerSideChips .side-chip').forEach(c => {
    c.addEventListener('click', () => { CEREMONY_SIDE = c.dataset.side; renderCeremony(); });
  });
  renderSearch();
});

function openDetail(id) {
  const g = GUESTS.find(x => x.id === id);
  if (!g) return;
  CURRENT_GUEST = g;
  document.getElementById('searchView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  renderDetail();
}

function closeDetail() {
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('searchView').style.display = 'block';
  CURRENT_GUEST = null;
  renderSearch();
}

function familyMembers(g) {
  return g.family ? GUESTS.filter(x => x.family === g.family) : [];
}

function renderDetail() {
  const g = CURRENT_GUEST;
  const el = document.getElementById('detailView');
  const checkedIn = boolify(g.checkedIn);
  const cookieGiven = boolify(g.cookieGiven);
  const members = familyMembers(g);

  let familyBlock = '';
  if (members.length > 1) {
    const allCheckedIn = members.every(m => boolify(m.checkedIn));
    const allCookie = members.every(m => boolify(m.cookieGiven));
    familyBlock = `
      <div class="section-label">${g.familyLabel}・全家共 ${members.length} 人</div>
      <div class="family-members">
        ${members.map(m => `
          <div class="fam-row">
            <span>${m.name}${m.id === g.id ? '（本人）' : ''}</span>
            <span class="fam-status">${boolify(m.checkedIn) ? '✅' : '⬜'}報到　${boolify(m.cookieGiven) ? '🍪' : '⬜'}喜餅</span>
          </div>`).join('')}
      </div>
      <div class="action-row">
        <button class="action-btn ${allCheckedIn ? 'state-on' : ''}" id="btnFamCheckin">
          <span><span class="icon">✅</span>全家一起報到</span>
          <span>${allCheckedIn ? '已全數報到 ✓' : '標記全家'}</span>
        </button>
        <button class="action-btn ${allCookie ? 'state-on' : ''}" id="btnFamCookie">
          <span><span class="icon">🍪</span>全家一起領喜餅</span>
          <span>${allCookie ? '已全數領取 ✓' : '標記全家'}</span>
        </button>
      </div>`;
  }

  el.innerHTML = `
    <span class="back" id="backBtn">← 返回搜尋</span>
    <div class="detail-card">
      <div class="dname">${g.name}</div>
      <div class="dsub">${aliasOf(g) ? aliasOf(g) + '　' : ''}${g.tag ? '（' + g.tag + '）' : ''} ${sideBadge(g.side)}</div>
      <div class="table-num">第 ${g.table} 桌</div>
      <div class="table-title">${g.tableTitle}</div>
      ${renderSeatingMap(Number(g.table))}
      <div class="action-row">
        <button class="action-btn ${checkedIn ? 'state-on' : ''}" id="btnCheckin">
          <span><span class="icon">✅</span>報到（本人）</span>
          <span>${checkedIn ? '已報到 ✓' : '尚未報到'}</span>
        </button>
        <button class="action-btn ${cookieGiven ? 'state-on' : ''}" id="btnCookie">
          <span><span class="icon">🍪</span>喜餅（本人）</span>
          <span>${cookieGiven ? '已領取 ✓' : '未領取'}</span>
        </button>
      </div>
      ${familyBlock}
    </div>
  `;
  document.getElementById('backBtn').onclick = closeDetail;
  document.getElementById('btnCheckin').onclick = () => toggleGuestFlag(g, 'checkedIn', 'checkin', rerenderDetailFor(g));
  document.getElementById('btnCookie').onclick = () => toggleGuestFlag(g, 'cookieGiven', 'cookie', rerenderDetailFor(g));
  const famCheckinBtn = document.getElementById('btnFamCheckin');
  if (famCheckinBtn) famCheckinBtn.onclick = () => toggleFamilyFlag('checkedIn', 'checkinFamily');
  const famCookieBtn = document.getElementById('btnFamCookie');
  if (famCookieBtn) famCookieBtn.onclick = () => toggleFamilyFlag('cookieGiven', 'cookieFamily');
}

function rerenderDetailFor(g) {
  return () => { if (CURRENT_GUEST === g) renderDetail(); };
}

async function toggleGuestFlag(g, field, action, rerender) {
  const newVal = !boolify(g[field]);
  // 先樂觀更新畫面，避免等待 Apps Script 的網路來回才有反應
  g[field] = newVal;
  rerender();
  toast(newVal ? '已更新' : '已取消');
  try {
    const res = await api(action, { id: g.id, val: newVal ? '1' : '0' });
    if (!res.ok) {
      g[field] = !newVal;
      rerender();
      toast('操作失敗，已還原：' + res.error);
    }
  } catch (err) {
    console.error(err);
    g[field] = !newVal;
    rerender();
    toast('無法連線到資料庫，已還原');
  }
}

async function toggleFamilyFlag(field, action) {
  const g = CURRENT_GUEST;
  const members = familyMembers(g);
  const allTrue = members.every(m => boolify(m[field]));
  const newVal = !allTrue;
  members.forEach(m => { m[field] = newVal; });
  renderDetail();
  toast(newVal ? '已標記全家' : '已取消全家標記');
  try {
    const res = await api(action, { family: g.family, val: newVal ? '1' : '0' });
    if (!res.ok) {
      members.forEach(m => { m[field] = !newVal; });
      if (CURRENT_GUEST === g) renderDetail();
      toast('操作失敗，已還原：' + res.error);
    }
  } catch (err) {
    console.error(err);
    members.forEach(m => { m[field] = !newVal; });
    if (CURRENT_GUEST === g) renderDetail();
    toast('無法連線到資料庫，已還原');
  }
}

// ---------- Ceremony tab ----------
// 使用者自己名單上的稱呼與順序；名單外（在試算表勾選新增的）排在最後、用綽號顯示
const CEREMONY_LABELS = [
  ['T1-5', '爸'], ['T1-6', '媽'], ['T1-11', '二哥'], ['T1-12', '二嫂'], ['T1-10', '婆婆'],
  ['T12-1', '大姊'], ['T12-2', '二姊'], ['T12-3', 'Bob'], ['T12-4', '岡儒'], ['T12-5', '小呆'],
  ['T15-1', '宜嬛'], ['T15-2', '阿凱'], ['T15-3', '宜嬛兒'], ['T15-4', '宜嬛女'], ['T15-5', '安妮'],
  ['T15-6', '安妮男友'], ['T15-7', '孜瑾'], ['T15-8', '孜瑾夫'], ['T13-5', '慧(美國姨)'], ['T13-6', 'Ian'],
  ['T13-7', '孜穎'], ['T13-9', '二樓'], ['T13-10', 'Peter'], ['T17-1', '柔'], ['T17-2', '元元'],
  ['T20-1', '可鐘'], ['T20-2', '堯柔'], ['T20-4', '怡安'], ['T23-1', '暈眩'], ['T23-9', '鮪魚'],
  ['T23-10', '莊潔'], ['T19-1', '小萬']
];
const CEREMONY_ORDER = new Map(CEREMONY_LABELS.map(([id, label], i) => [id, { label, i }]));

// 男方證婚名單（使用者提供，依原表欄位順序）。執行時用姓名／綽號比對賓客資料；
// 比對不到的人仍會顯示（標「名單外」），勾選狀態只存在這支手機
const GROOM_CEREMONY = [
  '周順標', '陳玲珠', 'larry 舅舅', 'larry 舅媽', '大阿姨', '大姨丈', '翁麗秋', '翁麗秋 hb', 'sharon', '凱文',
  '阿棠', '小琴', '肥爸', '三阿姨', '四姨丈', '五阿姨', 'derek', 'stanley', 'aaron',
  '寶兄', 'wilson', 'wilson gf', '炳秀', 'andy', 'au daniel', 'bert', 'denise', 'ebony', '王玉香老師'
];
// 自動比對錯人或比對不到時，在這裡手動指定賓客 id，例如 '凱文': 'T5-3'
const GROOM_CEREMONY_IDS = {};
// 名單上還沒標 ok 的人
const GROOM_CEREMONY_PENDING = new Set(['王玉香老師']);

let CEREMONY_SIDE = 'all';
let GROOM_MATCH = null;

function compact(s) { return normalize(s).replace(/\s+/g, ''); }

// 英文綽號要整個字相符，避免 andy 配到 sandy
function containsWord(hay, q) {
  if (!/^[a-z]+$/.test(q)) return hay.includes(q);
  return new RegExp(`(^|[^a-z])${q}([^a-z]|$)`).test(hay);
}

function groomCeremonyMatches() {
  if (GROOM_MATCH) return GROOM_MATCH;
  const result = new Map();
  const taken = new Set(CEREMONY_ORDER.keys()); // 女方名單上的人不拿來配對
  Object.entries(GROOM_CEREMONY_IDS).forEach(([label, id]) => {
    const g = GUESTS.find(x => x.id === id);
    if (g) { result.set(label, g); taken.add(g.id); }
  });
  // 先找姓名／綽號完全相同，再找包含；有多個候選人時寧可不配，交給手動指定
  const passes = [
    (g, q) => compact(g.name) === q || compact(g.nickname) === q,
    (g, q) => g.side === 'groom' && q.length >= 2 && (containsWord(compact(g.name), q) || containsWord(compact(g.nickname), q))
  ];
  passes.forEach(test => {
    GROOM_CEREMONY.forEach(label => {
      if (result.has(label)) return;
      const q = compact(label);
      const hits = GUESTS.filter(g => !taken.has(g.id) && test(g, q));
      const groomHits = hits.filter(g => g.side === 'groom');
      const pool = groomHits.length ? groomHits : hits;
      if (pool.length !== 1) return;
      result.set(label, pool[0]);
      taken.add(pool[0].id);
    });
  });
  GROOM_MATCH = result;
  return result;
}

const CER_LOCAL_KEY = 'ceremonyLocalChecked';
function readLocalChecked() {
  try { return JSON.parse(localStorage.getItem(CER_LOCAL_KEY) || '{}'); } catch (e) { return {}; }
}
function toggleLocalChecked(label) {
  const data = readLocalChecked();
  data[label] = !data[label];
  try { localStorage.setItem(CER_LOCAL_KEY, JSON.stringify(data)); } catch (e) { /* 無痕模式存不了，只影響這次畫面 */ }
  toast(data[label] ? '已更新' : '已取消');
  return data;
}

function ceremonyEntries() {
  const groomMatch = groomCeremonyMatches();
  const groomIds = new Set([...groomMatch.values()].map(g => g.id));
  const local = readLocalChecked();
  const fromGuest = (g, label) => ({ label, guest: g, checked: boolify(g.ceremonyChecked) });

  const groom = GROOM_CEREMONY.map(label => {
    const g = groomMatch.get(label);
    const e = g ? fromGuest(g, label) : { label, localKey: label, checked: !!local[label] };
    e.pending = GROOM_CEREMONY_PENDING.has(label);
    return e;
  });
  // 名單外、在試算表勾選新增的受邀者：男方賓客排在男方最後，其餘歸女方
  const extra = GUESTS.filter(g => boolify(g.ceremonyInvited) && !groomIds.has(g.id));
  extra.filter(g => !CEREMONY_ORDER.has(g.id) && g.side === 'groom')
    .forEach(g => groom.push(fromGuest(g, aliasOf(g) || g.name)));
  const bride = extra.filter(g => CEREMONY_ORDER.has(g.id) || g.side !== 'groom')
    .sort((a, b) => (CEREMONY_ORDER.get(a.id)?.i ?? 999) - (CEREMONY_ORDER.get(b.id)?.i ?? 999))
    .map(g => fromGuest(g, CEREMONY_ORDER.get(g.id)?.label || aliasOf(g) || g.name));
  return { groom, bride };
}

function cerCountText(list) {
  return `${list.filter(e => e.checked).length} / ${list.length}`;
}

function cerGrid(list) {
  return `<div class="cer-grid">` + list.map(e => {
    const note = [e.localKey && '名單外', e.pending && '待確認'].filter(Boolean).join('・');
    const attr = e.guest ? `data-id="${e.guest.id}"` : `data-local="${e.localKey}"`;
    return `<button class="cer-cell ${e.checked ? 'on' : ''}" ${attr}>${e.label}${note ? `<span class="cer-note">${note}</span>` : ''}</button>`;
  }).join('') + `</div>`;
}

function renderCeremony() {
  const box = document.getElementById('ceremonyList');
  const counter = document.getElementById('ceremonyCount');
  document.querySelectorAll('#cerSideChips .side-chip').forEach(c => c.classList.toggle('active', c.dataset.side === CEREMONY_SIDE));
  if (!DATA_READY) {
    box.innerHTML = `<div class="empty-hint">資料載入中，請稍候…</div>`;
    return;
  }
  const { groom, bride } = ceremonyEntries();
  if (CEREMONY_SIDE === 'all') {
    counter.textContent = `已確認 ${cerCountText([...groom, ...bride])} 人`;
    box.innerHTML = `
      <div class="cer-sub groom">男方・${cerCountText(groom)}</div>${cerGrid(groom)}
      <div class="cer-sub bride">女方・${cerCountText(bride)}</div>${cerGrid(bride)}`;
  } else {
    const list = CEREMONY_SIDE === 'groom' ? groom : bride;
    counter.textContent = `已確認 ${cerCountText(list)} 人`;
    box.innerHTML = cerGrid(list);
  }
  box.querySelectorAll('.cer-cell').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.local) {
        toggleLocalChecked(el.dataset.local);
        renderCeremony();
        return;
      }
      const g = GUESTS.find(x => x.id === el.dataset.id);
      toggleGuestFlag(g, 'ceremonyChecked', 'ceremony', renderCeremony);
    });
  });
}

// ---------- Tabs ----------
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.getElementById('tabbtn-' + name).classList.add('active');
}

// ---------- Timeline tab ----------
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function renderTimeline() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const main = TIMELINE.filter(s => !s.parallel);
  let current = null, next = null;
  for (let i = 0; i < main.length; i++) {
    const s = main[i];
    if (nowMin >= toMinutes(s.start) && nowMin < toMinutes(s.end)) current = s;
    if (!next && nowMin < toMinutes(s.start)) next = s;
  }

  const nowCardEl = document.getElementById('nowCard');
  if (current) {
    nowCardEl.innerHTML = `
      <div class="tag">${current.phase}・進行中</div>
      <div class="ttitle">${current.title}</div>
      <div class="trange">${current.start} - ${current.end}　${current.place || ''}</div>
      ${current.items && current.items.length ? '<ul>' + current.items.map(i => `<li>${i}</li>`).join('') + '</ul>' : ''}
    `;
  } else if (next) {
    const diff = toMinutes(next.start) - nowMin;
    const h = Math.floor(diff / 60), m = diff % 60;
    nowCardEl.innerHTML = `
      <div class="tag">${next.phase}・即將開始</div>
      <div class="ttitle">${next.title}</div>
      <div class="countdown">${h > 0 ? h + ' 小時 ' : ''}${m} 分後開始</div>
      <div class="trange">${next.start} - ${next.end}　${next.place || ''}</div>
      ${next.items && next.items.length ? '<ul>' + next.items.map(i => `<li>${i}</li>`).join('') + '</ul>' : ''}
    `;
  } else {
    nowCardEl.innerHTML = `
      <div class="tag">今日流程</div>
      <div class="ttitle">婚禮圓滿結束 🎉</div>
    `;
  }

  const listEl = document.getElementById('timelineList');
  listEl.innerHTML = TIMELINE.map(s => {
    const isPast = nowMin >= toMinutes(s.end);
    const isCurrent = nowMin >= toMinutes(s.start) && nowMin < toMinutes(s.end);
    return `
      <div class="tl-item ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''}">
        <div class="tl-time">${s.start}-${s.end}</div>
        <div>
          <div class="tl-title">${s.phase}｜${s.title}</div>
          ${s.place ? `<div style="font-size:12px;color:var(--text-dim)">${s.place}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ---------- boot ----------
(async function init() {
  renderTimeline();
  renderCeremony();
  setInterval(renderTimeline, 30000);
  await loadAll();
})();
