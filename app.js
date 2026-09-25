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
    // 資料可能在使用者已經打字之後才回來，重新跑一次目前的搜尋字串
    const input = document.getElementById('searchInput');
    if (input) renderResults(searchGuests(input.value));
    renderCeremony();
  }
}

// ---------- Search tab ----------
function normalize(s) { return (s || '').toString().toLowerCase().trim(); }

function searchGuests(q) {
  const nq = normalize(q);
  if (!nq) return [];
  return GUESTS.filter(g => {
    return normalize(g.name).includes(nq) ||
           normalize(g.nickname).includes(nq) ||
           normalize(g.tag).includes(nq) ||
           String(g.table) === nq;
  }).slice(0, 30);
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

function renderResults(list) {
  const box = document.getElementById('results');
  const input = document.getElementById('searchInput');
  if (!DATA_READY && input && input.value.trim()) {
    box.innerHTML = `<div class="empty-hint">資料載入中，請稍候…</div>`;
    return;
  }
  if (!list.length) {
    const hasQuery = input && input.value.trim();
    box.innerHTML = `<div class="empty-hint">${hasQuery ? '查無符合的賓客' : '輸入姓名、綽號或桌號開始搜尋'}</div>`;
    return;
  }
  box.innerHTML = list.map(g => `
    <div class="result-item" data-id="${g.id}">
      <div>
        <div class="name">${g.name}${aliasOf(g) ? ' <span style="color:var(--text-dim);font-weight:400;font-size:13px">(' + aliasOf(g) + ')</span>' : ''}</div>
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
  input.addEventListener('input', () => renderResults(searchGuests(input.value)));
  renderResults([]);
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
function renderCeremony() {
  const box = document.getElementById('ceremonyList');
  const counter = document.getElementById('ceremonyCount');
  if (!DATA_READY) {
    box.innerHTML = `<div class="empty-hint">資料載入中，請稍候…</div>`;
    return;
  }
  const invited = GUESTS.filter(g => boolify(g.ceremonyInvited));
  const done = invited.filter(g => boolify(g.ceremonyChecked)).length;
  counter.textContent = `已確認 ${done} / ${invited.length} 人`;
  box.innerHTML = invited.map(g => {
    const on = boolify(g.ceremonyChecked);
    const alias = aliasOf(g);
    return `
      <button class="cer-row ${on ? 'on' : ''}" data-id="${g.id}">
        <span class="cer-box">${on ? '✓' : ''}</span>
        <span class="cer-text">
          <span class="cer-name">${g.name}${alias ? `<span class="cer-alias">（${alias}）</span>` : ''}</span>
          <span class="cer-meta">第 ${g.table} 桌・${g.tableTitle}</span>
        </span>
      </button>`;
  }).join('');
  box.querySelectorAll('.cer-row').forEach(el => {
    el.addEventListener('click', () => {
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
