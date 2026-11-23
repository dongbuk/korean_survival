// 게임 아이콘 한 벌 (이모지 대신). 48×48 격자, 진한 갈색 테두리 + 파스텔 색 — 게임 그림과 같은 느낌.
// 화면(HTML)에서는 ico('heart'), 캔버스에서는 icoImg('heart')로 써요.
(function () {
  const K = '#4a3b35';
  // 굵은 선: 테두리(진한 선) 위에 색 선을 한 번 더
  const ln = (d, c, w) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sh = (d, c, sw) => `<path d="${d}" fill="${c}" stroke="${K}" stroke-width="${sw || 3}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const ci = (x, y, r, c, sw) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${K}" stroke-width="${sw == null ? 3 : sw}"/>`;
  const thin = (d, c, w) => `<path d="${d}" fill="none" stroke="${c || K}" stroke-width="${w || 2.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shine = (d) => thin(d, '#ffffff', 2.5);
  const star = (cx, cy, R, r, n) => { let p = ''; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; p += (i ? 'L' : 'M') + (cx + Math.cos(a) * q).toFixed(1) + ' ' + (cy + Math.sin(a) * q).toFixed(1); } return p + 'Z'; };
  const gear = () => { let p = ''; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, q = i % 2 ? 13 : 18; p += (i ? 'L' : 'M') + (24 + Math.cos(a - 0.1) * q).toFixed(1) + ' ' + (24 + Math.sin(a - 0.1) * q).toFixed(1) + 'L' + (24 + Math.cos(a + 0.1) * q).toFixed(1) + ' ' + (24 + Math.sin(a + 0.1) * q).toFixed(1); } return p + 'Z'; };
  const petals = () => [0, 1, 2, 3, 4].map((i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return ci((24 + Math.cos(a) * 10).toFixed(1), (23 + Math.sin(a) * 10).toFixed(1), 8, '#ffa8c5'); }).join('');

  const I = {
    // 무기
    sickle: ln('M11 42 L25 25', '#c08a5a', 5) + sh('M22 28 C17 12 30 2 43 8 C35 9 30 15 29 27 Z', '#e3eef5') + shine('M27 14 C30 10 34 9 37 9'),
    sling: ln('M24 44 L24 28 M24 28 L13 9 M24 28 L35 9', '#c08a5a', 5) + thin('M13 10 Q24 24 35 10', '#e07890', 3) + ci(24, 19, 4.5, '#a0704a'),
    bubble: ci(20, 27, 14, '#d6efff') + ci(36, 13, 7, '#e8f6ff') + shine('M12 23 Q14 16 21 15') + shine('M33 10 Q35 8 38 9'),
    sword: ln('M15 33 L39 9', '#e3eef5', 6) + ln('M10 27 L21 38', '#f2c14e', 4) + ln('M8 40 L13 35', '#8a5a3b', 5) + shine('M25 21 L35 11'),
    club: sh('M8 42 C6 40 6 37 9 35 L27 13 C30 6 40 5 43 11 C45 18 39 22 33 22 L14 41 C12 44 10 44 8 42 Z', '#c99363') + ci(34, 13, 2, K, 0) + ci(29, 19, 1.8, K, 0),
    zap: sh('M28 3 L9 27 L22 27 L17 45 L39 18 L26 18 L32 3 Z', '#ffe066'),
    boom: `<ellipse cx="16" cy="16" rx="11" ry="8" transform="rotate(-45 16 16)" fill="#e3eef5" stroke="${K}" stroke-width="3"/>` + ln('M22 22 L41 41', '#e3eef5', 5) + shine('M11 15 Q13 11 17 10'),
    mine: ln('M24 30 L24 44', '#7cc48a', 4) + petals() + ci(24, 23, 6, '#ffe066'),
    // 보조 도구 · 회복
    wind: sh('M7 41 C7 18 22 6 42 6 C42 26 30 41 7 41 Z', '#9be07a') + thin('M9 39 L33 15') + thin('M19 29 L19 21 M26 22 L31 22', K, 2),
    acorn: ln('M24 13 L26 7', '#8a5a3b', 3) + sh('M14 22 L34 22 C34 34 28 43 24 43 C20 43 14 34 14 22 Z', '#e7b67e') + sh('M10 22 C10 13 38 13 38 22 Z', '#8a5a3b') + shine('M18 27 Q18 33 21 37'),
    shoes: sh('M5 31 L7 15 L18 15 C20 21 26 24 34 25 C41 26 44 29 44 33 L44 36 L5 36 Z', '#ffa8c5') + sh('M5 36 L44 36 L44 41 L5 41 Z', '#ffffff') + thin('M17 21 L23 18 M19 25 L25 22', K, 2),
    rice: sh('M24 5 C31 5 43 29 43 35 C43 41 39 42 24 42 C9 42 5 41 5 35 C5 29 17 5 24 5 Z', '#ffffff') + sh('M15 29 L33 29 L33 42 L15 42 Z', '#3d4f3d'),
    // 게임 화면
    heart: sh('M24 41 C10 31 5 24 5 16 C5 10 10 6 15 6 C19 6 22 8 24 12 C26 8 29 6 33 6 C38 6 43 10 43 16 C43 24 38 31 24 41 Z', '#f6a6b8') + shine('M11 14 Q12 10 16 10'),
    gem: sh('M24 4 L39 21 L24 44 L9 21 Z', '#7fb3ff') + thin('M9 21 L39 21 M18 21 L24 44 L30 21 M24 4 L18 21 M24 4 L30 21', K, 2),
    clock: sh('M12 11 L17 6 M36 11 L31 6', '#f6a6b8') + ci(24, 26, 17, '#fffaf3') + thin('M24 26 L24 15 M24 26 L32 30', K, 3.5) + ci(24, 26, 2, K, 0),
    pause: `<rect x="11" y="9" width="10" height="30" rx="4" fill="#fffaf3" stroke="${K}" stroke-width="3"/><rect x="27" y="9" width="10" height="30" rx="4" fill="#fffaf3" stroke="${K}" stroke-width="3"/>`,
    monster: sh('M7 38 C7 20 14 9 24 9 C34 9 41 20 41 38 C37 42 31 40 29 37 C27 41 21 41 19 37 C15 41 9 42 7 38 Z', '#b5d67a') + ci(18, 24, 2.6, K, 0) + ci(30, 24, 2.6, K, 0) + thin('M21 30 Q24 32 27 30', K, 2),
    crown: sh('M6 36 L9 13 L18 24 L24 9 L30 24 L39 13 L42 36 Z', '#f2c14e') + sh('M6 36 L42 36 L42 42 L6 42 Z', '#e0a83a') + ci(24, 30, 3, '#ff8fb1', 2),
    star: sh(star(24, 25, 20, 9, 5), '#ffe066'),
    sparkle: sh(star(22, 26, 18, 5, 4), '#ffe066') + sh(star(38, 11, 7, 2.5, 4), '#fff3a0', 2),
    skull: sh('M24 6 C35 6 42 13 42 23 C42 30 38 33 36 34 L36 41 L12 41 L12 34 C10 33 6 30 6 23 C6 13 13 6 24 6 Z', '#fffaf3') + ci(17, 23, 4, K, 0) + ci(31, 23, 4, K, 0),
    // 메뉴
    play: sh('M15 8 L40 24 L15 40 Z', '#ffffff'),
    book: sh('M5 11 C13 8 20 9 24 13 L24 41 C20 37 13 36 5 39 Z', '#ffffff') + sh('M43 11 C35 8 28 9 24 13 L24 41 C28 37 35 36 43 39 Z', '#fff4c8') + thin('M10 18 L19 18 M10 24 L19 24 M29 18 L38 18 M29 24 L38 24', '#c7b3a4', 2.5),
    gear: sh(gear(), '#c7d3dc') + ci(24, 24, 6, '#fffaf3'),
    chart: sh('M9 9 L39 9 L39 43 L9 43 Z', '#fffaf3') + sh('M17 5 L31 5 L31 12 L17 12 Z', '#c99363') + `<rect x="14" y="30" width="5" height="8" fill="#7cc48a"/><rect x="21.5" y="23" width="5" height="15" fill="#7fb3ff"/><rect x="29" y="17" width="5" height="21" fill="#f6a6b8"/>`,
    album: sh('M9 6 L37 6 C40 6 41 8 41 10 L41 42 L12 42 C10 42 9 41 9 39 Z', '#f6a6b8') + sh('M9 36 L41 36 L41 42 L12 42 C10 42 9 41 9 39 Z', '#fffaf3') + sh(star(25, 20, 9, 4, 5), '#ffffff', 2.5),
    note: sh('M10 5 L38 5 L38 43 L10 43 Z', '#bfe3c6') + thin('M16 15 L32 15 M16 22 L32 22 M16 29 L26 29', K, 2.5) + sh('M30 32 L42 20 L45 23 L33 35 L29 36 Z', '#ffe066', 2.5) + ci(10, 12, 2, K, 0) + ci(10, 24, 2, K, 0) + ci(10, 36, 2, K, 0),
    lock: ln('M15 22 L15 16 C15 6 33 6 33 16 L33 22', '#c7b3a4', 4) + sh('M9 21 L39 21 L39 43 L9 43 Z', '#f2c14e') + ci(24, 30, 3.5, K, 0) + thin('M24 31 L24 37', K, 3),
    key: ci(14, 24, 9, '#f2c14e') + ci(14, 24, 3, '#fffaf3', 2) + ln('M23 24 L42 24 M35 24 L35 31 M41 24 L41 30', '#f2c14e', 4),
    list: [14, 24, 34].map((y) => ci(10, y, 3.5, '#7fb3ff', 2.5) + ln(`M18 ${y} L40 ${y}`, '#fffaf3', 3)).join(''),
    import: sh('M6 30 L6 41 L42 41 L42 30', 'none') + ln('M24 6 L24 29 M15 21 L24 30 L33 21', '#7cc48a', 5),
    search: ci(20, 20, 13, '#e8f6ff') + ln('M30 30 L42 42', '#c99363', 6) + shine('M13 17 Q14 12 19 11'),
    plus: ln('M24 9 L24 39 M9 24 L39 24', '#ffffff', 6),
    pencil: sh('M33 5 L43 15 L18 40 L6 42 L8 30 Z', '#ffe066') + sh('M8 30 L18 40 L6 42 Z', '#e7b67e') + thin('M28 10 L38 20', K, 2.5),
    trash: sh('M11 15 L37 15 L34 43 L14 43 Z', '#e8e1d8') + sh('M7 9 L41 9 L41 15 L7 15 Z', '#c7b3a4') + sh('M19 5 L29 5 L29 9 L19 9 Z', '#c7b3a4', 2.5) + thin('M19 21 L20 37 M24 21 L24 37 M29 21 L28 37', K, 2.5),
    save: sh('M7 7 L35 7 L42 14 L42 42 L7 42 Z', '#7fb3ff') + sh('M14 7 L32 7 L32 18 L14 18 Z', '#fffaf3') + sh('M13 27 L36 27 L36 42 L13 42 Z', '#fffaf3'),
    check: ci(24, 24, 19, '#7cc48a') + thin('M14 24 L21 31 L34 17', '#ffffff', 5),
    cross: ci(24, 24, 19, '#e8746c') + thin('M16 16 L32 32 M32 16 L16 32', '#ffffff', 5),
    party: sh('M6 43 L17 13 L35 31 Z', '#f6a6b8') + thin('M10 33 L22 38 M13 25 L28 34', '#fffaf3', 3) + ci(31, 9, 3, '#ffe066', 2) + ci(41, 19, 3, '#7fb3ff', 2) + ci(39, 6, 2.5, '#7cc48a', 2) + thin('M23 12 Q27 6 24 2 M36 25 Q42 23 45 27', K, 2.5),
    trophy: sh('M14 6 L34 6 L33 20 C32 27 28 30 24 30 C20 30 16 27 15 20 Z', '#f2c14e') + thin('M14 10 C6 10 6 20 15 20 M34 10 C42 10 42 20 33 20', K, 3) + sh('M21 30 L27 30 L27 36 L21 36 Z', '#e0a83a') + sh('M14 36 L34 36 L34 42 L14 42 Z', '#c99363'),
    home: sh('M6 24 L24 7 L42 24 L37 24 L37 42 L11 42 L11 24 Z', '#fff4c8') + sh('M20 42 L20 31 L28 31 L28 42 Z', '#c99363'),
    retry: ln('M37 16 C33 9 25 6 18 9 C10 13 7 22 10 30 C13 38 23 42 31 39', '#7fb3ff', 4) + sh('M30 5 L40 17 L27 19 Z', '#7fb3ff'),
    ally: ci(16, 24, 11, '#ffd84a') + ci(16, 22, 4, '#fffaf3', 2) + ci(16, 22, 1.8, K, 0) + ci(33, 26, 11, '#9ccf6e') + ci(29, 24, 1.8, K, 0) + ci(37, 24, 1.8, K, 0),
    sound: sh('M6 18 L14 18 L24 9 L24 39 L14 30 L6 30 Z', '#fffaf3') + thin('M30 17 Q35 24 30 31 M35 12 Q43 24 35 36', K, 3),
    eye: `<ellipse cx="24" cy="24" rx="19" ry="12" fill="#fffaf3" stroke="${K}" stroke-width="3"/>` + ci(24, 24, 6, '#7fb3ff') + ci(24, 24, 2.5, K, 0),
    bigtext: sh('M5 40 L15 8 L21 8 L31 40 L25 40 L22 31 L14 31 L11 40 Z', '#fffaf3') + sh('M31 40 L37 24 L41 24 L47 40 L43 40 L42 36 L36 36 L35 40 Z', '#fffaf3', 2.5),
  };
  window.ICONS = I;
  window.ico = (n, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${I[n] || ''}</svg>`;
  const cache = {};
  window.icoImg = (n) => {
    if (!cache[n]) {
      const im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="96" height="96">${I[n] || ''}</svg>`);
      cache[n] = im;
    }
    return cache[n];
  };
  Object.keys(I).forEach((n) => window.icoImg(n)); // 미리 풀어 두기 (첫 사용 때 끊김 방지)
})();
// HTML 안의 <i data-ico="이름"> 자리를 아이콘으로 바꿔요 (새로 그린 화면에도 fillIcons(그 화면) 호출)
window.fillIcons = (root) => (root || document).querySelectorAll('i[data-ico]').forEach((el) => { el.outerHTML = window.ico(el.dataset.ico, el.className); });
window.fillIcons();
