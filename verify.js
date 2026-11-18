// node verify.js — 문항 읽기와 출제 규칙 검사
const Q = require('./quiz.js');
const fs = require('fs');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('✗', name); } }

// 기본 문항 읽기 (questions.js를 실제로 실행해서 가져와요)
const win = {};
require('vm').runInNewContext(fs.readFileSync(__dirname + '/questions.js', 'utf8'), { window: win });
const def = Q.parseQuestions(win.DEFAULT_QUESTIONS);
ok(def.errors.length === 0, '기본 문항에 오류 없음');
ok(def.items.length === 180, '기본 문항 180개 (국어 5-2)');
ok(def.items.filter((i) => i.short).length === 60, '주관식 60개');
ok(new Set(def.items.map((i) => i.tag)).size === 4, '단원 4개');
def.items.forEach((it) => ok(it.wrongs.indexOf(it.ans) < 0, '정답이 오답에 없음: ' + it.q));
def.items.filter((i) => !i.short).forEach((it) => ok(it.wrongs.length === 3 && new Set([it.ans].concat(it.wrongs)).size === 4, '객관식 보기 4개, 중복 없음: ' + it.q));
def.items.filter((i) => i.short).forEach((it) => ok(Q.checkShort(it, it.ans) && Q.hintCells(it).length === it.ans.length, '주관식 정답 채점·글자 칸: ' + it.ans));
ok(def.items[0].q.indexOf('\n') > 0, '문제 안 줄바꿈 살림');

// 탭 구분 · 머리글 · 빈 줄 · 오류 줄
const tsv = '유형\t난이도\t문제\t정답\t오답1\t오답2\t오답3\t해설\nA\t2\t1+1\t2\t3\t\t\t\n\n#메모\nB\t9\t2+2\t4\t5\t6\t7\t설명\n잘못된 줄\nC\t1\t3+3\t6\t6\t\t\t';
const p = Q.parseQuestions(tsv);
ok(p.items.length === 2, '탭 구분 2문항');
ok(p.items[0].wrongs.length === 1 && !p.items[0].short, '오답 1개도 허용 (객관식)');
ok(p.items[1].diff === 1, '난이도 범위 밖이면 1');
ok(p.errors.length === 2, '오류 줄 2개 보고 (문제만 있는 줄, 오답=정답)');
ok(p.errors[0].line === 6, '오류 줄 번호');
// 엑셀에서 셀 안 줄바꿈이 있는 칸은 "..."로 감싸져 복사돼요
{
  const x = Q.parseQuestions('A\t1\t"지문 첫 줄\n묻는 말"\t답\t\t\t\t\nB\t1\t"따옴표 ""안"""\t가\t나\t\t\t\nC\t1\tq\t정\t\t\t\t');
  ok(x.items.length === 3 && x.errors.length === 0, '따옴표 칸 3문항');
  ok(x.items[0].q === '지문 첫 줄\n묻는 말' && x.items[0].short, '셀 안 줄바꿈 + 주관식');
  ok(x.items[1].q === '따옴표 "안"' && !x.items[1].short, '따옴표 두 개는 따옴표 하나');
  const y = Q.parseQuestions('A\t1\t"두 줄\n문제"\t답\t\t\t\t\n잘못된 줄');
  ok(y.errors.length === 1 && y.errors[0].line === 3, '셀 안 줄바꿈 뒤 오류 줄 번호');
}
// | 구분에서는 \n 글자가 줄바꿈
ok(Q.parseQuestions('A|1|첫 줄\\n둘째 줄|답||||').items[0].q === '첫 줄\n둘째 줄', '| 구분의 \\n 은 줄바꿈');
// 주관식 채점
{
  const it = { ans: '조회 수' };
  ok(Q.checkShort(it, '조회수') && Q.checkShort(it, ' 조회  수 ') && Q.checkShort(it, '‘조회 수’.'), '띄어쓰기·따옴표·마침표 무시');
  ok(!Q.checkShort(it, '조회') && !Q.checkShort(it, ''), '다른 답·빈 답은 오답');
  ok(Q.checkShort({ ans: '국시/국수' }, '국수') && Q.checkShort({ ans: '국시/국수' }, '국시'), '가/나 둘 다 정답');
  ok(Q.hintCells({ ans: '작은 의자' }).join('') === '작은 의자' && Q.hintCells({ ans: '작은 의자' }).length === 5, '힌트 칸: 띄어쓰기 자리 포함');
  ok(Q.hintCells({ ans: '국시/국수' }).join('') === '국시', '힌트 칸은 첫 번째 정답 기준');
}

