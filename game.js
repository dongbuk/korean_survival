// 치이카와의 모험 — 시제품 (치이카와 1명, 5분, 보스 1, 약초 채집)
(function () {
  'use strict';
  const Q = window.ChiiQuiz;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const TAU = Math.PI * 2;
  const QA = /[?&]qa=1/.test(location.search);
  const isTouchDev = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // ---------- 저장 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('이 기기에는 저장이 안 돼요'); return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  const K_Q = 'chii_questions_v2', K_REC = 'chii_runs_v1', K_OPT = 'chii_opts_v1', K_SEEN = 'chii_seen_v1';
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opts = Object.assign({ sound: true, vol: 80, shakeAmt: reduceMotion ? 0 : 100, lessFlash: reduceMotion, bigText: false }, store.get(K_OPT, {}));
  if (opts.shake === false && opts.shakeAmt == null) opts.shakeAmt = 0;
  const fs = (px) => Math.round(px * (opts.bigText ? 1.2 : 1)) + 'px Jua, sans-serif';
  const seen = store.get(K_SEEN, {});
  function markSeen(k) { if (!seen[k]) { seen[k] = true; store.set(K_SEEN, seen); } }

  let qText = store.get(K_Q, null) || window.DEFAULT_QUESTIONS;
  let items = Q.parseQuestions(qText).items;
  // 단원 고르기: 고른 단원의 문제만 나와요 (아무것도 안 고르면 전체)
  let selUnits = store.get('chii_units', []);
  function runItems() {
    const pool = selUnits.length ? items.filter((i) => selUnits.includes(i.tag)) : items;
    return pool.length >= 4 ? pool : items;
  }

  // ---------- 조정값 (모두 가설) ----------
  const T = {
    RUN: 300,        // 초: 전투 시계 기준 판 길이
    BOSS_AT: 150,    // 초: 보스 등장
    HP: 100,
    WRONG: 10,       // 오답 피해
    SPEED: 140,      // px/초
    MAG: 100,        // 증표 끌어당김 반경 px
    HERB_EVERY: 30, HERB_FIRST: 20, HERB_HEAL: 15, HERB_TIME: 3,
    MAX_ENEMY: 260,
  };
  const needXp = (L) => Math.round(4 + 4 * (L - 1) + 0.5 * (L - 1) * (L - 1));
  const ETYPE = {
    slime: { r: 12, hp: 12, spd: 45, dmg: 6, xp: 1 },
    hopper: { r: 11, hp: 8, spd: 220, dmg: 5, xp: 1 },
    big: { r: 20, hp: 45, spd: 34, dmg: 9, xp: 3 },
  };
  const WEAP = {
    sickle: { name: '풀베기 낫', ic: '🌾', desc: (l) => `몸 주위를 한 바퀴 휘둘러요 · 피해 ${14 + 4 * (l - 1)} · ${(1.3 - 0.1 * (l - 1)).toFixed(1)}초마다` },
    sling: { name: '새총', ic: '🎯', desc: (l) => `가장 가까운 적을 맞혀요 · 피해 ${12 + 3 * (l - 1)}${l >= 3 ? ' · +1발' : ''}${l >= 4 ? ' · 1번 관통' : ''}` },
    bubble: { name: '비눗방울', ic: '🫧', desc: (l) => `적 위에서 커지며 느리게 만들어요 · 피해 ${4 + 2 * (l - 1)}/0.4초` },
    sword: { name: '검', ic: '⚔️', desc: (l) => `바라보는 쪽을 크게 베어요 · 피해 ${20 + 6 * (l - 1)} · ${(1.1 - 0.08 * (l - 1)).toFixed(2)}초마다` },
    club: { name: '몽둥이', ic: '🪵', desc: (l) => `움직이면 앞으로 돌진, 멈추면 땅 쿵! · 피해 ${16 + 5 * (l - 1)}` },
  };
  const SUBS = {
    wind: { name: '바람 부적', ic: '🍃', desc: (l) => `낫·비눗방울·몽둥이 범위 +${12 * l}%` },
    acorn: { name: '도토리 주머니', ic: '🌰', desc: (l) => `새총·비눗방울 개수 +${Math.ceil(l / 2)}` },
    shoes: { name: '운동화', ic: '👟', desc: (l) => `이동속도 +${8 * l}% · 증표 끌어당기기 +${15 * l}%` },
  };

  // 캐릭터: 무기와 움직임만 달라요. 체력·문제·카드 보상은 모두 같아요.
  const CHARS = {
    chiikawa: { name: '치이카와', weapon: 'sickle', speed: 1, herbMul: 1, passive: '버티기', pdesc: '체력 30% 이하일 때 몬스터 피해 −30%' },
    hachiware: { name: '하치와레', weapon: 'sling', speed: 1, herbMul: 1, passive: '응원', pdesc: '3번 연속 정답마다 3초 무적 + 주변 밀어내기' },
    usagi: { name: '우사기', weapon: 'club', speed: 1.2, herbMul: 0.5, passive: '우라!', pdesc: '빠르게 달리고 약초를 2배 빨리 캐요' },
    rakko: { name: '랏코', weapon: 'sword', speed: 1.05, herbMul: 1, passive: '토벌 고수', pdesc: '보스에게 주는 피해 +30%', locked: true },
  };
  const isUnlocked = (k) => !CHARS[k].locked || !!store.get('chii_unlock_' + k, false);
  let selChar = store.get('chii_char', 'chiikawa');
  if (!CHARS[selChar] || !isUnlocked(selChar)) selChar = 'chiikawa';

  // ---------- 소리 (임시 합성음) ----------
  const SFX = {
    hit: { fv: 0.45, f: [420, 220], d: 0.05, type: 'square', v: 0.025, gap: 0.05 },
    kill: { fv: 0.5, f: [600, 200], d: 0.08, type: 'triangle', v: 0.04, gap: 0.04 },
    pick: { fv: 0.4, f: [900, 1400], d: 0.05, type: 'sine', v: 0.035, gap: 0.03 },
    hurt: { f: [220, 80], d: 0.2, type: 'sawtooth', v: 0.07, gap: 0.2 },
    ok: { seq: [660, 880, 1180], step: 0.08, d: 0.12, type: 'triangle', v: 0.12 },
    no: { seq: [330, 247], step: 0.14, d: 0.2, type: 'square', v: 0.06 },
    open: { f: [500, 800], d: 0.1, type: 'sine', v: 0.07 },
    card: { seq: [880, 1320], step: 0.06, d: 0.12, type: 'triangle', v: 0.1 },
    heal: { seq: [520, 660, 780], step: 0.07, d: 0.12, type: 'sine', v: 0.1 },
    boss: { seq: [110, 98, 82], step: 0.25, d: 0.35, type: 'sawtooth', v: 0.1 },
    warn: { f: [700, 700], d: 0.15, type: 'square', v: 0.05, gap: 0.3 },
    swing: { fv: 0.35, f: [300, 900], d: 0.09, type: 'sine', v: 0.03, gap: 0.1 },
    shoot: { fv: 0.4, f: [700, 500], d: 0.04, type: 'triangle', v: 0.025, gap: 0.06 },
    bubble: { fv: 0.45, f: [300, 600], d: 0.12, type: 'sine', v: 0.04, gap: 0.2 },
    dash: { fv: 0.6, f: [200, 520], d: 0.12, type: 'sawtooth', v: 0.04, gap: 0.15 },
    cheer: { seq: [784, 988, 1175, 1568], step: 0.07, d: 0.15, type: 'triangle', v: 0.1 },
    click: { fv: 0.5, f: [900, 700], d: 0.04, type: 'triangle', v: 0.04, gap: 0.03 },
    stomp: { fv: 0.7, f: [160, 60], d: 0.16, type: 'sine', v: 0.12, gap: 0.15 },
    win: { seq: [523, 659, 784, 1046], step: 0.12, d: 0.2, type: 'triangle', v: 0.12 },
  };
  // audio/manifest.js 에 파일이 등록되면 녹음 소리를 쓰고, 없으면 합성음으로 대신해요.
  const AUDIO_FILES = window.AUDIO_FILES || {};
  const audioEls = {};
  Object.keys(AUDIO_FILES).forEach((n) => {
    audioEls[n] = AUDIO_FILES[n].map((f) => { const a = new Audio('audio/' + f); a.preload = 'auto'; return a; });
  });
  const Snd = {
    ac: null, last: {}, voices: 0,
    unlock() {
      if (!this.ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) try { this.ac = new A(); } catch (e) { /* 소리 없이 진행 */ } }
      if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    },
    play(n, pitch) {
      const p = SFX[n];
      if (!p || !opts.sound || opts.vol <= 0) return;
      const nowMs = performance.now();
      if (this.last[n] && nowMs - this.last[n] < (p.gap || 0.04) * 1000) return;
      if (this.voices > 12) return;
      const files = audioEls[n];
      if (files && files.length) {
        this.last[n] = nowMs;
        const a = files[Math.floor(Math.random() * files.length)].cloneNode();
        a.volume = Math.min(1, (opts.vol / 100) * (p.fv || 0.8));
        a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
        a.playbackRate = (pitch || 1) * (1 + (Math.random() - 0.5) * 0.08);
        this.voices++; a.onended = a.onerror = () => { this.voices--; };
        a.play().catch(() => { this.voices--; });
        return;
      }
      if (!this.ac || this.ac.state !== 'running') return;
      const now = this.ac.currentTime;
      this.last[n] = nowMs;
      const notes = p.seq || [p.f];
      notes.forEach((f, i) => {
        const o = this.ac.createOscillator(), g = this.ac.createGain();
        const t0 = now + i * (p.step || 0);
        const j = (pitch || 1) * (1 + (Math.random() - 0.5) * 0.08);
        const f0 = (Array.isArray(f) ? f[0] : f) * j, f1 = (Array.isArray(f) ? f[1] : f) * j;
        o.type = p.type;
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(f1, t0 + p.d);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, p.v * opts.vol / 100), t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.d);
        o.connect(g).connect(this.ac.destination);
        o.start(t0); o.stop(t0 + p.d + 0.02);
        this.voices++; o.onended = () => { this.voices--; };
      });
    },
  };

  // ---------- 화면 크기 ----------
  let DPR = 1, VW = 0, VH = 0, viewScale = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, isTouchDev ? 1.5 : 2);
    VW = innerWidth; VH = innerHeight;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
    viewScale = Math.max(0.55, Math.min(1.3, Math.min(VW, VH) / 600));
  }
  addEventListener('resize', resize);
  resize();
  const viewR = () => Math.hypot(VW, VH) / 2 / viewScale + 40;

  // 미리 그려 두는 그림
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  (function () {
    const t = tile.getContext('2d'), r = Q.mulberry32(7);
    t.fillStyle = '#cfe8b8'; t.fillRect(0, 0, 256, 256);
    t.strokeStyle = '#b3d69a'; t.lineWidth = 2; t.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r() * 256, y = r() * 256;
      t.beginPath(); t.moveTo(x, y); t.lineTo(x - 3, y - 7); t.moveTo(x, y); t.lineTo(x + 3, y - 6); t.stroke();
    }
    const cols = ['#fff', '#ffd1dc', '#ffe58a'];
    for (let i = 0; i < 12; i++) {
      t.fillStyle = cols[i % 3]; t.beginPath(); t.arc(r() * 256, r() * 256, 2.5, 0, TAU); t.fill();
    }
  })();
  const shadow = document.createElement('canvas');
  shadow.width = 64; shadow.height = 24;
  (function () { const s = shadow.getContext('2d'); s.fillStyle = 'rgba(60,80,40,.25)'; s.beginPath(); s.ellipse(32, 12, 30, 10, 0, 0, TAU); s.fill(); })();

  const ART_FILES = window.ART_FILES || {};
  const ART = {};
  Object.keys(ART_FILES).forEach((k) => {
    const im = new Image();
    im.onload = () => {
      const H = k === 'boss' ? 220 : 96, sc = Math.min(1, H / im.height);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
      ART[k] = c;
      if (k in CHARS && state === 'title') renderChars();
    };
    im.onerror = () => console.warn('그림을 못 불러왔어요:', ART_FILES[k]);
    im.src = 'art/' + ART_FILES[k];
  });

  // 안전 영역 (노치)
  const safe = { t: 0, r: 0, b: 0, l: 0 };
  function readSafe() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);visibility:hidden';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    safe.t = parseFloat(cs.paddingTop) || 0; safe.r = parseFloat(cs.paddingRight) || 0; safe.b = parseFloat(cs.paddingBottom) || 0; safe.l = parseFloat(cs.paddingLeft) || 0;
    d.remove();
  }
  readSafe(); addEventListener('resize', readSafe); addEventListener('orientationchange', readSafe);

  // ---------- 입력 ----------
  const keys = {};
  const BIND = { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], pause: ['Escape', 'KeyP'] };
  const act = (a) => BIND[a].some((c) => keys[c]);
  const joy = { id: null, active: false, bx: 0, by: 0, x: 0, y: 0, R: 56 };
  let usingTouch = isTouchDev;
  function clearInput() { for (const k in keys) keys[k] = false; joy.id = null; joy.active = false; }

  addEventListener('keydown', (e) => {
    Snd.unlock();
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    usingTouch = false;
    keys[e.code] = true;
    if (BIND.pause.includes(e.code) && !e.repeat) {
      const top = ovStack[ovStack.length - 1];
      if (top && CLOSABLE[top] && e.code === 'Escape') hide(top);
      else if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame();
    }
    if (state !== 'play' && ovStack.length && /^Arrow/.test(e.code)) { e.preventDefault(); spatialNav(e.code.slice(5).toLowerCase()); return; }
    const dm = /^(Digit|Numpad)([1-4])$/.exec(e.code);
    if (dm && !e.repeat) {
      const i = +dm[2] - 1;
      if (state === 'quiz') answer(i);
      else if (state === 'cards') pickCard(i);
    }
    if ((e.code === 'Enter' || e.code === 'Space') && state === 'quiz' && $('quizNextRow').style.display !== 'none') { e.preventDefault(); afterQuiz(false); }
    if (BIND.up.concat(BIND.down, BIND.left, BIND.right).includes(e.code) || e.code === 'Space') e.preventDefault();
    if (QA && G && state === 'play') {
      if (e.code === 'KeyK') G.enemies.forEach((en) => { if (en.type !== 'boss') hurtEnemy(en, 9999, G.player.x, G.player.y, 0); });
      if (e.code === 'KeyT') G.clock += 30;
      if (e.code === 'KeyI') { G.qaInv = !G.qaInv; toast('무적 ' + (G.qaInv ? '켬' : '끔')); }
      if (e.code === 'KeyL') G.xp = G.need;
    }
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { clearInput(); if (state === 'play') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (state === 'play') pauseGame(); } });

  cv.addEventListener('pointerdown', (e) => {
    Snd.unlock();
    if (state !== 'play' || joy.id !== null) return;
    usingTouch = e.pointerType !== 'mouse';
    joy.id = e.pointerId; joy.active = true;
    joy.bx = joy.x = e.clientX; joy.by = joy.y = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  });
  cv.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
  const joyEnd = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.active = false; } };
  cv.addEventListener('pointerup', joyEnd);
  cv.addEventListener('pointercancel', joyEnd);

  // 게임패드: 왼쪽 스틱·십자키 이동, A 고르기, B 닫기, Start 쉬기
  const pad = { x: 0, y: 0, prev: [], navT: 0 };
  function rumble(strong, ms) {
    try { const g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean); if (g && g.vibrationActuator && opts.shakeAmt > 0) g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 }); } catch (e) { /* 진동 없음 */ }
  }
  function pollPad(dt) {
    const g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean);
    if (!g) { pad.x = pad.y = 0; return; }
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
    const down = (i) => b(i) && !pad.prev[i];
    let ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    const m = Math.hypot(ax, ay);
    if (m < 0.2) { ax = ay = 0; } else { const s = Math.min(1, (m - 0.2) / 0.8) / m; ax *= s; ay *= s; }
    if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
    if (ax || ay || g.buttons.some((x) => x.pressed)) usingTouch = false;
    pad.x = ax; pad.y = ay;
    if (state === 'play') { if (down(9)) pauseGame(); }
    else {
      pad.navT -= dt;
      if ((Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) && pad.navT <= 0) {
        spatialNav(Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up'));
        pad.navT = 0.22;
      } else if (Math.abs(ax) < 0.3 && Math.abs(ay) < 0.3) pad.navT = 0;
      if (down(0) && document.activeElement && document.activeElement.click) document.activeElement.click();
      if (down(1) || (down(9) && state === 'pause')) backAction();
    }
    pad.prev = g.buttons.map((x) => x.pressed);
  }

  // 화면 쌓기: 위에 열린 화면만 조작돼요. 열면 첫 버튼에, 닫으면 아래 화면에 포커스가 가요.
  const ovStack = []; // 처음엔 입장 코드 화면이나 제목 화면을 열어요
  const CLOSABLE = { how: 1, editor: 1, records: 1, settings: 1, dex: 1, note: 1 };
  function topOv() { return ovStack.length ? $(ovStack[ovStack.length - 1]) : null; }
  function focusables(root) { return root ? [...root.querySelectorAll('button:not(:disabled),input,textarea')].filter((el) => el.offsetParent !== null) : []; }
  function focusFirst(id) {
    const el = $(id);
    const pick = el.querySelector('[data-focus]:not(:disabled)') || el.querySelector('.choice:not(:disabled),.card,.char.on') || focusables(el)[0];
    if (pick) pick.focus({ preventScroll: true });
  }
  function spatialNav(dir) {
    const list = focusables(topOv());
    if (!list.length) return;
    const cur = document.activeElement;
    if (!list.includes(cur)) { list[0].focus(); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bd = 1e9;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, dx = x - ax, dy = y - ay;
      const ok = dir === 'left' ? dx < -4 : dir === 'right' ? dx > 4 : dir === 'up' ? dy < -4 : dy > 4;
      if (!ok) continue;
      const main = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy), side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      const sc = main + side * 2;
      if (sc < bd) { bd = sc; best = el; }
    }
    if (best) { best.focus(); Snd.play('click'); }
  }
  function backAction() {
    const top = ovStack[ovStack.length - 1];
    if (top && CLOSABLE[top]) hide(top);
    else if (state === 'pause') resumeGame();
  }

  // ---------- 상태 ----------
  let state = 'title';
  let G = null;
  function setState(s) { state = s; $('pauseBtn').style.display = s === 'play' ? 'block' : 'none'; }
  function show(id) {
    const el = $(id);
    el.classList.add('show');
    const i = ovStack.indexOf(id); if (i >= 0) ovStack.splice(i, 1);
    ovStack.push(id);
    setTimeout(() => { if (ovStack[ovStack.length - 1] === id) focusFirst(id); }, 30);
  }
  function hide(id) {
    const el = $(id);
    if (!el.classList.contains('show')) return;
    el.classList.remove('show');
    const i = ovStack.indexOf(id); if (i >= 0) ovStack.splice(i, 1);
    const top = ovStack[ovStack.length - 1];
    if (top) focusFirst(top); else if (document.activeElement) document.activeElement.blur();
  }

  // 오답 노트에 있는 문제를 이번 판 초반에 먼저 (최대 6개)
  function newSched(rng) {
    const pool = runItems(), n = noteGet(), byKey = {};
    pool.forEach((it) => { byKey[Q.noteKey(it)] = it; });
    const pri = Q.shuffle(Object.keys(n).filter((k) => byKey[k]).map((k) => byKey[k].id), rng).slice(0, 6);
    return new Q.Scheduler(pool, rng, { priority: pri });
  }
  function newRun() {
    const sm = /[?&]seed=(\d+)/.exec(location.search);
    const seed = sm ? +sm[1] >>> 0 : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const rng = Q.mulberry32(seed);
    G = {
      seed, rng,
      t: 0, clock: 0,
      player: { x: 0, y: 0, px: 0, py: 0, r: 14, hp: T.HP, max: T.HP, inv: 0, fx: 1, fy: 0, moving: false, hurtT: 0 },
      hpGhost: T.HP, ghostHold: 0,
      char: selChar, weapons: { [CHARS[selChar].weapon]: 1 }, subs: {}, wcd: { sickle: 0.4, sling: 0.3, bubble: 0, club: 0.6, sword: 0.5 }, slash: null,
      dash: null, stomp: null, pendingCheer: false, cheerT: 0,
      level: 1, xp: 0, need: needXp(1),
      enemies: [], shots: [], bubbles: [], gems: [], herbs: [], parts: [], nums: [],
      swing: null, kills: 0, spawnAcc: 0, herbT: T.HERB_FIRST,
      boss: null, bossSpawned: false, pendingBossQuiz: false,
      streak: 0, trauma: 0, zp: 0, hitstop: 0, shT: 0, kickX: 0, kickY: 0, hurtFlash: 0, puffs: [],
      xpBump: 0, killBump: 0, healGlow: 0, pickChain: 0, pickT: 0,
      cam: { x: 0, y: 0 },
      sched: newSched(rng), stats: new Q.Stats(),
      cardOpts: [], cardsAt: 0, qaInv: false,
    };
    for (let i = 0; i < 6; i++) spawnEnemy('slime');
  }

  // ---------- 계산 도우미 ----------
  const area = () => 1 + 0.12 * (G.subs.wind || 0);
  const cntB = () => Math.ceil((G.subs.acorn || 0) / 2);
  const spd = () => T.SPEED * CHARS[G.char].speed * (1 + 0.08 * (G.subs.shoes || 0));
  const mag = () => T.MAG * (1 + 0.15 * (G.subs.shoes || 0));
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // 공간 격자 (적끼리 / 공격과 적 충돌)
  const CELL = 64;
  const grid = new Map();
  const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  function buildGrid() {
    grid.forEach((a) => { a.length = 0; });
    for (const e of G.enemies) {
      if (e.dead) continue;
      const k = gkey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let a = grid.get(k);
      if (!a) { a = []; grid.set(k, a); }
      a.push(e);
    }
    if (grid.size > 4000) grid.clear(), buildGrid();
  }
  function near(x, y, r, cb) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = grid.get(gkey(cx, cy));
      if (a) for (let i = 0; i < a.length; i++) cb(a[i]);
    }
  }

  // ---------- 생성 ----------
  function ringPos(biasAngle) {
    const a = biasAngle == null ? G.rng() * TAU : biasAngle + (G.rng() - 0.5) * 1.4;
    const d = viewR();
    return { x: G.player.x + Math.cos(a) * d, y: G.player.y + Math.sin(a) * d };
  }
  function spawnEnemy(type) {
    const D = ETYPE[type], p = ringPos(), s = 1 + G.clock / 200;
    G.enemies.push({ type, x: p.x, y: p.y, px: p.x, py: p.y, r: D.r, hp: D.hp * s, max: D.hp * s, spd: D.spd, dmg: D.dmg, xp: D.xp,
      flash: 0, kx: 0, ky: 0, slow: 0, st: type === 'hopper' ? 'wait' : 'move', stT: 0.3 + G.rng() * 0.8, dx: 0, dy: 0, face: 1, ph: G.rng() * TAU });
  }
  function spawnBoss() {
    G.bossSpawned = true;
    const p = ringPos();
    const e = { type: 'boss', x: p.x, y: p.y, px: p.x, py: p.y, r: 40, hp: 300, max: 300, spd: 55, dmg: 12, xp: 0,
      flash: 0, kx: 0, ky: 0, slow: 0, st: 'chase', stT: 3.5, dx: 0, dy: 0, face: 1, ph: 0, quizDone: false };
    G.enemies.push(e); G.boss = e;
    banner('1라운드 보스 등장! 세이렌');
    Snd.play('boss'); addTrauma(0.5);
    if (!seen.boss) { toast('보스전 동안은 시계가 멈춰요. 빨간 줄이 보이면 비켜요!', 4500); markSeen('boss'); }
  }
  function dropGem(x, y, v) {
    if (G.gems.length > 350) { G.xp += v; return; }
    G.gems.push({ x, y, px: x, py: y, v, pull: false });
  }
  function burst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      if (G.parts.length > 300) G.parts.shift();
      const a = Math.random() * TAU, s = 60 + Math.random() * 140;
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.35 + Math.random() * 0.3, col, r: 2 + Math.random() * 2.5 });
    }
  }
  function addNum(x, y, txt, col, size) {
    if (G.nums.length > 40) G.nums.shift();
    G.nums.push({ x: x + (Math.random() - 0.5) * 12, y, t: 0, txt: String(txt), col, size: size || 16 });
  }
  function addTrauma(v) { G.trauma = Math.min(1, G.trauma + v); }
  function hitStop(d) { G.hitstop = Math.max(G.hitstop, d); }
  function kick(dx, dy, amt) { const d = Math.hypot(dx, dy) || 1; G.kickX += (dx / d) * amt; G.kickY += (dy / d) * amt; }
  function puff(x, y, r, col) { if (G.puffs.length > 40) G.puffs.shift(); G.puffs.push({ x, y, r, col, t: 0 }); }
  // 사건 크기에 맞춘 한 묶음 반응 (small · medium · large)
  function feedback(tier, x, y, col) {
    if (tier === 'small') { burst(x, y, col, 3); }
    else if (tier === 'medium') { addTrauma(0.35); hitStop(0.05); burst(x, y, col, 10); puff(x, y, 26, col); }
    else { addTrauma(0.8); hitStop(0.12); burst(x, y, col, 30); puff(x, y, 70, col); G.zp = Math.max(G.zp, 0.08); }
  }

  // ---------- 피해 ----------
  function hurtEnemy(e, dmg, fx, fy, kb) {
    if (e.dead) return;
    if (e.type === 'boss' && e.st === 'stun') dmg *= 2;
    if (e.type === 'boss' && G.char === 'rakko') dmg *= 1.3; // 랏코 특성 '토벌 고수'
    e.hp -= dmg; e.flash = 0.08; e.sq = 1;
    const dx = e.x - fx, dy = e.y - fy, d = Math.hypot(dx, dy) || 1;
    const kbm = e.type === 'boss' ? 0.08 : e.type === 'big' ? 0.5 : 1;
    e.kx += (dx / d) * kb * kbm; e.ky += (dy / d) * kb * kbm;
    addNum(e.x, e.y - e.r - 4, Math.round(dmg), e.type === 'boss' && e.st === 'stun' ? '#ffe066' : '#fff', e.type === 'boss' ? 20 : 15);
    Snd.play('hit');
    if (e.type === 'boss' && !e.quizDone && e.hp > 0 && e.hp <= e.max * 0.5) { e.quizDone = true; G.pendingBossQuiz = true; }
    if (e.hp <= 0) {
      e.dead = true; G.kills++;
      Snd.play('kill');
      if (e.type === 'boss') bossDefeated(e);
      else { burst(e.x, e.y, colorOf(e), e.type === 'big' ? 10 : 5); puff(e.x, e.y - e.r * 0.8, e.r * 1.6, '#ffffff'); dropGem(e.x, e.y, e.xp); G.killBump = 1; }
    }
  }
  function bossDefeated(e) {
    G.boss = null; G.pendingBossQuiz = false;
    burst(e.x, e.y, '#a07a5a', 40); burst(e.x, e.y, '#ffe066', 20);
    for (let i = 0; i < 15; i++) dropGem(e.x + (G.rng() - 0.5) * 120, e.y + (G.rng() - 0.5) * 120, 4);
    G.gems.forEach((g) => { g.pull = true; });
    feedback('large', e.x, e.y, '#ffe066'); G.zp = 0.1;
    banner('세이렌을 쫓아냈어요!');
    Snd.play('win');
  }
  function hurtPlayer(dmg, src) {
    const P = G.player;
    if (G.qaInv || P.inv > 0) return;
    const m = G.char === 'chiikawa' && P.hp <= P.max * 0.3 ? 0.7 : 1; // 치이카와 특성 '버티기'
    P.hp -= dmg * m; P.inv = 0.6; P.hurtT = 0.2; G.ghostHold = 0.3;
    feedback('medium', P.x, P.y - 12, '#ff9a9a');
    if (src) kick(P.x - src.x, P.y - src.y, 8);
    G.hurtFlash = 1;
    rumble(0.5, 140);
    addNum(P.x, P.y - 36, '-' + Math.round(dmg * m), '#ff6b6b', 18);
    Snd.play('hurt');
    if (P.hp <= 0) endRun(false, '몬스터에게 쓰러졌어요');
  }
  function heal(v) {
    const P = G.player;
    P.hp = Math.min(P.max, P.hp + v);
    if (G.hpGhost < P.hp) G.hpGhost = P.hp;
    addNum(P.x, P.y - 40, '+' + v, '#5fd17a', 22);
    burst(P.x, P.y - 10, '#7cc48a', 14); puff(P.x, P.y - 12, 34, '#7cc48a');
    G.healGlow = 1;
    Snd.play('heal');
  }
  const colorOf = (e) => (e.type === 'slime' ? '#b5d67a' : e.type === 'hopper' ? '#f6b3c4' : e.type === 'big' ? '#f0e6da' : '#ff8a8a');

  // ---------- 한 단계 (1/60초) ----------
  function update(dt) {
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    const P = G.player;
    G.t += dt;
    if (!G.boss) G.clock += dt;
    G.zp *= Math.exp(-6 * dt);
    for (const f of G.puffs) f.t += dt;
    G.puffs = G.puffs.filter((f) => f.t < 0.3);
    G.pickT -= dt; if (G.pickT <= 0) G.pickChain = 0;
    if (G.cheerT > 0) G.cheerT -= dt;
    if (G.pendingCheer) {
      G.pendingCheer = false; G.cheerT = 3;
      const P0 = G.player;
      P0.inv = Math.max(P0.inv, 3);
      near(P0.x, P0.y, 160, (e) => { const dx = e.x - P0.x, dy = e.y - P0.y, d = Math.hypot(dx, dy) || 1, k = e.type === 'boss' ? 0.15 : 1; e.kx += (dx / d) * 420 * k; e.ky += (dy / d) * 420 * k; });
      burst(P0.x, P0.y - 12, '#ffe066', 24); addTrauma(0.3);
      banner('하치와레 응원! 3초 무적'); Snd.play('cheer');
    }

    if (!G.bossSpawned && G.clock >= T.BOSS_AT) spawnBoss();
    if (G.clock >= T.RUN && !G.boss) { endRun(true); return; }

    // 이동
    P.px = P.x; P.py = P.y;
    let mx = 0, my = 0;
    if (act('left')) mx -= 1; if (act('right')) mx += 1;
    if (act('up')) my -= 1; if (act('down')) my += 1;
    if (mx || my) { const l = Math.hypot(mx, my); mx /= l; my /= l; }
    if (pad.x || pad.y) { mx = pad.x; my = pad.y; }
    if (joy.active) {
      const dx = joy.x - joy.bx, dy = joy.y - joy.by, len = Math.hypot(dx, dy);
      const m = Math.min(len / joy.R, 1);
      if (m > 0.15) { const s = (m - 0.15) / 0.85; mx = (dx / len) * s; my = (dy / len) * s; }
    }
    const ml = Math.hypot(mx, my);
    P.moving = ml > 0.02;
    if (P.moving) { P.fx = mx / ml; P.fy = my / ml; if (!seen.move) { markSeen('move'); hideToast(); } }
    P.x += mx * spd() * dt; P.y += my * spd() * dt;
    P.inv -= dt; P.hurtT -= dt;
    if (P.hp < G.hpGhost) { G.ghostHold -= dt; if (G.ghostHold <= 0) G.hpGhost = Math.max(P.hp, G.hpGhost - 60 * dt); } else G.hpGhost = P.hp;

    // 몬스터 생성
    const rate = (0.7 + 0.012 * G.clock) * (G.boss ? 0.2 : 1);
    G.spawnAcc += rate * dt;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1;
      if (G.enemies.length >= T.MAX_ENEMY) continue;
      const r = G.rng();
      spawnEnemy(G.clock > 200 && r < 0.12 ? 'big' : G.clock > 60 && r < 0.37 ? 'hopper' : 'slime');
    }

    buildGrid();
    updWeapons(dt);
    updEnemies(dt);
    if (state !== 'play') return; // 쓰러짐
    updShots(dt);
    updBubbles(dt);
    G.enemies = G.enemies.filter((e) => !e.dead);
    updGems(dt);
    updHerbs(dt);
    for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-5 * dt); p.vy *= Math.exp(-5 * dt); }
    G.parts = G.parts.filter((p) => p.t < p.life);
    for (const n of G.nums) n.t += dt;
    G.nums = G.nums.filter((n) => n.t < 0.75);

    if (G.pendingBossQuiz && G.boss) { G.pendingBossQuiz = false; openQuiz('boss'); return; }
    if (G.xp >= G.need) { G.xp -= G.need; G.level++; G.need = needXp(G.level); openQuiz('level'); }
  }

  function nearestN(x, y, r, n) {
    const out = [];
    const r2 = r * r;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 > r2) continue;
      let i = out.length;
      while (i > 0 && out[i - 1].d2 > d2) i--;
      if (i < n) { out.splice(i, 0, { e, d2 }); if (out.length > n) out.pop(); }
    }
    return out.map((o) => o.e);
  }

  function updWeapons(dt) {
    const P = G.player;
    for (const w in G.weapons) G.wcd[w] -= dt;
    // 풀베기 낫
    const ls = G.weapons.sickle;
    if (ls) {
      if (!G.swing && G.wcd.sickle <= 0) {
        G.swing = { a0: Math.atan2(P.fy, P.fx), t: 0, dur: 0.32, hit: new Set() };
        G.wcd.sickle = 1.3 - 0.1 * (ls - 1);
        Snd.play('swing');
      }
      if (G.swing) {
        const s = G.swing; s.t += dt;
        const p = Math.min(1, s.t / s.dur), R = 62 * area(), dmg = 14 + 4 * (ls - 1);
        near(P.x, P.y, R + 50, (e) => {
          if (e.dead || s.hit.has(e)) return;
          const dx = e.x - P.x, dy = e.y - P.y;
          if (dx * dx + dy * dy > (R + e.r) ** 2) return;
          let rel = Math.atan2(dy, dx) - s.a0; rel = ((rel % TAU) + TAU) % TAU;
          if (rel <= TAU * p) { s.hit.add(e); hurtEnemy(e, dmg, P.x, P.y, 160); }
        });
        if (p >= 1) G.swing = null;
      }
    }
    // 새총
    const lg = G.weapons.sling;
    if (lg && G.wcd.sling <= 0) {
      const n = 1 + cntB() + (lg >= 3 ? 1 : 0);
      const tg = nearestN(P.x, P.y, 420, n);
      if (tg.length) {
        G.wcd.sling = 0.9 - 0.08 * (lg - 1);
        for (let i = 0; i < n; i++) {
          const t = tg[i % tg.length];
          let a = Math.atan2(t.y - P.y, t.x - P.x);
          if (i >= tg.length) a += 0.22 * (i - tg.length + 1) * (i % 2 ? 1 : -1);
          G.shots.push({ x: P.x, y: P.y - 10, px: P.x, py: P.y - 10, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, life: 1.1, dmg: 12 + 3 * (lg - 1), pierce: lg >= 4 ? 1 : 0, hit: new Set() });
        }
        Snd.play('shoot');
      } else G.wcd.sling = 0.2;
    }
    // 비눗방울
    const lb = G.weapons.bubble;
    if (lb && G.wcd.bubble <= 0) {
      G.wcd.bubble = 3.2 - 0.25 * (lb - 1);
      const n = Math.min(4, 1 + cntB());
      const cand = G.enemies.filter((e) => !e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 320 * 320);
      for (let i = 0; i < n; i++) {
        let tx, ty;
        if (cand.length) { const c = cand[Math.floor(G.rng() * cand.length)]; tx = c.x; ty = c.y; }
        else { const a = G.rng() * TAU; tx = P.x + Math.cos(a) * 90; ty = P.y + Math.sin(a) * 90; }
        G.bubbles.push({ x: tx, y: ty, t: 0, life: 2.6, maxR: (42 + 5 * lb) * area(), tick: 0, dmg: 4 + 2 * (lb - 1) });
      }
      Snd.play('bubble');
    }
    // 검: 바라보는 쪽 부채꼴(140도)을 한 번에 베기
    const lw = G.weapons.sword;
    if (lw && G.wcd.sword <= 0) {
      G.wcd.sword = 1.1 - 0.08 * (lw - 1);
      const R = 84 * area(), half = 70 * Math.PI / 180, a0 = Math.atan2(P.fy, P.fx), dmgS = 20 + 6 * (lw - 1);
      near(P.x, P.y, R + 50, (e) => {
        if (e.dead) return;
        const dx = e.x - P.x, dy = e.y - P.y;
        if (dx * dx + dy * dy > (R + e.r) ** 2) return;
        let rel = Math.atan2(dy, dx) - a0; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) <= half || dx * dx + dy * dy < (e.r + 18) ** 2) hurtEnemy(e, dmgS, P.x, P.y, 190);
      });
      G.slash = { a0, R, t: 0 };
      Snd.play('swing', 0.8);
    }
    if (G.slash) { G.slash.t += dt; if (G.slash.t > 0.16) G.slash = null; }
    // 몽둥이: 움직이는 중엔 돌진, 멈춰 있으면 제자리 쿵
    const lc = G.weapons.club;
    if (lc) {
      const dmgC = 16 + 5 * (lc - 1);
      if (!G.dash && G.wcd.club <= 0) {
        G.wcd.club = 2.0 - 0.15 * (lc - 1);
        if (P.moving) { G.dash = { t: 0, dur: 0.18, dx: P.fx, dy: P.fy, hit: new Set() }; Snd.play('dash'); kick(-P.fx, -P.fy, 4); }
        else {
          const R = (52 + 4 * lc) * area();
          near(P.x, P.y, R + 50, (e) => { if (!e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < (R + e.r) ** 2) hurtEnemy(e, dmgC, P.x, P.y, 200); });
          G.stomp = { x: P.x, y: P.y, t: 0, R }; addTrauma(0.15); Snd.play('stomp');
        }
      }
      if (G.dash) {
        const d = G.dash; d.t += dt;
        const v = 120 / d.dur;
        P.x += d.dx * v * dt; P.y += d.dy * v * dt;
        P.inv = Math.max(P.inv, 0.05);
        const R = (24 + 3 * lc) * area();
        near(P.x, P.y, R + 50, (e) => {
          if (e.dead || d.hit.has(e)) return;
          if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < (R + e.r) ** 2) { d.hit.add(e); hurtEnemy(e, dmgC, P.x - d.dx * 30, P.y - d.dy * 30, 220); }
        });
        if (d.t >= d.dur) { G.dash = null; burst(P.x, P.y, '#e8dcc8', 6); }
      }
    }
    if (G.stomp) { G.stomp.t += dt; if (G.stomp.t > 0.3) G.stomp = null; }
  }

  function updEnemies(dt) {
    const P = G.player, VR = viewR();
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.px = e.x; e.py = e.y;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      const sf = e.slow > 0 ? 0.6 : 1;
      e.slow -= dt; e.flash -= dt; e.ph += dt; if (e.sq) e.sq = Math.max(0, e.sq - dt * 7);
      if (e.type === 'hopper') {
        e.stT -= dt;
        if (e.st === 'move') {
          if (e.stT <= 0) { e.st = 'wait'; e.stT = 0.8; }
          else { e.x += e.dx * e.spd * sf * dt; e.y += e.dy * e.spd * sf * dt; }
        } else if (e.stT <= 0) { e.st = 'move'; e.stT = 0.3; e.dx = dx / d; e.dy = dy / d; }
      } else if (e.type === 'boss') {
        updBoss(e, dt, dx, dy, d, sf);
      } else {
        e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      }
      e.x += e.kx * dt; e.y += e.ky * dt;
      const kd = Math.exp(-10 * dt); e.kx *= kd; e.ky *= kd;
      if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
      // 너무 멀어지면 앞쪽으로 다시 데려오기
      if (d > VR * 1.6) { const p = ringPos(Math.atan2(P.fy, P.fx)); e.x = e.px = p.x; e.y = e.py = p.y; }
      // 몬스터끼리 살짝 밀어내기
      if (e.type !== 'boss') near(e.x, e.y, e.r + 12, (o) => {
        if (o === e || o.dead || o.type === 'boss') return;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = e.r + o.r;
        if (od > 0 && od < min) { const push = (min - od) * 0.25; e.x += (ox / od) * push; e.y += (oy / od) * push; }
      });
      // 닿으면 피해
      const touchable = !(e.type === 'boss' && e.st === 'stun');
      if (touchable && d < e.r + P.r) { hurtPlayer(e.dmg, e); if (state !== 'play') return; }
    }
  }

  function bossWarn(e) {
    const P = G.player, dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.dx = dx / d; e.dy = dy / d; e.st = 'warn'; e.stT = 1.0;
    Snd.play('warn');
  }
  function updBoss(e, dt, dx, dy, d, sf) {
    e.stT -= dt;
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT <= 0) bossWarn(e);
    } else if (e.st === 'warn') {
      if (e.stT <= 0) { e.st = 'charge'; e.stT = 0.6; addTrauma(0.3); burst(e.x, e.y, '#a07a5a', 8); }
    } else if (e.st === 'charge') {
      e.x += e.dx * 400 * dt; e.y += e.dy * 400 * dt;
      if (e.stT <= 0) { e.st = 'chase'; e.stT = 5 + G.rng() * 1.5; }
    } else if (e.st === 'stun') {
      if (e.stT <= 0) { e.st = 'chase'; e.stT = 3; }
    }
  }

  function updShots(dt) {
    for (const s of G.shots) {
      s.px = s.x; s.py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      near(s.x, s.y, 50, (e) => {
        if (s.life <= 0 || e.dead || s.hit.has(e)) return;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + 5) ** 2) {
          s.hit.add(e); hurtEnemy(e, s.dmg, s.x - s.vx, s.y - s.vy, 90);
          if (--s.pierce < 0) s.life = 0;
        }
      });
    }
    G.shots = G.shots.filter((s) => s.life > 0);
  }

  function updBubbles(dt) {
    for (const b of G.bubbles) {
      b.t += dt; b.tick -= dt;
      const r = b.maxR * Math.min(1, b.t / 0.6), doTick = b.tick <= 0;
      near(b.x, b.y, r + 45, (e) => {
        if (e.dead) return;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (r + e.r) ** 2) { e.slow = 0.15; if (doTick) hurtEnemy(e, b.dmg, b.x, b.y, 15); }
      });
      if (doTick) b.tick = 0.4;
    }
    G.bubbles = G.bubbles.filter((b) => b.t < b.life);
  }

  function updGems(dt) {
    const P = G.player, M = mag();
    for (const g of G.gems) {
      g.px = g.x; g.py = g.y;
      const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (!g.pull && d < M) g.pull = true;
      if (g.pull) { const v = Math.min(d, (380 + (M - Math.min(d, M)) * 2) * dt); g.x += (dx / d) * v; g.y += (dy / d) * v; }
      if (d < P.r + 8) {
        G.xp += g.v; g.v = 0; G.xpBump = 1;
        G.pickChain = Math.min(G.pickChain + 1, 12); G.pickT = 0.35;
        Snd.play('pick', 1 + G.pickChain * 0.04);
      }
    }
    G.gems = G.gems.filter((g) => g.v > 0);
  }

  function updHerbs(dt) {
    const P = G.player;
    G.herbT -= dt;
    if (G.herbT <= 0) {
      G.herbT = T.HERB_EVERY;
      if (G.herbs.length < 2) {
        const a = G.rng() * TAU, d = 220 + G.rng() * 160;
        G.herbs.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, prog: 0, life: 40, ph: 0 });
        if (!seen.herb) toast('약초가 생겼어요! 초록 화살표를 따라가서 옆에 멈춰 서요', 5000);
      }
    }
    for (const h of G.herbs) {
      h.life -= dt; h.ph += dt;
      const close = Math.hypot(P.x - h.x, P.y - h.y) < 46;
      if (close && !P.moving) h.prog += dt / (T.HERB_TIME * CHARS[G.char].herbMul);
      else h.prog = Math.max(0, h.prog - dt * 0.4);
      if (close && P.moving && !seen.herb && !h.told) { h.told = true; toast('멈춰 서 있으면 약초를 캐요', 2500); }
      if (h.prog >= 1) { h.life = 0; heal(T.HERB_HEAL); puff(h.x, h.y - 10, 50, '#ffffff'); addTrauma(0.15); markSeen('herb'); }
    }
    G.herbs = G.herbs.filter((h) => h.life > 0);
  }

  // ---------- 문제 ----------
  let quiz = null;
  // 지문(앞줄들)과 묻는 말(마지막 줄)을 나눠서 보여 줘요
  function renderQText(q) {
    const ls = String(q).split('\n').map((l) => l.trim()).filter(Boolean);
    const ask = ls.pop() || '';
    $('quizQ').innerHTML = (ls.length ? `<div class="passage">${escapeHtml(ls.join('\n'))}</div>` : '') + `<div class="ask">${escapeHtml(ask)}</div>`;
    $('quizQ').classList.toggle('long', ask.length > 22);
  }
  function quizTitle(kind) {
    if (kind === 'boss') return '보스 약점 문제!';
    if (kind === 'review') return `오답 노트 복습 ${rv.i + 1} / ${rv.list.length}`;
    return '증표 게이지 가득! 문제';
  }
  function openQuiz(kind, given) {
    setState('quiz'); clearInput();
    const nq = given || G.sched.next(G.clock / T.RUN);
    const it = nq.item;
    quiz = { kind, nq, t0: performance.now(), answered: false, hint: false };
    $('quizKind').textContent = quizTitle(kind);
    const badge = nq.isReask ? '다시 도전 · ' : nq.isNote ? '지난번에 틀린 문제 · ' : '';
    $('quizTag').textContent = badge + it.tag + ' · ' + (it.short ? '주관식' : '★'.repeat(it.diff));
    renderQText(it.q);
    const box = $('quizChoices');
    box.innerHTML = '';
    box.style.display = it.short ? 'none' : '';
    $('quizShort').style.display = it.short ? '' : 'none';
    if (it.short) {
      const inp = $('shortIn');
      inp.value = ''; inp.disabled = false; inp.classList.remove('ok', 'no');
      $('shortGo').disabled = false; $('shortHint').disabled = false;
      renderCells();
    } else {
      nq.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'choice' + (nq.choices.some((x) => x.length > 12) ? ' long' : '');
        b.innerHTML = (usingTouch ? '' : `<span class="k">${i + 1}</span>`) + escapeHtml(c);
        b.addEventListener('click', () => answer(i));
        box.appendChild(b);
      });
    }
    $('quizFb').innerHTML = '';
    $('quizNextRow').style.display = 'none';
    $('quizQuitRow').style.display = kind === 'review' ? '' : 'none';
    Snd.play('open');
    show('quiz');
  }
  // 주관식 힌트 칸: 글자 수만큼 칸, 첫 글자 힌트를 누르면 첫 칸에 연하게
  function renderCells(reveal) {
    if (!quiz) return;
    const it = quiz.nq.item, cells = Q.hintCells(it);
    const typed = Array.from($('shortIn').value.replace(/\s/g, ''));
    const n = cells.filter((c) => c !== ' ').length;
    let j = 0;
    $('shortCells').innerHTML = cells.map((c) => {
      if (c === ' ') return '<span class="gap"></span>';
      const t = reveal ? c : typed[j], first = j === 0; j++;
      if (t) return `<span class="cell fill${reveal ? ' ans' : ''}">${escapeHtml(t)}</span>`;
      if (first && quiz.hint) return `<span class="cell ghost">${escapeHtml(c)}</span>`;
      return '<span class="cell"></span>';
    }).join('') + `<span class="cnt">${n}글자</span>`;
    $('shortCells').classList.toggle('over', !reveal && typed.length > n);
  }
  $('shortIn').addEventListener('input', () => renderCells());
  $('shortIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitShort(); } });
  $('shortGo').addEventListener('click', () => submitShort());
  $('shortHint').addEventListener('click', () => {
    if (!quiz || quiz.answered) return;
    quiz.hint = true; $('shortHint').disabled = true; renderCells(); Snd.play('pick');
    $('shortIn').focus();
  });
  function submitShort() {
    if (!quiz || quiz.answered || !quiz.nq.item.short) return;
    const v = $('shortIn').value.trim();
    if (!v) { toast('답을 써 주세요'); $('shortIn').focus(); return; }
    const ok = Q.checkShort(quiz.nq.item, v);
    $('shortIn').disabled = true; $('shortGo').disabled = true; $('shortHint').disabled = true;
    $('shortIn').classList.add(ok ? 'ok' : 'no');
    renderCells(true);
    resolve(ok, v);
  }
  function answer(i) {
    if (!quiz || quiz.answered || quiz.nq.item.short || i >= quiz.nq.choices.length) return;
    const it = quiz.nq.item, ch = quiz.nq.choices[i], ok = ch === it.ans;
    const btns = $('quizChoices').children;
    for (let k = 0; k < btns.length; k++) {
      btns[k].disabled = true;
      if (quiz.nq.choices[k] === it.ans) btns[k].classList.add('ok');
      else if (k === i) btns[k].classList.add('no');
    }
    resolve(ok, ch);
  }
  // 오답 노트 (별명마다, 이 기기에 저장)
  const K_NOTE = 'chii_note_v1';
  const nickName = () => ($('nick').value || '').trim() || '이름없음';
  function noteAll() { return store.get(K_NOTE, {}); }
  function noteGet() { return noteAll()[nickName()] || {}; }
  function noteSave(n) { const all = noteAll(); all[nickName()] = n; store.set(K_NOTE, all); }
  function noteCount() { return Object.keys(noteGet()).length; }
  function noteMark(it, ok) { const n = noteGet(); const r = Q.noteUpdate(n, it, ok, Date.now()); if (r) noteSave(n); return r; }
  function noteMsg(r, ok) {
    if (r === 'cleared') return '<br><span class="note-ok">📒 오답 노트 졸업!</span>';
    if (r === 'progress') return `<br><span class="note-ok">📒 오답 노트 ${Q.NOTE_CLEAR - 1}/${Q.NOTE_CLEAR} · 한 번 더 맞히면 졸업</span>`;
    if (r === 'added' && !ok) return '<br><span class="sub">📒 오답 노트에 담았어요</span>';
    return '';
  }
  function wrongHtml(it, mine) {
    return `<span class="big">✕ 아쉬워요</span><br>정답은 <b>${escapeHtml(it.ans)}</b>` + (it.short ? ` <span class="sub">(내 답: ${escapeHtml(mine)})</span>` : '') +
      (it.exp ? `<br>${escapeHtml(it.exp)}` : '');
  }
  function resolve(ok, chosen) {
    quiz.answered = true;
    const it = quiz.nq.item;
    const noteR = noteMark(it, ok);
    if (quiz.kind === 'review') { reviewResolve(ok, chosen, noteR); return; }
    G.stats.record({ tag: it.tag, q: it.q, ans: it.ans, chosen, correct: ok, ms: performance.now() - quiz.t0, isReask: quiz.nq.isReask, isNote: !!quiz.nq.isNote, hint: quiz.hint, short: !!it.short, kind: quiz.kind, diff: it.diff });
    G.sched.report(it, ok);
    if (ok) {
      G.streak++;
      if (G.char === 'hachiware' && G.streak % 3 === 0) G.pendingCheer = true;
      Snd.play('ok');
      const four = quiz.kind === 'level' && G.streak % 3 === 0;
      $('quizFb').innerHTML = '<span class="big">○ 정답!</span>' + (four ? '<br>3번 연속 정답! 카드가 4장이에요' : G.streak > 1 ? `<br>${G.streak}번 연속!` : '') + noteMsg(noteR, ok);
      if (G.pendingCheer) $('quizFb').innerHTML += '<br>하치와레 응원! 돌아가면 3초 무적';
      const me = quiz;
      setTimeout(() => { if (quiz === me) afterQuiz(true); }, noteR ? 1100 : 750);
    } else {
      G.streak = 0;
      Snd.play('no');
      G.player.hp -= T.WRONG; G.ghostHold = 0.3;
      const again = (G.sched.reaskN[it.id] || 0) > 0 && G.sched.reask.some((r) => r.id === it.id);
      $('quizFb').innerHTML = wrongHtml(it, chosen) + ` <span class="sub">· 체력 −${T.WRONG}</span>` +
        (quiz.kind === 'boss' ? '<br>보스가 돌진해요! 빨간 줄을 피해요' : '') +
        (again ? '<br><span class="sub">정답을 기억해 두세요. 이 문제가 곧 다시 나와요</span>' : '') + noteMsg(noteR, ok);
      setTimeout(() => { if (quiz) { $('quizNextRow').style.display = 'flex'; $('quizNext').focus(); } }, 1200);
    }
  }
  function afterQuiz(ok) {
    if (!quiz) return;
    if (quiz.kind === 'review') { reviewNext(); return; }
    const kind = quiz.kind;
    quiz = null;
    hide('quiz');
    if (G.player.hp <= 0) { endRun(false, '체력이 다 떨어졌어요'); return; }
    if (kind === 'level' && ok) { openCards(G.streak % 3 === 0 ? 4 : 3); return; }
    if (kind === 'boss' && G.boss) {
      if (ok) { G.boss.st = 'stun'; G.boss.stT = 5; banner('보스 기절! 지금이에요'); feedback('large', G.boss.x, G.boss.y - 30, '#ffe066'); }
      else bossWarn(G.boss);
    }
    setState('play');
  }
  $('quizNext').addEventListener('click', () => afterQuiz(false));

  // ---------- 오답 노트 복습 (체력·시간 없이 문제만) ----------
  let rv = null;
  function startReview() {
    const n = noteGet(), keys = Object.keys(n);
    if (!keys.length) { toast('오답 노트가 비어 있어요'); return; }
    const from = ovStack.includes('result') ? 'result' : 'title';
    const list = Q.shuffle(keys.map((k, i) => Object.assign({ id: i }, n[k])), Q.mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0));
    rv = { list, i: 0, ok: 0, cleared: 0, total: list.length, retried: {}, from, prevState: state };
    ['note', 'title', 'result'].forEach(hide);
    reviewOpen();
  }
  function reviewOpen() {
    const it = rv.list[rv.i];
    openQuiz('review', { item: it, choices: it.short ? [] : Q.shuffle([it.ans].concat(it.wrongs), Math.random), isReask: !!rv.retried[it.id] && rv.i >= rv.total, isNote: false });
  }
  function reviewResolve(ok, chosen, noteR) {
    const it = quiz.nq.item;
    if (ok) {
      if (rv.i < rv.total) rv.ok++;
      if (noteR === 'cleared') rv.cleared++;
      Snd.play('ok');
      $('quizFb').innerHTML = '<span class="big">○ 정답!</span>' + noteMsg(noteR, ok);
      const me = quiz;
      setTimeout(() => { if (quiz === me) reviewNext(); }, 1000);
    } else {
      Snd.play('no');
      let more = '';
      if (!rv.retried[it.id]) { rv.retried[it.id] = true; rv.list.push(it); more = '<br><span class="sub">이 문제는 복습 끝에 한 번 더 나와요</span>'; }
      $('quizFb').innerHTML = wrongHtml(it, chosen) + more;
      setTimeout(() => { if (quiz) { $('quizNextRow').style.display = 'flex'; $('quizNext').focus(); } }, 900);
    }
  }
  function reviewNext() {
    if (!rv) return;
    rv.i++;
    if (rv.i < rv.list.length) { quiz = null; reviewOpen(); return; }
    reviewEnd();
  }
  function reviewEnd() {
    quiz = null; hide('quiz');
    const left = noteCount();
    $('revSum').innerHTML = `<div><b>${rv.ok}/${rv.total}</b><span>처음에 맞힘</span></div><div><b>${rv.cleared}</b><span>졸업한 문제</span></div><div><b>${left}</b><span>노트에 남은 문제</span></div>`;
    $('revMsg').textContent = left ? `남은 문제는 다음 판에도 먼저 나와요. 두 번 맞히면 졸업!` : '오답 노트를 모두 졸업했어요! 🎉';
    $('revAgain').style.display = left ? '' : 'none';
    setState(rv.prevState === 'result' ? 'result' : 'title');
    Snd.play(left ? 'card' : 'win');
    show('revEnd');
  }
  function reviewQuit() {
    if (!rv) return;
    quiz = null; hide('quiz'); hide('revEnd');
    const from = rv.from; rv = null;
    if (from === 'result') { setState('result'); updateNoteBtns(); show('result'); }
    else { setState('title'); refreshTitle(); show('title'); }
  }
  $('quizQuit').addEventListener('click', reviewQuit);
  $('revBack').addEventListener('click', reviewQuit);
  $('revAgain').addEventListener('click', () => { const from = rv ? rv.from : 'title'; hide('revEnd'); show(from); startReview(); });
  function renderNote() {
    const n = noteGet(), keys = Object.keys(n).sort((a, b) => n[b].wrongN - n[a].wrongN || n[b].last - n[a].last);
    $('noteWho').textContent = nickName() + '의 오답 노트 · ' + keys.length + '문제';
    $('noteList').innerHTML = keys.length ? '<table><tr><th>문제</th><th>정답</th><th>틀림</th><th>졸업까지</th></tr>' + keys.map((k) => {
      const e = n[k];
      return `<tr><td class="nq">${escapeHtml(e.q)}<div class="sub">${escapeHtml(e.tag)}${e.short ? ' · 주관식' : ''}</div></td><td>${escapeHtml(e.ans)}</td><td>${e.wrongN}번</td><td>${'●'.repeat(e.okN)}${'○'.repeat(Q.NOTE_CLEAR - e.okN)}</td></tr>`;
    }).join('') + '</table>' : '<p class="sub">틀린 문제가 없어요. 게임에서 틀린 문제가 여기에 모여요.</p>';
    $('noteGo').disabled = !keys.length; $('noteClear').disabled = !keys.length;
  }
  function updateNoteBtns() {
    const c = noteCount();
    $('noteBtn').textContent = c ? `오답 노트 (${c})` : '오답 노트';
    $('resNoteBtn').textContent = `오답 노트 복습 (${c})`;
    $('resNoteBtn').style.display = c ? '' : 'none';
  }
  $('noteBtn').addEventListener('click', () => { renderNote(); show('note'); });
  $('noteGo').addEventListener('click', startReview);
  $('resNoteBtn').addEventListener('click', startReview);
  $('noteClear').addEventListener('click', () => {
    if (!confirm(nickName() + '의 오답 노트를 비울까요? 되돌릴 수 없어요.')) return;
    noteSave({}); renderNote(); updateNoteBtns();
  });

  // ---------- 카드 ----------
  function cardOptions() {
    const o = [], nW = Object.keys(G.weapons).length;
    for (const k in WEAP) { const l = G.weapons[k] || 0; if (l === 0 && nW < 4) o.push({ kind: 'w', k, l: 1 }); else if (l > 0 && l < 5) o.push({ kind: 'w', k, l: l + 1 }); }
    for (const k in SUBS) { const l = G.subs[k] || 0; if (l < 5) o.push({ kind: 's', k, l: l + 1 }); }
    return o;
  }
  function openCards(n) {
    setState('cards');
    let o = Q.shuffle(cardOptions(), G.rng).slice(0, n);
    if (!o.length) o = [{ kind: 'heal' }];
    G.cardOpts = o; G.cardsAt = performance.now();
    const list = $('cardList');
    list.innerHTML = '';
    o.forEach((c, i) => {
      const d = c.kind === 'w' ? WEAP[c.k] : c.kind === 's' ? SUBS[c.k] : { name: '주먹밥', ic: '🍙', desc: () => '체력 +30' };
      const b = document.createElement('button');
      b.className = 'card';
      b.style.animationDelay = i * 40 + 'ms';
      const lv = c.kind === 'heal' ? '회복' : c.l === 1 ? (c.kind === 'w' ? '새 무기' : '새 보조 도구') : `Lv.${c.l - 1} → Lv.${c.l}`;
      b.innerHTML = `<div class="ic">${d.ic}</div><div class="nm">${d.name}</div><div class="lv">${lv}</div><div class="ds">${d.desc(c.l)}</div>` + (usingTouch ? '' : `<div class="k">${i + 1}</div>`);
      b.addEventListener('click', () => pickCard(i));
      list.appendChild(b);
    });
    Snd.play('card');
    show('cards');
  }
  function pickCard(i) {
    if (state !== 'cards' || performance.now() - G.cardsAt < 250) return;
    const c = G.cardOpts[i];
    if (!c) return;
    if (c.kind === 'w') { G.weapons[c.k] = c.l; if (G.wcd[c.k] == null || c.l === 1) G.wcd[c.k] = 0; toast(`${WEAP[c.k].name} Lv.${c.l}`, 1500); }
    else if (c.kind === 's') { G.subs[c.k] = c.l; toast(`${SUBS[c.k].name} Lv.${c.l}`, 1500); }
    else heal(30);
    Snd.play('card');
    hide('cards');
    setState('play');
  }

  // ---------- 끝 · 기록 ----------
  function endRun(win, cause) {
    if (state === 'result') return;
    setState('result'); clearInput(); hide('quiz'); hide('cards'); quiz = null;
    const s = G.stats.summary();
    const rec = {
      date: new Date().toISOString(), nick: ($('nick').value || '').trim() || '이름없음', win, cause: win ? '성공' : cause,
      clock: Math.floor(G.clock), kills: G.kills, level: G.level, n: s.n, correct: s.correct, avgSec: +s.avgSec.toFixed(1),
      reaskN: s.reaskN, reaskCorrect: s.reaskCorrect, byTag: s.byTag,
      wrong: s.wrong.map((w) => ({ tag: w.tag, q: w.q, chosen: w.chosen, ans: w.ans })), seed: G.seed, char: G.char,
    };
    let unlockedNow = null;
    if (win) for (const k in CHARS) if (CHARS[k].locked && !isUnlocked(k)) { store.set('chii_unlock_' + k, true); unlockedNow = k; }
    const all = store.get(K_REC, []);
    all.push(rec);
    store.set(K_REC, all.slice(-300));

    $('resTitle').textContent = CHARS[G.char].name + ' · ' + (win ? '토벌 성공! 5분을 버텼어요' : '토벌 실패 · ' + cause);
    const pct = s.n ? Math.round(s.rate * 100) + '%' : '-';
    $('resStat').innerHTML = [
      ['버틴 시간', fmt(G.clock) + ' / ' + fmt(T.RUN)], ['쫓아낸 몬스터', G.kills], ['레벨', G.level],
      ['정답률', `${pct} (${s.correct}/${s.n})`], ['평균 풀이', s.avgSec.toFixed(1) + '초'], ['다시 도전 정답', `${s.reaskCorrect}/${s.reaskN}`],
    ].map((a) => `<div><b>${a[1]}</b><span>${a[0]}</span></div>`).join('');
    const tags = Object.keys(s.byTag);
    $('resTags').innerHTML = tags.length ? '<table><tr><th>유형</th><th>맞힘</th><th>정답률</th></tr>' +
      tags.map((t) => { const v = s.byTag[t]; return `<tr><td>${escapeHtml(t)}</td><td>${v.c}/${v.n}</td><td>${Math.round((v.c / v.n) * 100)}%</td></tr>`; }).join('') + '</table>' : '';
    $('resWrong').innerHTML = s.wrong.length ? '<h2 style="margin-top:16px;font-size:20px">틀린 문제 다시 보기 <span class="sub">· 오답 노트에 담겼어요</span></h2><table><tr><th>문제</th><th>내 답</th><th>정답</th></tr>' +
      s.wrong.map((w) => `<tr><td class="nq">${escapeHtml(w.q)}</td><td>✕ ${escapeHtml(w.chosen)}</td><td>○ ${escapeHtml(w.ans)}</td></tr>`).join('') + '</table>' : '';
    updateNoteBtns();
    // 동료 만나기 (도감 수집. 강해지지는 않아요)
    const met = meetCompanions(win, s.correct);
    document.querySelectorAll('#result .unlock, #result .meet').forEach((el) => el.remove());
    if (met.length) {
      $('resStat').insertAdjacentHTML('afterend', '<div class="meet">' + met.map((c, i) =>
        `<div class="meetcard" style="animation-delay:${0.4 + i * 0.25}s"><span class="new">새 동료!</span><img src="art/${c.img}" alt=""><div class="nm">${escapeHtml(c.name)}</div></div>`).join('') + '</div>');
      setTimeout(() => Snd.play('card'), 400);
    } else if (COMP.length && dexCount() < COMP.length && s.correct < RULE.minCorrect) {
      $('resStat').insertAdjacentHTML('afterend', `<p class="unlock" style="color:var(--soft)">문제를 ${RULE.minCorrect}개 이상 맞히면 동료를 만날 수 있어요 (이번 판 ${s.correct}개)</p>`);
    }
    if (unlockedNow) $('resStat').insertAdjacentHTML('afterend', `<p class="unlock">🎉 ${CHARS[unlockedNow].name}${josaIGa(CHARS[unlockedNow].name)} 동료가 되었어요! 다음 판부터 고를 수 있어요.</p>`);
    show('result');
    Snd.play(win ? 'win' : 'no');
    if (unlockedNow) setTimeout(() => Snd.play('cheer'), 700);
  }

  function renderRecords() {
    const all = store.get(K_REC, []).slice().reverse();
    if (!all.length) { $('recTable').innerHTML = '<p class="sub">아직 기록이 없어요.</p>'; return; }
    $('recTable').innerHTML = '<table><tr><th>날짜</th><th>별명</th><th>캐릭터</th><th>결과</th><th>시간</th><th>정답률</th><th>평균</th><th>틀린 유형</th></tr>' +
      all.slice(0, 100).map((r) => {
        const wt = {}; r.wrong.forEach((w) => { wt[w.tag] = (wt[w.tag] || 0) + 1; });
        return `<tr><td>${r.date.slice(5, 16).replace('T', ' ')}</td><td>${escapeHtml(r.nick)}</td><td>${(CHARS[r.char] || CHARS.chiikawa).name}</td><td>${escapeHtml(r.cause)}</td><td>${fmt(r.clock)}</td>` +
          `<td>${r.n ? Math.round((r.correct / r.n) * 100) : 0}% (${r.correct}/${r.n})</td><td>${r.avgSec}초</td>` +
          `<td>${Object.keys(wt).map((t) => escapeHtml(t) + ' ' + wt[t]).join(', ')}</td></tr>`;
      }).join('') + '</table>';
  }
  function recordsTSV() {
    const all = store.get(K_REC, []);
    const head = ['날짜', '별명', '캐릭터', '결과', '버틴시간(초)', '쫓아낸수', '레벨', '문제수', '정답수', '정답률(%)', '평균풀이(초)', '다시도전', '다시도전정답', '틀린문제'];
    const rows = all.map((r) => [new Date(r.date).toLocaleString('ko-KR'), r.nick, (CHARS[r.char] || CHARS.chiikawa).name, r.cause, r.clock, r.kills, r.level, r.n, r.correct,
      r.n ? Math.round((r.correct / r.n) * 100) : 0, r.avgSec, r.reaskN, r.reaskCorrect,
      r.wrong.map((w) => `${w.q} (내 답 ${w.chosen}, 정답 ${w.ans})`).join(' / ')].map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t'));
    return [head.join('\t')].concat(rows).join('\n');
  }
  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('복사했어요. 엑셀에 붙여 넣으세요'); } catch (e) { toast('복사가 안 돼요'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('복사했어요. 엑셀에 붙여 넣으세요'), fallback);
    else fallback();
  }

  // ---------- 그리기 ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function render(alpha, rdt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!G) { ctx.fillStyle = '#cfe8b8'; ctx.fillRect(0, 0, VW, VH); return; }
    const P = G.player, now = performance.now() / 1000;
    const ix = lerp(P.px, P.x, alpha), iy = lerp(P.py, P.y, alpha);
    if (state === 'play') {
      const look = P.moving ? 36 : 0, k = 1 - Math.exp(-6 * rdt);
      G.cam.x += (ix + P.fx * look - G.cam.x) * k;
      G.cam.y += (iy + P.fy * look - G.cam.y) * k;
    }
    const sc = viewScale * (1 + G.zp);
    // 흔들림: 실제 시간으로 줄어들어서 멈칫 중에도 화면이 한쪽에 멈춰 있지 않아요
    G.trauma = Math.max(0, G.trauma - 1.4 * rdt);
    G.shT += rdt * 30;
    const kd = Math.exp(-12 * rdt); G.kickX *= kd; G.kickY *= kd;
    G.hurtFlash = Math.max(0, G.hurtFlash - rdt * 3.5);
    G.xpBump = Math.max(0, G.xpBump - rdt * 6); G.killBump = Math.max(0, G.killBump - rdt * 6); G.healGlow = Math.max(0, G.healGlow - rdt * 2);
    const amt = opts.shakeAmt / 100;
    const shake = G.trauma * G.trauma * 14 * amt;
    let sx = shake * Math.sin(G.shT * 1.7) + G.kickX * amt, sy = shake * Math.sin(G.shT * 2.3) + G.kickY * amt;
    ctx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * (VW / 2 + sx) - DPR * sc * G.cam.x, DPR * (VH / 2 + sy) - DPR * sc * G.cam.y);
    const hw = VW / 2 / sc, hh = VH / 2 / sc;
    const L = G.cam.x - hw - 60, R = G.cam.x + hw + 60, Tp = G.cam.y - hh - 60, B = G.cam.y + hh + 60;
    const vis = (x, y) => x > L && x < R && y > Tp && y < B;

    // 땅
    for (let tx = Math.floor((L + 60) / 256); tx * 256 < R; tx++) for (let ty = Math.floor((Tp + 60) / 256); ty * 256 < B; ty++) ctx.drawImage(tile, tx * 256, ty * 256, 257, 257);

    // 약초
    for (const h of G.herbs) {
      if (!vis(h.x, h.y)) continue;
      const bob = Math.sin(h.ph * 3) * 2;
      ctx.drawImage(shadow, h.x - 16, h.y - 4, 32, 12);
      ctx.fillStyle = '#4f9a5e';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(h.x + i * 7, h.y - 10 + bob - Math.abs(i) * -3, 5, 11, i * 0.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(h.x, h.y - 22 + bob, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(h.x, h.y, 46, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (h.prog > 0) { ctx.strokeStyle = '#2f7d40'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(h.x, h.y - 12, 24, -Math.PI / 2, -Math.PI / 2 + TAU * h.prog); ctx.stroke(); }
    }
    // 비눗방울
    for (const b of G.bubbles) {
      if (!vis(b.x, b.y)) continue;
      const r = b.maxR * Math.min(1, b.t / 0.6), fade = b.t > b.life - 0.3 ? (b.life - b.t) / 0.3 : 1;
      ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x - r * 0.4, b.y - r * 0.4, r * 0.12, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 검 베기
    if (G.slash) {
      const k = G.slash.t / 0.16, half = 70 * Math.PI / 180;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath();
      ctx.arc(ix, iy - 12, G.slash.R * (0.85 + 0.15 * k), G.slash.a0 - half, G.slash.a0 + half);
      ctx.arc(ix, iy - 12, G.slash.R * (0.55 + 0.2 * k), G.slash.a0 + half, G.slash.a0 - half, true);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 몽둥이 쿵
    if (G.stomp) {
      const k = G.stomp.t / 0.3;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(G.stomp.x, G.stomp.y, G.stomp.R * (0.4 + 0.6 * k), G.stomp.R * (0.4 + 0.6 * k) * 0.7, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 펑 (쓰러질 때 · 회복할 때 퍼지는 고리)
    for (const f of G.puffs) {
      if (!vis(f.x, f.y)) continue;
      const k = f.t / 0.3, e2 = 1 - (1 - k) * (1 - k);
      ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = f.col; ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * e2), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 증표
    for (const g of G.gems) {
      const x = lerp(g.px, g.x, alpha), y = lerp(g.py, g.y, alpha);
      if (!vis(x, y)) continue;
      const s = g.v > 1 ? 7 : 5;
      ctx.fillStyle = g.v > 1 ? '#5b8def' : '#7fb3ff';
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill();
    }
    // 보스 경고선 (실제 돌진 거리와 같음: 400px/초 × 0.6초)
    if (G.boss && G.boss.st === 'warn') {
      const b = G.boss, len = 240 + b.r, blink = Math.floor(now * 8) % 2;
      ctx.globalAlpha = blink ? 0.45 : 0.3; ctx.fillStyle = '#e8746c';
      ctx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * (VW / 2 + sx) - DPR * sc * G.cam.x, DPR * (VH / 2 + sy) - DPR * sc * G.cam.y);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.dy, b.dx));
      ctx.fillRect(0, -b.r, len, b.r * 2);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.strokeRect(0, -b.r, len, b.r * 2);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // 몬스터
    for (const e of G.enemies) {
      const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
      if (!vis(x, y)) continue;
      drawEnemy(e, x, y, now);
    }
    // 낫
    if (G.swing) {
      const s = G.swing, p = Math.min(1, s.t / s.dur), R = 62 * area();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ix, iy - 10, R, s.a0 + TAU * Math.max(0, p - 0.3), s.a0 + TAU * p); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,230,160,.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ix, iy - 10, R - 8, s.a0 + TAU * Math.max(0, p - 0.3), s.a0 + TAU * p); ctx.stroke();
    }
    drawPlayer(ix, iy, now);
    // 도토리
    ctx.fillStyle = '#8a5a3b';
    for (const s of G.shots) { const x = lerp(s.px, s.x, alpha), y = lerp(s.py, s.y, alpha); if (vis(x, y)) { ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); } }
    // 조각
    for (const p of G.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); }
    ctx.globalAlpha = 1;
    // 숫자
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const n of G.nums) {
      const k = n.t / 0.75, pop = n.t < 0.08 ? 0.7 + n.t / 0.08 * 0.5 : 1.2 - Math.min(0.2, n.t);
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `${Math.round(n.size * pop)}px Jua, sans-serif`;
      ctx.strokeStyle = 'rgba(60,40,30,.85)'; ctx.lineWidth = 4; ctx.strokeText(n.txt, n.x, n.y - n.t * 40);
      ctx.fillStyle = n.col; ctx.fillText(n.txt, n.x, n.y - n.t * 40);
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (G.hurtFlash > 0) {
      const a = G.hurtFlash * (opts.lessFlash ? 0.18 : 0.45);
      const gr = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
      gr.addColorStop(0, 'rgba(232,80,80,0)'); gr.addColorStop(1, `rgba(232,80,80,${a})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    }
    drawArrows(sc);
    drawHUD(now);
    if (joy.active && state === 'play') {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(joy.bx, joy.by, joy.R, 0, TAU); ctx.fill();
      const dx = joy.x - joy.bx, dy = joy.y - joy.by, l = Math.hypot(dx, dy), m = Math.min(l, joy.R);
      ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(joy.bx + (l ? dx / l * m : 0), joy.by + (l ? dy / l * m : 0), 24, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(x, y, t) {
    const P = G.player;
    if (G.cheerT > 0) {
      ctx.globalAlpha = Math.min(1, G.cheerT) * 0.6; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y - 13, 27 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (G.dash) {
      const d = G.dash; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const ox = -d.dy * i * 8, oy = d.dx * i * 8;
        ctx.beginPath(); ctx.moveTo(x - d.dx * 18 + ox, y - 13 - d.dy * 18 + oy); ctx.lineTo(x - d.dx * 42 + ox, y - 13 - d.dy * 42 + oy); ctx.stroke();
      }
    }
    const blink = P.inv > 0.06 && !(G.cheerT > 0) && Math.floor(t * 20) % 2 === 0;
    drawChar(ctx, G.char, x, y, t, { moving: P.moving || !!G.dash, fx: P.fx, fy: P.fy, hurt: P.hurtT > 0, alpha: blink ? 0.55 : null, low: P.hp <= P.max * 0.3 });
  }

  // 캐릭터 그림 (게임과 선택 화면이 같이 씀)
  function drawChar(c, kind, x, y, t, s) {
    const moving = !!s.moving, fx = s.fx == null ? 0.4 : s.fx, fy = s.fy || 0;
    const bob = moving ? Math.abs(Math.sin(t * 11)) * 3 : Math.sin(t * 2.2) * 1;
    const sq = moving ? 1 + Math.sin(t * 22) * 0.04 : 1 + Math.sin(t * 2.2) * 0.02;
    c.drawImage(shadow, x - 18, y - 5, 36, 12);
    if (s.alpha != null) c.globalAlpha = s.alpha;
    const spr = ART[kind];
    if (spr) {
      const h = (s.size || 44) * sq, w = h * (spr.width / spr.height) / sq;
      const flip = fx < -0.1;
      if (flip) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(spr, -w / 2, y - h - bob, w, h); c.restore(); }
      else c.drawImage(spr, x - w / 2, y - h - bob, w, h);
      c.globalAlpha = 1;
      return;
    }
    const cy = y - 13 - bob, bw = 16 / sq, bh = 14 * sq;
    const body = s.hurt ? '#ffd6d6' : kind === 'usagi' ? '#fff2bf' : '#ffffff';
    const cap = '#7d9cc4';
    c.strokeStyle = '#4a3b35'; c.lineWidth = 2; c.lineJoin = 'round';
    if (kind === 'hachiware') {
      c.fillStyle = cap;
      for (const g of [-1, 1]) { c.beginPath(); c.moveTo(x + g * 14, cy - 4); c.lineTo(x + g * 11, cy - 19); c.lineTo(x + g * 3, cy - 12); c.closePath(); c.fill(); c.stroke(); }
    } else if (kind === 'usagi') {
      for (const g of [-1, 1]) {
        const sw = g * 0.12 + Math.sin(t * 3 + g) * 0.08;
        c.fillStyle = body; c.beginPath(); c.ellipse(x + g * 5, cy - 20, 4, 12, sw, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#f6b8c6'; c.beginPath(); c.ellipse(x + g * 5, cy - 20, 1.6, 8, sw, 0, TAU); c.fill();
      }
    } else {
      c.fillStyle = body;
      for (const g of [-1, 1]) { c.beginPath(); c.arc(x + g * 8, cy - 11, 5, 0, TAU); c.fill(); c.stroke(); }
    }
    c.fillStyle = body; c.beginPath(); c.ellipse(x, cy, bw, bh, 0, 0, TAU); c.fill();
    if (kind === 'hachiware') {
      c.save(); c.beginPath(); c.ellipse(x, cy, bw, bh, 0, 0, TAU); c.clip();
      c.fillStyle = cap; c.fillRect(x - bw, cy - bh, bw * 2, bh - 1);
      c.fillStyle = body; c.beginPath(); c.moveTo(x - 7, cy); c.lineTo(x, cy - bh * 0.85); c.lineTo(x + 7, cy); c.closePath(); c.fill();
      c.restore();
    }
    c.beginPath(); c.ellipse(x, cy, bw, bh, 0, 0, TAU); c.stroke();
    const ex = fx * 2.5, ey = fy * 1.5, eyeY = kind === 'hachiware' ? cy + 2 : cy - 2;
    c.fillStyle = '#4a3b35';
    if (Math.floor(t * 10) % 37 === 0) { c.fillRect(x - 7 + ex, eyeY + ey, 4, 1.5); c.fillRect(x + 3 + ex, eyeY + ey, 4, 1.5); }
    else { c.beginPath(); c.arc(x - 5 + ex, eyeY + ey, 2.2, 0, TAU); c.arc(x + 5 + ex, eyeY + ey, 2.2, 0, TAU); c.fill(); }
    if (kind === 'usagi') { c.lineWidth = 1.5; c.beginPath(); c.arc(x + ex, cy + 4 + ey, 2, 0, TAU); c.stroke(); }
    c.fillStyle = '#f6a6b8';
    c.beginPath(); c.ellipse(x - 9 + ex, eyeY + 5 + ey, 3.5, 2, 0, 0, TAU); c.ellipse(x + 9 + ex, eyeY + 5 + ey, 3.5, 2, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
    if (s.low) { c.fillStyle = '#7fb3ff'; c.beginPath(); c.arc(x + 14, cy - 8 + Math.sin(t * 6) * 2, 2.5, 0, TAU); c.fill(); }
  }

  function drawEnemy(e, x, y, t) {
    const flash = e.flash > 0;
    ctx.drawImage(shadow, x - e.r * 1.2, y - e.r * 0.35, e.r * 2.4, e.r * 0.8);
    let rx = e.r, ry = e.r * 0.85;
    if (e.type === 'hopper') {
      if (e.st === 'wait') { const k = 1 - Math.max(0, e.stT) / 0.8; rx *= 1 + 0.25 * k; ry *= 1 - 0.3 * k; }
      else { rx *= 0.85; ry *= 1.2; }
    } else { const w = Math.sin(e.ph * 6) * 0.06; rx *= 1 + w; ry *= 1 - w; }
    if (e.sq) { const k = e.sq * e.sq; rx *= 1 + 0.3 * k; ry *= 1 - 0.25 * k; }
    const cy = y - ry;
    const spr = ART[e.type];
    if (spr) {
      const h = e.r * 2.9 * (ry / (e.r * 0.85)), w = h * (spr.width / spr.height) * (rx / e.r);
      ctx.drawImage(spr, x - w / 2, y - h, w, h);
      if (flash) { ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(spr, x - w / 2, y - h, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (e.type === 'boss' && e.st === 'stun') { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const a = t * 4 + (i * TAU) / 3; ctx.fillStyle = '#ffe066'; ctx.fillText('★', x + Math.cos(a) * 30, y - h - 6 + Math.sin(a) * 8); } }
      if (e.type === 'boss' && e.st === 'warn') { ctx.fillStyle = Math.floor(t * 8) % 2 ? '#e8746c' : '#fff'; ctx.font = '30px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - h - 10); }
      return;
    }
    ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2;
    ctx.fillStyle = flash ? '#ffffff' : colorOf(e);
    if (e.type === 'hopper') {
      ctx.beginPath(); ctx.ellipse(x - 5, cy - ry - 6, 3, 8, -0.2, 0, TAU); ctx.ellipse(x + 5, cy - ry - 6, 3, 8, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (e.type === 'boss') {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, rr = (i % 2 ? 1 : 1.12) * e.r; ctx.lineTo(x + Math.cos(a) * rr * (rx / e.r), cy + Math.sin(a) * rr * (ry / e.r)); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else { ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    // 눈
    const f = e.face, es = e.r / 12;
    ctx.fillStyle = '#4a3b35';
    if (e.type === 'boss' && e.st === 'stun') {
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('× ×', x, cy + 2);
      for (let i = 0; i < 3; i++) { const a = t * 4 + (i * TAU) / 3; ctx.fillStyle = '#ffe066'; ctx.fillText('★', x + Math.cos(a) * 30, cy - e.r - 6 + Math.sin(a) * 8); }
    } else {
      ctx.beginPath(); ctx.arc(x - 4 * es + f * 2, cy - 1, 1.8 * es, 0, TAU); ctx.arc(x + 4 * es + f * 2, cy - 1, 1.8 * es, 0, TAU); ctx.fill();
      if (e.type === 'big' || e.type === 'boss') {
        ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(x - 7 * es + f * 2, cy - 6 * es); ctx.lineTo(x - 2 * es + f * 2, cy - 4 * es);
        ctx.moveTo(x + 7 * es + f * 2, cy - 6 * es); ctx.lineTo(x + 2 * es + f * 2, cy - 4 * es); ctx.stroke();
      }
    }
    if (e.type === 'boss' && e.st === 'warn') {
      ctx.fillStyle = Math.floor(t * 8) % 2 ? '#e8746c' : '#fff'; ctx.font = '30px Jua, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', x, cy - e.r - 14);
    }
  }

  function drawArrows(sc) {
    const targets = G.herbs.map((h) => ({ x: h.x, y: h.y, col: '#2f7d40', label: '약초' }));
    if (G.boss) targets.push({ x: G.boss.x, y: G.boss.y, col: '#c0392b', label: '보스' });
    for (const t of targets) {
      const sx = (t.x - G.cam.x) * sc + VW / 2, sy = (t.y - G.cam.y) * sc + VH / 2;
      const m = 40;
      if (sx > m && sx < VW - m && sy > m && sy < VH - m) continue;
      const cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((VW / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (VH / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
      const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = t.col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      ctx.font = '14px Jua, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(t.label, ax - Math.cos(a) * 24, ay - Math.sin(a) * 24 + 5);
      ctx.fillStyle = t.col; ctx.fillText(t.label, ax - Math.cos(a) * 24, ay - Math.sin(a) * 24 + 5);
    }
  }

  function drawHUD(t) {
    const P = G.player;
    const x0 = 14 + safe.l, y0 = 14 + safe.t, bw = Math.min(240, VW * 0.42);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // 체력
    rrect(x0, y0, bw, 22, 11); ctx.fillStyle = 'rgba(74,59,53,.55)'; ctx.fill();
    const hpk = Math.max(0, P.hp) / P.max, gk = Math.max(0, G.hpGhost) / P.max;
    if (gk > hpk) { rrect(x0 + 3, y0 + 3, (bw - 6) * gk, 16, 8); ctx.fillStyle = '#ffe1a8'; ctx.fill(); }
    if (hpk > 0) {
      const low = hpk <= 0.3, pulse = low ? 0.75 + 0.25 * Math.sin(t * 8) : 1;
      rrect(x0 + 3, y0 + 3, Math.max(8, (bw - 6) * hpk), 16, 8);
      ctx.globalAlpha = pulse; ctx.fillStyle = low ? '#e8746c' : '#f6a6b8'; ctx.fill(); ctx.globalAlpha = 1;
      if (G.healGlow > 0) { ctx.globalAlpha = G.healGlow * 0.8; ctx.fillStyle = '#c8f5d0'; rrect(x0 + 3 + Math.max(0, (bw - 6) * hpk - 14), y0 + 3, 14, 16, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.font = fs(15); ctx.fillStyle = '#fff';
    ctx.fillText(`체력 ${Math.max(0, Math.ceil(P.hp))}/${P.max}` + (hpk <= 0.3 && G.char === 'chiikawa' ? ' · 버티기!' : ''), x0 + 10, y0 + 12);
    // 증표 게이지
    const y1 = y0 + 28;
    const xb = G.xpBump * G.xpBump * 3;
    rrect(x0, y1 - xb / 2, bw, 14 + xb, 7); ctx.fillStyle = 'rgba(74,59,53,.45)'; ctx.fill();
    const xk = Math.min(1, G.xp / G.need);
    if (xk > 0) { rrect(x0 + 2, y1 + 2 - xb / 2, Math.max(6, (bw - 4) * xk), 10 + xb, 5); ctx.fillStyle = G.xpBump > 0.5 ? '#a9ccff' : '#7fb3ff'; ctx.fill(); }
    ctx.font = fs(15); ctx.fillStyle = '#4a3b35';
    const big = opts.bigText ? 4 : 0;
    ctx.fillText(`Lv.${G.level} · 증표 ${G.xp}/${G.need}`, x0 + 2, y1 + 26 + big);
    // 무기 목록
    let wy = y1 + 48 + big * 2;
    ctx.font = fs(16);
    const owned = Object.keys(G.weapons).map((k) => `${WEAP[k].ic}${G.weapons[k]}`).concat(Object.keys(G.subs).map((k) => `${SUBS[k].ic}${G.subs[k]}`));
    ctx.fillText(owned.join('  '), x0 + 2, wy);
    if (G.streak >= 2) { wy += 24 + big; ctx.fillStyle = '#e07890'; ctx.fillText(`연속 정답 ×${G.streak}`, x0 + 2, wy); }

    // 가운데 위: 시계 또는 보스 체력
    ctx.textAlign = 'center';
    const cw = Math.min(280, VW * 0.4), cx = VW / 2 - cw / 2;
    const narrow = VW < 620;
    const cy0 = narrow ? wy + 24 : 14 + safe.t;
    const ccx = narrow ? x0 + cw / 2 : VW / 2;
    const ccx0 = narrow ? x0 : cx;
    if (G.boss) {
      rrect(ccx0, cy0, cw, 20, 10); ctx.fillStyle = 'rgba(74,59,53,.6)'; ctx.fill();
      rrect(ccx0 + 3, cy0 + 3, Math.max(6, (cw - 6) * (G.boss.hp / G.boss.max)), 14, 7); ctx.fillStyle = G.boss.st === 'stun' ? '#ffe066' : '#c0392b'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = fs(15); ctx.fillText('세이렌' + (G.boss.st === 'stun' ? ' · 기절!' : ''), ccx, cy0 + 11);
      ctx.fillStyle = '#4a3b35'; ctx.font = fs(15); ctx.fillText(`❚❚ 시계 멈춤 ${fmt(G.clock)}`, ccx, cy0 + 34);
    } else {
      rrect(ccx0, cy0 + 6, cw, 8, 4); ctx.fillStyle = 'rgba(74,59,53,.3)'; ctx.fill();
      const ck = Math.min(1, G.clock / T.RUN);
      rrect(ccx0, cy0 + 6, Math.max(8, cw * ck), 8, 4); ctx.fillStyle = '#f2c14e'; ctx.fill();
      const bx = ccx0 + cw * (T.BOSS_AT / T.RUN);
      if (!G.bossSpawned) { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(bx, cy0 + 10, 5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#4a3b35'; ctx.font = fs(20);
      const last = T.RUN - G.clock < 20;
      ctx.fillText(`${fmt(G.clock)} / ${fmt(T.RUN)}`, ccx, cy0 + 30 + (last ? Math.sin(t * 10) * 1.5 : 0));
    }
    // 오른쪽 위: 쫓아낸 수 (쉬기 버튼 왼쪽)
    ctx.textAlign = 'right'; ctx.font = fs(18 + G.killBump * 3); ctx.fillStyle = '#4a3b35';
    ctx.fillText(`쫓아낸 수 ${G.kills}`, VW - 78 - safe.r, 38 + safe.t);
    ctx.textBaseline = 'alphabetic';
    if (QA) {
      ctx.textAlign = 'left'; ctx.font = '12px monospace'; ctx.fillStyle = '#000';
      ctx.fillText(`QA seed ${G.seed} · 적 ${G.enemies.length} · 프레임 ${frameMs.toFixed(1)}ms 최악 ${worstMs.toFixed(1)}ms · K처치 T+30초 I무적 L레벨`, 10, VH - 10);
    }
  }

  // ---------- 안내 ----------
  let toastTimer = 0, bannerTimer = 0;
  function toast(text, ms) {
    const el = $('toast'); el.textContent = text; el.style.display = 'block';
    clearTimeout(toastTimer); if (ms !== 0) toastTimer = setTimeout(hideToast, ms || 2200);
  }
  function hideToast() { $('toast').style.display = 'none'; }
  function banner(text) {
    const el = $('banner'); el.firstElementChild.textContent = text; el.style.display = 'block';
    el.firstElementChild.style.animation = 'none'; void el.offsetWidth; el.firstElementChild.style.animation = '';
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.style.display = 'none'; }, 1600);
  }
  // ---------- 동료 도감 ----------
  const COMP = window.COMPANIONS || [];
  const RULE = Object.assign({ minCorrect: 5, perRun: 1, perWin: 2 }, window.COMPANION_RULE || {});
  const K_DEX = 'chii_dex_v1';
  const dexGet = () => store.get(K_DEX, {});
  const dexCount = () => { const d = dexGet(); return COMP.filter((c) => d[c.id]).length; };
  function meetCompanions(win, correct) {
    if (!COMP.length || correct < RULE.minCorrect) return [];
    const d = dexGet();
    const pool = COMP.filter((c) => !d[c.id]);
    const n = Math.min(pool.length, win ? RULE.perWin : RULE.perRun);
    const out = [];
    for (let i = 0; i < n; i++) {
      const k = Math.floor(G.rng() * pool.length);
      const c = pool.splice(k, 1)[0];
      d[c.id] = { date: new Date().toISOString().slice(0, 10), with: G.char };
      out.push(c);
    }
    if (out.length) store.set(K_DEX, d);
    return out;
  }
  function renderDex() {
    const d = dexGet();
    $('dexCount').textContent = `${dexCount()} / ${COMP.length}`;
    $('dexGrid').innerHTML = COMP.map((c, i) => d[c.id]
      ? `<div class="dexcell"><img src="art/${c.img}" alt=""><div>${escapeHtml(c.name)}</div><div class="d">${d[c.id].date}</div></div>`
      : `<div class="dexcell no"><img src="art/${c.img}" alt=""><div>No.${i + 1} ???</div></div>`).join('');
  }
  function josaIGa(w) { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '이' : '가'; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  // ---------- 화면 전환 ----------
  function renderChars() {
    const best = {};
    store.get(K_REC, []).forEach((r) => { const k = r.char || 'chiikawa'; best[k] = Math.max(best[k] || 0, r.kills); });
    const box = $('charList');
    box.innerHTML = '';
    Object.keys(CHARS).forEach((k) => {
      const C = CHARS[k], W = WEAP[C.weapon];
      const open = isUnlocked(k);
      const b = document.createElement('button');
      b.className = 'char' + (k === selChar ? ' on' : '') + (open ? '' : ' locked');
      b.setAttribute('aria-pressed', String(k === selChar));
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = 144; cvs.style.width = cvs.style.height = '72px';
      const c = cvs.getContext('2d'); c.scale(2.25, 2.25);
      drawChar(c, k, 32, 58, 1.3, { size: 52 });
      if (!open) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#6b5c55'; c.fillRect(0, 0, 64, 64); }
      b.appendChild(cvs);
      b.insertAdjacentHTML('beforeend', open
        ? `<div class="nm">${C.name}</div><div class="ds">${W.ic} ${W.name}${C.speed > 1 ? ' · 빠름' : ''}</div><div class="ds"><b>${C.passive}</b> ${C.pdesc}</div><div class="best">최고 기록 ${best[k] || 0}마리</div>`
        : `<div class="nm">🔒 ???</div><div class="ds">아무 캐릭터로 첫 토벌에 성공하면 함께해요</div>`);
      b.addEventListener('click', () => {
        Snd.unlock();
        if (!open) { toast('5분을 버티고 토벌에 성공하면 열려요!'); Snd.play('no'); return; }
        selChar = k; store.set('chii_char', k); Snd.play('card'); renderChars();
      });
      box.appendChild(b);
    });
  }
  function refreshTitle() {
    renderChars();
    const custom = !!store.get(K_Q, null);
    const cnt = {}; items.forEach((i) => { cnt[i.tag] = (cnt[i.tag] || 0) + 1; });
    const tags = Object.keys(cnt);
    selUnits = selUnits.filter((t) => cnt[t]);
    const box = $('unitList');
    box.innerHTML = '';
    box.style.display = tags.length > 1 ? '' : 'none';
    $('unitLabel').style.display = tags.length > 1 ? '' : 'none';
    const chip = (label, on, fn) => { const b = document.createElement('button'); b.className = 'unit' + (on ? ' on' : ''); b.innerHTML = label; b.setAttribute('aria-pressed', on); b.addEventListener('click', fn); box.appendChild(b); };
    chip(`전체 <span>${items.length}</span>`, !selUnits.length, () => { selUnits = []; store.set('chii_units', selUnits); Snd.play('card'); refreshTitle(); });
    tags.forEach((t) => chip(`${escapeHtml(t)} <span>${cnt[t]}</span>`, selUnits.includes(t), () => {
      selUnits = selUnits.includes(t) ? selUnits.filter((x) => x !== t) : selUnits.concat(t);
      if (selUnits.length === tags.length) selUnits = [];
      store.set('chii_units', selUnits); Snd.play('card'); refreshTitle();
    }));
    const pool = runItems(), nShort = pool.filter((i) => i.short).length;
    $('qcount').textContent = `이번 판 문제 ${pool.length}개 (객관식 ${pool.length - nShort} · 주관식 ${nShort}) · ${custom ? '선생님이 넣은 문항' : '기본 문항: 국어 5-2'}`;
    updateNoteBtns();
  }
  function startGame() {
    Snd.unlock();
    if (items.length < 4) { toast('문항이 4개 이상 있어야 시작할 수 있어요'); openEditor(); return; }
    if (isTouchDev && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    newRun();
    ['title', 'result', 'err', 'pause', 'settings', 'how', 'note', 'revEnd', 'dex'].forEach(hide); rv = null;
    setState('play');
    acc = 0; lastT = performance.now();
    if (!seen.move) toast(usingTouch ? '화면을 누른 채 끌어서 움직여요' : '방향키나 WASD로 움직여요', 0);
  }
  function goHome() { ['result', 'err', 'pause', 'quiz', 'cards', 'settings', 'how', 'note', 'revEnd'].forEach(hide); quiz = null; rv = null; G = null; setState('title'); refreshTitle(); show('title'); }
  function pauseGame() { if (state !== 'play') return; setState('pause'); clearInput(); show('pause'); }
  function openSettings() {
    $('optSound').checked = opts.sound; $('optVol').value = opts.vol; $('optShakeAmt').value = opts.shakeAmt;
    $('optFlash').checked = opts.lessFlash; $('optBig').checked = opts.bigText;
    $('optVolV').textContent = opts.vol + '%'; $('optShakeV').textContent = opts.shakeAmt + '%';
    show('settings');
  }
  function applyOpts() { document.body.classList.toggle('big', !!opts.bigText); store.set(K_OPT, opts); }
  function resumeGame() { hide('settings'); hide('how'); hide('pause'); setState('play'); lastT = performance.now(); acc = 0; }
  function openEditor() { $('qtext').value = qText; $('errs').textContent = ''; $('okmsg').textContent = ''; show('editor'); }

  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('homeBtn').addEventListener('click', goHome);
  $('howBtn').addEventListener('click', () => show('how'));
  $('howBtn2').addEventListener('click', () => show('how'));
  $('editBtn').addEventListener('click', openEditor);
  $('recBtn').addEventListener('click', () => { renderRecords(); show('records'); });
  $('dexBtn').addEventListener('click', () => { renderDex(); show('dex'); });
  $('pauseBtn').addEventListener('click', pauseGame);
  $('resumeBtn').addEventListener('click', resumeGame);
  $('quitBtn').addEventListener('click', () => { if (confirm('이번 판을 그만할까요? 기록은 남지 않아요.')) goHome(); });
  $('optSound').addEventListener('change', (e) => { opts.sound = e.target.checked; applyOpts(); Snd.unlock(); Snd.play('click'); });
  $('optVol').addEventListener('input', (e) => { opts.vol = +e.target.value; $('optVolV').textContent = opts.vol + '%'; applyOpts(); Snd.unlock(); Snd.play('pick'); });
  $('optShakeAmt').addEventListener('input', (e) => { opts.shakeAmt = +e.target.value; $('optShakeV').textContent = opts.shakeAmt + '%'; applyOpts(); });
  $('optFlash').addEventListener('change', (e) => { opts.lessFlash = e.target.checked; applyOpts(); });
  $('optBig').addEventListener('change', (e) => { opts.bigText = e.target.checked; applyOpts(); });
  $('setBtn').addEventListener('click', openSettings);
  $('setBtn2').addEventListener('click', openSettings);
  applyOpts();
  // 모든 버튼 누름 소리
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.btn'); if (b) { Snd.unlock(); Snd.play('click'); } });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => hide(b.dataset.close)));
  $('nick').value = store.get('chii_nick', '');
  $('nick').addEventListener('change', () => store.set('chii_nick', $('nick').value.trim()));

  $('qApply').addEventListener('click', () => {
    const txt = $('qtext').value;
    const r = Q.parseQuestions(txt);
    $('errs').textContent = r.errors.map((e) => `${e.line}번째 줄: ${e.msg} (건너뜀)`).join('\n');
    if (r.items.length < 4) { $('okmsg').textContent = ''; $('errs').textContent += (r.errors.length ? '\n' : '') + '쓸 수 있는 문제가 4개 이상 필요해요. 저장하지 않았어요.'; return; }
    qText = txt; items = r.items; store.set(K_Q, txt);
    const cnt = {}; items.forEach((i) => { cnt[i.tag] = (cnt[i.tag] || 0) + 1; });
    $('okmsg').textContent = `${items.length}문제 (주관식 ${items.filter((x) => x.short).length}개) · 단원 ${Object.keys(cnt).length}개를 저장했어요.`;
    refreshTitle();
  });
  $('qReset').addEventListener('click', () => {
    if (!confirm('예시 문항으로 되돌릴까요? 지금 저장된 선생님 문항은 지워져요.')) return;
    store.del(K_Q); qText = window.DEFAULT_QUESTIONS; items = Q.parseQuestions(qText).items;
    $('qtext').value = qText; $('errs').textContent = ''; $('okmsg').textContent = '예시 문항으로 되돌렸어요.'; refreshTitle();
  });
  $('recCopy').addEventListener('click', () => copyText(recordsTSV()));
  $('recClear').addEventListener('click', () => { if (confirm('이 기기의 기록을 모두 지울까요? 되돌릴 수 없어요.')) { store.del(K_REC); renderRecords(); } });
  $('errRetry').addEventListener('click', startGame);
  $('errHome').addEventListener('click', goHome);

  function showError(err) {
    if (state === 'error') return;
    console.error(err);
    setState('error'); clearInput();
    $('errMsg').textContent = (err && err.message) || String(err);
    show('err');
  }
  window.addEventListener('error', (e) => { if (state === 'play' || state === 'quiz' || state === 'cards') showError(e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => { if (state === 'play') showError(e.reason); });

  // ---------- 고정 단계 루프 ----------
  const STEP = 1 / 60;
  let acc = 0, lastT = performance.now(), frameMs = 0, worstMs = 0, worstAt = 0;
  function frame(now) {
    try {
      let dt = (now - lastT) / 1000; lastT = now;
      if (dt > 0.25) dt = 0.25;
      if (state === 'error') { requestAnimationFrame(frame); return; }
      const w0 = performance.now();
      pollPad(dt);
      if (state === 'play') {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 5) { update(STEP); acc -= STEP; n++; if (state !== 'play') { acc = 0; break; } }
        if (n >= 5) acc = 0;
      }
      render(state === 'play' ? acc / STEP : 1, dt);
      frameMs = performance.now() - w0;
      if (frameMs > worstMs || now - worstAt > 500) { worstMs = frameMs; worstAt = now; }
    } catch (err) { showError(err); }
    requestAnimationFrame(frame);
  }
  // ---------- 입장 코드 ----------
  // 수업용으로만 쓰도록 처음 한 번 입장 코드를 물어요. 맞히면 이 기기에 기억해요.
  // 코드 글자 자체는 파일에 적지 않고 해시값만 둬요. 코드를 바꾸려면 사용법.md의 '입장 코드' 참고.
  const GATE_HASH = '1sxk6sd', K_GATE = 'chii_gate_v1';
  function gateHash(t) {
    let x = 0x811c9dc5;
    for (const c of String(t).replace(/\s/g, '')) { x ^= c.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(36);
  }
  function enterTitle() { refreshTitle(); show('title'); }
  function tryGate() {
    const v = $('gateIn').value;
    if (gateHash(v) === GATE_HASH) {
      store.set(K_GATE, GATE_HASH);
      Snd.unlock(); Snd.play('ok');
      hide('gate'); enterTitle();
    } else {
      Snd.unlock(); Snd.play('no');
      $('gateMsg').textContent = v.trim() ? '입장 코드가 달라요. 선생님께 물어보세요.' : '입장 코드를 써 주세요.';
      const p = $('gate').querySelector('.panel'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
      $('gateIn').select();
    }
  }
  $('gateGo').addEventListener('click', tryGate);
  $('gateIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryGate(); } });
  if (store.get(K_GATE, null) === GATE_HASH) enterTitle();
  else show('gate');
  requestAnimationFrame(frame);

  // 검사용
  window.__chii = {
    get G() { return G; }, get state() { return state; }, get quiz() { return quiz; }, answer, submitShort, startReview, pickCard, startGame, afterQuiz, T, setChar(k) { selChar = k; },
    // QA: 화면과 상관없이 n단계 진행 (자동 검사용)
    step(n) { for (let i = 0; i < n && state === 'play'; i++) update(STEP); render(1, 0); },
    qa: { hurtPlayer, feedback, render: (dt) => render(1, dt), hurtEnemy },
  };
})();
