let GUESTS = [];
let FAMILIES = [];
let CURRENT_GUEST = null;

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
  } catch (err) {
    console.error('loadAll failed', err);
    toast('無法連線到資料庫');
  }
}

function familyById(id) { return FAMILIES.find(f => f.familyId === id); }

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

function sideBadge(side) {
  if (side === 'groom') return `<span class="badge groom">男方</span>`;
  if (side === 'bride') return `<span class="badge bride">女方</span>`;
  return '';
}

function renderResults(list) {
  const box = document.getElementById('results');
  if (!list.length) {
    box.innerHTML = `<div class="empty-hint">輸入姓名、綽號或桌號開始搜尋</div>`;
    return;
  }
  box.innerHTML = list.map(g => `
    <div class="result-item" data-id="${g.id}">
      <div>
        <div class="name">${g.name}${g.nickname ? ' <span style="color:var(--text-dim);font-weight:400;font-size:13px">(' + g.nickname + ')</span>' : ''}</div>
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

function renderDetail() {
  const g = CURRENT_GUEST;
  const el = document.getElementById('detailView');
  const checkedIn = boolify(g.checkedIn);
  const cookieGiven = boolify(g.cookieGiven);
  const adhoc = boolify(g.mooncakeAdhoc);

  let mooncakeBlock = '';
  if (g.family) {
    const fam = familyById(g.family);
    const given = fam && boolify(fam.mooncakeGiven);
    mooncakeBlock = `
      <button class="action-btn ${given ? 'state-on' : ''}" id="btnMooncake">
        <span><span class="icon">🥮</span>月餅・${g.familyLabel}
          <small>同家庭成員：${fam ? fam.members : ''}</small>
        </span>
        <span>${given ? '已領取 ✓' : '未領取'}</span>
      </button>`;
  } else if (g.side === 'bride') {
    mooncakeBlock = `
      <button class="action-btn state-blocked ${adhoc ? 'state-on' : ''}" id="btnMooncakeAdhoc">
        <span><span class="icon">🥮</span>彈性登記月餅
          <small>不在標準家庭名單內，僅供現場彈性處理</small>
        </span>
        <span>${adhoc ? '已登記 ✓' : '登記'}</span>
      </button>`;
  } else {
    mooncakeBlock = `
      <button class="action-btn state-blocked ${adhoc ? 'state-on' : ''}" id="btnMooncakeAdhoc">
        <span><span class="icon">🥮</span>彈性登記月餅
          <small>男方賓客・原則不發放，僅供特殊情況登記</small>
        </span>
        <span>${adhoc ? '已登記 ✓' : '登記'}</span>
      </button>`;
  }

  el.innerHTML = `
    <span class="back" id="backBtn">← 返回搜尋</span>
    <div class="detail-card">
      <div class="dname">${g.name}</div>
      <div class="dsub">${g.nickname ? g.nickname + '　' : ''}${g.tag ? '（' + g.tag + '）' : ''} ${sideBadge(g.side)}</div>
      <div class="table-num">第 ${g.table} 桌</div>
      <div class="table-title">${g.tableTitle}</div>
      ${renderSeatingMap(Number(g.table))}
      <div class="action-row">
        <button class="action-btn ${checkedIn ? 'state-on' : ''}" id="btnCheckin">
          <span><span class="icon">✅</span>報到</span>
          <span>${checkedIn ? '已報到 ✓' : '尚未報到'}</span>
        </button>
        <button class="action-btn ${cookieGiven ? 'state-on' : ''}" id="btnCookie">
          <span><span class="icon">🍪</span>喜餅／送客小禮</span>
          <span>${cookieGiven ? '已領取 ✓' : '未領取'}</span>
        </button>
        ${mooncakeBlock}
      </div>
    </div>
  `;
  document.getElementById('backBtn').onclick = closeDetail;
  document.getElementById('btnCheckin').onclick = () => toggleGuestFlag('checkedIn', 'checkin');
  document.getElementById('btnCookie').onclick = () => toggleGuestFlag('cookieGiven', 'cookie');
  const mBtn = document.getElementById('btnMooncake');
  if (mBtn) mBtn.onclick = () => toggleFamilyMooncake();
  const mAdhocBtn = document.getElementById('btnMooncakeAdhoc');
  if (mAdhocBtn) mAdhocBtn.onclick = () => toggleGuestFlag('mooncakeAdhoc', 'mooncakeAdhoc');
}

async function toggleGuestFlag(field, action) {
  const g = CURRENT_GUEST;
  const newVal = !boolify(g[field]);
  try {
    const res = await api(action, { id: g.id, val: newVal ? '1' : '0' });
    if (!res.ok) { toast('操作失敗：' + res.error); return; }
    g[field] = newVal;
    renderDetail();
    toast(newVal ? '已更新' : '已取消');
  } catch (err) {
    console.error(err);
    toast('無法連線到資料庫，請重試');
  }
}

async function toggleFamilyMooncake() {
  const g = CURRENT_GUEST;
  const fam = familyById(g.family);
  const newVal = !boolify(fam.mooncakeGiven);
  try {
    const res = await api('mooncakeFamily', { family: g.family, val: newVal ? '1' : '0', by: g.name });
    if (!res.ok) { toast('操作失敗：' + res.error); return; }
    fam.mooncakeGiven = newVal;
    renderDetail();
    toast(newVal ? '已登記月餅' : '已取消登記');
  } catch (err) {
    console.error(err);
    toast('無法連線到資料庫，請重試');
  }
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
  setInterval(renderTimeline, 30000);
  await loadAll();
})();