// 재출제: 틀린 '같은 문제'가 2~3번째 뒤에 다시 나옴
for (let seed = 1; seed <= 200; seed++) {
  const s = new Q.Scheduler(def.items, Q.mulberry32(seed));
  const first = s.next(0.1);
  s.report(first.item, false);
  let found = -1;
  for (let k = 1; k <= 3; k++) { const n = s.next(0.1); if (n.isReask && n.item.id === first.item.id) { found = k; break; } }
  ok(found === 2 || found === 3, `재출제 위치 2~3 (seed ${seed}, got ${found})`);
}
// 같은 문제는 한 판에 최대 2번까지만 다시 나옴
{
  const s = new Q.Scheduler(def.items, Q.mulberry32(5));
  const f = s.next(0.1);
  let again = 0;
  s.report(f.item, false);
  for (let k = 0; k < 30; k++) { const n = s.next(0.1); if (n.isReask && n.item.id === f.item.id) { again++; s.report(n.item, false); } }
  ok(again === 2, `계속 틀려도 재출제는 2번 (got ${again})`);
}
// 맞히면 재출제 없음
{
  const s = new Q.Scheduler(def.items, Q.mulberry32(9));
  const f = s.next(0.1); s.report(f.item, true);
  let any = false; for (let k = 0; k < 6; k++) if (s.next(0.1).isReask) any = true;
  ok(!any, '정답이면 재출제 없음');
}
// 주관식은 보기가 없음
{
  const s = new Q.Scheduler(def.items.filter((i) => i.short), Q.mulberry32(2));
  ok(s.next(0.5).choices.length === 0, '주관식 보기 없음');
}
// 오답 노트 문항이 판 초반에 한 문제 걸러 먼저 나옴
{
  const s = new Q.Scheduler(def.items, Q.mulberry32(8), { priority: [5, 77, 150] });
  const seq = []; for (let k = 0; k < 8; k++) seq.push(s.next(0.1));
  ok(seq[0].isNote && seq[0].item.id === 5 && seq[2].item.id === 77 && seq[4].item.id === 150, '노트 문항이 1·3·5번째');
  ok(!seq[1].isNote && seq.filter((n) => n.isNote).length === 3, '그 사이는 일반 문제');
  ok(new Set(seq.map((n) => n.item.id)).size === 8, '노트 문항이 일반 문제로 겹쳐 나오지 않음');
  const s2 = new Q.Scheduler(def.items.slice(0, 10), Q.mulberry32(8), { priority: [150] });
  ok(!s2.next(0.1).isNote, '이번 판 범위(단원) 밖 노트 문항은 건너뜀');
}
// 오답 노트: 틀리면 담고, 두 번 맞히면 졸업, 다시 틀리면 처음부터
{
  const note = {}, it = def.items[3];
  ok(Q.noteUpdate(note, def.items[4], true) === null, '노트에 없는 문제를 맞히면 그대로');
  ok(Q.noteUpdate(note, it, false) === 'added' && note[Q.noteKey(it)].wrongN === 1, '틀리면 담음');
  ok(Q.noteUpdate(note, it, true) === 'progress', '한 번 맞힘');
  ok(Q.noteUpdate(note, it, false) === 'added' && note[Q.noteKey(it)].okN === 0 && note[Q.noteKey(it)].wrongN === 2, '다시 틀리면 졸업 진행 처음부터');
  Q.noteUpdate(note, it, true);
  ok(Q.noteUpdate(note, it, true) === 'cleared' && !note[Q.noteKey(it)], '두 번 맞히면 졸업');
}
// 다 쓰기 전에는 같은 문항 반복 없음
{
  const s = new Q.Scheduler(def.items, Q.mulberry32(3));
  const ids = new Set();
  for (let k = 0; k < def.items.length; k++) ids.add(s.next(k / def.items.length).item.id);
  ok(ids.size === def.items.length, '문항을 다 쓸 때까지 중복 없음');
  ok(s.next(0.5).item, '다 쓴 뒤에도 계속 출제');
}
// 난이도: 초반 ★1(객관식) 위주, 후반 ★2(주관식) 비중 증가
{
  let early = 0, late = 0, N = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const a = new Q.Scheduler(def.items, Q.mulberry32(seed)); if (a.next(0.05).item.diff === 1) early++;
    const b = new Q.Scheduler(def.items, Q.mulberry32(seed)); if (b.next(0.95).item.diff === 2) late++;
    N++;
  }
  // 객관식 120개·주관식 60개: 초반 가중치 3:1 → 120·3/(120·3+60) ≈ 86%, 후반 0.3:1 → 60/(36+60) ≈ 62%
  ok(early / N > 0.75, `초반 첫 문제 객관식 비율 > 75% (${(early / N * 100).toFixed(0)}%)`);
  ok(late / N > 0.5, `후반 첫 문제 주관식 비율 > 50% (${(late / N * 100).toFixed(0)}%)`);
}
// 보기는 정답 1개 + 오답, 중복 없음
{
  const s = new Q.Scheduler(def.items, Q.mulberry32(11));
  for (let k = 0; k < 40; k++) { const n = s.next(k / 40); if (n.item.short) continue; ok(n.choices.filter((c) => c === n.item.ans).length === 1 && new Set(n.choices).size === n.choices.length, '보기 정상'); }
}
// 같은 시드 → 같은 순서
{
  const a = new Q.Scheduler(def.items, Q.mulberry32(42)), b = new Q.Scheduler(def.items, Q.mulberry32(42));
  let same = true; for (let k = 0; k < 30; k++) { const x = a.next(k / 30), y = b.next(k / 30); if (x.item.id !== y.item.id || x.choices.join() !== y.choices.join()) same = false; }
  ok(same, '같은 시드는 같은 출제 순서');
}
// 기록 요약
{
  const st = new Q.Stats();
  st.record({ tag: 'A', correct: true, ms: 1000, isReask: false });
  st.record({ tag: 'A', correct: false, ms: 3000, isReask: false, q: 'x', chosen: '1', ans: '2' });
  st.record({ tag: 'B', correct: true, ms: 2000, isReask: true });
  const s = st.summary();
  ok(s.n === 3 && s.correct === 2 && Math.abs(s.avgSec - 2) < 1e-9, '요약 수치');
  ok(s.byTag.A.n === 2 && s.byTag.A.c === 1 && s.wrong.length === 1 && s.reaskN === 1 && s.reaskCorrect === 1, '유형별·재출제 요약');
}

console.log(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
