// 문항 읽기 · 출제 순서 · 기록 — 게임 화면과 상관없는 순수 로직 (node verify.js 로 검사)
(function (root) {
  'use strict';

  // 시드 고정 난수 (같은 시드 → 같은 판)
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 표 글을 칸으로 나누기. 탭 구분이면 엑셀이 셀 안 줄바꿈을 "..."로 감싸서 복사하니 따옴표를 풀어요.
  function splitRows(text) {
    const t = String(text || '').replace(/\r/g, '');
    const rows = [];
    let line = 1;
    const tabs = t.indexOf('\t') >= 0;
    if (!tabs) {
      t.split('\n').forEach(function (raw, i) { rows.push({ line: i + 1, raw: raw, cells: raw.split('|') }); });
      return rows;
    }
    let cells = [], cur = '', q = false, i = 0, start = 1, raw = '';
    while (i <= t.length) {
      const ch = t.charAt(i);
      if (i === t.length) { cells.push(cur); rows.push({ line: start, raw: raw, cells: cells }); break; }
      if (q) {
        if (ch === '"' && t.charAt(i + 1) === '"') { cur += '"'; raw += '""'; i += 2; continue; }
        if (ch === '"') { q = false; raw += ch; i++; continue; }
        if (ch === '\n') line++;
        cur += ch; raw += ch; i++; continue;
      }
      if (ch === '"' && cur === '') { q = true; raw += ch; i++; continue; }
      if (ch === '\t') { cells.push(cur); cur = ''; raw += ch; i++; continue; }
      if (ch === '\n') { cells.push(cur); rows.push({ line: start, raw: raw, cells: cells }); cells = []; cur = ''; raw = ''; line++; start = line; i++; continue; }
      cur += ch; raw += ch; i++;
    }
    return rows;
  }

  // 한 줄 = 한 문항. 칸 구분은 탭(엑셀·구글시트에서 복사) 또는 |
  // 유형 | 난이도(1~3) | 문제 | 정답 | 오답1 | 오답2 | 오답3 | 해설
  // 오답 칸이 모두 비면 주관식(단답형). 문제·해설 안의 \n 글자는 줄바꿈으로 바꿔요.
  function parseQuestions(text) {
    const items = [];
    const errors = [];
    splitRows(text).forEach(function (row) {
      if (!row.raw.trim() || row.raw.trim().charAt(0) === '#') return;
      const c = row.cells.map(function (s) { return s.trim().replace(/\\n/g, '\n'); });
      if (c[0] === '유형') return; // 머리글 줄
      const tag = c[0], diffS = c[1], q = c[2], ans = c[3];
      const wrongs = [c[4], c[5], c[6]].filter(function (s) { return s; });
      const exp = c[7] || '';
      if (!q || !ans) {
        errors.push({ line: row.line, msg: '문제와 정답이 필요해요' });
        return;
      }
      if (wrongs.indexOf(ans) >= 0) {
        errors.push({ line: row.line, msg: '오답 칸에 정답과 같은 값이 있어요' });
        return;
      }
      let d = parseInt(diffS, 10);
      if (!(d >= 1 && d <= 3)) d = 1;
      items.push({ id: items.length, tag: tag || '기본', diff: d, q: q, ans: ans, wrongs: wrongs, exp: exp, short: wrongs.length === 0 });
    });
    return { items: items, errors: errors };
  }

  // 주관식 채점: 띄어쓰기·따옴표·마침표는 따지지 않아요. 정답 칸에 "가/나"처럼 쓰면 둘 다 정답.
  function normAns(s) { return String(s || '').replace(/[\s'"‘’“”`.,!?·~]/g, '').toLowerCase(); }
  function answers(item) { return String(item.ans).split('/').map(function (a) { return a.trim(); }).filter(Boolean); }
  function checkShort(item, input) {
    const v = normAns(input);
    if (!v) return false;
    return answers(item).some(function (a) { return normAns(a) === v; });
  }
  // 힌트: 정답(첫 번째)의 글자 칸. 띄어쓰기 자리는 ' '
  function hintCells(item) { return Array.from(answers(item)[0] || ''); }

  // 출제 순서: 판 초반엔 ★1 위주 → 후반 ★3 비중 증가
  // 틀린 문제는 2~3문제 뒤에 '같은 문제'가 다시 나와요 (한 문제당 최대 2번).
  // opts.priority: 오답 노트에 있는 문항 id. 판 초반에 한 문제 걸러 하나씩 먼저 나와요.
  function Scheduler(items, rng, opts) {
    this.items = items;
    this.rng = rng;
    this.used = {};
    this.usedCount = 0;
    this.reask = []; // {id, due}
    this.reaskN = {}; // id → 다시 낸 횟수
    this.count = 0;
    const byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    this.byId = byId;
    this.priority = ((opts && opts.priority) || []).filter(function (id) { return byId[id]; });
  }
  Scheduler.prototype._weighted = function (pool, target) {
    let total = 0;
    const w = pool.map(function (it) {
      const d = Math.abs(it.diff - target);
      const v = d === 0 ? 3 : d === 1 ? 1 : 0.3;
      total += v;
      return v;
    });
    let r = this.rng() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };
  Scheduler.prototype._markUsed = function (it) {
    if (!this.used[it.id]) { this.used[it.id] = true; this.usedCount++; }
    if (this.usedCount >= this.items.length) { this.used = {}; this.usedCount = 0; this.used[it.id] = true; this.usedCount = 1; }
  };
  Scheduler.prototype._wrap = function (pick, isReask, isNote) {
    this._markUsed(pick);
    return { item: pick, choices: pick.short ? [] : shuffle([pick.ans].concat(pick.wrongs), this.rng), isReask: isReask, isNote: isNote };
  };
  Scheduler.prototype.next = function (phase) {
    this.count++;
    const self = this;
    for (let i = 0; i < this.reask.length; i++) {
      if (this.reask[i].due <= this.count) {
        const r = this.reask.splice(i, 1)[0];
        return this._wrap(this.byId[r.id], true, false);
      }
    }
    if (this.priority.length && this.count % 2 === 1) {
      const id = this.priority.shift();
      return this._wrap(this.byId[id], false, true);
    }
    const target = phase < 0.34 ? 1 : phase < 0.67 ? 2 : 3;
    const skip = {};
    this.reask.forEach(function (r) { skip[r.id] = true; });
    this.priority.forEach(function (id) { skip[id] = true; });
    let pool = this.items.filter(function (it) { return !self.used[it.id] && !skip[it.id]; });
    if (!pool.length) pool = this.items.filter(function (it) { return !skip[it.id]; });
    if (!pool.length) pool = this.items;
    return this._wrap(this._weighted(pool, target), false, false);
  };
  Scheduler.prototype.report = function (item, correct) {
    if (correct) return;
    const n = this.reaskN[item.id] || 0;
    if (n >= 2) return;
    for (let i = 0; i < this.reask.length; i++) if (this.reask[i].id === item.id) return;
    this.reaskN[item.id] = n + 1;
    this.reask.push({ id: item.id, due: this.count + 2 + (this.rng() < 0.5 ? 0 : 1) });
  };

  // 오답 노트 (순수 로직): 틀리면 넣고, 그 뒤로 두 번 맞히면 졸업
  const NOTE_CLEAR = 2;
  function noteKey(item) { return item.tag + '|' + item.q; }
  function noteUpdate(note, item, correct, now) {
    const k = noteKey(item);
    const e = note[k];
    if (!correct) {
      note[k] = { tag: item.tag, q: item.q, ans: item.ans, wrongs: item.wrongs, exp: item.exp, short: !!item.short, diff: item.diff,
        wrongN: (e ? e.wrongN : 0) + 1, okN: 0, last: now || 0 };
      return 'added';
    }
    if (!e) return null;
    e.okN++;
    e.last = now || 0;
    if (e.okN >= NOTE_CLEAR) { delete note[k]; return 'cleared'; }
    return 'progress';
  }

  // 풀이 기록
  function Stats() { this.log = []; }
  Stats.prototype.record = function (e) { this.log.push(e); };
  Stats.prototype.summary = function () {
    const n = this.log.length;
    let c = 0, ms = 0;
    const byTag = {};
    const wrong = [];
    this.log.forEach(function (e) {
      if (e.correct) c++;
      ms += e.ms;
      const t = byTag[e.tag] || (byTag[e.tag] = { n: 0, c: 0 });
      t.n++; if (e.correct) t.c++;
      if (!e.correct) wrong.push(e);
    });
    const re = this.log.filter(function (e) { return e.isReask; });
    return {
      n: n, correct: c,
      rate: n ? c / n : 0,
      avgSec: n ? ms / n / 1000 : 0,
      byTag: byTag,
      wrong: wrong,
      reaskN: re.length,
      reaskCorrect: re.filter(function (e) { return e.correct; }).length,
    };
  };

  const api = { mulberry32: mulberry32, shuffle: shuffle, parseQuestions: parseQuestions, normAns: normAns, checkShort: checkShort, hintCells: hintCells,
    Scheduler: Scheduler, Stats: Stats, noteKey: noteKey, noteUpdate: noteUpdate, NOTE_CLEAR: NOTE_CLEAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChiiQuiz = api;
})(this);
