// 桌次座位圖：依現場平面圖 (綠蒂廳) 概略還原相對位置，供快速指引賓客方向用
const TABLE_POS = {
  6:[60,70],5:[130,70],4:[200,70],3:[270,70],2:[340,70],
  11:[60,150],10:[130,150],9:[200,150],8:[270,150],7:[340,150],
  21:[60,230],18:[130,230],1:[345,230],
  22:[60,320],19:[130,320],14:[200,320],13:[270,320],12:[340,320],
  23:[60,400],20:[130,400],17:[200,400],16:[270,400],15:[340,400]
};

function renderSeatingMap(highlightTable) {
  const w = 400, h = 470;
  let circles = "";
  for (const [num, [x, y]] of Object.entries(TABLE_POS)) {
    const n = Number(num);
    const isHi = n === highlightTable;
    const isMain = n === 1;
    let fill = "var(--tbl-fill)";
    if (isMain) fill = "var(--tbl-main)";
    if (isHi) fill = "var(--tbl-hi)";
    circles += `
      <g class="${isHi ? 'table-hi' : ''}">
        ${isHi ? `<circle cx="${x}" cy="${y}" r="26" class="pulse-ring"/>` : ""}
        <circle cx="${x}" cy="${y}" r="20" fill="${fill}" stroke="${isHi ? 'var(--tbl-hi-stroke)' : 'var(--tbl-stroke)'}" stroke-width="${isHi ? 3 : 1.5}"/>
        <text x="${x}" y="${y+5}" text-anchor="middle" font-size="14" font-weight="700" fill="${isHi ? '#fff' : 'var(--tbl-text)'}">${num}</text>
      </g>`;
  }
  return `
  <svg viewBox="0 0 ${w} ${h}" class="seat-map" xmlns="http://www.w3.org/2000/svg">
    <rect x="150" y="215" width="90" height="30" rx="4" class="carpet"/>
    <text x="195" y="235" text-anchor="middle" font-size="10" fill="var(--carpet-text)">紅毯</text>
    <rect x="365" y="140" width="30" height="180" rx="4" class="stage"/>
    <text x="380" y="235" text-anchor="middle" font-size="10" fill="var(--stage-text)" transform="rotate(90 380 235)">舞台</text>
    <rect x="130" y="440" width="140" height="22" rx="4" class="entrance"/>
    <text x="200" y="455" text-anchor="middle" font-size="10" fill="var(--entrance-text)">宴會廳入口 / 收禮桌</text>
    ${circles}
  </svg>`;
}
