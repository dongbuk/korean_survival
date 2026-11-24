// 치이카와의 모험 — 시제품 (캐릭터 4명, 10분, 보스 3, 약초 채집, 동료 소환)
(function () {
  'use strict';
  const Q = window.ChiiQuiz;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const TAU = Math.PI * 2;
  const QA = /[?&]qa=1/.test(location.search);
  const QA_NONEW = QA && /[?&]nonew=1/.test(location.search); // QA 비교용: 새 몬스터 끄기
  const isTouchDev = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // ---------- 저장 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('이 기기에는 저장이 안 돼요'); return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  const K_Q = 'chii_questions_v2', K_REC = 'chii_runs_v1', K_OPT = 'chii_opts_v1', K_SEEN = 'chii_seen_v1';
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opts = Object.assign({ music: true, sound: true, vol: 80, shakeAmt: reduceMotion ? 0 : 100, lessFlash: reduceMotion, bigText: false }, store.get(K_OPT, {}));
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
    RUN: 600,        // 초: 전투 시계 기준 판 길이 (10분 · 보스전 중엔 시계가 멈춰요)
    RUSH_AT: 450,    // 초: 몬스터 대습격
    ALLY_CD: 22, ALLY_DUR: 7, SUMO_CD: 16, SUMO_DUR: 5, // 섬아저씨 (Q)
    CAR_CD: 30, CAR_DUR: 10, // 랏코 자동차 (Shift · 익스트림): 이동 1.5배 · 받는 피해 -20%
    // 동료 소환 쿨타임 · 지속 (초)
    HP: 100,
    WRONG: 10,       // 오답 피해
    SPEED: 140,      // px/초
    MAG: 100,        // 증표 끌어당김 반경 px
    HERB_EVERY: 25, HERB_FIRST: 20, HERB_HEAL: 20, HERB_TIME: 3,
    MAX_ENEMY: 260,
  };
  const needXp = (L) => Math.round(4 + 4 * (L - 1) + 0.5 * (L - 1) * (L - 1));
  const ETYPE = {
    slime: { r: 12, hp: 12, spd: 45, dmg: 6, xp: 1 },
    hopper: { r: 11, hp: 8, spd: 220, dmg: 5, xp: 1 },
    big: { r: 20, hp: 45, spd: 34, dmg: 9, xp: 3 },
    swoop: { r: 13, hp: 14, spd: 120, dmg: 6, xp: 2 },   // 빙빙 돌다가 급강하
    burrow: { r: 14, hp: 22, spd: 95, dmg: 8, xp: 2 },   // 땅속으로 다가와 튀어나옴 (땅속에선 안 맞아요)
    thrower: { r: 15, hp: 24, spd: 62, dmg: 6, xp: 2 },  // 거리 두고 몽둥이 던지기
    spitter: { r: 16, hp: 30, spd: 40, dmg: 6, xp: 3 },  // 눈이 빛나면 3갈래 탄
    charger: { r: 18, hp: 42, spd: 55, dmg: 10, xp: 3 }, // 경고선 뒤 돌진
    clone: { r: 30, hp: 140, spd: 78, dmg: 10, xp: 0 },  // 검은 별똥별의 분신
    fluff: { r: 12, hp: 30, spd: 150, dmg: 6, xp: 1 },   // 아노코가 부르는 꼬마 아노코 (빠름)
    stag: { r: 18, hp: 40, spd: 52, dmg: 9, xp: 3 },     // 집게투구: 멈춰서 땅을 찍으면 가시가 줄지어 솟아요
    mace: { r: 20, hp: 55, spd: 46, dmg: 10, xp: 3 },    // 쇠공 토끼: 가까우면 쇠공을 빙빙 돌리고, 멀면 쇠공을 굴려요
    grab: { r: 16, hp: 34, spd: 56, dmg: 7, xp: 3 },
    mermaid: { r: 17, hp: 160, spd: 72, dmg: 12, xp: 5 }, // 세이렌의 인어 2마리 (하드: 물줄기·물방울)
    bee: { r: 10, hp: 10, spd: 95, dmg: 5, xp: 1 },      // 익스트림 · 꿀벌: 떼로 날아와 멈칫(!) 뒤 침 돌진
    pinkele: { r: 18, hp: 50, spd: 44, dmg: 9, xp: 3 },  // 익스트림 · 분홍 코끼리: 거리를 두고 코로 물폭탄 3개 (떨어질 곳에 원)

    // 새 몬스터 13종 (생김새에 맞는 기술 하나씩)
    yamanba: { r: 16, hp: 40, spd: 50, dmg: 8, xp: 3 },   // 산할머니: 사라졌다가 바로 옆에 나타나 지팡이로 쾅
    snake: { r: 15, hp: 36, spd: 46, dmg: 7, xp: 3 },     // 하얀 돌뱀: 똬리를 틀고(!) 돌 눈빛 → 맞으면 분홍 돌이 되어 잠깐 못 움직여요
    centipede: { r: 12, hp: 26, spd: 70, dmg: 6, xp: 2 }, // 분홍 지네: 꾸물꾸물 다가오다 다다닥 질주
    fugu: { r: 16, hp: 40, spd: 40, dmg: 7, xp: 3 },      // 복어: 부풀었다가(!) 가시 8방향 발사
    chushi: { r: 15, hp: 30, spd: 58, dmg: 6, xp: 2 },    // '중지입니다': "중지!" 외치면 둘레 원 안에서 느려져요
    cream: { r: 18, hp: 50, spd: 38, dmg: 7, xp: 3 },     // 생크림: 크림 3덩이를 던져요 (밟으면 미끌미끌 느려짐)
    antlion: { r: 20, hp: 70, spd: 24, dmg: 9, xp: 4 },   // 개미귀신: 모래 구덩이로 빨아들여요
    piman: { r: 17, hp: 45, spd: 52, dmg: 8, xp: 3 },     // 피망 괴물: 펄쩍 뛰어올라 플레이어 자리에 덮치기
    soy: { r: 13, hp: 24, spd: 62, dmg: 5, xp: 2 },       // 간장 액체: 지나간 자리에 간장 웅덩이 (밟으면 따끔)
    imomushi: { r: 16, hp: 55, spd: 30, dmg: 8, xp: 3 },  // 하얀 애벌레: 몸을 말아 데굴데굴 굴러와요
    midori: { r: 24, hp: 110, spd: 38, dmg: 10, xp: 5 },  // 연두색 대형 괴물: 쓰러지면 작은 연두 2마리로 갈라져요
    midori_s: { r: 12, hp: 22, spd: 85, dmg: 5, xp: 1 },
    pinkbug: { r: 13, hp: 26, spd: 60, dmg: 6, xp: 2 },   // 분홍 세발 벌레: 세 발로 삼각형 알 폭탄
    tonakai: { r: 20, hp: 70, spd: 50, dmg: 10, xp: 4 },  // 크리스마스 순록: 뿔 돌진 뒤 선물 상자가 펑
  };
  const ELEFT = { imomushi: 1, midori: 1, midori_s: 1 }; // 왼쪽을 보는 그림 (오른쪽으로 갈 때 뒤집어요)
  // 언제부터 나오는지(초)와 나오는 비율. after: 보스를 몇 마리 쓰러뜨린 뒤부터. 동료가 된 몬스터(ally)는 5:00 보스 뒤엔 안 나와요.
  const SPAWN = [
    { t: 'slime', from: 0, w: 5 }, { t: 'hopper', from: 20, w: 3 }, { t: 'swoop', from: 60, w: 1.5, cap: 6 },
    { t: 'big', from: 90, w: 1.2 }, { t: 'burrow', from: 110, w: 1.5, cap: 5 },
    { t: 'thrower', from: 150, w: 1.2, cap: 4, ally: true, after: 1 }, { t: 'stag', from: 150, w: 1.3, cap: 4, after: 1 },
    { t: 'mace', from: 190, w: 1, cap: 2, after: 1 }, { t: 'spitter', from: 210, w: 1, cap: 3, ally: true, after: 1 },
    { t: 'grab', from: 240, w: 1, cap: 3, after: 1 }, { t: 'charger', from: 300, w: 1.5, cap: 5, after: 2 },
    { t: 'bee', from: 45, w: 2.2, cap: 14, only: 'extreme' }, { t: 'pinkele', from: 170, w: 1, cap: 3, after: 1, only: 'extreme' },
    { t: 'centipede', nw: 1, from: 40, w: 1.2, cap: 5 }, { t: 'soy', nw: 1, from: 80, w: 1, cap: 4 }, { t: 'chushi', nw: 1, from: 100, w: 0.8, cap: 3 },
    { t: 'fugu', nw: 1, from: 130, w: 0.9, cap: 3 }, { t: 'imomushi', nw: 1, from: 160, w: 0.9, cap: 3, after: 1 }, { t: 'snake', nw: 1, from: 170, w: 0.9, cap: 3, after: 1 },
    { t: 'cream', nw: 1, from: 200, w: 0.8, cap: 3, after: 1 }, { t: 'piman', nw: 1, from: 220, w: 0.9, cap: 3, after: 1 }, { t: 'pinkbug', nw: 1, from: 250, w: 0.9, cap: 3, after: 1 },
    { t: 'yamanba', nw: 1, from: 320, w: 0.8, cap: 2, after: 2 }, { t: 'antlion', nw: 1, from: 330, w: 0.6, cap: 2, after: 2 }, { t: 'midori', nw: 1, from: 360, w: 0.6, cap: 2, after: 2 },
    { t: 'tonakai', nw: 1, from: 400, w: 0.8, cap: 3, after: 2 },
  ];
  // 판 중간중간 몰려오는 사건 (지루한 틈이 없게)
  const EVENTS = [
    { at: 30, k: 'ring', t: 'slime', n: 22, msg: '슬라임이 빙 둘러쌌어요! 틈을 찾아 빠져나가요' },
    { at: 70, k: 'herd', t: 'hopper', n: 14, msg: '토끼 떼가 달려와요!' },
    { at: 90, k: 'herd', t: 'bee', n: 14, msg: '꿀벌 떼가 붕붕! 멈칫하면 비켜요', only: 'extreme' },
    { at: 110, k: 'ring', t: 'hopper', n: 18, msg: '사방에서 뛰어와요!' },
    { at: 200, k: 'herd', t: 'stag', n: 5, msg: '집게투구 부대!' },
    { at: 230, k: 'ring', t: 'pinkele', n: 8, msg: '분홍 코끼리들이 물폭탄을 쏴요!', only: 'extreme' },
    { at: 260, k: 'ring', t: 'big', n: 12, msg: '노랑 갈기에 갇혔어요!' },
    { at: 380, k: 'herd', t: 'mace', n: 5, msg: '쇠공 토끼들이 굴러와요!' },
    { at: 420, k: 'ring', t: 'grab', n: 10, msg: '긴팔이 사방에서 뻗어와요!' },
    { at: 520, k: 'ring', t: 'charger', n: 10, msg: '사자탈에게 포위됐어요!' },
    { at: 160, k: 'herd', t: 'centipede', n: 10, msg: '분홍 지네 떼가 다다닥!', skip: 'normal' },
    { at: 340, k: 'ring', t: 'snake', n: 7, msg: '하얀 돌뱀이 노려봐요! 돌 눈빛을 피해요', skip: 'normal' },
    { at: 470, k: 'herd', t: 'tonakai', n: 5, msg: '크리스마스 순록 썰매대!', skip: 'normal' },
  ];
  EVENTS.sort((a, b) => a.at - b.at);
  // 지역: 보스를 쓰러뜨리면 다음 지역으로 (바닥·소품·보스 울타리 모양이 바뀌어요)
  const BIOMES = [
    { name: '풀밭', ground: '#cfe8b8', grass: '#b3d69a', dots: ['#fff', '#ffd1dc', '#ffe58a'], props: ['bush', 'flower', 'rock'], fence: '#8fc27a', shadow: 'rgba(60,80,40,.25)' },
    { name: '깊은 숲', ground: '#a9cf95', grass: '#8cbc78', dots: ['#e2f2c8', '#c7a4e0', '#fff4b0'], props: ['tree', 'mush', 'log', 'tree'], fence: '#4f7d4a', shadow: 'rgba(30,60,30,.3)' },
    { name: '바위 골짜기', ground: '#e3cfa8', grass: '#cdb284', dots: ['#f6ead0', '#b89a70', '#e8a97a'], props: ['rock', 'pillar', 'crystal', 'rock'], fence: '#9a7a55', shadow: 'rgba(90,60,30,.28)' },
    { name: '별밤 언덕', ground: '#5b5683', grass: '#4a4672', dots: ['#fff6c8', '#b9a3ff', '#ffffff'], props: ['lamp', 'crystal', 'rock'], fence: '#8a7fd0', shadow: 'rgba(10,0,30,.35)' },
  ];
  // 보스: 2분 30초마다. 마지막은 검은 별똥별 (한 번 쓰러뜨리면 더 세져서 되살아나요)
  const BOSSES = [
    { at: 150, kind: 'siren', name: '세이렌', art: 'boss', hp: 2200, spd: 62, r: 40, dmg: 16, arena: 340 },
    { at: 300, kind: 'anoko', name: '아노코', art: 'anoko', hp: 3400, spd: 62, r: 44, dmg: 14, arena: 360 },
    { at: 600, kind: 'star', name: '검은 별똥별', art: 'star', hp: 8000, hp2: 7000, spd: 70, r: 46, dmg: 16, final: true, arena: 380 },
  ];
  // 익스트림 보스: 풍뎅이(의태형) → 더 센 세이렌과 인어 → 악몽코끼리 → 데카츠요 (쓰러뜨리면 본체 매지컬 모몽가로 변신)
  const BOSSES_X = [
    { at: 150, kind: 'beetle', name: '풍뎅이 (의태형)', art: 'beetle', hp: 2600, spd: 66, r: 42, dmg: 17, arena: 340 },
    { at: 300, kind: 'siren', name: '세이렌', art: 'boss', hp: 3300, spd: 70, r: 40, dmg: 18, arena: 340 },
    { at: 450, kind: 'nightmare', name: '악몽코끼리', art: 'nightmare', hp: 4600, spd: 64, r: 46, dmg: 18, arena: 360 },
    { at: 600, kind: 'dekatsuyo', name: '데카츠요', art: 'dekatsuyo', hp: 6000, hp2: 10500, spd: 74, r: 46, dmg: 18, final: true, arena: 380 },
  ];
  // 난이도: 노말은 몬스터·보스가 약하고 덜 아파요. 하드는 원래 그대로. 익스트림은 하드보다 조금 더 세고 보스가 달라요.
  const DIFF = {
    normal: { name: '노말', desc: '처음 하는 친구', ehp: 0.75, bhp: 0.6, dmg: 0.6, spawn: 0.8, ev: 0.65, herb: 1.5 },
    hard: { name: '하드', desc: '자신 있는 친구', ehp: 1, bhp: 1, dmg: 1, spawn: 1, ev: 1, herb: 1 },
    extreme: { name: '익스트림', desc: '최강 토벌대', ehp: 1.1, bhp: 1, dmg: 1.1, spawn: 1.1, ev: 1.1, herb: 0.9, bosses: BOSSES_X, last: '매지컬 모몽가' },
  };
  let selMode = store.get('chii_mode', 'normal');
  if (!DIFF[selMode]) selMode = 'normal';
  const D = () => DIFF[G.mode] || DIFF.hard;
  const bossList = () => D().bosses || BOSSES;
  const lastBoss = () => D().last || '검은 별똥별';
  // 익스트림은 하드를 한 번 깨야 열려요 (테스트 모드에선 늘 열림)
  const xOpen = () => testOn || !!store.get('chii_clear_hard', false) || store.get(K_REC, []).some((r) => r.mode === 'hard' && r.win);
  const ALLIES = [{ art: 'ode', name: '오데' }, { art: 'thrower', name: '초록 도깨비' }];
  const WEAP = {
    sickle: { name: '풀베기 낫', ic: 'sickle', desc: (l) => `몸 주위를 한 바퀴 휘둘러요 · 피해 ${14 + 4 * (l - 1)} · ${(1.3 - 0.1 * (l - 1)).toFixed(1)}초마다` },
    sling: { name: '새총', ic: 'sling', desc: (l) => `가장 가까운 적을 맞혀요 · 피해 ${12 + 3 * (l - 1)}${l >= 3 ? ' · +1발' : ''}${l >= 4 ? ' · 1번 관통' : ''}` },
    bubble: { name: '비눗방울', ic: 'bubble', desc: (l) => `적 위에서 커지며 느리게 만들어요 · 피해 ${4 + 2 * (l - 1)}/0.4초` },
    sword: { name: '검', ic: 'sword', desc: (l) => `바라보는 쪽을 크게 베어요 · 피해 ${20 + 6 * (l - 1)} · ${(1.1 - 0.08 * (l - 1)).toFixed(2)}초마다` },
    club: { name: '몽둥이', ic: 'club', desc: (l) => `움직이면 앞으로 돌진, 멈추면 땅 쿵! · 피해 ${16 + 5 * (l - 1)}` },
    zap: { name: '번개 구슬', ic: 'zap', desc: (l) => `번개가 적 사이를 튀어 다녀요 · 피해 ${18 + 5 * (l - 1)} · ${2 + Math.floor(l / 2)}번 튐` },
    boom: { name: '부메랑 숟가락', ic: 'boom', desc: (l) => `날아갔다가 돌아오며 모두 베어요 · 피해 ${15 + 4 * (l - 1)}${l >= 3 ? ' · 2개' : ''}` },
    // 캐릭터 전용 토벌봉: 처음부터 들고 시작하고, 그 캐릭터만 키울 수 있어요
    rod_chiikawa: { only: 'chiikawa', img: 'rods/chiikawa.png', name: '분홍 토벌봉', ic: 'heart', desc: (l) => `던지면 적과 적 사이를 튕겨 다녀요 · 피해 ${20 + 5 * (l - 1)} · ${2 + Math.floor(l / 2)}번 튕김` },
    rod_hachiware: { only: 'hachiware', img: 'rods/hachiware.png', name: '파랑 토벌봉', ic: 'heart', desc: (l) => `부채꼴로 ${l >= 5 ? 5 : l >= 3 ? 4 : 3}개를 던져 꿰뚫어요 · 피해 ${14 + 4 * (l - 1)}` },
    rod_usagi: { only: 'usagi', img: 'rods/usagi.png', name: '노랑 토벌봉', ic: 'heart', desc: (l) => `높이 던져 적 무리 위에 쿵! 내리꽂아요 · 피해 ${35 + 10 * (l - 1)}` },
    rod_rakko: { only: 'rakko', img: 'items/rakko_sword.png', name: '해달의 칼', ic: 'sword', desc: (l) => `칼을 빙글빙글 던져 모두 베고 돌아와요 · 피해 ${30 + 8 * (l - 1)}${l >= 3 ? ' · 2자루' : ''}` },
    mine: { name: '꽃폭탄', ic: 'mine', desc: (l) => `발밑에 꽃을 심어요. 적이 밟으면 펑! · 피해 ${28 + 8 * (l - 1)}` },
    // 캐릭터 전용 물건 (카드로 얻어요)
    it_naruto: { only: 'chiikawa', img: 'items/naruto.png', name: '나루토 원반', ic: 'heart', desc: (l) => `몸 주위를 ${l >= 5 ? 4 : l >= 3 ? 3 : 2}개가 빙글빙글 돌며 베어요 · 피해 ${10 + 3 * (l - 1)}` },
    it_tempura: { only: 'hachiware', img: 'items/tempura.png', name: '새우튀김', ic: 'heart', desc: (l) => `던지면 화면 끝에서 튕기며 ${l >= 5 ? 4 : 2.5}초 날아다녀요 · 피해 ${12 + 4 * (l - 1)}${l >= 3 ? ' · 2개' : ''}` },
    it_rocket: { only: 'usagi', img: 'items/rocket.png', name: '쌍둥이 로켓', ic: 'heart', desc: (l) => `적을 쫓아가 펑! · ${l >= 5 ? 4 : l >= 3 ? 3 : 2}발 · 피해 ${18 + 5 * (l - 1)}` },
    top: { img: 'items/top.png', name: '팽이', ic: 'wind', desc: (l) => `적 무리에 팽이를 던져 빨아들이며 갈아요 · 피해 ${6 + 2 * (l - 1)}/0.3초${l >= 3 ? ' · 2개' : ''}` },
  };
  // Lv.5가 되면 무기가 진화해요 (새 동작이 하나 더 생겨요)
  const EVO = {
    sickle: '회오리가 남아 계속 베어요', sling: '도토리가 맞으면 터져요', bubble: '사라질 때 크게 터져요',
    sword: '검기가 날아가요', club: '충격파가 퍼져요', zap: '맞은 적이 감전돼 느려져요',
    boom: '불꽃 숟가락! 더 크고 불꽃이 남아요', mine: '터질 때 꽃잎 폭탄이 4개 더 터져요',
    rod_chiikawa: '6번 튕기고, 맞을 때마다 작게 터져요', rod_hachiware: '5개를 던지고 끝까지 꿰뚫어요', rod_usagi: '2개를 던지고 떨어진 곳에 충격파가 퍼져요',
    rod_rakko: '돌아올 때 검기 고리가 퍼져요',
    it_naruto: '원반이 크게 펼쳐졌다 돌아와요', it_tempura: '튕길 때마다 작게 터져요', it_rocket: '터질 때 작은 로켓 3개가 더 날아가요', top: '다 돌면 크게 펑!',
  };
  const SUBS = {
    wind: { name: '바람 부적', ic: 'wind', desc: (l) => `낫·비눗방울·몽둥이·꽃폭탄 범위 +${12 * l}%` },
    acorn: { name: '도토리 주머니', ic: 'acorn', desc: (l) => `새총·비눗방울·부메랑 개수 +${Math.ceil(l / 2)}` },
    shoes: { name: '운동화', ic: 'shoes', desc: (l) => `이동속도 +${8 * l}% · 증표 끌어당기기 +${15 * l}%` },
  };

  // 캐릭터: 무기와 움직임만 달라요. 체력·문제·카드 보상은 모두 같아요.
  const CHARS = {
    // bonus: 하드를 한 번 깨면 영구로 받는 강화 (기본 체력 + 캐릭터 특수 효과)
    chiikawa: { name: '치이카와', weapon: 'sickle', speed: 1, herbMul: 1, passive: '버티기', pdesc: '체력 40% 이하일 때 몬스터 피해 −30%', bonus: { hp: 135, name: '울보 각성', desc: '체력 40% 이하면 주는 피해 +40%' } }, // 11-24 버프: 30% → 40%, 체력 125 → 135
    hachiware: { name: '하치와레', weapon: 'sling', speed: 1, herbMul: 1, passive: '응원', pdesc: '3번 연속 정답마다 3초 무적 + 주변 밀어내기', bonus: { hp: 125, name: '긍정 에너지', desc: '1초에 체력 0.4씩 저절로 회복' } }, // 11-24 너프: 회복 0.6 → 0.4
    usagi: { name: '우사기', weapon: 'club', speed: 1.2, herbMul: 0.5, passive: '우라!', pdesc: '빠르게 달리고 약초를 2배 빨리 캐요', bonus: { hp: 140, name: '우라 연타', desc: '공격의 25%가 2배 피해 (치명타)' } }, // 11-24 버프: 치명타 15% → 25%, 체력 125 → 140
    rakko: { name: '랏코', weapon: 'sword', speed: 1.1, herbMul: 1, hp: 125, passive: '토벌 고수', pdesc: '체력 125 · 모든 피해 +10% · 보스에게 +10% 더 · 해달의 칼', locked: true }, // 2026-11-24 너프 (140 · +20% · 보스 +30%)
  };
  let testOn = false; // 테스트 모드 (비밀번호로 켜요 · 이 창을 닫으면 꺼져요)
  const isUnlocked = (k) => testOn || !CHARS[k].locked || !!store.get('chii_unlock_' + k, false);
  let selChar = store.get('chii_char', 'chiikawa');
  const hardBonus = () => xOpen(); // 하드 클리어(또는 테스트 모드) → 강화
  const charHp = (k) => CHARS[k].hp || (hardBonus() && CHARS[k].bonus ? CHARS[k].bonus.hp : T.HP);
  // 익스트림 탈것 (Shift): 랏코는 자동차(그림이 왼쪽을 봐요), 나머지는 자전거(그림이 오른쪽을 봐요)
  const VEH = { rakko: { art: 'rakko_car', name: '자동차', h: 62, faceLeft: true }, chiikawa: { art: 'bike_chiikawa', name: '자전거', h: 56 }, hachiware: { art: 'bike_hachiware', name: '자전거', h: 58 }, usagi: { art: 'bike_usagi', name: '자전거', h: 66 } };
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
      Music.unlocked = true;
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

  // ---------- 배경 음악 ----------
  // audio/bgm_main.mp3 (기본 · 계속 반복), audio/bgm_boss.mp3 (보스전 · 반복). 파일이 없으면 조용히 넘어가요.
  // 크기: 효과음보다 작게 (소리 크기 설정 × 0.3). 쉬기·결과 화면에선 더 작게, 다른 창으로 가면 멈춰요.
  // 곡마다 원래 소리 크기가 달라서 따로 맞췄어요 (기본 곡이 6.6dB 더 커요). 둘 다 효과음보다 약 6dB 작게 들려요.
  const BGM_VOL = { main: 0.16, boss: 0.32 };
  const Music = {
    els: {}, want: null, duck: 1,
    init() {
      for (const [k, f] of [['main', 'bgm_main.mp3'], ['boss', 'bgm_boss.mp3']]) {
        const a = new Audio('audio/' + f); a.loop = true; a.preload = 'auto'; a.volume = 0; a.ok = true;
        a.onerror = () => { a.ok = false; };
        this.els[k] = a;
      }
    },
    tick(dt) {
      const hidden = document.hidden;
      for (const k in this.els) {
        const a = this.els[k]; if (!a.ok) continue;
        const target = !hidden && opts.sound && opts.music && k === this.want ? Math.min(1, opts.vol / 100 * BGM_VOL[k] * this.duck) : 0;
        const v = a.volume + (target - a.volume) * (1 - Math.exp(-(target > a.volume ? 3 : 5) * dt));
        a.volume = Math.max(0, Math.min(1, Math.abs(v - target) < 0.003 ? target : v));
        if (target > 0 && a.paused && this.unlocked) {
          a.play().catch(() => {});
        }
        if (target === 0 && a.volume === 0 && !a.paused) { a.pause(); if (k === 'boss') a.currentTime = 0; } // 보스 음악은 다음 보스 때 처음부터
      }
    },
  };
  Music.init();

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
  // 지역마다 바닥 무늬 한 장 (256px, 이어 붙여 깔아요)
  const tiles = BIOMES.map((b, bi) => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    const t = tile.getContext('2d'), r = Q.mulberry32(7 + bi);
    t.fillStyle = b.ground; t.fillRect(0, 0, 256, 256);
    if (bi === 2) { t.fillStyle = b.grass; for (let i = 0; i < 9; i++) { t.globalAlpha = 0.5; const ex = r() * 256, ey = r() * 256, rx = 18 + r() * 20, ry = 8 + r() * 8, ro = r() * 3; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { t.beginPath(); t.ellipse(ex + ox, ey + oy, rx, ry, ro, 0, TAU); t.fill(); } } t.globalAlpha = 1; }
    t.strokeStyle = b.grass; t.lineWidth = 2; t.lineCap = 'round';
    for (let i = 0; i < (bi === 2 ? 20 : 70); i++) {
      const x = r() * 256, y = r() * 256;
      t.beginPath(); t.moveTo(x, y); t.lineTo(x - 3, y - 7); t.moveTo(x, y); t.lineTo(x + 3, y - 6); t.stroke();
    }
    for (let i = 0; i < (bi === 3 ? 22 : 12); i++) {
      t.fillStyle = b.dots[i % 3]; t.beginPath(); t.arc(r() * 256, r() * 256, bi === 3 && i % 3 === 0 ? 1.6 : 2.5, 0, TAU); t.fill();
    }
    return tile;
  });
  const shadow = document.createElement('canvas');
  shadow.width = 64; shadow.height = 24;
  (function () { const s = shadow.getContext('2d'); s.fillStyle = 'rgba(60,80,40,.25)'; s.beginPath(); s.ellipse(32, 12, 30, 10, 0, 0, TAU); s.fill(); })();

  const ART_FILES = Object.assign({}, window.ART_FILES);
  const SKINS = window.ART_SKINS || {};
  for (const k in SKINS) SKINS[k].forEach((id) => { ART_FILES['skin_' + id] = 'heroes/' + id + '.png'; });
  // 스킨 상점: 캐릭터마다 원작 복장 20종. 스킨 하나가 나올 확률 = 등급 확률 (일반 3% · 고급 2% · 희귀 1% · 전설 0.5%)
  // 등급 개수 10 · 26 · 12 · 12 → 10×3 + 26×2 + 12×1 + 12×0.5 = 100%
  const RAR_P = [3, 2, 1, 0.5], RAR_NM = ['일반', '고급', '희귀', '전설'];
  const SHOP_NAMES = { // [이름, 등급 0~3]
    chiikawa: [['분홍 곰 귀 잠옷', 0], ['초록 잎 너구리', 1], ['빨간 문어 옷', 1], ['초록 좀비', 2], ['검은 고양이', 2], ['혼시메지 버섯', 1], ['간호사', 1], ['빨간 크리스마스 요정', 3], ['호박조림 무늬 옷', 3], ['개구리 우비', 0],
      ['콩 탈', 1], ['게 집게 머리띠', 1], ['멜론 포장망 모자', 1], ['도토리 모자', 0], ['분홍 곰 파우치', 1], ['줄무늬 죄수복', 2], ['크리스마스 트리', 3], ['분홍 부활절 달걀', 3], ['여주 열매 옷', 1], ['삶은 달걀 후드', 2]],
    hachiware: [['하늘색 고양이 귀 잠옷', 0], ['은행잎 너구리', 1], ['빨간 문어 옷', 1], ['초록 좀비', 2], ['검은 고양이', 2], ['새송이버섯', 1], ['간호사', 1], ['초록 크리스마스 요정', 3], ['호박튀김 무늬 옷', 3], ['달팽이 우비', 0],
      ['편의점 유니폼', 2], ['고깃집 종이 앞치마', 1], ['냉탕 머리 수건', 1], ['게 집게 머리띠', 1], ['초미니 허리 가방', 0], ['꿈속 꽃 요정', 3], ['난토카 바니아 인형', 3], ['눈사람 옷', 2], ['하늘색 빙수 옷', 1], ['분홍 카메라', 1]],
    usagi: [['노란 토끼 귀 잠옷', 0], ['단풍잎 너구리', 1], ['하얀 오징어 옷', 1], ['초록 좀비', 2], ['검은 고양이', 2], ['표고버섯', 1], ['수술복', 1], ['하얀 크리스마스 요정', 3], ['생호박 무늬 옷', 3], ['테루테루보즈 우비', 0],
      ['보라 발톱', 3], ['니트 모자·안경', 1], ['그릇 헬멧', 0], ['칠석 날개옷', 3], ['부활절 달걀', 2], ['점화기', 1], ['권투', 1], ['땅콩 껍질', 1], ['액세서리 상인', 2], ['알로하', 0]],
  };
  const SHOP = [];
  for (const c in SHOP_NAMES) SHOP_NAMES[c].forEach(([n, r], i) => { const f = c + '_' + String(i + 1).padStart(2, '0'); ART_FILES['sk_' + f] = 'skins/' + f + '.png'; SHOP.push({ id: 'sk_' + f, c, n, r }); });
  const ART = {};
  Object.keys(ART_FILES).forEach((k) => {
    const im = new Image();
    im.onload = () => {
      const H = /^(boss|siren_rage|star|anoko|beetle|nightmare|dekatsuyo|momonga)$/.test(k) ? 220 : 96, sc = Math.min(1, H / im.height);
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
      if (top && CLOSABLE[top] && e.code === 'Escape') (CLOSE_FN[top] || hide)(top);
      else if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame();
    }
    if (state !== 'play' && ovStack.length && /^Arrow/.test(e.code)) { e.preventDefault(); spatialNav(e.code.slice(5).toLowerCase()); return; }
    const dm = /^(Digit|Numpad)([1-7])$/.exec(e.code);
    if (dm && !e.repeat) {
      const i = +dm[2] - 1;
      if (state === 'quiz') { if (i < 4) answer(i); }
      else if (state === 'cards') pickCard(i);
    }
    if ((e.code === 'Enter' || e.code === 'Space') && state === 'quiz' && $('quizNextRow').style.display !== 'none') { e.preventDefault(); afterQuiz(false); }
    if (BIND.up.concat(BIND.down, BIND.left, BIND.right).includes(e.code) || e.code === 'Space') e.preventDefault();
    if (!e.repeat && state === 'play') { const si = ['KeyQ', 'KeyE', 'KeyR'].indexOf(e.code); if (si >= 0) useSlot(si); }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && state === 'play') useCar();
    if ((QA || (G && G.test)) && G && state === 'play') {
      if (e.code === 'KeyB') { G.clock = (bossList()[G.bossIdx] || { at: T.RUN }).at; }
      if (e.code === 'KeyN' && G.boss) { G.boss.inv = false; G.boss.air = false; G.boss.airH = 0; hurtEnemy(G.boss, G.boss.max * 0.25, G.player.x, G.player.y, 0); }
      if (e.code === 'KeyK') G.enemies.forEach((en) => { if (en.type !== 'boss') hurtEnemy(en, 9999, G.player.x, G.player.y, 0); });
      if (e.code === 'KeyT') G.clock += 30;
      if (e.code === 'KeyI') { G.qaInv = !G.qaInv; toast('무적 ' + (G.qaInv ? '켬' : '끔')); testBar(); }
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
    if (G && G.car.ok) { const b = carBtn(); if ((e.clientX - b.x) ** 2 + (e.clientY - b.y) ** 2 < (b.r + 8) ** 2) { useCar(); return; } }
    if (G) for (let i = 0; i < G.slots.length; i++) { const b = slotBtn(i); if ((e.clientX - b.x) ** 2 + (e.clientY - b.y) ** 2 < (b.r + 8) ** 2) { useSlot(i); return; } }
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
    if (state === 'play') { if (down(9)) pauseGame(); if (down(3)) useSlot(0); if (down(2)) useSlot(1); if (down(4)) useSlot(2); if (down(5) || down(1)) useCar(); }
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
  const CLOSABLE = { legal: 1, how: 1, editor: 1, records: 1, settings: 1, dex: 1, note: 1, tgate: 1, xgate: 1, qform: 1 };
  const CLOSE_FN = { editor: () => edClose(), qform: () => closeForm() }; // 닫기 전에 확인이 필요한 화면
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
    if (top && CLOSABLE[top]) (CLOSE_FN[top] || hide)(top);
    else if (state === 'pause') resumeGame();
  }

  // ---------- 상태 ----------
  let state = 'title';
  let G = null;
  function setState(s) { state = s; $('pauseBtn').style.display = s === 'play' ? 'flex' : 'none'; $('musicBtn').style.display = s === 'play' ? 'flex' : 'none'; testBar(); }
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
      player: { x: 0, y: 0, px: 0, py: 0, r: 14, hp: charHp(selChar), max: charHp(selChar), inv: 0, fx: 1, fy: 0, moving: false, hurtT: 0 },
      hpGhost: charHp(selChar), ghostHold: 0, car: { ok: selMode === 'extreme' && !!VEH[selChar], cd: 0, t: 0 }, vamp: false, bonus: hardBonus() && !!CHARS[selChar].bonus, sumo: { ok: false, cd: 0, t: 0, x: 0, y: 0, drop: 0, tick: 0 }, slots: [], hx: {}, pickN: 0, pickAt: 0, hshots: [], puddles: [], epud: [],
      mode: selMode, char: selChar, weapons: Object.assign({ [CHARS[selChar].weapon]: 1 }, WEAP['rod_' + selChar] ? { ['rod_' + selChar]: 1 } : {}), subs: {},
      wcd: { sickle: 0.4, sling: 0.3, bubble: 0, club: 0.6, sword: 0.5, zap: 0, boom: 0, mine: 0, rod_chiikawa: 0.8, rod_hachiware: 0.8, rod_usagi: 1, rod_rakko: 0.6, it_naruto: 0, it_tempura: 0, it_rocket: 0, top: 0 }, slash: null, rods: [],
      eshots: [], warns: [], fx: [], booms: [], mines: [], waves: [], whirl: null, items: [], tops: [], orbA: 0,
      arena: null, biome: 0, biomeT: 0, evIdx: 0, pull: null, grabs: [],
      bossIdx: 0, bossesBeaten: 0, rushDone: false, winT: 0, skin: (store.get('chii_shop_v1', {}).eq || {})[selChar] || null,
      ally: { ok: false, cd: 0, t: 0, a: [{ x: 0, y: 0, cd: 0 }, { x: 0, y: 0, cd: 0, jump: null }] },
      dash: null, stomp: null, pendingCheer: false, cheerT: 0,
      level: 1, xp: 0, need: needXp(1),
      enemies: [], shots: [], bubbles: [], gems: [], herbs: [], parts: [], nums: [],
      swing: null, kills: 0, spawnAcc: 0, herbT: T.HERB_FIRST,
      boss: null, pendingBossQuiz: false,
      streak: 0, trauma: 0, zp: 0, hitstop: 0, shT: 0, kickX: 0, kickY: 0, hurtFlash: 0, puffs: [],
      xpBump: 0, killBump: 0, healGlow: 0, pickChain: 0, pickT: 0,
      cam: { x: 0, y: 0 },
      sched: newSched(rng), stats: new Q.Stats(),
      cardOpts: [], cardsAt: 0, qaInv: false, dmgBy: {},
    };
    for (let i = 0; i < 6; i++) spawnEnemy('slime');
  }

  // ---------- 계산 도우미 ----------
  const area = () => 1 + 0.12 * (G.subs.wind || 0);
  const cntB = () => Math.ceil((G.subs.acorn || 0) / 2);
  const spd = () => T.SPEED * CHARS[G.char].speed * (1 + 0.08 * (G.subs.shoes || 0)) * (G.car.t > 0 ? 1.5 : 1) * (G.hx && G.hx.kani && G.hx.kani.t > 0 ? 1.25 : 1);
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
  function spawnEnemy(type, pos) {
    const D = ETYPE[type], p = pos || ringPos(), s = 1 + G.clock / 260;
    const e = { type, x: p.x, y: p.y, px: p.x, py: p.y, r: D.r, hp: D.hp * s * DIFF[G.mode].ehp, max: D.hp * s * DIFF[G.mode].ehp, spd: D.spd, dmg: D.dmg, xp: D.xp,
      flash: 0, kx: 0, ky: 0, slow: 0, st: type === 'hopper' ? 'wait' : type === 'burrow' ? 'under' : 'move', stT: 0.3 + G.rng() * 0.8,
      cd: 1 + G.rng() * 2, dx: 0, dy: 0, face: 1, ph: G.rng() * TAU, under: type === 'burrow' };
    if (type === 'swoop') e.stT = 1.5 + G.rng();
    G.enemies.push(e);
    return e;
  }
  function pickType() {
    const alive = {};
    for (const e of G.enemies) alive[e.type] = (alive[e.type] || 0) + 1;
    const list = SPAWN.filter((o) => !(QA_NONEW && o.nw) && !(o.only && o.only !== G.mode) && G.clock >= o.from && G.bossesBeaten >= (o.after || 0) && !(o.ally && G.ally.ok) && !(o.cap && alive[o.t] >= o.cap));
    const wOf = (o) => o.w * (o.nw && G.mode === 'normal' ? 0.25 : 1); // 새 몬스터는 노말에서 1/4만 (봇: 끄면 6/16승, 절반이면 1/16승)
    let r = G.rng() * list.reduce((a, o) => a + wOf(o), 0);
    for (const o of list) { r -= wOf(o); if (r <= 0) return o.t; }
    return 'slime';
  }
  function spawnBoss(B) {
    G.bossIdx++;
    const P = G.player, a0 = G.rng() * TAU, p = { x: P.x + Math.cos(a0) * B.arena * 0.6, y: P.y + Math.sin(a0) * B.arena * 0.6 };
    const e = { type: 'boss', kind: B.kind, name: B.name, art: B.art, final: !!B.final, x: p.x, y: p.y, px: p.x, py: p.y, r: B.r, hp: B.hp * D().bhp, max: B.hp * D().bhp, spd: B.spd, dmg: B.dmg, xp: 0,
      flash: 0, kx: 0, ky: 0, slow: 0, st: 'chase', stT: 2.5, dx: 0, dy: 0, face: 1, ph: 0, quizDone: false, pat: 0, enr: false, hp2: (B.hp2 || 0) * D().bhp };
    G.enemies.push(e); G.boss = e;
    // 보스 울타리: 지금 서 있는 곳을 가운데로 둥글게 막아요. 울타리 밖 몬스터는 밖으로 밀려나요.
    G.arena = { x: P.x, y: P.y, r: B.arena + 400, tr: B.arena, base: B.arena };
    for (const o of G.enemies) if (o !== e && Math.hypot(o.x - P.x, o.y - P.y) > B.arena - 30) o.dead = true;
    G.gems.forEach((g) => { g.pull = true; });
    banner(B.final ? '마지막 보스! ' + B.name : `${G.bossIdx}라운드 보스 등장! ${B.name}`);
    Snd.play('boss'); addTrauma(B.final ? 0.9 : 0.5);
    if (B.final) { fx({ k: 'ring', x: e.x, y: e.y, r: 260, col: '#6b4fa0', w: 14, life: 0.8 }); G.zp = 0.12; }
    if (!seen.boss) { toast('보스전 동안은 시계가 멈춰요. 빨간 줄이 보이면 비켜요!', 4500); markSeen('boss'); }
  }
  // 사건: ring = 사방을 빙 둘러싸고 조여 오기 (틈 하나), herd = 한쪽에서 떼로 달려오기
  function runEvent(ev) {
    const P = G.player;
    if (ev.k === 'ring') {
      const gap = G.rng() * TAU, R = viewR() * 0.85;
      for (let i = 0; i < Math.round(ev.n * D().ev); i++) {
        const a = gap + 0.5 + (i / ev.n) * (TAU - 0.9);
        const e = spawnEnemy(ev.t, { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R });
        puff(e.x, e.y - 10, 22, '#ffffff');
      }
    } else {
      const a = G.rng() * TAU;
      for (let i = 0; i < Math.round(ev.n * D().ev); i++) {
        const b = a + (G.rng() - 0.5) * 0.7, R = viewR() * (0.9 + G.rng() * 0.25);
        spawnEnemy(ev.t, { x: P.x + Math.cos(b) * R, y: P.y + Math.sin(b) * R });
      }
    }
    banner(ev.msg); Snd.play('warn'); addTrauma(0.25);
  }
  // 덫 고리: 플레이어 둘레에 경고 원을 빙 둘러 놓고 (틈 한 곳), 점점 안쪽으로 조여요
  function cageAt(x, y, col, dmg, rings, gapW) {
    for (let k = 0; k < rings; k++) {
      const R = 170 - k * 62, n = Math.max(6, Math.round(TAU * R / 64)), gap = G.rng() * TAU;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n, dg = Math.atan2(Math.sin(a - gap), Math.cos(a - gap));
        if (Math.abs(dg) < gapW) continue;
        warnAt(x + Math.cos(a) * R, y + Math.sin(a) * R, 38, 1.1 + k * 0.55, dmg, col);
      }
    }
    warnAt(x, y, 46, 1.1 + rings * 0.55, dmg, col);
  }
  // 고리 경고: 안쪽 반지름(rin) 바깥, 울타리까지 모두 위험 (가운데로 피해요)
  function donutAt(x, y, rin, rout, dur, dmg, col) { G.warns.push({ x, y, r: rout, rin, dur, dmg, t: 0, col }); }
  // 줄 경고: (x,y)에서 a 방향으로 len 길이, 폭 w
  function lineAt(x, y, a, len, w, dur, dmg, col) { const o = { x, y, a, len, w, dur, dmg, t: 0, col, line: true, r: len }; G.warns.push(o); return o; }
  // 화려한 효과 한 줄 (고리 · 번개 · 광선 · 번쩍)
  function fx(o) { if (G.fx.length > 120) G.fx.shift(); o.t = 0; G.fx.push(o); }
  function eshot(x, y, a, v, o) {
    if (G.eshots.length > 220) return;
    G.eshots.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 7, dmg: 7, life: 4, rot: 0, k: 'orb', col: '#b07cff' }, o));
  }
  function warnAt(x, y, r, dur, dmg, col) { const o = { x, y, r, dur, dmg, t: 0, col: col || '#e8746c' }; G.warns.push(o); return o; }
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
    if (e.dead || e.under || e.air || e.inv) return;
    if (e.type === 'boss' && e.st === 'stun') dmg *= 2;
    if (G.char === 'rakko') dmg *= e.type === 'boss' ? 1.1 * 1.1 : 1.1; // 랏코 특성 '토벌 고수' (11-24 너프: 1.2 · 보스 ×1.3)
    let crit = false;
    if (G.bonus) {
      if (G.char === 'chiikawa' && G.player.hp <= G.player.max * 0.4) dmg *= 1.4; // 울보 각성
      else if (G.char === 'usagi' && G.rng() < 0.25) { dmg *= 2; crit = true; } // 우라 연타
    }
    e.hp -= dmg; e.flash = 0.08; e.sq = 1;
    if (G.vamp) { const P = G.player, k = helperOn() ? 0.02 : 0.01; P.hp = Math.min(P.max, P.hp + dmg * k); if (G.hpGhost < P.hp) G.hpGhost = P.hp; } // 흡혈 (친구 스킬 쓰는 동안 2배, 겹치지 않아요)
    const dx = e.x - fx, dy = e.y - fy, d = Math.hypot(dx, dy) || 1;
    const kbm = e.type === 'boss' ? 0.08 : e.type === 'clone' ? 0.2 : e.type === 'big' || e.type === 'charger' ? 0.5 : 1;
    e.kx += (dx / d) * kb * kbm; e.ky += (dy / d) * kb * kbm;
    addNum(e.x, e.y - e.r - 4, Math.round(dmg) + (crit ? '!' : ''), crit ? '#ffb020' : e.type === 'boss' && e.st === 'stun' ? '#ffe066' : '#fff', (e.type === 'boss' ? 20 : 15) + (crit ? 5 : 0));
    Snd.play('hit');
    if (e.type === 'boss' && !e.quizDone && e.hp > 0 && e.hp <= e.max * 0.5) { e.quizDone = true; G.pendingBossQuiz = true; }
    if (e.hp <= 0 && e.type === 'boss' && e.final && e.hp2 && !e.revived) { if (e.kind === 'dekatsuyo') transformMomonga(e); else reviveStar(e); return; }
    if (e.hp <= 0) {
      e.dead = true; G.kills++;
      Snd.play('kill');
      if (e.type === 'boss') bossDefeated(e);
      else {
        if (e.type === 'midori') for (let i = -1; i <= 1; i += 2) { const m = spawnEnemy('midori_s', { x: e.x + i * 16, y: e.y }); m.art = 'midori'; m.kx = i * 180; }
        if (e.type === 'slime' && !e.small && G.bossesBeaten >= 1) for (let i = -1; i <= 1; i += 2) { const m = spawnEnemy('slime', { x: e.x + i * 12, y: e.y }); m.small = true; m.r = 8; m.hp = m.max = m.max * 0.4; m.xp = 0; m.kx = i * 160; }
        burst(e.x, e.y, colorOf(e), e.type === 'big' ? 10 : 5); puff(e.x, e.y - e.r * 0.8, e.r * 1.6, '#ffffff'); dropGem(e.x, e.y, e.xp); G.killBump = 1; }
    }
  }
  // 검은 별똥별 1차 처치 → "future oh no~" 외치며 더 세져서 되살아나요
  function reviveStar(e) {
    e.revived = true; e.hp = 1; e.inv = true; e.st = 'revive'; e.stT = 2.6; e.air = false; e.airH = 0;
    e.name = '검은 별똥별 · 각성'; e.quizDone = true; G.pendingBossQuiz = false;
    for (const o of G.enemies) if (o.type === 'clone' && !o.dead) { o.dead = true; burst(o.x, o.y, '#3a2f4a', 10); }
    G.eshots.length = 0; G.warns.length = 0; G.pull = null;
    banner('future oh no~'); Snd.play('boss'); addTrauma(1); G.zp = 0.14; hitStop(0.25);
    fx({ k: 'flash', x: e.x, y: e.y - 40, r: 260, col: '#ffffff', life: 0.6 });
    fx({ k: 'ring', x: e.x, y: e.y - 40, r: 320, col: '#c0392b', w: 18, life: 0.9 });
    burst(e.x, e.y - 40, '#3a2f4a', 40); burst(e.x, e.y - 40, '#ffe066', 20);
    G.arena.tr = G.arena.base - 60;
    setTimeout(() => { if (G && G.boss === e) banner('검은 별똥별이 더 강해져서 돌아왔어요!'); }, 1300);
    queueHelperPick(); // 1차 처치도 보스 클리어로 쳐요
  }
  // 데카츠요 처치 → 털이 걷히고 본체 '매지컬 모몽가'가 나타나요 (흑마법)
  function transformMomonga(e) {
    e.revived = true; e.hp = 1; e.inv = true; e.st = 'revive'; e.stT = 2.8; e.air = false; e.airH = 0; e.hide = false;
    e.quizDone = true; G.pendingBossQuiz = false; G.pull = null; G.curse = 0; G.dark = 0;
    for (const o of G.enemies) if (o.minion && !o.dead) { o.dead = true; burst(o.x, o.y, '#6b4fa0', 8); }
    G.eshots.length = 0; G.warns.length = 0;
    banner('데카츠요의 정체는…?!'); Snd.play('boss'); addTrauma(1); G.zp = 0.14; hitStop(0.25);
    fx({ k: 'flash', x: e.x, y: e.y - 40, r: 280, col: '#ffffff', life: 0.7 });
    fx({ k: 'ring', x: e.x, y: e.y - 40, r: 340, col: '#7b4fd0', w: 18, life: 1 });
    burst(e.x, e.y - 40, '#ffe066', 40); burst(e.x, e.y - 40, '#7b4fd0', 30);
    G.arena.tr = G.arena.base - 40;
    queueHelperPick();
  }
  function bossDefeated(e) {
    G.boss = null; G.pendingBossQuiz = false; G.bossesBeaten++; G.arena = null; G.pull = null; G.warns.length = 0; G.curse = 0; G.dark = 0;
    burst(e.x, e.y, '#a07a5a', 40); burst(e.x, e.y, '#ffe066', 20);
    fx({ k: 'ring', x: e.x, y: e.y, r: 220, col: '#ffe066', w: 12, life: 0.7 }); fx({ k: 'flash', x: e.x, y: e.y, r: 160, col: '#fff6c8', life: 0.35 });
    for (let i = 0; i < 15; i++) dropGem(e.x + (G.rng() - 0.5) * 120, e.y + (G.rng() - 0.5) * 120, 4);
    G.gems.forEach((g) => { g.pull = true; });
    feedback('large', e.x, e.y, '#ffe066'); G.zp = 0.1;
    Snd.play('win');
    changeSkin();
    if (e.final) {
      // 마지막 보스: 남은 몬스터와 분신이 모두 펑! 잠깐 축하한 뒤 승리
      for (const o of G.enemies) if (!o.dead) { o.dead = true; burst(o.x, o.y, colorOf(o), 6); puff(o.x, o.y - o.r, o.r * 1.6, '#fff'); }
      G.eshots.length = 0; G.warns.length = 0;
      banner(lastBoss() + '을(를) 물리쳤어요!');
      G.winT = 1.8;
      return;
    }
    for (const o of G.enemies) if (o.type === 'clone' || o.type === 'fluff' || o.type === 'mermaid' || o.minion) { o.dead = true; burst(o.x, o.y, '#f0e6da', 6); }
    if (e.kind === 'nightmare') { G.vamp = true; setTimeout(() => { if (G && state === 'play') { banner('흡혈 능력! 준 피해의 1%만큼 회복해요'); toast('친구 스킬(Q·E·R)이 싸우는 동안엔 흡혈이 2배 (2%)', 4500); Snd.play('cheer'); } }, 1800); }
    banner(e.name + '을(를) 쫓아냈어요!');
    queueHelperPick(); // 축하 배너가 지나간 뒤 도와줄 친구 고르기
  }
  // 보스를 쓰러뜨릴 때마다 닮은 친구 외형으로 (무작위)
  function changeSkin() {
    if (G.skin && G.skin.startsWith('sk_')) return; // 상점에서 입은 스킨은 그대로
    const pool = (SKINS[G.char] || []).map((id) => 'skin_' + id).filter((k) => k !== G.skin);
    if (!pool.length) return;
    G.skin = pool[Math.floor(G.rng() * pool.length)];
    const P = G.player;
    fx({ k: 'flash', x: P.x, y: P.y - 20, r: 90, col: '#ffffff', life: 0.45 });
    fx({ k: 'ring', x: P.x, y: P.y - 20, r: 120, col: '#ffd23f', w: 8, life: 0.6 });
    burst(P.x, P.y - 20, '#ffd23f', 24); burst(P.x, P.y - 20, '#ffffff', 16);
    setTimeout(() => { if (G && state === 'play') { banner(CHARS[G.char].name + '의 모습이 바뀌었어요!'); Snd.play('cheer'); } }, 900);
  }
  function useAlly() {
    const A = G && G.ally;
    if (!A || !A.ok || A.cd > 0 || state !== 'play') return;
    const P = G.player;
    A.t = T.ALLY_DUR; A.cd = T.ALLY_CD;
    A.a.forEach((h, i) => { h.x = P.x + (i ? 46 : -46); h.y = P.y - 10; h.cd = 0.2; h.jump = null; fx({ k: 'ring', x: h.x, y: h.y - 16, r: 70, col: i ? '#7cc48a' : '#ffd23f', w: 8, life: 0.5 }); burst(h.x, h.y - 16, i ? '#7cc48a' : '#ffd23f', 16); });
    banner('동료 출동!'); Snd.play('cheer'); addTrauma(0.25);
  }
  // 섬아저씨 (Q): 하늘에서 쿵 떨어져 주변을 날려 버리고, 5초 동안 손바닥 밀치기
  function useSumo() {
    const S = G && G.sumo;
    if (!S || !S.ok || S.cd > 0 || state !== 'play') return;
    const P = G.player;
    S.cd = T.SUMO_CD; S.t = T.SUMO_DUR + 0.55; S.x = P.x + 40; S.y = P.y - 10; S.drop = 0.55; S.tick = 0.6;
    warnAt(S.x, S.y, 170, 0.55, 0, '#e0a830');
    banner('섬아저씨 출동!'); Snd.play('dash', 0.6);
  }
  function useCar() {
    const C = G && G.car;
    if (!C || !C.ok || C.cd > 0 || C.t > 0 || state !== 'play') return;
    const P = G.player;
    C.t = T.CAR_DUR; C.cd = T.CAR_CD;
    puff(P.x, P.y - 20, 60, '#ffffff'); burst(P.x, P.y - 20, '#bfe0ff', 18); fx({ k: 'ring', x: P.x, y: P.y - 20, r: 80, col: '#8cc4f0', w: 8, life: 0.5 });
    banner(VEH[G.char].name + ' 출발! 빠르고 단단해요'); Snd.play('dash', 0.8); addTrauma(0.2);
  }
  function updCar(dt) {
    const C = G.car; if (!C.ok) return;
    C.cd = Math.max(0, C.cd - dt); // 쿨타임은 탈 때부터 30초 (섬아저씨·동료와 같아요)
    if (C.t > 0) { C.t -= dt; if (C.t <= 0) { const P = G.player; puff(P.x, P.y - 20, 60, '#ffffff'); burst(P.x, P.y - 20, '#bfe0ff', 12); toast(VEH[G.char].name + '에서 내렸어요', 1500); } }
  }
  function updSumo(dt) {
    const S = G.sumo, P = G.player;
    if (!S.ok) return;
    S.cd = Math.max(0, S.cd - dt);
    if (S.t <= 0) return;
    S.t -= dt;
    if (S.drop > 0) {
      S.drop -= dt;
      if (S.drop <= 0) {
        // 쿵! 큰 피해 + 멀리 날리기, 보스는 잠깐 기절
        near(S.x, S.y, 220, (e) => {
          if (e.dead || (e.x - S.x) ** 2 + (e.y - S.y) ** 2 > (170 + e.r) ** 2) return;
          hurtEnemy(e, e.type === 'boss' ? 120 : 90, S.x, S.y, 520);
          if (e.type === 'boss' && !e.dead && (e.st === 'chase' || e.st === 'warn')) { e.st = 'stun'; e.stT = 1.2; }
        });
        G.eshots = G.eshots.filter((b) => (b.x - S.x) ** 2 + (b.y - S.y) ** 2 > 170 * 170);
        fx({ k: 'ring', x: S.x, y: S.y, r: 200, col: '#ffd23f', w: 16, life: 0.6 }); fx({ k: 'flash', x: S.x, y: S.y, r: 150, col: '#fff3c4', life: 0.3 });
        feedback('large', S.x, S.y, '#e0c59a'); Snd.play('stomp', 0.6);
      }
      return;
    }
    // 따라다니며 손바닥 밀치기
    const k = 1 - Math.exp(-4 * dt);
    S.x += (P.x + 44 - S.x) * k; S.y += (P.y - 6 - S.y) * k;
    S.tick -= dt;
    if (S.tick <= 0) {
      S.tick = 0.45; S.slap = 0.15;
      near(S.x, S.y, 130, (e) => { if (!e.dead && (e.x - S.x) ** 2 + (e.y - S.y) ** 2 < (95 + e.r) ** 2) hurtEnemy(e, 28, S.x, S.y, 360); });
      Snd.play('hit', 0.7);
    }
    if (S.slap > 0) S.slap -= dt;
    if (S.t <= 0) { burst(S.x, S.y - 30, '#ffffff', 14); puff(S.x, S.y - 30, 40, '#ffffff'); }
  }
  // ---------- 도와주는 친구 (보스를 쓰러뜨릴 때마다 1명 골라요 · Q → E → R 순서 · 한 판에 3명까지) ----------
  // 오데와 외계인·섬아저씨는 예전 동작 그대로, 새 친구 5팀은 G.hx[id]에 상태를 둬요.
  const HELPERS = {
    sumo: { name: '섬아저씨', short: '섬아저씨', arts: ['sumo'], col: '#e0a830', cd: () => T.SUMO_CD, desc: '하늘에서 쿵! 큰 피해로 날려 보내고 5초 동안 손바닥 밀치기 · 보스는 잠깐 기절' },
    ode: { name: '오데와 외계인', short: '오데', arts: ['ode', 'thrower'], col: '#f2c14e', cd: () => T.ALLY_CD, desc: '7초 동안 오데는 눈빛 광선, 외계인은 뛰어올라 몽둥이 쾅' },
    pajama: { name: '파자마 파티스', short: '파자마', arts: ['pj_green', 'pj_purple', 'pj_pink', 'pj_white'], col: '#c49af0', cd: () => 20, dur: 7, desc: '7초 동안 둘레에서 춤춰요 · 노래 음표가 적을 쫓고, 춤에 홀린 적은 느려져요 · 마지막에 피날레 쾅' },
    kuri: { name: '쿠리만쥬와 시사', short: '쿠리·시사', arts: ['kuri', 'shisa'], col: '#e89a5a', cd: () => 22, dur: 6, desc: '쿠리만쥬가 음료를 나눠 체력 회복(약 34), 시사는 만쥬를 던져 펑 터뜨려요' },
    armor: { name: '갑옷씨들', short: '갑옷씨들', arts: ['armor_silver', 'armor_bronze', 'armor_gold'], col: '#9aa3ad', cd: () => 24, dur: 8, desc: '은갑옷은 방패로 탄을 막고 받는 피해 -40% · 동갑옷은 돌진 베기 · 금갑옷은 땅 내려찍기' },
    yogurt: { name: '꿀맛맨', short: '꿀맛맨', arts: ['yogurt'], col: '#7cc6d8', cd: () => 20, dur: 7, desc: '하늘을 날며 요거트를 쏴요 · 떨어진 곳에 끈적한 요거트 웅덩이(느려지고 계속 피해)' },
    kani: { name: '카니와 모몽가', short: '카니·모몽가', arts: ['kani', 'h_momonga'], col: '#f08fa0', cd: () => 20, dur: 7, desc: '카니는 옆걸음으로 붙어 집게로 싹둑(보스 먼저) · 모몽가는 활공해 급강하 · 그동안 이동 속도 +25%' },
  };
  const SLOT_KEYS = ['Q', 'E', 'R'], SLOT_PAD = ['Y', 'X', 'LB'];
  const hState = (id) => id === 'sumo' ? G.sumo : id === 'ode' ? G.ally : G.hx[id];
  const helperOn = () => G.slots.some((id) => hState(id).t > 0);
  function useSlot(i) {
    const id = G && G.slots[i];
    if (!id || state !== 'play') return;
    if (id === 'sumo') return useSumo();
    if (id === 'ode') return useAlly();
    const S = G.hx[id], H = HELPERS[id];
    if (S.cd > 0 || S.t > 0) return;
    S.t = H.dur; S.cd = H.cd(); S.tick = 0; S.a = 0;
    const P = G.player;
    S.m = H.arts.map((_, k) => ({ x: P.x + Math.cos(k * TAU / H.arts.length) * 60, y: P.y + Math.sin(k * TAU / H.arts.length) * 40, cd: 0.3 + k * 0.15, hop: 0 }));
    S.m.forEach((m) => { puff(m.x, m.y - 16, 30, '#ffffff'); burst(m.x, m.y - 16, H.col, 10); });
    fx({ k: 'ring', x: P.x, y: P.y - 16, r: 110, col: H.col, w: 8, life: 0.5 });
    if (id === 'kuri') heal(10);
    if (id === 'kani') P.inv = Math.max(P.inv, 1.2); // 모몽가 활공으로 휙! 잠깐 무적
    banner(H.name + ' 출동!'); Snd.play('cheer'); addTrauma(0.2);
  }
  function addHelper(id) {
    if (G.slots.includes(id) || G.slots.length >= 3) return;
    G.slots.push(id);
    if (id === 'sumo') { G.sumo.ok = true; G.sumo.cd = 0; }
    else if (id === 'ode') { G.ally.ok = true; G.ally.cd = 0; }
    else G.hx[id] = { ok: true, cd: 0, t: 0, tick: 0, m: [], a: 0 };
    const i = G.slots.length - 1;
    banner(HELPERS[id].name + ' 합류!');
    toast(usingTouch ? '오른쪽 아래 ' + HELPERS[id].name + ' 버튼을 누르면 도와줘요' : SLOT_KEYS[i] + ' 키(게임패드 ' + SLOT_PAD[i] + ')를 누르면 ' + HELPERS[id].name + '이(가) 도와줘요', 5000);
    Snd.play('cheer');
  }
  // 보스를 쓰러뜨리면 1.7초 뒤 친구 고르기 (자리가 남았을 때만)
  function queueHelperPick() {
    if (G.slots.length + G.pickN >= 3) return;
    G.pickN++; if (!G.pickAt) G.pickAt = G.t + 1.7;
  }
  function openHelpers() {
    const o = Object.keys(HELPERS).filter((id) => !G.slots.includes(id)).map((k) => ({ kind: 'h', k }));
    if (!o.length) { G.pickN = 0; return; }
    setState('cards');
    G.cardOpts = o; G.cardsAt = performance.now();
    $('cardsTitle').innerHTML = ico('sparkle') + '도와줄 친구를 골라요 · ' + SLOT_KEYS[G.slots.length] + ' 스킬';
    const list = $('cardList'); list.innerHTML = ''; list.classList.add('helpers'); $('cardsPanel').style.maxWidth = '980px';
    o.forEach((c, i) => {
      const H = HELPERS[c.k], b = document.createElement('button');
      b.className = 'card k-friend'; b.style.animationDelay = i * 40 + 'ms';
      b.innerHTML = `<span class="kind">${SLOT_KEYS[G.slots.length]} 스킬</span><div class="ic hic">${H.arts.map((a) => `<img src="art/${ART_FILES[a]}" alt="">`).join('')}</div><div class="nm">${H.name}</div><div class="ds">${H.desc}</div><div class="k">다시 부르기 ${H.cd()}초</div>`;
      b.addEventListener('click', () => pickCard(i));
      list.appendChild(b);
    });
    Snd.play('card'); show('cards');
  }
  // 요거트 웅덩이 · 날아가는 음표/만쥬/요거트
  function updHelpers(dt) {
    const P = G.player;
    if (G.pickAt && G.t >= G.pickAt && G.pickN > 0) { G.pickN--; G.pickAt = G.pickN ? G.t + 1.2 : 0; openHelpers(); return; }
    for (const id in G.hx) {
      const S = G.hx[id];
      S.cd = Math.max(0, S.cd - dt);
      if (S.t <= 0) continue;
      S.t -= dt; S.a += dt;
      const k = 1 - Math.exp(-5 * dt);
      if (id === 'pajama') {
        // 춤: 플레이어 둘레를 돌며 통통, 음표는 가까운 적을 쫓아가요
        S.m.forEach((m, i) => {
          const a = S.a * 2.4 + i * TAU / 4; m.x += (P.x + Math.cos(a) * 78 - m.x) * k * 2; m.y += (P.y + Math.sin(a) * 52 - m.y) * k * 2; m.hop = Math.abs(Math.sin(S.a * 9 + i)) * 10;
          m.cd -= dt;
          if (m.cd <= 0) { const t = nearestN(m.x, m.y, 380, 1)[0]; m.cd = t ? 0.6 : 0.2; if (t) G.hshots.push({ k: 'note', x: m.x, y: m.y - 30, tg: t, v: 330, dmg: 16, col: ['#7cc48a', '#b08ae0', '#f08fa0', '#a8b8c8'][i], life: 2 }); }
        });
        near(P.x, P.y, 190, (e) => { if (!e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 150 * 150) e.slow = Math.max(e.slow, e.type === 'boss' ? 0.05 : 0.2); });
        if (S.t <= 0) { boomAt(P.x, P.y, 170, 50, '#c49af0'); banner('파자마 파티스 피날레!'); }
      } else if (id === 'kuri') {
        // 쿠리만쥬: 곁에서 음료 건배(회복) · 시사: 만쥬를 포물선으로 던져요
        const [ku, si] = S.m;
        ku.x += (P.x - 46 - ku.x) * k; ku.y += (P.y - 8 - ku.y) * k; si.x += (P.x + 46 - si.x) * k; si.y += (P.y - 8 - si.y) * k;
        S.tick -= dt;
        if (S.tick <= 0) { S.tick = 1.5; heal(6); fx({ k: 'ring', x: P.x, y: P.y - 16, r: 40, col: '#ffe0a0', w: 4, life: 0.4 }); burst(ku.x + 14, ku.y - 40, '#8fd0ff', 5); }
        si.cd -= dt;
        if (si.cd <= 0) { const c = nearestN(si.x, si.y, 420, 4), t = c[Math.floor(G.rng() * c.length)]; si.cd = t ? 0.7 : 0.2; if (t) G.hshots.push({ k: 'bun', x: si.x, y: si.y - 30, x0: si.x, y0: si.y - 30, x1: t.x, y1: t.y, q: 0, dur: 0.55, dmg: 34, r: 72, col: '#e8a860' }); }
      } else if (id === 'armor') {
        const [sv, br, gd] = S.m;
        // 은갑옷: 플레이어 앞을 돌며 방패 · 가까운 적 탄을 지워요
        const sa = S.a * 3; sv.x += (P.x + Math.cos(sa) * 50 - sv.x) * k * 2; sv.y += (P.y + Math.sin(sa) * 36 - sv.y) * k * 2;
        G.eshots = G.eshots.filter((b) => { const hit = (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < 95 * 95; if (hit) burst(b.x, b.y, '#d8dee6', 3); return !hit; });
        // 동갑옷: 가까운 적에게 돌진하며 베기 (지나가는 길의 적 모두)
        if (br.dash) {
          const D = br.dash; D.t += dt; const q = Math.min(1, D.t / 0.3); const px = br.x, py = br.y;
          br.x = D.x0 + (D.x1 - D.x0) * q; br.y = D.y0 + (D.y1 - D.y0) * q;
          near(br.x, br.y, 80, (e) => { if (!e.dead && !D.hit.has(e) && (e.x - br.x) ** 2 + (e.y - br.y) ** 2 < (40 + e.r) ** 2) { D.hit.add(e); hurtEnemy(e, 32, px, py, 260); } });
          if (q >= 1) { br.dash = null; fx({ k: 'ring', x: br.x, y: br.y - 10, r: 50, col: '#b08a6a', w: 5, life: 0.25 }); }
        } else {
          br.x += (P.x - 56 - br.x) * k; br.y += (P.y + 10 - br.y) * k; br.cd -= dt;
          if (br.cd <= 0) { const t = nearestN(br.x, br.y, 320, 1)[0]; br.cd = t ? 1.1 : 0.2; if (t) { const a = Math.atan2(t.y - br.y, t.x - br.x); br.dash = { t: 0, x0: br.x, y0: br.y, x1: br.x + Math.cos(a) * 260, y1: br.y + Math.sin(a) * 260, hit: new Set() }; Snd.play('dash', 1.3); } }
        }
        // 금갑옷: 적 무리 곁으로 뛰어가 땅 내려찍기
        gd.cd -= dt;
        const tg = nearestN(gd.x, gd.y, 300, 1)[0];
        const gx = tg ? tg.x - 40 : P.x + 56, gy = tg ? tg.y : P.y + 10; gd.x += (gx - gd.x) * k * 0.8; gd.y += (gy - gd.y) * k * 0.8;
        if (gd.cd <= 0 && tg) { gd.cd = 1.6; gd.slam = 0.2; boomAt(gd.x + 30, gd.y, 110, 40, '#d8c060'); addTrauma(0.15); }
        if (gd.slam > 0) gd.slam -= dt;
      } else if (id === 'yogurt') {
        // 꿀맛맨: 위에서 날며 요거트 발사 → 떨어진 곳에 웅덩이
        const [y0] = S.m; y0.x += (P.x + 20 - y0.x) * k; y0.y += (P.y - 70 - y0.y) * k; y0.hop = Math.sin(S.a * 4) * 6;
        y0.cd -= dt;
        if (y0.cd <= 0) { const c = nearestN(P.x, P.y, 460, 6), t = c[Math.floor(G.rng() * c.length)]; y0.cd = t ? 0.8 : 0.2; if (t) { G.hshots.push({ k: 'yog', x: y0.x, y: y0.y - 40, x0: y0.x, y0: y0.y - 40, x1: t.x, y1: t.y, q: 0, dur: 0.5, dmg: 18, r: 70, col: '#ffffff' }); Snd.play('bubble', 0.8); } }
      } else if (id === 'kani') {
        // 카니: 옆걸음(좌우로 흔들) · 가장 센 적(보스 먼저)에게 붙어 집게로 싹둑
        const [ka, mo] = S.m;
        const c = nearestN(P.x, P.y, 420, 8), t = c.find((e) => e.type === 'boss') || c.sort((a, b) => b.hp - a.hp)[0];
        const tx = t ? t.x + (t.x > P.x ? -t.r - 20 : t.r + 20) : P.x - 50, ty = t ? t.y : P.y;
        ka.x += (tx + Math.sin(S.a * 14) * 10 - ka.x) * k * 1.6; ka.y += (ty - ka.y) * k * 1.6;
        ka.cd -= dt;
        if (t && ka.cd <= 0 && (t.x - ka.x) ** 2 + (t.y - ka.y) ** 2 < (t.r + 50) ** 2) { ka.cd = 0.35; ka.snip = 0.12; hurtEnemy(t, 22, ka.x, ka.y, 40); burst(t.x, t.y - t.r, '#f08fa0', 4); Snd.play('hit', 1.4); }
        if (ka.snip > 0) ka.snip -= dt;
        // 모몽가: 하늘을 빙글 활공하다 급강하
        if (mo.dive) {
          const D = mo.dive; D.t += dt; const q = Math.min(1, D.t / 0.35);
          mo.x = D.x0 + (D.x1 - D.x0) * q; mo.y = D.y0 + (D.y1 - D.y0) * q; mo.hop = (1 - q) * 90;
          if (q >= 1) { mo.dive = null; boomAt(mo.x, mo.y, 60, 36, '#bfe0ff'); }
        } else {
          const a = S.a * 2.2; mo.x += (P.x + Math.cos(a) * 140 - mo.x) * k; mo.y += (P.y + Math.sin(a) * 90 - mo.y) * k; mo.hop = 70;
          mo.cd -= dt;
          if (mo.cd <= 0) { const d = nearestN(mo.x, mo.y, 380, 5), tt = d[Math.floor(G.rng() * d.length)]; mo.cd = tt ? 1.3 : 0.2; if (tt) mo.dive = { t: 0, x0: mo.x, y0: mo.y, x1: tt.x, y1: tt.y }; }
        }
      }
      if (S.t <= 0) S.m.forEach((m) => { burst(m.x, m.y - 16, '#ffffff', 8); puff(m.x, m.y - 16, 30, '#ffffff'); });
    }
    // 날아가는 것들
    for (const s of G.hshots) {
      if (s.k === 'note') {
        s.life -= dt;
        if (s.tg.dead) { s.life = 0; continue; }
        const dx = s.tg.x - s.x, dy = s.tg.y - s.tg.r - s.y, d = Math.hypot(dx, dy) || 1;
        s.x += dx / d * s.v * dt; s.y += dy / d * s.v * dt;
        if (d < s.tg.r + 10) { hurtEnemy(s.tg, s.dmg, s.x, s.y, 60); burst(s.x, s.y, s.col, 4); s.life = 0; }
      } else {
        s.q += dt / s.dur;
        s.x = s.x0 + (s.x1 - s.x0) * s.q; s.y = s.y0 + (s.y1 - s.y0) * s.q - Math.sin(Math.min(1, s.q) * Math.PI) * 90;
        if (s.q >= 1) {
          s.life = 0;
          if (s.k === 'bun') boomAt(s.x1, s.y1, s.r, s.dmg, s.col);
          else { near(s.x1, s.y1, s.r + 30, (e) => { if (!e.dead && (e.x - s.x1) ** 2 + (e.y - s.y1) ** 2 < (s.r + e.r) ** 2) hurtEnemy(e, s.dmg, s.x1, s.y1, 30); }); G.puddles.push({ x: s.x1, y: s.y1, r: s.r, t: 4, tick: 0 }); puff(s.x1, s.y1 - 6, 30, '#ffffff'); }
        }
      }
    }
    G.hshots = G.hshots.filter((s) => s.life == null ? s.q < 1 : s.life > 0);
    for (const p of G.puddles) {
      p.t -= dt; p.tick -= dt; const tick = p.tick <= 0; if (tick) p.tick = 0.4;
      near(p.x, p.y, p.r + 30, (e) => { if (!e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (p.r + e.r) ** 2) { e.slow = Math.max(e.slow, 0.15); if (tick) hurtEnemy(e, 8, p.x, p.y, 0); } });
    }
    G.puddles = G.puddles.filter((p) => p.t > 0);
  }
  function drawHelpers(t) {
    for (const p of G.puddles) { ctx.globalAlpha = Math.min(1, p.t) * 0.75; ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const id in G.hx) {
      const S = G.hx[id], H = HELPERS[id];
      if (S.t <= 0) continue;
      const fade = Math.min(1, S.t / 0.4);
      S.m.forEach((m, i) => {
        const spr = ART[H.arts[i]]; if (!spr) return;
        const big = id === 'armor' ? 50 : id === 'yogurt' ? 52 : 42, h = big * (m.slam > 0 || m.snip > 0 ? 1.12 : 1), w = h * spr.width / spr.height, y = m.y - (m.hop || 0);
        ctx.globalAlpha = 0.35 * fade; ctx.drawImage(shadow, m.x - 16, m.y - 5, 32, 10);
        ctx.globalAlpha = fade; ctx.drawImage(spr, m.x - w / 2, y - h, w, h);
      });
      if (id === 'armor' && S.m[0]) { ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = '#d8dee6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(G.player.x, G.player.y - 14, 95, 0, TAU); ctx.stroke(); }
      if (id === 'pajama') { ctx.globalAlpha = 0.18 * fade; ctx.fillStyle = '#c49af0'; ctx.beginPath(); ctx.ellipse(G.player.x, G.player.y, 150, 100, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    for (const s of G.hshots) {
      if (s.k === 'note') { ctx.fillStyle = s.col; ctx.font = '22px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♪', s.x, s.y + 8); }
      else if (s.k === 'bun') { ctx.fillStyle = '#e8a860'; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(s.x - 4, s.y - 2, 8, 3); }
      else { ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c8d8e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, 11, 9, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
  }
  // 친구 버튼 (오른쪽 아래 한 줄 · 쿨타임 동안 회색 부채꼴)
  // 좁은 화면(폰 가로)에선 R을 E 위에 쌓아 아래 가운데 안내 글과 겹치지 않게
  const slotBtn = (i) => VW < 900 && i === 2 ? { x: VW - 58 - safe.r - 108, y: VH - 64 - safe.b - 112, r: 40 } : { x: VW - 58 - safe.r - i * 108, y: VH - 64 - safe.b, r: 40 };
  function drawSlotBtns(t) {
    G.slots.forEach((id, i) => {
      const H = HELPERS[id], S = hState(id), b = slotBtn(i), on = S.t > 0, ready = !on && S.cd <= 0, cdMax = H.cd();
      ctx.globalAlpha = 0.92; ctx.fillStyle = ready ? '#fff4c8' : on ? '#f3ecff' : '#e9e1d8'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = ready || on ? H.col : '#bcae9f'; ctx.stroke();
      const n = Math.min(H.arts.length, 3), sz = n === 1 ? 50 : n === 2 ? 34 : 26;
      for (let k = 0; k < n; k++) { const spr = ART[H.arts[k]]; if (!spr) continue; const h = sz, w = Math.min(sz, h * spr.width / spr.height), hh = w * spr.height / spr.width; ctx.drawImage(spr, b.x - (n * sz) / 2 + k * sz + (sz - w) / 2, b.y - hh / 2 - 2, w, hh); }
      if (!ready && !on) { ctx.globalAlpha = 0.55; ctx.fillStyle = '#4a3b35'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * (S.cd / cdMax)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = fs(20); ctx.textAlign = 'center'; ctx.fillText(Math.ceil(S.cd), b.x, b.y + 7); }
      else if (ready) { const p = 1 + Math.sin(t * 6) * 0.06; ctx.globalAlpha = 0.6; ctx.strokeStyle = H.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * p + 4, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4a3b35'; ctx.font = fs(14); ctx.textAlign = 'center';
      ctx.fillText(usingTouch ? H.short : H.short + ' [' + SLOT_KEYS[i] + ']', b.x, b.y + b.r + 16);
    });
  }
  function hurtPlayer(dmg, src) {
    const P = G.player;
    if (G.qaInv || P.inv > 0) return;
    const m = G.char === 'chiikawa' && P.hp <= P.max * 0.4 ? 0.7 : 1; // 치이카와 특성 '버티기'
    dmg *= D().dmg * (G.car.t > 0 ? 0.8 : 1) * (G.hx.armor && G.hx.armor.t > 0 ? 0.6 : 1) * (G.boss && G.boss.rage ? 1.25 : 1); // 자동차·자전거 방어 +20% · 은갑옷 방패 -40% · 레이지 세이렌 +25%
    P.hp -= dmg * m; P.inv = 0.6;
    const by = src ? (src.type || src.k || 'warn') : '?'; G.dmgBy[by] = (G.dmgBy[by] || 0) + Math.round(dmg * m); // 밸런스 확인용 P.hurtT = 0.2; G.ghostHold = 0.3;
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
  const ECOL = { fluff: '#f0e6da', slime: '#b5d67a', hopper: '#f6b3c4', big: '#ffd84a', swoop: '#ffffff', burrow: '#a0704a', thrower: '#9ccf6e', spitter: '#ffd84a', charger: '#e8574c', clone: '#5a4a6a', stag: '#b5384f', mace: '#f6b8d0', grab: '#f6c9a8', mermaid: '#ff8a80', bee: '#ffd84a', pinkele: '#ffc4d4', yamanba: '#8a9a6a', snake: '#ffffff', centipede: '#e89a9a', fugu: '#6a9ad0', chushi: '#ffe066', cream: '#fff4c8', antlion: '#6a7080', piman: '#ffe066', soy: '#f4c890', imomushi: '#ffffff', midori: '#e8f8d8', midori_s: '#e8f8d8', pinkbug: '#f0b8e0', tonakai: '#a08060' };
  const colorOf = (e) => ECOL[e.type] || '#ff8a8a';

  // ---------- 한 단계 (1/60초) ----------
  function update(dt) {
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    const P = G.player;
    G.t += dt;
    if (G.winT > 0) { G.winT -= dt; updFx(dt); if (G.winT <= 0) endRun(true); return; }
    if (!G.boss) G.clock = Math.min(T.RUN, G.clock + dt);
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

    const NB = bossList()[G.bossIdx];
    if (NB && !G.boss && G.clock >= NB.at) spawnBoss(NB);
    if (!G.rushDone && !G.boss && G.clock >= T.RUSH_AT) {
      G.rushDone = true; banner('몬스터 대습격! 밤이 됐어요'); Snd.play('warn'); addTrauma(0.4);
      for (let i = 0; i < 36; i++) spawnEnemy(pickType());
    }
    // 판 중간 사건 (보스전 중엔 미뤄요)
    const EV = EVENTS[G.evIdx];
    if (EV && !G.boss && G.clock >= EV.at) {
      G.evIdx++;
      if ((EV.only && EV.only !== G.mode) || EV.skip === G.mode) { /* 다른 모드 사건 */ } else {
      const need = (SPAWN.find((s) => s.t === EV.t) || {}).after || 0;
      if (G.bossesBeaten >= need && !(QA_NONEW && ['centipede', 'snake', 'tonakai'].includes(EV.t))) runEvent(EV);
      }
    }
    // 지역: 보스를 쓰러뜨릴 때마다 다음 지역, 대습격부터 별밤
    const bt = G.bossesBeaten >= 2 && G.rushDone ? 3 : Math.min(2, G.bossesBeaten);
    if (bt !== G.biome) { G.biome = bt; G.biomeT = 1; toast(BIOMES[bt].name + '에 들어왔어요', 2500); }
    if (G.biomeT > 0) G.biomeT = Math.max(0, G.biomeT - dt / 1.5);
    // 보스 울타리: 천천히 목표 크기로
    const A = G.arena;
    if (A) A.r += (A.tr - A.r) * (1 - Math.exp(-2.5 * dt));

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
    if (G.botMv) { mx = G.botMv.x; my = G.botMv.y; } // QA 밸런스 봇 전용 (?qa=1)
    if (G.curse > 0) { G.curse -= dt; mx = -mx; my = -my; } // 모몽가의 거꾸로 저주
    if (G.dark > 0) G.dark -= dt;
    const ml = Math.hypot(mx, my);
    P.moving = ml > 0.02;
    if (P.moving) { P.fx = mx / ml; P.fy = my / ml; if (!seen.move) { markSeen('move'); hideToast(); } }
    const slowK = (G.pull ? 0.45 : 1) * (P.stunT > 0 ? 0 : P.slowT > 0 ? 0.55 : 1); // 돌뱀 돌 눈빛 = 못 움직임 · 크림/중지 = 느려짐
    P.x += mx * spd() * slowK * dt; P.y += my * spd() * slowK * dt;
    // 긴팔·세이렌 노래에 붙잡히면 끌려가요
    if (G.pull) {
      const pl = G.pull; pl.t -= dt;
      const dx = pl.x - P.x, dy = pl.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (d > 30) { P.x += dx / d * pl.v * dt; P.y += dy / d * pl.v * dt; }
      if (pl.src && pl.src.dead) pl.t = 0;
      if (pl.src) { pl.x = pl.src.x; pl.y = pl.src.y; }
      if (pl.t <= 0) G.pull = null;
    }
    // 보스 울타리 밖으로는 못 나가요
    if (G.arena) {
      const A = G.arena, dx = P.x - A.x, dy = P.y - A.y, d = Math.hypot(dx, dy) || 1, lim = A.r - P.r - 4;
      if (d > lim) { P.x = A.x + dx / d * lim; P.y = A.y + dy / d * lim; if (Math.random() < 0.15) burst(P.x, P.y - 6, BIOMES[G.biome].fence, 2); }
    }
    P.inv -= dt; P.hurtT -= dt; P.stunT = (P.stunT || 0) - dt; P.slowT = (P.slowT || 0) - dt;
    if (P.hp < G.hpGhost) { G.ghostHold -= dt; if (G.ghostHold <= 0) G.hpGhost = Math.max(P.hp, G.hpGhost - 60 * dt); } else G.hpGhost = P.hp;

    // 몬스터 생성
    // 초반부터 북적이게: 1.6마리/초에서 시작해 6마리/초까지
    const rate = Math.min(6, 1.6 + 0.008 * G.clock) * (G.boss ? 0.15 : 1) * D().spawn;
    G.spawnAcc += rate * dt;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1;
      if (G.enemies.length >= T.MAX_ENEMY) continue;
      spawnEnemy(pickType());
    }

    buildGrid();
    updWeapons(dt);
    updEnemies(dt);
    if (state !== 'play') return; // 쓰러짐
    updShots(dt);
    updBubbles(dt);
    updEShots(dt); if (state !== 'play') return;
    updWarns(dt); if (state !== 'play') return;
    updGrabs(dt); if (state !== 'play') return;
    updItems(dt);
    updAlly(dt);
    updSumo(dt); updCar(dt);
    updHelpers(dt); if (state !== 'play') return;
    if (G.bonus && G.char === 'hachiware' && P.hp > 0) P.hp = Math.min(P.max, P.hp + 0.4 * dt); // 긍정 에너지
    updFx(dt);
    G.enemies = G.enemies.filter((e) => !e.dead);
    updGems(dt);
    updHerbs(dt);
    for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-5 * dt); p.vy *= Math.exp(-5 * dt); }
    G.parts = G.parts.filter((p) => p.t < p.life);
    for (const n of G.nums) n.t += dt;
    G.nums = G.nums.filter((n) => n.t < 0.75);

    // 테스트 모드: 문제 없이 바로 카드 고르기 (보스 문제는 건너뛰어요)
    if (G.pendingBossQuiz && G.boss) { G.pendingBossQuiz = false; if (!G.test) { openQuiz('boss'); return; } }
    if (G.xp >= G.need) { G.xp -= G.need; G.level++; G.need = needXp(G.level); if (G.test) openCards(3); else openQuiz('level'); }
  }

  function nearestN(x, y, r, n) {
    const out = [];
    const r2 = r * r;
    for (const e of G.enemies) {
      if (e.dead || e.under || e.air) continue;
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
    // 풀베기 낫 (Lv.5 진화: 회오리가 1초 동안 남아 계속 베어요)
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
        const tip = s.a0 + TAU * p;
        if (Math.random() < 0.7) G.parts.push({ x: P.x + Math.cos(tip) * R, y: P.y - 10 + Math.sin(tip) * R, vx: -Math.sin(tip) * 90, vy: Math.cos(tip) * 90, t: 0, life: 0.4, col: Math.random() < 0.5 ? '#9be07a' : '#e8ffd0', r: 2.5 });
        if (p >= 1) { G.swing = null; if (ls >= 5) G.whirl = { t: 0, life: 1.0, tick: 0, R: R * 1.15, dmg: dmg * 0.45 }; }
      }
    }
    if (G.whirl) {
      const w = G.whirl; w.t += dt; w.tick -= dt;
      if (w.tick <= 0) { w.tick = 0.25; near(P.x, P.y, w.R + 50, (e) => { if (!e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < (w.R + e.r) ** 2) hurtEnemy(e, w.dmg, P.x, P.y, 60); }); }
      if (w.t >= w.life) G.whirl = null;
    }
    // 새총 (Lv.5 진화: 맞으면 터져요)
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
          G.shots.push({ x: P.x, y: P.y - 10, px: P.x, py: P.y - 10, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, life: 1.1, dmg: 12 + 3 * (lg - 1), pierce: lg >= 4 ? 1 : 0, hit: new Set(), r: 5, boom: lg >= 5 });
        }
        Snd.play('shoot');
      } else G.wcd.sling = 0.2;
    }
    // 비눗방울 (Lv.5 진화: 사라질 때 크게 터져요)
    const lb = G.weapons.bubble;
    if (lb && G.wcd.bubble <= 0) {
      G.wcd.bubble = 3.2 - 0.25 * (lb - 1);
      const n = Math.min(4, 1 + cntB());
      const cand = G.enemies.filter((e) => !e.dead && !e.under && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 320 * 320);
      for (let i = 0; i < n; i++) {
        let tx, ty;
        if (cand.length) { const c = cand[Math.floor(G.rng() * cand.length)]; tx = c.x; ty = c.y; }
        else { const a = G.rng() * TAU; tx = P.x + Math.cos(a) * 90; ty = P.y + Math.sin(a) * 90; }
        G.bubbles.push({ x: tx, y: ty, t: 0, life: 2.6, maxR: (42 + 5 * lb) * area(), tick: 0, dmg: 4 + 2 * (lb - 1), pop: lb >= 5 });
      }
      Snd.play('bubble');
    }
    // 검: 바라보는 쪽 부채꼴(140도)을 한 번에 베기 (Lv.5 진화: 검기가 날아가요)
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
      if (lw >= 5) G.shots.push({ x: P.x, y: P.y - 12, px: P.x, py: P.y - 12, vx: Math.cos(a0) * 480, vy: Math.sin(a0) * 480, life: 0.55, dmg: dmgS * 0.7, pierce: 99, hit: new Set(), r: 26, wave: true, a: a0 });
      Snd.play('swing', 0.8);
    }
    if (G.slash) { G.slash.t += dt; if (G.slash.t > 0.16) G.slash = null; }
    // 몽둥이: 움직이는 중엔 돌진, 멈춰 있으면 제자리 쿵 (Lv.5 진화: 충격파)
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
          if (lc >= 5) G.waves.push({ x: P.x, y: P.y, R0: R, R1: R * 2.2, t: 0, dur: 0.35, dmg: dmgC * 0.8, hit: new Set(), col: '#f2c14e' });
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
        if (d.t >= d.dur) {
          G.dash = null; burst(P.x, P.y, '#e8dcc8', 6);
          if (lc >= 5) G.waves.push({ x: P.x, y: P.y, R0: 20, R1: 110 * area(), t: 0, dur: 0.3, dmg: dmgC * 0.8, hit: new Set(), col: '#f2c14e' });
        }
      }
    }
    if (G.stomp) { G.stomp.t += dt; if (G.stomp.t > 0.3) G.stomp = null; }
    // 번개 구슬: 가장 가까운 적부터 번개가 튀어요 (Lv.5 진화: 감전돼 느려짐)
    const lz = G.weapons.zap;
    if (lz && G.wcd.zap <= 0) {
      const first = nearestN(P.x, P.y, 380, 1)[0];
      if (!first) G.wcd.zap = 0.2;
      else {
        G.wcd.zap = 1.6 - 0.1 * (lz - 1);
        const dmg = 18 + 5 * (lz - 1), hit = new Set(), pts = [{ x: P.x, y: P.y - 22 }];
        let cur = first;
        for (let i = 0; i <= 2 + Math.floor(lz / 2) && cur; i++) {
          hit.add(cur); pts.push({ x: cur.x, y: cur.y - cur.r });
          hurtEnemy(cur, dmg, cur.x, cur.y - 1, 30);
          if (lz >= 5) cur.slow = 1.2;
          let best = null, bd = 150 * 150;
          near(cur.x, cur.y, 150, (o) => { if (o.dead || o.under || hit.has(o)) return; const d2 = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d2 < bd) { bd = d2; best = o; } });
          cur = best;
        }
        fx({ k: 'bolt', pts, col: '#9fd8ff', life: 0.22 });
        for (const q of pts.slice(1)) fx({ k: 'flash', x: q.x, y: q.y, r: 22, col: '#e6f6ff', life: 0.15 });
        Snd.play('shoot', 1.7);
      }
    }
    // 부메랑 숟가락: 날아갔다가 돌아오며 베기 (Lv.5 진화: 불꽃 숟가락)
    const lm = G.weapons.boom;
    if (lm && G.wcd.boom <= 0) {
      G.wcd.boom = 2.2 - 0.15 * (lm - 1);
      const n = 1 + (lm >= 3 ? 1 : 0) + cntB(), t0 = nearestN(P.x, P.y, 400, 1)[0];
      const base = t0 ? Math.atan2(t0.y - P.y, t0.x - P.x) : Math.atan2(P.fy, P.fx);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.5;
        G.booms.push({ x: P.x, y: P.y - 12, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, t: 0, back: false, hit: new Set(), dmg: 15 + 4 * (lm - 1), r: lm >= 5 ? 26 : 16, fire: lm >= 5, rot: 0 });
      }
      Snd.play('swing', 1.3);
    }
    for (const b of G.booms) {
      b.t += dt; b.rot += dt * 18;
      if (!b.back) { b.vx *= Math.exp(-2.6 * dt); b.vy *= Math.exp(-2.6 * dt); if (b.t > 0.5) { b.back = true; b.hit.clear(); } }
      else { const dx = P.x - b.x, dy = P.y - 12 - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * 620; b.vy = dy / d * 620; if (d < 24) b.done = true; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.fire && Math.random() < 0.8) G.parts.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, t: 0, life: 0.45, col: Math.random() < 0.5 ? '#ff9f43' : '#ffe066', r: 3 });
      near(b.x, b.y, b.r + 40, (e) => { if (!e.dead && !b.hit.has(e) && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) { b.hit.add(e); hurtEnemy(e, b.dmg, b.x, b.y, 120); } });
      if (b.t > 2.5) b.done = true;
    }
    G.booms = G.booms.filter((b) => !b.done);
    // 꽃폭탄: 발밑에 심고, 적이 밟으면 펑 (Lv.5 진화: 꽃잎 폭탄 4개 더)
    const lf = G.weapons.mine;
    if (lf && G.wcd.mine <= 0) {
      G.wcd.mine = 2.6 - 0.18 * (lf - 1);
      if (G.mines.length >= 5 + lf) G.mines.shift();
      G.mines.push({ x: P.x + (G.rng() - 0.5) * 30, y: P.y + (G.rng() - 0.5) * 30, t: 0 });
    }
    for (const m of G.mines) {
      m.t += dt;
      let go = m.t > 7;
      if (m.t > 0.4 && !go) near(m.x, m.y, 60, (e) => { if (!e.dead && !e.under && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (e.r + 30) ** 2) go = true; });
      if (go) {
        m.done = true;
        const R = (64 + 6 * lf) * area(), dmg = 28 + 8 * (lf - 1);
        boomAt(m.x, m.y, R, dmg, '#ff8fb1');
        if (lf >= 5) for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; setTimeout(() => { if (G && state === 'play') boomAt(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R, R * 0.6, dmg * 0.6, '#ffd1dc'); }, 140); }
      }
    }
    G.mines = G.mines.filter((m) => !m.done);
    // 새우튀김 (하치와레): 화면 끝에서 튕기며 날아다녀요
    const lt = G.weapons.it_tempura;
    if (lt && G.wcd.it_tempura <= 0) {
      const t0 = nearestN(P.x, P.y, 420, 1)[0];
      if (!t0) G.wcd.it_tempura = 0.2;
      else {
        G.wcd.it_tempura = 3.2 - 0.2 * (lt - 1);
        const n = lt >= 3 ? 2 : 1, a = Math.atan2(t0.y - P.y, t0.x - P.x);
        for (let i = 0; i < n; i++) { const b = a + i * Math.PI * 0.6; G.items.push({ k: 'it_tempura', x: P.x, y: P.y - 14, vx: Math.cos(b) * 430, vy: Math.sin(b) * 430, life: lt >= 5 ? 4 : 2.5, rot: 0, dmg: 12 + 4 * (lt - 1), pop: lt >= 5 }); }
        Snd.play('swing', 1.4);
      }
    }
    // 쌍둥이 로켓 (우사기): 적을 쫓아가 터져요
    const lk = G.weapons.it_rocket;
    if (lk && G.wcd.it_rocket <= 0) {
      const tg = nearestN(P.x, P.y, 460, 4);
      if (!tg.length) G.wcd.it_rocket = 0.2;
      else {
        G.wcd.it_rocket = 2.4 - 0.15 * (lk - 1);
        const n = lk >= 5 ? 4 : lk >= 3 ? 3 : 2;
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.6; G.items.push({ k: 'it_rocket', x: P.x, y: P.y - 18, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, tgt: tg[i % tg.length], life: 2.6, rot: a, dmg: 18 + 5 * (lk - 1), cluster: lk >= 5 }); }
        Snd.play('dash', 1.5);
      }
    }
    // 팽이: 적 무리 쪽으로 던지면 빙글빙글 돌며 빨아들여요
    const lp = G.weapons.top;
    if (lp && G.wcd.top <= 0) {
      const tg = nearestN(P.x, P.y, 380, 6);
      if (!tg.length) G.wcd.top = 0.2;
      else {
        G.wcd.top = 4 - 0.25 * (lp - 1);
        const n = lp >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) { const c = tg[(i * 3) % tg.length]; G.tops.push({ x: P.x, y: P.y - 10, tx: c.x, ty: c.y, t: 0, life: 3, tick: 0, dmg: 6 + 2 * (lp - 1), R: 120 * area(), pop: lp >= 5, rot: 0 }); }
        Snd.play('swing', 0.9);
      }
    }
    // 토벌봉 던지기 (캐릭터마다 다름)
    const rk = 'rod_' + G.char, lr = G.weapons[rk];
    if (lr && G.wcd[rk] <= 0) throwRod(rk, lr);
    updRods(dt);
    // 퍼지는 충격파 (몽둥이 진화)
    for (const w of G.waves) {
      w.t += dt;
      const R = w.R0 + (w.R1 - w.R0) * Math.min(1, w.t / w.dur);
      near(w.x, w.y, R + 40, (e) => { if (!e.dead && !w.hit.has(e) && (e.x - w.x) ** 2 + (e.y - w.y) ** 2 < (R + e.r) ** 2) { w.hit.add(e); hurtEnemy(e, w.dmg, w.x, w.y, 180); } });
    }
    G.waves = G.waves.filter((w) => w.t < w.dur);
  }
  function throwRod(k, l) {
    const P = G.player, t0 = nearestN(P.x, P.y, 420, 1)[0];
    if (!t0) { G.wcd[k] = 0.2; return; }
    const a = Math.atan2(t0.y - P.y, t0.x - P.x);
    if (k === 'rod_rakko') {
      // 해달의 칼: 빙글빙글 날아가 모두 베고 돌아와요 (돌아올 때도 베요)
      G.wcd[k] = 1.6 - 0.1 * (l - 1);
      const n = l >= 3 ? 2 : 1; // 11-24 너프: 5레벨 3자루 → 2자루, 피해 40+12 → 30+8
      for (let i = 0; i < n; i++) { const b = a + (i - (n - 1) / 2) * 0.5; G.rods.push({ k, x: P.x, y: P.y - 14, vx: Math.cos(b) * 620, vy: Math.sin(b) * 620, rot: 0, t: 0, back: false, hit: new Set(), dmg: 30 + 8 * (l - 1), ring: l >= 5 }); }
    } else if (k === 'rod_chiikawa') {
      // 분홍: 맞으면 가까운 다른 적에게 튕겨요
      G.wcd[k] = 1.8 - 0.12 * (l - 1);
      G.rods.push({ k, x: P.x, y: P.y - 14, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, rot: 0, life: 1.2, hit: new Set(), left: l >= 5 ? 6 : 2 + Math.floor(l / 2), dmg: 20 + 5 * (l - 1), pop: l >= 5 });
    } else if (k === 'rod_hachiware') {
      // 파랑: 부채꼴로 여러 개, 꿰뚫고 날아가요
      G.wcd[k] = 1.5 - 0.1 * (l - 1);
      const n = l >= 5 ? 5 : l >= 3 ? 4 : 3;
      for (let i = 0; i < n; i++) { const b = a + (i - (n - 1) / 2) * 0.22; G.rods.push({ k, x: P.x, y: P.y - 14, vx: Math.cos(b) * 560, vy: Math.sin(b) * 560, rot: 0, life: 0.75, hit: new Set(), pierce: l >= 5 ? 99 : 2, dmg: 14 + 4 * (l - 1) }); }
    } else {
      // 노랑: 적이 가장 많은 쪽으로 높이 던져 쿵
      G.wcd[k] = 2.4 - 0.15 * (l - 1);
      const tg = nearestN(P.x, P.y, 360, 8);
      for (let i = 0; i < (l >= 5 ? 2 : 1); i++) {
        const c = tg[i * 3] || t0, R = (70 + 4 * l) * area();
        G.rods.push({ k, x0: P.x, y0: P.y - 14, x1: c.x, y1: c.y, x: P.x, y: P.y, t: 0, dur: 0.6, rot: 0, R, dmg: 35 + 10 * (l - 1), wave: l >= 5, h: 0 });
      }
    }
    Snd.play('swing', 1.15);
  }
  function updRods(dt) {
    for (const r of G.rods) {
      r.rot += dt * 16;
      if (r.k === 'rod_rakko') {
        const P = G.player; r.t += dt;
        if (!r.back) { r.vx *= Math.exp(-2.4 * dt); r.vy *= Math.exp(-2.4 * dt); if (r.t > 0.5) { r.back = true; r.hit.clear(); } }
        else { const dx = P.x - r.x, dy = P.y - 14 - r.y, d = Math.hypot(dx, dy) || 1; r.vx = dx / d * 700; r.vy = dy / d * 700; if (d < 26) { r.done = true; if (r.ring) G.waves.push({ x: P.x, y: P.y, R0: 30, R1: 160 * area(), t: 0, dur: 0.3, dmg: r.dmg * 0.6, hit: new Set(), col: '#cfd8e6' }); } }
        r.x += r.vx * dt; r.y += r.vy * dt;
        if (Math.random() < 0.7) G.parts.push({ x: r.x, y: r.y, vx: 0, vy: 0, t: 0, life: 0.25, col: '#e6ecf5', r: 3 });
        near(r.x, r.y, 70, (e) => { if (!e.dead && !e.under && !r.hit.has(e) && (e.x - r.x) ** 2 + (e.y - r.y) ** 2 < (e.r + 26) ** 2) { r.hit.add(e); hurtEnemy(e, r.dmg, r.x, r.y, 160); } });
        if (r.t > 3) r.done = true;
        continue;
      }
      if (r.k === 'rod_usagi') {
        r.t += dt; const q = Math.min(1, r.t / r.dur);
        r.x = r.x0 + (r.x1 - r.x0) * q; r.y = r.y0 + (r.y1 - r.y0) * q; r.h = Math.sin(q * Math.PI) * 140;
        if (q >= 1) {
          r.done = true;
          boomAt(r.x1, r.y1, r.R, r.dmg, '#ffe066'); addTrauma(0.2); kick(0, -1, 3);
          fx({ k: 'ring', x: r.x1, y: r.y1, r: r.R * 1.3, col: '#fff3a0', w: 10, life: 0.45 });
          if (r.wave) G.waves.push({ x: r.x1, y: r.y1, R0: r.R, R1: r.R * 2.2, t: 0, dur: 0.35, dmg: r.dmg * 0.5, hit: new Set(), col: '#ffd84a' });
        }
        continue;
      }
      r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt;
      if (Math.random() < 0.5) G.parts.push({ x: r.x, y: r.y, vx: 0, vy: 0, t: 0, life: 0.25, col: r.k === 'rod_chiikawa' ? '#ffb3c6' : '#a8d4ff', r: 3 });
      near(r.x, r.y, 60, (e) => {
        if (r.life <= 0 || e.dead || e.under || r.hit.has(e)) return;
        if ((e.x - r.x) ** 2 + (e.y - r.y) ** 2 > (e.r + 14) ** 2) return;
        r.hit.add(e); hurtEnemy(e, r.dmg, r.x - r.vx * 0.05, r.y - r.vy * 0.05, 130);
        fx({ k: 'flash', x: e.x, y: e.y - e.r, r: 26, col: r.k === 'rod_chiikawa' ? '#ffd1dc' : '#d6ecff', life: 0.15 });
        if (r.k === 'rod_chiikawa') {
          if (r.pop) boomAt(e.x, e.y, 40, r.dmg * 0.4, '#ff8fb1');
          if (--r.left < 0) { r.life = 0; return; }
          let best = null, bd = 220 * 220;
          for (const o of G.enemies) { if (o.dead || o.under || r.hit.has(o)) continue; const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (d2 < bd) { bd = d2; best = o; } }
          if (!best) { r.life = 0; return; }
          const a = Math.atan2(best.y - r.y, best.x - r.x); r.vx = Math.cos(a) * 560; r.vy = Math.sin(a) * 560; r.life = 0.8;
        } else if (--r.pierce < 0) r.life = 0;
      });
    }
    G.rods = G.rods.filter((r) => !r.done && (r.k === 'rod_usagi' || r.k === 'rod_rakko' || r.life > 0));
  }
  // 범위 폭발 (꽃폭탄 · 폭발 도토리 · 비눗방울 터짐)
  function boomAt(x, y, R, dmg, col) {
    near(x, y, R + 40, (e) => { if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 < (R + e.r) ** 2) hurtEnemy(e, dmg, x, y, 160); });
    fx({ k: 'flash', x, y, r: R * 0.9, col: '#fff3c4', life: 0.18 });
    fx({ k: 'ring', x, y, r: R, col, w: 7, life: 0.35 });
    burst(x, y, col, 10); addTrauma(0.08);
    Snd.play('stomp', 1.4);
  }

  function updEnemies(dt) {
    const P = G.player, VR = viewR();
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.px = e.x; e.py = e.y;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      const sf = e.slow > 0 ? 0.6 : 1;
      e.slow -= dt; e.flash -= dt; e.ph += dt; if (e.sq) e.sq = Math.max(0, e.sq - dt * 7);
      const chase = (v) => { e.x += (dx / d) * v * sf * dt; e.y += (dy / d) * v * sf * dt; };
      e.stT -= dt; e.cd -= dt;
      if (e.type === 'hopper') {
        if (e.st === 'move') {
          if (e.stT <= 0) { e.st = 'wait'; e.stT = 0.8; }
          else { e.x += e.dx * e.spd * sf * dt; e.y += e.dy * e.spd * sf * dt; }
        } else if (e.stT <= 0) { e.st = 'move'; e.stT = 0.3; e.dx = dx / d; e.dy = dy / d; }
      } else if (e.type === 'swoop') {
        // 플레이어 둘레를 빙빙 돌다가 잠깐 멈칫(조준) → 일직선 급강하
        if (e.st === 'move') {
          const radial = Math.max(-1, Math.min(1, (d - 150) / 60));
          let vx = (dx / d) * radial - (dy / d) * 0.9, vy = (dy / d) * radial + (dx / d) * 0.9;
          const l = Math.hypot(vx, vy) || 1;
          e.x += vx / l * e.spd * sf * dt; e.y += vy / l * e.spd * sf * dt;
          if (e.stT <= 0 && d < 280) { e.st = 'aim'; e.stT = 0.6; e.dx = dx / d; e.dy = dy / d; }
        } else if (e.st === 'aim') { if (e.stT <= 0) { e.st = 'dive'; e.stT = 0.55; } }
        else { e.x += e.dx * 300 * sf * dt; e.y += e.dy * 300 * sf * dt; if (e.stT <= 0) { e.st = 'move'; e.stT = 2.5 + G.rng() * 1.5; } }
      } else if (e.type === 'burrow') {
        // 땅속(안 맞음)으로 다가와 → 빨간 원 경고 → 튀어나오며 쾅 → 잠깐 걷다가 다시 숨기
        if (e.st === 'under') { chase(e.spd); if (d < 70) { e.st = 'rise'; e.stT = 0.7; warnAt(e.x, e.y, 50, 0.7, 8, '#a0704a'); } }
        else if (e.st === 'rise') { if (e.stT <= 0) { e.st = 'up'; e.under = false; e.stT = 3.5; burst(e.x, e.y, '#a0704a', 12); e.sq = 1; } }
        else { chase(40); if (e.stT <= 0) { e.st = 'under'; e.under = true; burst(e.x, e.y, '#a0704a', 8); } }
      } else if (e.type === 'thrower') {
        // 거리 220쯤 유지, 팔을 들면(!) 0.5초 뒤 몽둥이 던지기
        if (e.st === 'wind') { if (e.stT <= 0) { e.st = 'move'; e.cd = 3.6; eshot(e.x, e.y - 20, Math.atan2(dy, dx), 210, { k: 'club', r: 9, dmg: 6, col: '#8a5a3b' }); } }
        else {
          const k = d > 250 ? 1 : d < 180 ? -1 : 0;
          if (k) chase(e.spd * k); else { e.x += (-dy / d) * e.spd * 0.6 * dt; e.y += (dx / d) * e.spd * 0.6 * dt; }
          if (e.cd <= 0 && d < 420) { e.st = 'wind'; e.stT = 0.6; }
        }
      } else if (e.type === 'spitter') {
        // 눈이 빛나면(0.7초) 3갈래 보라 탄
        if (e.st === 'glow') { if (e.stT <= 0) { e.st = 'move'; e.cd = 3.2; const a = Math.atan2(dy, dx); for (let i = -1; i <= 1; i++) eshot(e.x, e.y - 22, a + i * 0.3, 150, { dmg: 5 }); } }
        else { if (d > 200) chase(e.spd); if (e.cd <= 0 && d < 400) { e.st = 'glow'; e.stT = 0.7; } }
      } else if (e.type === 'charger') {
        // 경고선(0.8초) → 돌진 (380px/초 × 0.55초)
        if (e.st === 'warn') { if (e.stT <= 0) { e.st = 'charge'; e.stT = 0.55; burst(e.x, e.y, '#e8574c', 6); } }
        else if (e.st === 'charge') { e.x += e.dx * 380 * dt; e.y += e.dy * 380 * dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 3.5; } }
        else { chase(e.spd); if (e.cd <= 0 && d < 280) { e.st = 'warn'; e.stT = 0.8; e.dx = dx / d; e.dy = dy / d; e.chg = 380; e.chgT = 0.55; Snd.play('warn'); } }
      } else if (e.type === 'mermaid') {
        // 인어: 세이렌 곁을 헤엄치다 다가와요. 하드 모드에서만 특수 공격 (조준선 물줄기 · 물방울 부채)
        const B = G.boss;
        if (e.st === 'aim') { if (e.stT <= 0) { e.st = 'move'; e.cd = (G.mode === 'extreme' ? 2.3 : 3.4) * (B && B.rage ? 0.65 : 1); } }
        else {
          if (B && d > 140) { const ox = B.x + Math.cos(e.ph * 1.6 + e.side * Math.PI) * 120 - e.x, oy = B.y + Math.sin(e.ph * 1.6 + e.side * Math.PI) * 90 - e.y, ol = Math.hypot(ox, oy) || 1; e.x += (ox / ol * 0.5 + dx / d * 0.5) * e.spd * sf * dt; e.y += (oy / ol * 0.5 + dy / d * 0.5) * e.spd * sf * dt; }
          else chase(e.spd);
          if (G.mode !== 'normal' && e.cd <= 0 && d < 420) {
            e.alt = !e.alt;
            if (e.alt) { e.st = 'aim'; e.stT = 0.9; const a = Math.atan2(dy, dx); lineAt(e.x, e.y - 16, a, 460, 34, 0.85, 15, '#4aa8d8'); Snd.play('warn'); }
            else { e.cd = (G.mode === 'extreme' ? 2.1 : 3) * (B && B.rage ? 0.65 : 1); const a = Math.atan2(dy, dx); for (let i = -2; i <= (G.mode === 'extreme' ? 3 : 2); i++) eshot(e.x, e.y - 20, a + i * 0.22, 160, { k: 'orb', r: 8, dmg: 10, col: '#7fd3ff' }); Snd.play('bubble', 1.2); }
          }
        }
      } else if (e.type === 'bee') {
        // 꿀벌: 지그재그로 다가오다 멈칫(!) → 침 돌진
        if (e.st === 'aim') { if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.4; } }
        else if (e.st === 'dash') { e.x += e.dx * 430 * dt; e.y += e.dy * 430 * dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 2.6 + G.rng(); } }
        else {
          const w = Math.sin(e.ph * 9) * 0.9, ux = dx / d, uy = dy / d;
          e.x += (ux - uy * w) * e.spd * sf * dt; e.y += (uy + ux * w) * e.spd * sf * dt;
          if (e.cd <= 0 && d < 230) { e.st = 'aim'; e.stT = 0.45; e.dx = ux; e.dy = uy; }
        }
      } else if (e.type === 'pinkele') {
        // 분홍 코끼리: 거리를 두고 코를 들어(!) → 물폭탄 3개가 떨어질 곳에 원
        if (e.st === 'wind') {
          if (e.stT <= 0) {
            e.st = 'move'; e.cd = 4.2; e.sq = 1;
            warnAt(P.x, P.y, 46, 1.0, 9, '#ff8fb1');
            for (let i = 0; i < 2; i++) { const a = G.rng() * TAU, r = 70 + G.rng() * 60; warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 46, 1.0 + 0.2 * i, 9, '#ff8fb1'); }
            Snd.play('bubble', 0.8);
          }
        } else {
          const k = d > 280 ? 1 : d < 180 ? -0.7 : 0;
          if (k) chase(e.spd * k);
          if (e.cd <= 0 && d < 380) { e.st = 'wind'; e.stT = 0.8; }
        }
      } else if (e.type === 'stag') {
        // 집게투구: 다가오다 멈춰 집게를 들고(!) → 땅을 찍으면 플레이어 쪽으로 가시 줄이 차례로 솟아요
        if (e.st === 'wind') {
          if (e.stT <= 0) {
            e.st = 'move'; e.cd = 4.2; e.sq = 1; addTrauma(0.08);
            for (let i = 1; i <= 6; i++) warnAt(e.x + e.dx * i * 46, e.y + e.dy * i * 46, 26, 0.35 + i * 0.12, 8, '#b5384f');
          }
        } else { chase(e.spd); if (e.cd <= 0 && d < 300) { e.st = 'wind'; e.stT = 0.6; e.dx = dx / d; e.dy = dy / d; } }
      } else if (e.type === 'mace') {
        // 쇠공 토끼: 가까우면 쇠공을 빙빙 (붉은 고리 경고 뒤 1.4초 회전 공격), 멀면 큰 쇠공을 굴려요
        if (e.st === 'spinwarn') { if (e.stT <= 0) { e.st = 'spin'; e.stT = 1.4; e.tick = 0; } }
        else if (e.st === 'spin') {
          e.tick -= dt; chase(e.spd * 0.6);
          if (e.tick <= 0) { e.tick = 0.15; burst(e.x + Math.cos(e.ph * 14) * 70, e.y + Math.sin(e.ph * 14) * 50, '#5a5560', 2); }
          if (d < 70 + P.r) { hurtPlayer(9, e); if (state !== 'play') return; }
          if (e.stT <= 0) { e.st = 'move'; e.cd = 3.5; }
        } else if (e.st === 'wind') { if (e.stT <= 0) { e.st = 'move'; e.cd = 3.8; eshot(e.x, e.y - 14, Math.atan2(dy, dx), 170, { k: 'ball', r: 14, dmg: 7, col: '#4a4550', life: 3.5 }); } }
        else {
          chase(e.spd);
          if (e.cd <= 0 && d < 130) { e.st = 'spinwarn'; e.stT = 0.7; warnAt(e.x, e.y, 70, 0.7, 0, '#e8574c'); }
          else if (e.cd <= 0 && d < 380) { e.st = 'wind'; e.stT = 0.55; }
        }
      } else if (e.type === 'grab') {
        // 긴팔 털뭉치: 조준선(!) → 팔을 쭉 뻗어요. 맞으면 1.2초 동안 끌려가고 느려져요.
        if (e.st === 'aim') {
          if (e.stT <= 0) {
            e.st = 'arm'; e.stT = 0.35; e.armT = 0;
            G.grabs.push({ e, x: e.x, y: e.y - 18, a: Math.atan2(e.dy, e.dx), len: 0, max: 300, t: 0, hit: false });
          }
        } else if (e.st === 'arm') { if (e.stT <= 0) { e.st = 'move'; e.cd = 4; } }
        else {
          const k = d > 260 ? 1 : d < 160 ? -0.6 : 0;
          if (k) chase(e.spd * k);
          if (e.cd <= 0 && d < 300) { e.st = 'aim'; e.stT = 0.65; e.dx = dx / d; e.dy = dy / d; }
        }
      } else if (e.type === 'yamanba') {
        // 산할머니: 연기 속으로 사라졌다가(!) 플레이어 옆에 나타나 지팡이로 쾅
        if (e.st === 'gone') { if (e.stT <= 0) { const a = G.rng() * TAU; e.x = P.x + Math.cos(a) * 90; e.y = P.y + Math.sin(a) * 90; e.hide = false; e.inv = false; e.st = 'wind'; e.stT = 0.7; warnAt(e.x, e.y, 75, 0.7, 10, '#7a8a5a'); puff(e.x, e.y - 14, 34, '#ffffff'); } }
        else if (e.st === 'wind') { if (e.stT <= 0) { e.st = 'move'; e.cd = 4.5; e.sq = 1; } }
        else { chase(e.spd); if (e.cd <= 0 && d < 380) { e.st = 'gone'; e.stT = 0.9; e.hide = true; e.inv = true; puff(e.x, e.y - 14, 34, '#ffffff'); } }
      } else if (e.type === 'snake') {
        // 하얀 돌뱀: 똬리를 틀고(!) → 돌 눈빛 줄. 맞으면 분홍 돌이 되어 1.3초 못 움직여요
        if (e.st === 'aim') { if (e.stT <= 0) { e.st = 'move'; e.cd = 4.8; } }
        else { const k = d > 240 ? 1 : d < 150 ? -0.6 : 0; if (k) chase(e.spd * k); if (e.cd <= 0 && d < 360) { e.st = 'aim'; e.stT = 0.95; const w = lineAt(e.x, e.y - 20, Math.atan2(dy, dx), 420, 30, 0.9, 6, '#ff8fc8'); w.stun = 1.3; Snd.play('warn'); } }
      } else if (e.type === 'centipede') {
        // 분홍 지네: 꾸물꾸물 다가오다 가까우면 다다닥 질주 (0.6초)
        if (e.st === 'run') { e.x += e.dx * 260 * sf * dt; e.y += e.dy * 260 * sf * dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 2.8; } }
        else { const w = Math.sin(e.ph * 6) * 0.6, ux = dx / d, uy = dy / d; e.x += (ux - uy * w) * e.spd * sf * dt; e.y += (uy + ux * w) * e.spd * sf * dt; if (e.cd <= 0 && d < 220) { e.st = 'run'; e.stT = 0.6; e.dx = ux; e.dy = uy; } }
      } else if (e.type === 'fugu') {
        // 복어: 부풀어 오르면(!) 가시 8개가 사방으로
        if (e.st === 'wind') { e.sq = 0; if (e.stT <= 0) { e.st = 'move'; e.cd = 4; for (let i = 0; i < 8; i++) eshot(e.x, e.y - 16, i * TAU / 8 + e.ph, 150, { k: 'orb', r: 6, dmg: 6, col: '#5b8ac0' }); Snd.play('bubble', 1.4); } }
        else { chase(e.spd); if (e.cd <= 0 && d < 260) { e.st = 'wind'; e.stT = 0.8; } }
      } else if (e.type === 'chushi') {
        // '중지입니다': "중지!" 외치며 둘레 원(!) → 원 안에 있으면 2초 느려져요
        if (e.st === 'wind') { if (e.stT <= 0) { e.st = 'move'; e.cd = 5; } }
        else { chase(e.spd); if (e.cd <= 0 && d < 200) { e.st = 'wind'; e.stT = 0.9; e.say = '중지입니다'; e.sayUntil = G.t + 1.4; const w = warnAt(e.x, e.y, 140, 0.9, 4, '#e8c040'); w.slow = 2; } }
      } else if (e.type === 'cream') {
        // 생크림 괴물: 크림 3덩이를 던져요 (맞으면 미끌미끌 느려짐)
        if (e.st === 'wind') { if (e.stT <= 0) { e.st = 'move'; e.cd = 4.2; for (let i = 0; i < 3; i++) { const a = G.rng() * TAU, r = i ? 50 + G.rng() * 60 : 0; const w = warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 42, 1 + i * 0.15, 6, '#f5e6b8'); w.slow = 1.5; } } }
        else { const k = d > 260 ? 1 : d < 170 ? -0.6 : 0; if (k) chase(e.spd * k); if (e.cd <= 0 && d < 380) { e.st = 'wind'; e.stT = 0.6; } }
      } else if (e.type === 'antlion') {
        // 개미귀신: 모래 구덩이(!) → 1.2초 동안 끌려가요
        chase(e.spd);
        if (e.cd <= 0 && d < 230 && !G.pull) { e.cd = 5.5; G.pull = { x: e.x, y: e.y, v: 95, t: 1.2, src: e }; fx({ k: 'ring', x: e.x, y: e.y, r: 230, col: '#c9a76a', w: 10, life: 0.6 }); burst(e.x, e.y, '#c9a76a', 12); Snd.play('warn'); }
      } else if (e.type === 'piman') {
        // 피망 괴물: 플레이어 자리에 원(!) → 펄쩍 뛰어 덮쳐요
        if (e.st === 'jump') { const k = 1 - e.stT / 0.8; e.x = e.jx + (e.tx - e.jx) * k; e.y = e.jy + (e.ty - e.jy) * k; e.airH = Math.sin(k * Math.PI) * 120; if (e.stT <= 0) { e.st = 'move'; e.cd = 4; e.air = false; e.airH = 0; e.sq = 1; addTrauma(0.1); } }
        else { chase(e.spd); if (e.cd <= 0 && d < 300) { e.st = 'jump'; e.stT = 0.8; e.air = true; e.jx = e.x; e.jy = e.y; e.tx = P.x; e.ty = P.y; warnAt(P.x, P.y, 60, 0.8, 10, '#5aa84a'); } }
      } else if (e.type === 'soy') {
        // 간장 액체: 지나간 자리에 간장 웅덩이 (4초, 밟으면 따끔)
        chase(e.spd);
        if (e.cd <= 0) { e.cd = 0.9; if (G.epud.length < 40) G.epud.push({ x: e.x, y: e.y, r: 26, t: 4 }); }
      } else if (e.type === 'imomushi' || e.type === 'tonakai') {
        // 하얀 애벌레: 몸을 말아 데굴데굴 / 순록: 뿔 돌진 뒤 선물 상자가 펑
        const T2 = e.type === 'tonakai';
        if (e.st === 'warn') { if (e.stT <= 0) { e.st = 'charge'; e.stT = T2 ? 0.5 : 0.8; } }
        else if (e.st === 'charge') { const v = T2 ? 420 : 300; e.x += e.dx * v * dt; e.y += e.dy * v * dt; if (e.stT <= 0) { e.st = 'move'; e.cd = 3.8; if (T2) warnAt(e.x, e.y, 60, 1.2, 9, '#d43c3c'); } }
        else { chase(e.spd); if (e.cd <= 0 && d < 280) { e.st = 'warn'; e.stT = 0.7; e.dx = dx / d; e.dy = dy / d; e.chg = T2 ? 420 : 300; e.chgT = T2 ? 0.5 : 0.8; Snd.play('warn'); } }
      } else if (e.type === 'pinkbug') {
        // 분홍 세발 벌레: 세 발로 플레이어 둘레에 삼각형 알 폭탄
        chase(e.spd);
        if (e.cd <= 0 && d < 300) { e.cd = 4.2; const a0 = G.rng() * TAU; for (let i = 0; i < 3; i++) { const a = a0 + i * TAU / 3; warnAt(P.x + Math.cos(a) * 60, P.y + Math.sin(a) * 60, 44, 1.0, 7, '#e89ad8'); } }
      } else if (e.type === 'big' && G.bossesBeaten >= 1) {
        // 1보스 뒤 노랑 갈기: 가까우면 발 구르기 (경고 원)
        chase(e.spd);
        if (e.cd <= 0 && d < 110) { e.cd = 4; warnAt(e.x, e.y, 80, 0.8, 9, '#e0a830'); e.sq = 1; }
      } else if (e.type === 'clone') {
        chase(e.spd);
        if (e.cd <= 0) { e.cd = 3.5; for (let i = 0; i < 6; i++) eshot(e.x, e.y - 30, i * TAU / 6 + e.ph, 140, { k: 'star', r: 8, dmg: 8, col: '#3a2f4a' }); }
      } else if (e.type === 'boss') {
        (BOSS_UPD[e.kind] || updSiren)(e, dt, dx, dy, d, sf);
      } else {
        chase(e.spd);
      }
      e.x += e.kx * dt; e.y += e.ky * dt;
      const kd = Math.exp(-10 * dt); e.kx *= kd; e.ky *= kd;
      if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
      // 너무 멀어지면 앞쪽으로 다시 데려오기
      if (d > VR * 1.6 && e.type !== 'boss') { const p = ringPos(Math.atan2(P.fy, P.fx)); e.x = e.px = p.x; e.y = e.py = p.y; }
      // 몬스터끼리 살짝 밀어내기
      if (e.type !== 'boss' && !e.under) near(e.x, e.y, e.r + 12, (o) => {
        if (o === e || o.dead || o.type === 'boss' || o.under) return;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = e.r + o.r;
        if (od > 0 && od < min) { const push = (min - od) * 0.25; e.x += (ox / od) * push; e.y += (oy / od) * push; }
      });
      // 닿으면 피해
      const touchable = !e.under && !e.air && !e.hide && !(e.type === 'boss' && (e.st === 'stun' || e.st === 'revive'));
      if (touchable && d < e.r + P.r) { hurtPlayer(e.dmg, e); if (state !== 'play') return; }
    }
  }

  function bossWarn(e) {
    const P = G.player, dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.dx = dx / d; e.dy = dy / d; e.st = 'warn'; e.stT = e.kind === 'star' ? 0.8 : 1.0;
    e.chg = e.kind === 'star' ? 470 : 400; e.chgT = 0.6;
    Snd.play('warn');
  }
  // 세이렌 (1라운드): 음표 고리 · 연속 돌진 · 덫 고리 · 홀리는 노래(끌어당김) · 부하 소환 · 기둥 쿵. 체력 50% 아래면 무대가 좁아지고 더 빨라요.
  const SIREN_PAT = ['mermaid', 'song', 'dash', 'cage', 'charm', 'summon', 'mermaid', 'song', 'dash', 'pillars'];
  const SIREN_PAT_R = ['song', 'dash', 'duet', 'charm', 'pillars', 'mermaid', 'song', 'cage', 'dash', 'duet'];
  const SIREN_PAT_X = ['mermaid', 'song', 'duet', 'dash', 'charm', 'mermaid', 'pillars', 'duet', 'song', 'summon'];
  function updSiren(e, dt, dx, dy, d, sf) {
    const P = G.player;
    if (G.mode === 'extreme' && e.stT > 0 && e.st === 'chase') e.stT -= dt * 0.25; // 익스트림: 쉬는 틈이 짧아요
    if (!e.enr && e.hp < e.max * 0.5) {
      e.enr = true; e.spd = 80; G.arena.tr = G.arena.base - 90;
      banner('세이렌이 화났어요! 무대가 좁아져요'); addTrauma(0.5); fx({ k: 'ring', x: e.x, y: e.y, r: 220, col: '#7fd3ff', w: 14, life: 0.6 });
    }
    if (!e.rage && e.hp > 0 && e.hp <= e.max * 0.2) {
      // 레이지 모드: 빨갛게 변해 "알겠어!" 외치며 바로 음표 폭풍 → 빠르고 세고 쉬지 않아요
      e.rage = true; e.art = 'siren_rage'; e.spd = 100; e.say = '알겠어!'; e.sayUntil = G.t + 2;
      e.st = 'song'; e.waves = 4; e.stT = 0.45; e.air = false; e.airH = 0; G.pull = null;
      G.arena.tr = G.arena.base - 120;
      banner('세이렌 레이지 모드! "알겠어!"'); Snd.play('boss'); addTrauma(0.9); hitStop(0.15); G.zp = 0.12;
      fx({ k: 'flash', x: e.x, y: e.y - 40, r: 240, col: '#ff6b4a', life: 0.6 }); fx({ k: 'ring', x: e.x, y: e.y - 40, r: 300, col: '#e8372c', w: 18, life: 0.9 }); burst(e.x, e.y - 40, '#e8372c', 36);
      const alive = G.enemies.filter((o) => o.type === 'mermaid' && !o.dead).length;
      for (let i = alive; i < 2; i++) { const m = spawnEnemy('mermaid', { x: e.x + (i ? 80 : -80), y: e.y + 20 }); m.side = i; m.cd = 1 + i * 0.5; m.hp = m.max = m.max * 1.3; puff(m.x, m.y - 14, 30, '#ffb0a0'); }
      return;
    }
    if (e.rage && e.st === 'chase' && e.stT > 0) e.stT -= dt * 0.8; // 레이지: 쉬는 틈이 거의 없어요
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      const pats = e.rage ? SIREN_PAT_R : G.mode === 'extreme' ? SIREN_PAT_X : SIREN_PAT, p = pats[e.pat++ % pats.length];
      if (p === 'duet') {
        // 협공: 세이렌은 물방울 덫, 인어 둘은 동시에 조준 물줄기
        cageAt(P.x, P.y, '#4aa8d8', 13, e.enr ? 2 : 1, 0.42);
        for (const m of G.enemies) if (m.type === 'mermaid' && !m.dead) { const a = Math.atan2(P.y - m.y, P.x - m.x); lineAt(m.x, m.y - 16, a, 520, 36, 1.25, 16, '#4aa8d8'); m.st = 'aim'; m.stT = 1.3; }
        banner('세이렌과 인어의 협공! 틈과 물줄기를 함께 봐요'); Snd.play('warn'); e.st = 'chase'; e.stT = e.enr ? 2.2 : 2.6; return;
      }
      if (p === 'mermaid') {
        const alive = G.enemies.filter((o) => o.type === 'mermaid' && !o.dead).length;
        if (alive >= 2) { e.stT = 0.3; return; }
        for (let i = alive; i < 2; i++) { const m = spawnEnemy('mermaid', { x: e.x + (i ? 70 : -70), y: e.y + 20 }); m.side = i; m.cd = 2 + i; if (G.mode === 'extreme') m.hp = m.max = m.max * 1.3; fx({ k: 'ring', x: m.x, y: m.y - 20, r: 60, col: '#7fd3ff', w: 6, life: 0.5 }); burst(m.x, m.y - 20, '#bfefff', 14); }
        banner(G.mode !== 'normal' ? '인어 2마리 등장! 물줄기를 조심해요' : '세이렌이 인어 2마리를 불렀어요!'); Snd.play('boss'); e.st = 'chase'; e.stT = 1.6;
      } else if (p === 'song') { e.st = 'song'; e.waves = e.rage ? 4 : e.enr ? 3 : 2; e.stT = 0.5; banner('세이렌의 노래! 음표 틈으로 빠져요'); fx({ k: 'flash', x: e.x, y: e.y - 50, r: 90, col: '#bfefff', life: 0.4 }); }
      else if (p === 'dash') { e.rolls = e.rage ? 4 : e.enr ? 3 : 2; bossWarn(e); e.chg = 470; e.chgT = 0.5; e.stT = 0.75; }
      else if (p === 'cage') { cageAt(P.x, P.y, '#4aa8d8', 12, e.enr ? 2 : 1, 0.45); banner('물방울 덫! 틈을 찾아 나가요'); Snd.play('warn'); e.st = 'chase'; e.stT = e.enr ? 2.2 : 2.8; }
      else if (p === 'charm') { e.st = 'charm'; e.stT = 2.4; e.tick = 0; G.pull = { x: e.x, y: e.y, v: e.rage ? 105 : e.enr ? 85 : 65, t: 2.4, src: e }; banner('홀리는 노래! 끌려가지 않게 반대로 달려요'); Snd.play('boss'); }
      else if (p === 'summon') {
        const n = e.enr ? 10 : 7;
        for (let i = 0; i < n; i++) { const a = i * TAU / n, m = spawnEnemy(i % 2 ? 'hopper' : 'slime', { x: e.x + Math.cos(a) * 80, y: e.y + Math.sin(a) * 80 }); m.hp = m.max = m.max * 1.5; puff(m.x, m.y - 10, 22, '#bfefff'); }
        banner('세이렌이 부하를 불렀어요!'); e.st = 'chase'; e.stT = 1.8;
      } else {
        const n = e.enr ? 9 : 6;
        warnAt(P.x, P.y, 60, 1.0, 14, '#4aa8d8');
        for (let i = 1; i < n; i++) { const a = G.rng() * TAU, r = 80 + G.rng() * 180; warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 60, 0.9 + G.rng() * 0.6, 14, '#4aa8d8'); }
        banner('물기둥이 솟아요!'); e.st = 'chase'; e.stT = 2;
      }
    } else if (e.st === 'song') {
      if (e.stT <= 0) {
        // 음표 고리: 한 곳만 비어 있어요 (그 틈으로 빠져나가요)
        const n = (e.enr ? 26 : 22) + (G.mode === 'extreme' ? 4 : 0) + (e.rage ? 4 : 0), gap = Math.atan2(P.y - e.y, P.x - e.x) + (G.rng() - 0.5) * 2.4;
        for (let i = 0; i < n; i++) { const a = i * TAU / n, dg = Math.atan2(Math.sin(a - gap), Math.cos(a - gap)); if (Math.abs(dg) < 0.42) continue; eshot(e.x, e.y - 40, a, e.rage ? 180 : 150, { k: 'note', r: 9, dmg: 7, col: e.rage ? '#e8372c' : '#4aa8d8', life: 5 }); }
        Snd.play('bubble', 1.3); addTrauma(0.12);
        if (--e.waves > 0) e.stT = e.rage ? 0.5 : 0.6; else { e.st = 'chase'; e.stT = e.enr ? 1.4 : 2; }
      }
    } else if (e.st === 'charm') {
      e.tick -= dt;
      if (e.tick <= 0) { e.tick = 0.22; const a = e.ph * 3; for (let i = 0; i < 3; i++) eshot(e.x, e.y - 40, a + i * TAU / 3, 120, { k: 'note', r: 8, dmg: 7, col: '#ff8fb1', life: 4 }); }
      if (e.stT <= 0) { e.st = 'chase'; e.stT = 1.6; G.pull = null; }
    } else if (e.st === 'charge') {
      e.x += e.dx * e.chg * dt; e.y += e.dy * e.chg * dt;
      if (e.stT <= 0) {
        burst(e.x, e.y, '#7fd3ff', 10);
        for (let i = 0; i < 8; i++) eshot(e.x, e.y - 20, i * TAU / 8, 140, { k: 'note', r: 8, dmg: 8, col: '#4aa8d8', life: 3 });
        if (--e.rolls > 0) { bossWarn(e); e.chg = 470; e.chgT = 0.5; e.stT = 0.6; } else { e.st = 'chase'; e.stT = 1.8; }
      }
    } else updBoss(e, dt, dx, dy, d, sf);
  }
  function updBoss(e, dt, dx, dy, d, sf) {
    const P = G.player;
    if (e.st === 'jump') {
      // 공통 점프: 웅크렸다가 → 플레이어 자리에 그림자 원 → 쿵 + 탄 (e.jN개, 모양 e.jK)
      if (e.stT <= 0) { const T0 = e.jT || 1; e.st = 'air'; e.air = true; e.stT = T0; e.airT = 0; e.sx = e.x; e.sy = e.y; e.tx = P.x; e.ty = P.y; warnAt(P.x, P.y, e.jR || 100, T0, e.dmg + 2, e.jCol || '#a07a5a'); Snd.play('dash', 0.7); }
      return;
    }
    if (e.st === 'air') {
      const T0 = e.jT || 1; e.airT += dt; const q = Math.min(1, e.airT / T0);
      e.x = e.sx + (e.tx - e.sx) * q; e.y = e.sy + (e.ty - e.sy) * q; e.airH = Math.sin(q * Math.PI) * 220;
      if (e.stT <= 0) {
        e.air = false; e.airH = 0; e.sq = 1; addTrauma(0.6); G.zp = Math.max(G.zp, 0.06); Snd.play('stomp', 0.7);
        for (let i = 0; i < (e.jN || 10); i++) eshot(e.x, e.y - 20, i * TAU / (e.jN || 10), 190, { k: e.jK || 'fur', r: 9, dmg: 9, col: e.jCol || '#fffaf3' });
        e.st = 'chase'; e.stT = 1.4;
      }
      return;
    }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT <= 0) bossWarn(e);
    } else if (e.st === 'warn') {
      if (e.stT <= 0) { e.st = 'charge'; e.stT = e.chgT; addTrauma(0.3); burst(e.x, e.y, '#a07a5a', 8); }
    } else if (e.st === 'charge') {
      e.x += e.dx * e.chg * dt; e.y += e.dy * e.chg * dt;
      if (e.stT <= 0) { e.st = 'chase'; e.stT = 5 + G.rng() * 1.5; }
    } else if (e.st === 'stun') {
      if (e.stT <= 0) { e.st = 'chase'; e.stT = 3; }
    }
  }
  // 아노코 (2라운드): 연속 구르기 · 털 폭발 · 꼬마 아노코 · 점프 내려찍기. 체력 40% 아래면 화나서 더 많이·빨리.
  const ANO_PAT = ['roll', 'fur', 'cage', 'mini', 'jump', 'roll', 'fur', 'donut', 'jump'];
  function updAnoko(e, dt, dx, dy, d, sf) {
    const P = G.player;
    if (!e.enr && e.hp < e.max * 0.4) { e.enr = true; e.spd = 80; G.arena.tr = G.arena.base - 100; banner('아노코가 화났어요! 털 울타리가 좁아져요'); addTrauma(0.5); fx({ k: 'ring', x: e.x, y: e.y, r: 220, col: '#f0e6da', w: 14, life: 0.6 }); }
    if (e.st === 'chase' && e.stT <= 0) {
      const p = ANO_PAT[e.pat % ANO_PAT.length];
      if (p === 'cage') { e.pat++; cageAt(P.x, P.y, '#c79a6a', 13, e.enr ? 2 : 1, 0.42); banner('털뭉치 덫! 틈으로 빠져나가요'); Snd.play('warn'); e.stT = e.enr ? 2.2 : 2.8; return; }
      if (p === 'donut') { e.pat++; donutAt(e.x, e.y, 120, G.arena.r + 40, 1.6, 16, '#c79a6a'); banner('털 폭풍! 아노코 곁으로 숨어요'); Snd.play('warn'); e.st = 'hold'; e.stT = 1.7; return; }
    }
    if (e.st === 'hold') { if (e.stT <= 0) { e.st = 'chase'; e.stT = 1.2; } return; }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      const p = ANO_PAT[e.pat++ % ANO_PAT.length];
      if (p === 'roll') { e.rolls = e.enr ? 4 : 3; bossWarn(e); e.chg = 540; e.chgT = 0.45; e.stT = 0.65; banner('털뭉치 구르기! 빨간 줄을 피해요'); }
      else if (p === 'fur') { e.st = 'fur'; e.waves = e.enr ? 4 : 3; e.stT = 0.35; fx({ k: 'flash', x: e.x, y: e.y - 50, r: 80, col: '#ffffff', life: 0.35 }); }
      else if (p === 'mini') {
        const n = e.enr ? 7 : 5;
        for (let i = 0; i < n; i++) { const a = i * TAU / n, m = spawnEnemy('fluff', { x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70 }); m.art = 'anoko'; puff(m.x, m.y - 12, 24, '#ffffff'); }
        banner('꼬마 아노코들이 몰려와요!'); Snd.play('boss'); e.stT = 1.8;
      } else { e.st = 'jump'; e.stT = 0.45; e.sq = 1; }
    } else if (e.st === 'fur') {
      if (e.stT <= 0) {
        const n = e.enr ? 16 : 12, off = e.waves * 0.2;
        for (let i = 0; i < n; i++) eshot(e.x, e.y - 40, i * TAU / n + off, 165, { k: 'fur', r: 9, dmg: 8, col: '#fffaf3' });
        Snd.play('bubble', 0.7); addTrauma(0.12);
        if (--e.waves > 0) e.stT = 0.35; else { e.st = 'chase'; e.stT = e.enr ? 1.3 : 2; }
      }
    } else if (e.st === 'jump') {
      // 웅크렸다가 뛰어올라 → 플레이어 자리에 그림자 원 → 1.1초 뒤 쿵 (공중에선 안 맞고 안 닿아요)
      if (e.stT <= 0) { e.st = 'air'; e.air = true; e.stT = 1.1; e.airT = 0; e.sx = e.x; e.sy = e.y; e.tx = P.x; e.ty = P.y; warnAt(P.x, P.y, 95, 1.1, 18, '#c79a6a'); Snd.play('dash', 0.7); }
    } else if (e.st === 'air') {
      e.airT += dt; const q = Math.min(1, e.airT / 1.1);
      e.x = e.sx + (e.tx - e.sx) * q; e.y = e.sy + (e.ty - e.sy) * q; e.airH = Math.sin(q * Math.PI) * 220;
      if (e.stT <= 0) {
        e.air = false; e.airH = 0; e.sq = 1; addTrauma(0.6); G.zp = Math.max(G.zp, 0.06); Snd.play('stomp', 0.7);
        for (let i = 0; i < 10; i++) eshot(e.x, e.y - 20, i * TAU / 10, 200, { k: 'fur', r: 9, dmg: 8, col: '#fffaf3' });
        e.jumps = (e.jumps || 0) + 1;
        if (e.enr && e.jumps % 2 === 1) { e.st = 'jump'; e.stT = 0.35; } else { e.st = 'chase'; e.stT = 1.6; }
      }
    } else if (e.st === 'charge') {
      e.x += e.dx * e.chg * dt; e.y += e.dy * e.chg * dt;
      if (e.stT <= 0) {
        burst(e.x, e.y, '#f0e6da', 8);
        if (--e.rolls > 0) { bossWarn(e); e.chg = 540; e.chgT = 0.45; e.stT = e.enr ? 0.45 : 0.55; }
        else { e.st = 'chase'; e.stT = 2; }
      }
    } else updBoss(e, dt, dx, dy, d, sf);
  }
  // 검은 별똥별: 별 폭발 · 별똥별 비 · 분신술 · 돌진을 돌아가며. 체력 40% 아래면 화나서 더 빠르고 많이.
  const STAR_PAT = ['burst', 'rain', 'cage', 'clone', 'dash', 'donut', 'burst', 'rain', 'dash'];
  const STAR_PAT2 = ['cross', 'burst', 'cage', 'clone', 'donut', 'rain', 'cross', 'dash', 'burst'];
  function updStar(e, dt, dx, dy, d, sf) {
    const P = G.player;
    if (e.st === 'revive') {
      // 되살아나는 중: 안 맞아요. 체력이 다시 차오르고 붉게 빛나요.
      const q = 1 - Math.max(0, e.stT) / 2.6;
      e.max = e.hp2; e.hp = Math.max(1, e.hp2 * q); e.sq = 0.5 + 0.5 * Math.sin(q * 30);
      if (Math.random() < 0.5) burst(e.x, e.y - 40, Math.random() < 0.5 ? '#c0392b' : '#3a2f4a', 2);
      if (e.stT <= 0) { e.inv = false; e.hp = e.max; e.enr = true; e.spd = 100; e.dmg = 20; e.st = 'chase'; e.stT = 1; e.pat = 0; addTrauma(0.6); fx({ k: 'ring', x: e.x, y: e.y - 40, r: 260, col: '#c0392b', w: 16, life: 0.6 }); }
      return;
    }
    if (!e.enr && e.hp < e.max * 0.4) { e.enr = true; G.arena.tr = G.arena.base - 70; banner('검은 별똥별이 화났어요! 밤하늘이 좁아져요'); addTrauma(0.6); fx({ k: 'ring', x: e.x, y: e.y, r: 240, col: '#6b4fa0', w: 16, life: 0.7 }); e.spd = 90; }
    if (e.st === 'hold') { if (e.stT <= 0) { e.st = 'chase'; e.stT = e.revived ? 0.9 : 1.3; } return; }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      const pats = e.revived ? STAR_PAT2 : STAR_PAT;
      const p = pats[e.pat++ % pats.length];
      if (p === 'cage') { cageAt(P.x, P.y, '#6b4fa0', 15, e.revived ? 3 : e.enr ? 2 : 1, e.revived ? 0.36 : 0.42); banner('별 감옥! 틈을 찾아요'); Snd.play('warn'); e.stT = e.revived ? 2 : 2.6; return; }
      if (p === 'donut') { donutAt(e.x, e.y, e.revived ? 100 : 120, G.arena.r + 40, e.revived ? 1.3 : 1.6, 18, '#6b4fa0'); banner('밤하늘이 무너져요! 별똥별 곁으로'); Snd.play('warn'); e.st = 'hold'; e.stT = e.revived ? 1.4 : 1.7; return; }
      if (p === 'cross') {
        // 십자 별빛: 별똥별에서 4갈래 → 0.6초 뒤 45도 돌린 4갈래
        const a0 = G.rng() * TAU, L = (G.arena ? G.arena.r : 380) * 2.2;
        for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) lineAt(e.x, e.y, a0 + i * Math.PI / 2 + k * Math.PI / 4, L, 54, 1.0 + k * 0.6, 18, '#c0392b');
        banner('십자 별빛! 대각선으로 피해요'); Snd.play('warn'); e.st = 'hold'; e.stT = 1.8; return;
      }
      const clones = G.enemies.filter((o) => o.type === 'clone' && !o.dead).length;
      if (p === 'burst') { e.st = 'burst'; e.waves = e.enr ? 3 : 2; e.stT = 0.4; fx({ k: 'flash', x: e.x, y: e.y - 40, r: 70, col: '#b9a3ff', life: 0.4 }); }
      else if (p === 'rain') {
        const n = e.enr ? 9 : 6, P = G.player;
        warnAt(P.x, P.y, 56, 1.1, 14, '#6b4fa0');
        for (let i = 1; i < n; i++) { const a = G.rng() * TAU, r = 60 + G.rng() * 170; warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 56, 1.0 + G.rng() * 0.5, 14, '#6b4fa0'); }
        banner('별똥별 비! 보라 원을 피해요'); e.st = 'chase'; e.stT = e.enr ? 1.6 : 2.4;
      } else if (p === 'clone' && clones < (e.enr ? 3 : 2)) {
        for (let i = clones; i < (e.enr ? 3 : 2); i++) {
          const a = G.rng() * TAU, c = spawnEnemy('clone', { x: e.x + Math.cos(a) * 90, y: e.y + Math.sin(a) * 90 });
          c.hp = c.max = 600; c.art = 'star';
          fx({ k: 'ring', x: c.x, y: c.y - 30, r: 60, col: '#6b4fa0', w: 6, life: 0.5 }); burst(c.x, c.y - 30, '#3a2f4a', 14);
        }
        banner('분신술! 진짜를 찾아요'); Snd.play('boss'); e.st = 'chase'; e.stT = 2;
      } else bossWarn(e);
    } else if (e.st === 'burst') {
      if (e.stT <= 0) {
        const n = e.enr ? 18 : 14, off = e.waves * 0.13;
        for (let i = 0; i < n; i++) eshot(e.x, e.y - 40, i * TAU / n + off, 170, { k: 'star', r: 9, dmg: 10, col: '#3a2f4a' });
        Snd.play('shoot', 0.6); addTrauma(0.15);
        if (--e.waves > 0) e.stT = 0.35; else { e.st = 'chase'; e.stT = e.enr ? 1.5 : 2.2; }
      }
    } else updBoss(e, dt, dx, dy, d, sf);
  }

  // 보스 울타리 안쪽으로 점 옮기기
  function inArena(x, y, pad) {
    const A = G.arena; if (!A) return { x, y };
    const dx = x - A.x, dy = y - A.y, d = Math.hypot(dx, dy) || 1, lim = A.tr - (pad || 50);
    return d > lim ? { x: A.x + dx / d * lim, y: A.y + dy / d * lim } : { x, y };
  }
  function bossEnrage(e, at, spd, shrink, msg, col) {
    if (e.enr || e.hp >= e.max * at) return;
    e.enr = true; e.spd = spd; if (G.arena) G.arena.tr = G.arena.base - shrink;
    banner(msg); addTrauma(0.5); fx({ k: 'ring', x: e.x, y: e.y, r: 230, col, w: 14, life: 0.6 });
  }
  function rollStep(e, dt, col, chg) {
    e.x += e.dx * e.chg * dt; e.y += e.dy * e.chg * dt;
    if (e.stT > 0) return;
    burst(e.x, e.y, col, 8);
    if (--e.rolls > 0) { bossWarn(e); e.chg = chg; e.chgT = 0.45; e.stT = e.enr ? 0.45 : 0.55; } else { e.st = 'chase'; e.stT = 1.8; }
  }
  // 익스트림 1 · 풍뎅이 (의태형): 박치기 · 의태(바위 중 하나에서 튀어나와요) · 돌 던지기 · 점프 · 껍질 덫 · 근육 불끈
  const BEETLE_PAT = ['charge', 'mimic', 'rocks', 'jump', 'cage', 'flex', 'mimic', 'charge', 'rocks', 'jump'];
  function updBeetle(e, dt, dx, dy, d, sf) {
    const P = G.player;
    bossEnrage(e, 0.5, 84, 90, '풍뎅이가 화났어요! 근육 불끈!', '#a07a5a');
    if (e.st === 'hold') { if (e.stT <= 0) { e.st = 'chase'; e.stT = 1.2; } return; }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      const p = BEETLE_PAT[e.pat++ % BEETLE_PAT.length];
      if (p === 'charge') { e.rolls = e.enr ? 4 : 3; bossWarn(e); e.chg = 520; e.chgT = 0.45; e.stT = 0.7; banner('풍뎅이 박치기! 빨간 줄을 피해요'); }
      else if (p === 'mimic') {
        // 의태: 바위인 척 숨어요 → 바위 여러 개 중 하나에서 튀어나와요 (숨은 동안엔 안 맞아요)
        const n = e.enr ? 5 : 4; e.spots = [];
        for (let i = 0; i < n; i++) { const a = i * TAU / n + G.rng() * 0.8, r = 120 + G.rng() * 110; e.spots.push(inArena(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 60)); }
        e.real = Math.floor(G.rng() * n); e.st = 'hide'; e.hide = true; e.inv = true; e.stT = 1.5;
        e.spots.forEach((q, i) => warnAt(q.x, q.y, 66, 1.5, i === e.real ? 18 : 12, '#a07a5a'));
        puff(e.x, e.y - 20, 70, '#ffffff'); burst(e.x, e.y - 20, '#a07a5a', 16);
        banner('의태! 바위 중 하나가 풍뎅이예요'); Snd.play('warn');
      } else if (p === 'rocks') { e.st = 'rocks'; e.waves = e.enr ? 4 : 3; e.stT = 0.5; }
      else if (p === 'jump') { e.st = 'jump'; e.stT = 0.45; e.sq = 1; e.jN = e.enr ? 14 : 10; e.jK = 'ball'; e.jCol = '#8a6a4a'; e.jR = 105; e.jT = 1; }
      else if (p === 'cage') { cageAt(P.x, P.y, '#a07a5a', 14, e.enr ? 2 : 1, 0.42); banner('껍질 덫! 틈으로 나가요'); Snd.play('warn'); e.stT = e.enr ? 2.2 : 2.6; }
      else { warnAt(e.x, e.y, 150, 1.0, 18, '#e0a830'); e.st = 'flex'; e.stT = 1.0; e.sq = 1; banner('근육 불끈! 풍뎅이에게서 멀어져요'); Snd.play('warn'); }
    } else if (e.st === 'hide') {
      if (e.stT <= 0) {
        const q = e.spots[e.real]; e.x = e.px = q.x; e.y = e.py = q.y; e.hide = false; e.inv = false; e.sq = 1;
        for (let i = 0; i < 10; i++) eshot(e.x, e.y - 20, i * TAU / 10 + 0.3, 180, { k: 'ball', r: 10, dmg: 9, col: '#8a6a4a' });
        burst(e.x, e.y - 20, '#a07a5a', 20); addTrauma(0.4); Snd.play('stomp', 0.6); e.st = 'chase'; e.stT = 1.4;
      }
    } else if (e.st === 'rocks') {
      if (e.stT <= 0) {
        const a = Math.atan2(P.y - e.y, P.x - e.x), n = e.enr ? 7 : 5;
        for (let i = 0; i < n; i++) eshot(e.x, e.y - 30, a + (i - (n - 1) / 2) * 0.2, 190, { k: 'ball', r: 11, dmg: 9, col: '#8a6a4a', life: 3.5 });
        Snd.play('shoot', 0.6); addTrauma(0.1);
        if (--e.waves > 0) e.stT = 0.45; else { e.st = 'chase'; e.stT = e.enr ? 1.4 : 2; }
      }
    } else if (e.st === 'flex') {
      if (e.stT <= 0) { const n = e.enr ? 20 : 16; for (let i = 0; i < n; i++) eshot(e.x, e.y - 20, i * TAU / n, 150, { k: 'ball', r: 9, dmg: 9, col: '#8a6a4a' }); e.st = 'chase'; e.stT = 1.5; }
    } else if (e.st === 'charge') rollStep(e, dt, '#a07a5a', 520);
    else updBoss(e, dt, dx, dy, d, sf);
  }
  // 익스트림 3 · 악몽코끼리: 코 휘두르기(차례로 쓸어요) · 악몽의 밤(내 주변만 보여요) · 꿈방울 · 분홍 코끼리 행진 · 점프 · 덫
  const NIGHT_PAT = ['trunk', 'dream', 'bubbles', 'parade', 'jump', 'trunk', 'cage', 'dream', 'bubbles', 'jump'];
  function updNightmare(e, dt, dx, dy, d, sf) {
    const P = G.player;
    bossEnrage(e, 0.45, 82, 100, '악몽이 깊어져요! 무대가 좁아져요', '#7a6a9a');
    if (e.st === 'hold') { if (e.stT <= 0) { e.st = 'chase'; e.stT = 1.1; } return; }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      const p = NIGHT_PAT[e.pat++ % NIGHT_PAT.length];
      if (p === 'trunk') {
        // 코가 한쪽에서 반대쪽으로 차례로 쓸어요 (먼저 깜빡인 줄은 곧 안전해져요)
        const k = e.enr ? 5 : 4, a0 = Math.atan2(P.y - e.y, P.x - e.x) - 0.45 * (k - 1) / 2, dir = G.rng() < 0.5 ? 1 : -1;
        for (let i = 0; i < k; i++) { const j = dir > 0 ? i : k - 1 - i; lineAt(e.x, e.y - 20, a0 + j * 0.45, 560, 64, 0.8 + i * 0.24, 16, '#7a6a9a'); }
        banner('코 휘두르기! 먼저 지나간 쪽으로'); Snd.play('warn'); e.st = 'hold'; e.stT = 0.9 + k * 0.24;
      } else if (p === 'dream') {
        G.dark = 4.5;
        const n = e.enr ? 10 : 7;
        warnAt(P.x, P.y, 58, 1.3, 15, '#5a4a7a');
        for (let i = 1; i < n; i++) { const a = G.rng() * TAU, r = 70 + G.rng() * 170; warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 58, 1.2 + G.rng() * 1.8, 15, '#5a4a7a'); }
        banner('악몽의 밤! 내 주변만 보여요'); Snd.play('boss'); e.stT = 3;
      } else if (p === 'bubbles') { e.st = 'bubbles'; e.waves = e.enr ? 3 : 2; e.stT = 0.4; fx({ k: 'flash', x: e.x, y: e.y - 50, r: 90, col: '#d8c8ff', life: 0.4 }); }
      else if (p === 'parade') {
        const n = e.enr ? 4 : 3;
        for (let i = 0; i < n; i++) { const a = i * TAU / n, m = spawnEnemy('pinkele', inArena(e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90)); m.minion = true; m.hp = m.max = m.max * 2; m.cd = 1 + i * 0.5; puff(m.x, m.y - 12, 26, '#ffd1dc'); }
        banner('분홍 코끼리 행진!'); Snd.play('boss'); e.stT = 2;
      } else if (p === 'jump') { e.st = 'jump'; e.stT = 0.45; e.sq = 1; e.jN = e.enr ? 14 : 12; e.jK = 'orb'; e.jCol = '#9a7ad0'; e.jR = 115; e.jT = 1.1; }
      else { cageAt(P.x, P.y, '#7a6a9a', 15, e.enr ? 2 : 1, 0.4); banner('꿈의 덫! 틈을 찾아요'); Snd.play('warn'); e.stT = e.enr ? 2.2 : 2.6; }
    } else if (e.st === 'bubbles') {
      if (e.stT <= 0) {
        const n = e.enr ? 14 : 11, off = e.waves * 0.28;
        for (let i = 0; i < n; i++) eshot(e.x, e.y - 40, i * TAU / n + off, 95, { k: 'orb', r: 13, dmg: 10, col: '#b9a3ff', life: 7 });
        Snd.play('bubble', 0.6); addTrauma(0.1);
        if (--e.waves > 0) e.stT = 0.7; else { e.st = 'chase'; e.stT = e.enr ? 1.4 : 2; }
      }
    } else updBoss(e, dt, dx, dy, d, sf);
  }
  // 익스트림 4 · 데카츠요: 혀 날름 · 털뭉치 구르기 · 노랑 털 폭발 · 점프 · 덫 · 털 폭풍. 쓰러뜨리면 본체 매지컬 모몽가로!
  const DEKA_PAT = ['lick', 'roll', 'fur', 'jump', 'cage', 'lick', 'donut', 'fur', 'roll', 'jump'];
  function updDekatsuyo(e, dt, dx, dy, d, sf) {
    if (e.st === 'revive') { updMomonga(e, dt, dx, dy, d, sf); return; }
    const P = G.player;
    bossEnrage(e, 0.5, 90, 80, '데카츠요가 화났어요! 털이 곤두서요', '#ffe066');
    if (e.st === 'hold') { if (e.stT <= 0) { e.st = 'chase'; e.stT = 1.1; } return; }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      const p = DEKA_PAT[e.pat++ % DEKA_PAT.length];
      if (p === 'lick') {
        const a = Math.atan2(P.y - e.y, P.x - e.x), k = e.enr ? 3 : 2;
        for (let i = 0; i < k; i++) lineAt(e.x, e.y - 30, a + (i === 0 ? 0 : (i % 2 ? 0.4 : -0.4)), 560, 50, 0.85 + i * 0.4, 17, '#e86a8a');
        banner('혀 날름! 줄 밖으로'); Snd.play('warn'); e.st = 'hold'; e.stT = 0.9 + k * 0.4;
      } else if (p === 'roll') { e.rolls = e.enr ? 4 : 3; bossWarn(e); e.chg = 560; e.chgT = 0.45; e.stT = 0.65; banner('털뭉치 구르기! 빨간 줄을 피해요'); }
      else if (p === 'fur') { e.st = 'fur'; e.waves = e.enr ? 4 : 3; e.stT = 0.35; }
      else if (p === 'jump') { e.st = 'jump'; e.stT = 0.4; e.sq = 1; e.jN = e.enr ? 16 : 12; e.jK = 'fur'; e.jCol = '#ffe066'; e.jR = 110; e.jT = 1; }
      else if (p === 'cage') { cageAt(P.x, P.y, '#d8b030', 15, e.enr ? 2 : 1, 0.4); banner('털 감옥! 틈으로 빠져나가요'); Snd.play('warn'); e.stT = e.enr ? 2.1 : 2.6; }
      else { donutAt(e.x, e.y, 110, G.arena.r + 40, 1.5, 18, '#d8b030'); banner('털 폭풍! 데카츠요 곁으로 숨어요'); Snd.play('warn'); e.st = 'hold'; e.stT = 1.6; }
    } else if (e.st === 'fur') {
      if (e.stT <= 0) {
        const n = e.enr ? 18 : 14, off = e.waves * 0.2;
        for (let i = 0; i < n; i++) eshot(e.x, e.y - 40, i * TAU / n + off, 170, { k: 'fur', r: 9, dmg: 9, col: '#ffe066' });
        Snd.play('bubble', 0.7); addTrauma(0.12);
        if (--e.waves > 0) e.stT = 0.35; else { e.st = 'chase'; e.stT = e.enr ? 1.3 : 1.9; }
      }
    } else if (e.st === 'charge') rollStep(e, dt, '#ffe066', 560);
    else updBoss(e, dt, dx, dy, d, sf);
  }
  // 매지컬 모몽가 (데카츠요의 본체): 흑마법 — 박쥐 떼 · 저주 마법진 · 해골 지팡이 광선 · 순간이동 · 거꾸로 저주 · 흑마법 비 · 어둠 분신 · 끌어당기기.
  // 50% 아래면 폭주(더 빠르게), 20% 아래면 마지막 흑마법(박쥐 소용돌이가 계속 돌아요).
  const MOMO_PAT = ['bats', 'hex', 'skull', 'portal', 'curse', 'meteor', 'shade', 'bats', 'drain', 'skull', 'portal', 'hex'];
  function updMomonga(e, dt, dx, dy, d, sf) {
    const P = G.player;
    if (e.st === 'revive') {
      const q = 1 - Math.max(0, e.stT) / 2.8;
      if (q > 0.45 && e.kind !== 'momonga') {
        e.kind = 'momonga'; e.art = 'momonga'; e.name = '매지컬 모몽가'; e.r = 50;
        burst(e.x, e.y - 40, '#7b4fd0', 30); fx({ k: 'ring', x: e.x, y: e.y - 40, r: 260, col: '#3a2f4a', w: 14, life: 0.6 });
        banner('매지컬 모몽가! 흑마법을 조심해요'); Snd.play('boss');
      }
      e.max = e.hp2; e.hp = Math.max(1, e.hp2 * q); e.sq = 0.5 + 0.5 * Math.sin(q * 30);
      if (Math.random() < 0.5) burst(e.x, e.y - 40, Math.random() < 0.5 ? '#7b4fd0' : '#3a2f4a', 2);
      if (e.stT <= 0) { e.inv = false; e.hp = e.max; e.enr = false; e.spd = 92; e.dmg = 20; e.st = 'chase'; e.stT = 1.2; e.pat = 0; addTrauma(0.6); fx({ k: 'ring', x: e.x, y: e.y - 40, r: 260, col: '#7b4fd0', w: 16, life: 0.6 }); }
      return;
    }
    bossEnrage(e, 0.5, 105, 110, '모몽가의 흑마법이 폭주해요!', '#7b4fd0');
    if (!e.last && e.hp < e.max * 0.2) { e.last = true; banner('마지막 흑마법! 박쥐 소용돌이를 버텨요'); addTrauma(0.7); G.zp = 0.1; e.spinT = 0; }
    if (e.last && e.st !== 'blink') {
      e.spinT -= dt;
      if (e.spinT <= 0) { e.spinT = 0.2; const a = G.t * 1.7; for (let k = 0; k < 2; k++) eshot(e.x, e.y - 40, a + k * Math.PI, 135, { k: 'bat', r: 9, dmg: 9, col: '#3a2f4a', life: 4.5 }); }
    }
    const rest = e.enr ? 0.75 : 1;
    if (e.st === 'hold') { if (e.stT <= 0) { e.st = 'chase'; e.stT = 1 * rest; } return; }
    if (e.st === 'chase') {
      e.x += (dx / d) * e.spd * sf * dt; e.y += (dy / d) * e.spd * sf * dt;
      if (e.stT > 0) return;
      let p = MOMO_PAT[e.pat++ % MOMO_PAT.length];
      const shades = G.enemies.filter((o) => o.type === 'clone' && !o.dead).length;
      if (p === 'shade' && shades >= (e.enr ? 3 : 2)) p = 'bats';
      if (p === 'bats') { e.st = 'bats'; e.waves = e.enr ? 4 : 3; e.stT = 0.4; fx({ k: 'flash', x: e.x, y: e.y - 50, r: 90, col: '#b9a3ff', life: 0.35 }); banner('박쥐 떼! 틈으로 빠져요'); }
      else if (p === 'hex') { cageAt(P.x, P.y, '#7b4fd0', 16, e.enr ? 3 : 2, 0.36); banner('저주의 마법진! 틈을 찾아요'); Snd.play('warn'); e.stT = 2.6 * rest; }
      else if (p === 'skull') {
        const a0 = G.rng() * TAU, L = (G.arena ? G.arena.r : 380) * 2.2;
        for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) lineAt(e.x, e.y, a0 + i * Math.PI / 3 + k * Math.PI / 6, L, 46, 1.0 + k * 0.65, 19, '#7b4fd0');
        banner('해골 지팡이 광선! 줄 사이로'); Snd.play('warn'); e.st = 'hold'; e.stT = 1.9;
      } else if (p === 'portal') { e.blinks = e.enr ? 2 : 1; momoBlink(e); }
      else if (p === 'curse') {
        G.curse = 2.4;
        for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + G.rng(), r = 90 + G.rng() * 60; warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 56, 1.3, 14, '#7b4fd0'); }
        fx({ k: 'ring', x: P.x, y: P.y - 14, r: 70, col: '#7b4fd0', w: 8, life: 0.6 });
        banner('거꾸로 저주! 방향이 반대가 돼요'); Snd.play('boss'); e.stT = 2.4 * rest;
      } else if (p === 'meteor') {
        const n = e.enr ? 12 : 9;
        warnAt(P.x, P.y, 58, 1.1, 17, '#7b4fd0');
        for (let i = 1; i < n; i++) { const a = G.rng() * TAU, r = 60 + G.rng() * 180; warnAt(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, 58, 1.0 + G.rng() * 0.7, 17, '#7b4fd0'); }
        banner('흑마법 비! 보라 원을 피해요'); e.stT = 2.2 * rest;
      } else if (p === 'shade') {
        for (let i = shades; i < (e.enr ? 3 : 2); i++) {
          const a = G.rng() * TAU, c = spawnEnemy('clone', inArena(e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100));
          c.hp = c.max = 700; c.art = 'momonga'; c.minion = true;
          fx({ k: 'ring', x: c.x, y: c.y - 30, r: 60, col: '#7b4fd0', w: 6, life: 0.5 }); burst(c.x, c.y - 30, '#3a2f4a', 14);
        }
        banner('어둠 분신! 진짜를 찾아요'); Snd.play('boss'); e.stT = 2 * rest;
      } else {
        e.st = 'drain'; e.stT = 2.6; e.tick = 0; G.pull = { x: e.x, y: e.y, v: e.enr ? 100 : 80, t: 2.6, src: e };
        banner('흑마법 끌어당기기! 반대로 달려요'); Snd.play('boss');
      }
    } else if (e.st === 'bats') {
      if (e.stT <= 0) {
        const n = 22, gap = Math.atan2(P.y - e.y, P.x - e.x) + (G.rng() - 0.5) * 2;
        for (let i = 0; i < n; i++) { const a = i * TAU / n, dg = Math.atan2(Math.sin(a - gap), Math.cos(a - gap)); if (Math.abs(dg) < 0.38) continue; eshot(e.x, e.y - 40, a, 165, { k: 'bat', r: 9, dmg: 10, col: '#3a2f4a', life: 5 }); }
        Snd.play('shoot', 0.6); addTrauma(0.12);
        if (--e.waves > 0) e.stT = 0.5; else { e.st = 'chase'; e.stT = 1.6 * rest; }
      }
    } else if (e.st === 'blink') {
      if (e.stT <= 0) {
        e.x = e.px = e.tx; e.y = e.py = e.ty; e.hide = false; e.inv = false; e.sq = 1;
        const n = e.enr ? 18 : 14; for (let i = 0; i < n; i++) eshot(e.x, e.y - 40, i * TAU / n, 160, { k: 'bat', r: 9, dmg: 10, col: '#3a2f4a' });
        burst(e.x, e.y - 40, '#7b4fd0', 20); addTrauma(0.4); Snd.play('stomp', 0.5);
        if (--e.blinks > 0) momoBlink(e); else { e.st = 'chase'; e.stT = 1.4 * rest; }
      }
    } else if (e.st === 'drain') {
      e.tick -= dt;
      if (e.tick <= 0) { e.tick = 0.3; const a = e.ph * 3; for (let i = 0; i < 4; i++) eshot(e.x, e.y - 40, a + i * TAU / 4, 120, { k: 'bat', r: 8, dmg: 9, col: '#3a2f4a', life: 4 }); }
      if (e.stT <= 0) { e.st = 'chase'; e.stT = 1.4 * rest; G.pull = null; }
    } else updBoss(e, dt, dx, dy, d, sf);
  }
  // 순간이동: 플레이어 반대편에 보라 원(0.8초) → 거기서 나타나며 박쥐가 사방으로
  function momoBlink(e) {
    const P = G.player, a = Math.atan2(P.y - e.y, P.x - e.x) + (G.rng() - 0.5) * 1.2, q = inArena(P.x + Math.cos(a) * 150, P.y + Math.sin(a) * 150, 60);
    e.tx = q.x; e.ty = q.y; e.st = 'blink'; e.stT = 0.8; e.hide = true; e.inv = true;
    warnAt(q.x, q.y, 90, 0.8, 18, '#7b4fd0'); puff(e.x, e.y - 30, 60, '#7b4fd0'); burst(e.x, e.y - 30, '#3a2f4a', 14); Snd.play('dash', 0.6);
    banner('순간이동! 보라 원에서 나타나요');
  }
  const BOSS_UPD = { siren: updSiren, anoko: updAnoko, star: updStar, beetle: updBeetle, nightmare: updNightmare, dekatsuyo: updDekatsuyo, momonga: updMomonga };

  function updShots(dt) {
    for (const s of G.shots) {
      s.px = s.x; s.py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      near(s.x, s.y, s.r + 45, (e) => {
        if (s.life <= 0 || e.dead || s.hit.has(e)) return;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + s.r) ** 2) {
          s.hit.add(e); hurtEnemy(e, s.dmg, s.x - s.vx, s.y - s.vy, s.wave ? 140 : 90);
          if (s.boom) boomAt(s.x, s.y, 46, s.dmg * 0.6, '#ffb36b');
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
      if (b.pop && b.t >= b.life) { boomAt(b.x, b.y, b.maxR * 1.2, b.dmg * 4, '#bfe6ff'); for (let i = 0; i < 8; i++) G.parts.push({ x: b.x, y: b.y, vx: Math.cos(i) * 160, vy: Math.sin(i) * 160, t: 0, life: 0.4, col: '#e6f6ff', r: 3 }); }
    }
    G.bubbles = G.bubbles.filter((b) => b.t < b.life);
  }

  // 몬스터 탄
  function updEShots(dt) {
    const P = G.player;
    for (const s of G.eshots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.rot += dt * 12;
      if ((s.x - P.x) ** 2 + (s.y - (P.y - 12)) ** 2 < (s.r + P.r) ** 2) { s.life = 0; hurtPlayer(s.dmg, s); if (state !== 'play') return; }
    }
    G.eshots = G.eshots.filter((s) => s.life > 0);
  }
  // 바닥 경고 원: 다 차면 쾅
  function updWarns(dt) {
    const P = G.player;
    for (const w of G.warns) {
      w.t += dt;
      if (w.t >= w.dur) {
        w.done = true;
        let hit;
        if (w.line) {
          const ux = Math.cos(w.a), uy = Math.sin(w.a), px = P.x - w.x, py = P.y - w.y, along = px * ux + py * uy, side = Math.abs(-px * uy + py * ux);
          hit = along > -P.r && along < w.len + P.r && side < w.w / 2 + P.r;
          for (let s = 0; s <= w.len; s += 60) { fx({ k: 'flash', x: w.x + ux * s, y: w.y + uy * s, r: w.w * 0.9, col: w.col, life: 0.22 }); burst(w.x + ux * s, w.y + uy * s, w.col, 2); }
          addTrauma(0.15);
        } else if (w.rin) {
          const d = Math.hypot(P.x - w.x, P.y - w.y);
          hit = d > w.rin - P.r * 0.5;
          fx({ k: 'ring', x: w.x, y: w.y, r: w.rin + 30, col: w.col, w: 18, life: 0.4 }); addTrauma(0.3);
        } else {
          fx({ k: 'flash', x: w.x, y: w.y, r: w.r, col: w.col, life: 0.25 }); fx({ k: 'ring', x: w.x, y: w.y, r: w.r * 1.3, col: w.col, w: 6, life: 0.3 });
          burst(w.x, w.y, w.col, 8); addTrauma(0.1);
          hit = (P.x - w.x) ** 2 + (P.y - w.y) ** 2 < (w.r + P.r) ** 2;
        }
        if (hit && !(P.inv > 0) && !G.qaInv) {
          if (w.stun) { P.stunT = w.stun; addNum(P.x, P.y - 56, '돌이 됐어요!', '#ff6fb5', 18); burst(P.x, P.y - 16, '#ff9ad0', 14); }
          if (w.slow) { P.slowT = w.slow; addNum(P.x, P.y - 56, '느려졌어요', '#e0b030', 16); }
        }
        if (hit && w.dmg > 0) { hurtPlayer(w.dmg, w); if (state !== 'play') return; }
      }
    }
    G.warns = G.warns.filter((w) => !w.done);
    for (const u of G.epud) { u.t -= dt; if ((P.x - u.x) ** 2 + ((P.y - u.y) * 1.6) ** 2 < (u.r + P.r) ** 2) { hurtPlayer(3, { x: u.x, y: u.y, type: 'soy' }); if (state !== 'play') return; } }
    G.epud = G.epud.filter((u) => u.t > 0);
  }
  // 동료 소환: 노랑 외눈이는 눈빛 광선, 초록 도깨비는 뛰어올라 몽둥이 쾅
  function updAlly(dt) {
    const A = G.ally, P = G.player;
    if (!A.ok) return;
    A.cd = Math.max(0, A.cd - dt);
    if (A.t <= 0) return;
    A.t -= dt;
    const [eye, gob] = A.a;
    const k = 1 - Math.exp(-6 * dt);
    eye.x += (P.x - 50 - eye.x) * k; eye.y += (P.y - 30 - eye.y) * k;
    eye.cd -= dt;
    if (eye.cd <= 0) {
      const t = nearestN(eye.x, eye.y, 380, 1)[0];
      eye.cd = t ? 0.3 : 0.1;
      if (t) { hurtEnemy(t, 26, eye.x, eye.y, 60); fx({ k: 'beam', x1: eye.x, y1: eye.y - 30, x2: t.x, y2: t.y - t.r, col: '#ffe066', life: 0.14 }); Snd.play('shoot', 2); }
    }
    if (gob.jump) {
      const j = gob.jump; j.t += dt;
      const q = Math.min(1, j.t / 0.28);
      gob.x = j.x0 + (j.x1 - j.x0) * q; gob.y = j.y0 + (j.y1 - j.y0) * q; gob.hop = Math.sin(q * Math.PI) * 40;
      if (q >= 1) { gob.jump = null; gob.hop = 0; boomAt(gob.x, gob.y, 80, 45, '#7cc48a'); addTrauma(0.15); }
    } else {
      gob.x += (P.x + 50 - gob.x) * k; gob.y += (P.y - 10 - gob.y) * k;
      gob.cd -= dt;
      if (gob.cd <= 0) {
        const t = nearestN(gob.x, gob.y, 300, 1)[0];
        gob.cd = t ? 1.1 : 0.2;
        if (t) gob.jump = { t: 0, x0: gob.x, y0: gob.y, x1: t.x, y1: t.y };
      }
    }
    if (A.t <= 0) A.a.forEach((h) => { burst(h.x, h.y - 16, '#ffffff', 10); puff(h.x, h.y - 16, 30, '#ffffff'); });
  }
  // 던지는 물건들 (나루토 원반 · 새우튀김 · 로켓 · 팽이)
  function updItems(dt) {
    const P = G.player;
    // 나루토 원반 (치이카와): 몸 주위를 돌아요. 같은 적은 0.45초마다 한 번.
    const ln = G.weapons.it_naruto;
    G.orbs = null;
    if (ln) {
      G.orbA += dt * 3.4;
      const n = ln >= 5 ? 4 : ln >= 3 ? 3 : 2, base = 78 * area(), R = base + (ln >= 5 ? 80 * Math.max(0, Math.sin(G.t * 1.8)) : 0), dmg = 10 + 3 * (ln - 1);
      G.orbs = [];
      for (let i = 0; i < n; i++) {
        const a = G.orbA + i * TAU / n, x = P.x + Math.cos(a) * R, y = P.y - 12 + Math.sin(a) * R * 0.8;
        G.orbs.push({ x, y });
        near(x, y, 60, (e) => { if (e.dead || e.under || (e.x - x) ** 2 + (e.y - y) ** 2 > (e.r + 16) ** 2) return; if (G.t - (e.orbT || -9) < 0.45) return; e.orbT = G.t; hurtEnemy(e, dmg, P.x, P.y, 110); });
      }
    }
    const hw = VW / 2 / viewScale, hh = VH / 2 / viewScale;
    for (const it of G.items) {
      it.life -= dt;
      if (it.k === 'it_tempura') {
        it.rot += dt * 10; it.x += it.vx * dt; it.y += it.vy * dt;
        // 화면 가장자리에서 튕겨요
        let b = false;
        if (it.x < G.cam.x - hw + 20 && it.vx < 0) { it.vx *= -1; b = true; } if (it.x > G.cam.x + hw - 20 && it.vx > 0) { it.vx *= -1; b = true; }
        if (it.y < G.cam.y - hh + 20 && it.vy < 0) { it.vy *= -1; b = true; } if (it.y > G.cam.y + hh - 20 && it.vy > 0) { it.vy *= -1; b = true; }
        if (b) { burst(it.x, it.y, '#a8d4ff', 6); if (it.pop) boomAt(it.x, it.y, 50, it.dmg * 0.6, '#a8d4ff'); }
        if (Math.random() < 0.4) G.parts.push({ x: it.x, y: it.y, vx: 0, vy: 0, t: 0, life: 0.25, col: '#cfe6ff', r: 3 });
        near(it.x, it.y, 60, (e) => { if (e.dead || e.under || (e.x - it.x) ** 2 + (e.y - it.y) ** 2 > (e.r + 16) ** 2) return; if (G.t - (e.tmpT || -9) < 0.4) return; e.tmpT = G.t; hurtEnemy(e, it.dmg, it.x, it.y, 120); });
      } else if (it.k === 'it_rocket') {
        if (!it.tgt || it.tgt.dead) it.tgt = nearestN(it.x, it.y, 500, 1)[0];
        let va = Math.atan2(it.vy, it.vx);
        if (it.tgt) { const ta = Math.atan2(it.tgt.y - it.y, it.tgt.x - it.x); let df = Math.atan2(Math.sin(ta - va), Math.cos(ta - va)); va += Math.max(-6 * dt, Math.min(6 * dt, df)); }
        const sp = Math.min(520, Math.hypot(it.vx, it.vy) + 700 * dt);
        it.vx = Math.cos(va) * sp; it.vy = Math.sin(va) * sp; it.rot = va;
        it.x += it.vx * dt; it.y += it.vy * dt;
        if (Math.random() < 0.8) G.parts.push({ x: it.x - it.vx * 0.04, y: it.y - it.vy * 0.04, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, t: 0, life: 0.35, col: Math.random() < 0.5 ? '#ffe066' : '#ff9f43', r: 3 });
        let go = it.life <= 0;
        near(it.x, it.y, 50, (e) => { if (!e.dead && !e.under && (e.x - it.x) ** 2 + (e.y - it.y) ** 2 < (e.r + 12) ** 2) go = true; });
        if (go) {
          it.life = 0; boomAt(it.x, it.y, (it.mini ? 36 : 56) * area(), it.dmg, '#ffb347');
          if (it.cluster) for (let i = 0; i < 3; i++) { const a = i * TAU / 3; G.items.push({ k: 'it_rocket', x: it.x, y: it.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, tgt: null, life: 1, rot: a, dmg: it.dmg * 0.5, mini: true }); }
        }
      }
    }
    G.items = G.items.filter((it) => it.life > 0);
    for (const tp of G.tops) {
      tp.t += dt; tp.rot += dt * 20;
      const q = Math.min(1, tp.t / 0.4);
      if (q < 1) { tp.x += (tp.tx - tp.x) * Math.min(1, dt * 9); tp.y += (tp.ty - tp.y) * Math.min(1, dt * 9); }
      tp.tick -= dt;
      near(tp.x, tp.y, tp.R + 30, (e) => {
        if (e.dead || e.under) return;
        const dx = tp.x - e.x, dy = tp.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > tp.R + e.r) return;
        if (e.type !== 'boss' && d > 14) { e.x += dx / d * 110 * dt; e.y += dy / d * 110 * dt; }
        if (tp.tick <= 0 && d < 46 + e.r) hurtEnemy(e, tp.dmg, tp.x, tp.y, 0);
      });
      if (tp.tick <= 0) tp.tick = 0.3;
      if (Math.random() < 0.5) { const a = Math.random() * TAU; G.parts.push({ x: tp.x + Math.cos(a) * tp.R, y: tp.y + Math.sin(a) * tp.R * 0.7, vx: -Math.cos(a) * 160, vy: -Math.sin(a) * 110, t: 0, life: 0.5, col: '#cfe8b8', r: 2 }); }
      if (tp.t >= tp.life) { tp.done = true; if (tp.pop) boomAt(tp.x, tp.y, 110 * area(), tp.dmg * 6, '#7cc48a'); else burst(tp.x, tp.y, '#7cc48a', 8); }
    }
    G.tops = G.tops.filter((tp) => !tp.done);
  }
  // 긴팔 털뭉치의 팔: 쭉 뻗었다가 돌아와요. 끝에 닿으면 끌려가요.
  function updGrabs(dt) {
    const P = G.player;
    for (const g of G.grabs) {
      g.t += dt;
      if (g.e.dead) { g.done = true; continue; }
      g.x = g.e.x; g.y = g.e.y - 18;
      if (!g.back) { g.len += 1100 * dt; if (g.len >= g.max) g.back = true; }
      else { g.len -= 900 * dt; if (g.len <= 0) g.done = true; }
      const tx = g.x + Math.cos(g.a) * g.len, ty = g.y + Math.sin(g.a) * g.len;
      if (!g.hit && !g.back && (tx - P.x) ** 2 + (ty - (P.y - 12)) ** 2 < (P.r + 16) ** 2) {
        g.hit = true; g.back = true;
        hurtPlayer(7, g.e); if (state !== 'play') return;
        if (!G.qaInv) { G.pull = { x: g.e.x, y: g.e.y, v: 160, t: 1.2, src: g.e }; toast('붙잡혔어요! 반대로 달려요', 1500); }
      }
    }
    G.grabs = G.grabs.filter((g) => !g.done);
  }
  function updFx(dt) {
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter((f) => f.t < f.life);
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
      if (close && (!P.moving || G.mode === 'extreme')) h.prog += dt / (G.mode === 'extreme' ? 0.5 : T.HERB_TIME * CHARS[G.char].herbMul);
      else h.prog = Math.max(0, h.prog - dt * 0.4);
      if (close && P.moving && !seen.herb && !h.told) { h.told = true; toast('멈춰 서 있으면 약초를 캐요', 2500); }
      if (h.prog >= 1) { h.life = 0; heal(Math.round(T.HERB_HEAL * D().herb)); puff(h.x, h.y - 10, 50, '#ffffff'); addTrauma(0.15); markSeen('herb'); }
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
    $('quizKind').innerHTML = ico(kind === 'boss' ? 'crown' : kind === 'review' ? 'note' : 'gem') + escapeHtml(quizTitle(kind)); $('quizKind').className = 'qkind ' + kind;
    const badge = nq.isReask ? '다시 도전 · ' : nq.isNote ? '지난번에 틀린 문제 · ' : '';
    $('quizTag').innerHTML = escapeHtml(badge + it.tag + ' · ') + (it.short ? '주관식' : ico('star').repeat(it.diff));
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
    if (r === 'cleared') return `<br><span class="note-ok">${ico('note')} 오답 노트 졸업!</span>`;
    if (r === 'progress') return `<br><span class="note-ok">${ico('note')} 오답 노트 ${Q.NOTE_CLEAR - 1}/${Q.NOTE_CLEAR} · 한 번 더 맞히면 졸업</span>`;
    if (r === 'added' && !ok) return `<br><span class="sub">${ico('note')} 오답 노트에 담았어요</span>`;
    return '';
  }
  function wrongHtml(it, mine) {
    return `<span class="big">${ico('cross')}아쉬워요</span><br>정답은 <b>${escapeHtml(it.ans)}</b>` + (it.short ? ` <span class="sub">(내 답: ${escapeHtml(mine)})</span>` : '') +
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
      $('quizFb').innerHTML = `<span class="big">${ico('check')}정답!</span>` + (four ? '<br>3번 연속 정답! 카드가 4장이에요' : G.streak > 1 ? `<br>${G.streak}번 연속!` : '') + noteMsg(noteR, ok);
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
      $('quizFb').innerHTML = `<span class="big">${ico('check')}정답!</span>` + noteMsg(noteR, ok);
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
    $('revMsg').textContent = left ? `남은 문제는 다음 판에도 먼저 나와요. 두 번 맞히면 졸업!` : '오답 노트를 모두 졸업했어요!';
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
      return `<tr><td class="nq">${escapeHtml(e.q)}<div class="sub">${escapeHtml(e.tag)}${e.short ? ' · 주관식' : ''}</div></td><td>${escapeHtml(e.ans)}</td><td>${e.wrongN}번</td><td>${'<span class="note-pip on"></span>'.repeat(e.okN)}${'<span class="note-pip"></span>'.repeat(Q.NOTE_CLEAR - e.okN)}</td></tr>`;
    }).join('') + '</table>' : '<p class="sub">틀린 문제가 없어요. 게임에서 틀린 문제가 여기에 모여요.</p>';
    $('noteGo').disabled = !keys.length; $('noteClear').disabled = !keys.length;
  }
  function updateNoteBtns() {
    const c = noteCount();
    $('noteCnt').hidden = !c; $('noteCnt').textContent = c;
    $('resNoteBtn').querySelector('span').textContent = `오답 노트 복습 (${c})`;
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
    for (const k in WEAP) { if (WEAP[k].only && WEAP[k].only !== G.char) continue; const l = G.weapons[k] || 0; if (l === 0 && nW < 4) o.push({ kind: 'w', k, l: 1 }); else if (l > 0 && l < 5) o.push({ kind: 'w', k, l: l + 1 }); }
    for (const k in SUBS) { const l = G.subs[k] || 0; if (l < 5) o.push({ kind: 's', k, l: l + 1 }); }
    return o;
  }
  function openCards(n) {
    setState('cards');
    $('cardsTitle').innerHTML = ico('sparkle') + (G.test ? '하나를 골라요' : '정답! 하나를 골라요'); $('cardList').classList.remove('helpers'); $('cardsPanel').style.maxWidth = '760px';
    let o = Q.shuffle(cardOptions(), G.rng).slice(0, n);
    if (!o.length) o = [{ kind: 'heal' }];
    G.cardOpts = o; G.cardsAt = performance.now();
    const list = $('cardList');
    list.innerHTML = '';
    o.forEach((c, i) => {
      const d = c.kind === 'w' ? WEAP[c.k] : c.kind === 's' ? SUBS[c.k] : { name: '주먹밥', ic: 'rice', desc: () => '체력 +30' };
      const b = document.createElement('button');
      // 종류마다 색: 새 무기 파랑 · 강화 초록 · 진화 금색 · 보조 도구 보라 · 회복 분홍
      const kind = c.kind === 'heal' ? 'heal' : c.kind === 's' ? 'sub' : c.l === 1 ? 'new' : c.l === 5 ? 'evo' : 'up';
      const label = { heal: '회복', sub: c.l === 1 ? '새 보조 도구' : '도구 강화', new: '새 무기', evo: 'Lv.5 진화!', up: '무기 강화' }[kind];
      b.className = 'card k-' + kind;
      b.style.animationDelay = i * 50 + 'ms';
      const pips = c.kind === 'heal' ? '' : '<div class="pips">' + [1, 2, 3, 4, 5].map((n) => `<i class="${n < c.l ? 'on' : n === c.l ? 'new' : ''}"></i>`).join('') + '</div>';
      b.innerHTML = `<span class="kind">${label}</span><div class="ic">${d.img ? `<img src="art/${d.img}" alt="">` : ico(d.ic)}</div><div class="nm">${d.name}</div>${pips}<div class="ds">${d.desc(c.l)}${c.kind === 'w' ? `<br><span class="evo">${ico('sparkle')} ${c.l === 5 ? '진화: ' : 'Lv.5: '}${EVO[c.k]}</span>` : ''}</div>` + (usingTouch ? '' : `<div class="k">${i + 1}</div>`);
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
    if (c.kind === 'h') addHelper(c.k);
    else if (c.kind === 'w') { G.weapons[c.k] = c.l; if (G.wcd[c.k] == null || c.l === 1) G.wcd[c.k] = 0; toast(`${WEAP[c.k].name} Lv.${c.l}`, 1500); }
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
      wrong: s.wrong.map((w) => ({ tag: w.tag, q: w.q, chosen: w.chosen, ans: w.ans })), seed: G.seed, char: G.char, mode: G.mode,
    };
    let unlockedNow = null;
    if (G.test) {
      $('resIco').innerHTML = ico(win ? 'trophy' : 'skull');
      $('resTitle').textContent = '테스트 · ' + CHARS[G.char].name + ' · ' + DIFF[G.mode].name + ' · ' + (win ? '토벌 성공! ' + lastBoss() + '을(를) 물리쳤어요' : cause);
      $('resStat').innerHTML = `<p class="sub">테스트 판은 기록에 남지 않아요 · 버틴 시간 ${fmt(G.clock)} · 쓰러뜨린 보스 ${G.bossesBeaten} / ${bossList().length} · 레벨 ${G.level}</p>`;
      ['resWrong', 'resTags'].forEach((id) => { if ($(id)) $(id).innerHTML = ''; });
      document.querySelectorAll('#result .unlock, #result .meet').forEach((el) => el.remove());
      testBar(); show('result'); return;
    }
    if (win) for (const k in CHARS) if (CHARS[k].locked && !isUnlocked(k)) { store.set('chii_unlock_' + k, true); unlockedNow = k; }
    const xNow = win && G.mode === 'hard' && !xOpen();
    if (win && G.mode === 'hard') store.set('chii_clear_hard', true);
    const all = store.get(K_REC, []);
    all.push(rec);
    store.set(K_REC, all.slice(-300));

    $('resIco').innerHTML = ico(win ? 'trophy' : 'skull');
    $('resTitle').textContent = CHARS[G.char].name + ' · ' + DIFF[G.mode].name + ' · ' + (win ? '토벌 성공! ' + lastBoss() + '을(를) 물리쳤어요' : '토벌 실패 · ' + cause);
    const pct = s.n ? Math.round(s.rate * 100) + '%' : '-';
    $('resStat').innerHTML = [
      ['버틴 시간', fmt(G.clock) + ' / ' + fmt(T.RUN), 'clock'], ['쓰러뜨린 보스', `${G.bossesBeaten} / ${bossList().length}`, 'crown'], ['쫓아낸 몬스터', G.kills, 'monster'], ['레벨', G.level, 'gem'],
      ['정답률', `${pct} (${s.correct}/${s.n})`, 'check'], ['평균 풀이', s.avgSec.toFixed(1) + '초', 'pencil'], ['다시 도전 정답', `${s.reaskCorrect}/${s.reaskN}`, 'retry'],
    ].map((a, i) => `<div style="animation-delay:${i * 60}ms">${ico(a[2])}<b>${a[1]}</b><span>${a[0]}</span></div>`).join('');
    const tags = Object.keys(s.byTag);
    $('resTags').innerHTML = tags.length ? '<table><tr><th>유형</th><th>맞힘</th><th>정답률</th></tr>' +
      tags.map((t) => { const v = s.byTag[t]; return `<tr><td>${escapeHtml(t)}</td><td>${v.c}/${v.n}</td><td>${Math.round((v.c / v.n) * 100)}%</td></tr>`; }).join('') + '</table>' : '';
    $('resWrong').innerHTML = s.wrong.length ? '<h2 style="margin-top:16px;font-size:20px">틀린 문제 다시 보기 <span class="sub">· 오답 노트에 담겼어요</span></h2><table><tr><th>문제</th><th>내 답</th><th>정답</th></tr>' +
      s.wrong.map((w) => `<tr><td class="nq">${escapeHtml(w.q)}</td><td>${ico('cross')} ${escapeHtml(w.chosen)}</td><td>${ico('check')} ${escapeHtml(w.ans)}</td></tr>`).join('') + '</table>' : '';
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
    if (xNow) $('resStat').insertAdjacentHTML('afterend', `<p class="unlock">${ico('skull')} 익스트림 모드가 열렸어요! 치이카와·하치와레·우사기도 체력 125와 특수 효과를 얻었어요.</p>`);
    if (unlockedNow) $('resStat').insertAdjacentHTML('afterend', `<p class="unlock">${ico('party')} ${CHARS[unlockedNow].name}${josaIGa(CHARS[unlockedNow].name)} 동료가 되었어요! 다음 판부터 고를 수 있어요.</p>`);
    show('result');
    Snd.play(win ? 'win' : 'no');
    if (unlockedNow) setTimeout(() => Snd.play('cheer'), 700);
  }

  function renderRecords() {
    const all = store.get(K_REC, []).slice().reverse();
    if (!all.length) { $('recTable').innerHTML = '<p class="sub">아직 기록이 없어요.</p>'; return; }
    $('recTable').innerHTML = '<table><tr><th>날짜</th><th>별명</th><th>캐릭터</th><th>모드</th><th>결과</th><th>시간</th><th>정답률</th><th>평균</th><th>틀린 유형</th></tr>' +
      all.slice(0, 100).map((r) => {
        const wt = {}; r.wrong.forEach((w) => { wt[w.tag] = (wt[w.tag] || 0) + 1; });
        return `<tr><td>${r.date.slice(5, 16).replace('T', ' ')}</td><td>${escapeHtml(r.nick)}</td><td>${(CHARS[r.char] || CHARS.chiikawa).name}</td><td>${(DIFF[r.mode] || DIFF.hard).name}</td><td>${escapeHtml(r.cause)}</td><td>${fmt(r.clock)}</td>` +
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

    // 땅 (지역이 바뀌면 새 바닥이 서서히 덮여요)
    const drawGround = (tl) => { for (let tx = Math.floor((L + 60) / 256); tx * 256 < R; tx++) for (let ty = Math.floor((Tp + 60) / 256); ty * 256 < B; ty++) ctx.drawImage(tl, tx * 256, ty * 256, 257, 257); };
    if (G.biomeT > 0 && G.biome > 0) { drawGround(tiles[G.biome - 1]); ctx.globalAlpha = 1 - G.biomeT; }
    drawGround(tiles[G.biome]); ctx.globalAlpha = 1;
    drawProps(L, R, Tp, B, now);
    drawArena(now);

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
    // 바닥 경고 원 (별똥별 비 · 땅속 몬스터): 안쪽이 차오르면 쾅
    for (const u of G.epud) { ctx.globalAlpha = Math.min(1, u.t) * 0.7; ctx.fillStyle = '#4a2a1a'; ctx.beginPath(); ctx.ellipse(u.x, u.y, u.r, u.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } // 간장 웅덩이
    for (const w of G.warns) {
      const k = Math.min(1, w.t / w.dur), blink = Math.floor(now * 10) % 2;
      if (w.line) {
        ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a);
        ctx.globalAlpha = 0.2 + (blink ? 0.1 : 0); ctx.fillStyle = w.col; ctx.fillRect(0, -w.w / 2, w.len, w.w);
        ctx.globalAlpha = 0.5; ctx.fillRect(0, -w.w / 2, w.len * k, w.w);
        ctx.globalAlpha = 0.9; ctx.strokeStyle = w.col; ctx.lineWidth = 3; ctx.strokeRect(0, -w.w / 2, w.len, w.w);
        ctx.restore(); ctx.globalAlpha = 1; continue;
      }
      if (w.rin) {
        // 바깥이 위험: 안쪽 원만 남기고 칠해요
        ctx.globalAlpha = 0.16 + (blink ? 0.1 : 0) + 0.25 * k; ctx.fillStyle = w.col;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.arc(w.x, w.y, w.rin, 0, TAU, true); ctx.fill('evenodd');
        ctx.globalAlpha = 0.95; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(w.x, w.y, w.rin, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1; continue;
      }
      if (!vis(w.x, w.y)) continue;
      ctx.globalAlpha = 0.18 + (blink ? 0.1 : 0); ctx.fillStyle = w.col; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r * k, w.r * 0.7 * k, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = w.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * 0.7, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 돌진 경고선 (실제 돌진 거리와 같음: 속도 × 시간)
    for (const b of G.enemies) {
      if (b.st !== 'warn' || !b.chg || b.dead) continue;
      const len = b.chg * b.chgT + b.r, blink = Math.floor(now * 8) % 2;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.dy, b.dx));
      ctx.globalAlpha = blink ? 0.45 : 0.3; ctx.fillStyle = '#e8746c'; ctx.fillRect(0, -b.r, len, b.r * 2);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.strokeRect(0, -b.r, len, b.r * 2);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // 꽃폭탄
    for (const m of G.mines) {
      if (!vis(m.x, m.y)) continue;
      const bob = Math.sin(now * 5 + m.x) * 1.5, ready = m.t > 0.4;
      ctx.fillStyle = '#4f9a5e'; ctx.fillRect(m.x - 1, m.y - 10, 2, 10);
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + now; ctx.fillStyle = ready ? '#ff8fb1' : '#ffd1dc'; ctx.beginPath(); ctx.arc(m.x + Math.cos(a) * 5, m.y - 12 + bob + Math.sin(a) * 5, 4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(m.x, m.y - 12 + bob, 3, 0, TAU); ctx.fill();
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
    // 낫 회오리 (진화)
    if (G.whirl) {
      const w = G.whirl, k = w.t / w.life;
      ctx.globalAlpha = 0.7 * (1 - k); ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = now * 14 + i * TAU / 3; ctx.strokeStyle = i % 2 ? '#c8f5a0' : '#ffffff'; ctx.beginPath(); ctx.arc(ix, iy - 10, w.R * (0.6 + 0.12 * i), a, a + 1.8); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    drawPlayer(ix, iy, now);
    drawAllies(now);
    drawSumo(now);
    drawHelpers(now);
    // 도토리 · 검기
    for (const s of G.shots) {
      const x = lerp(s.px, s.x, alpha), y = lerp(s.py, s.y, alpha);
      if (!vis(x, y)) continue;
      if (s.wave) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(s.a); ctx.globalAlpha = Math.min(1, s.life / 0.2) * 0.85;
        ctx.fillStyle = '#dff3ff'; ctx.beginPath(); ctx.arc(0, 0, s.r, -1.1, 1.1); ctx.arc(-10, 0, s.r * 0.8, 1.1, -1.1, true); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
      } else { ctx.fillStyle = s.boom ? '#d9733b' : '#8a5a3b'; ctx.beginPath(); ctx.arc(x, y, s.boom ? 6 : 5, 0, TAU); ctx.fill(); }
    }
    // 부메랑 숟가락
    for (const b of G.booms) {
      if (!vis(b.x, b.y)) continue;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      const z = b.r / 16;
      ctx.fillStyle = b.fire ? '#ffb347' : '#dfe6ee'; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-8 * z, 0, 8 * z, 6 * z, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillRect(0, -2 * z, 16 * z, 4 * z); ctx.strokeRect(0, -2 * z, 16 * z, 4 * z);
      ctx.restore();
    }
    // 토벌봉
    for (const r of G.rods) {
      if (!vis(r.x, r.y)) continue;
      const spr = ART[r.k];
      if (r.k === 'rod_usagi') {
        // 떨어질 자리: 노란 원이 차오르고, 그림자가 작아졌다 커져요
        const q = Math.min(1, r.t / r.dur);
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(r.x1, r.y1, r.R, r.R * 0.7, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(r.x1, r.y1, r.R * q, r.R * 0.7 * q, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.drawImage(shadow, r.x - 12, r.y - 4, 24, 8);
      }
      ctx.save(); ctx.translate(r.x, r.y - (r.h || 0)); ctx.rotate(r.rot);
      const H = r.k === 'rod_usagi' ? 46 : r.k === 'rod_rakko' ? 30 : 38;
      if (spr) { const W = H * spr.width / spr.height; ctx.drawImage(spr, -W / 2, -H / 2, W, H); }
      else { ctx.fillStyle = r.k === 'rod_chiikawa' ? '#ff8fb1' : r.k === 'rod_hachiware' ? '#6fb3f2' : '#ffe066'; ctx.fillRect(-3, -H / 2, 6, H); }
      ctx.restore();
    }
    // 던지는 물건 그림 (선생님이 주신 물건 그림을 그대로 써요)
    const drawSpr = (key, x, y, h, rot, col) => {
      const spr = ART[key];
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      if (spr) { const w = h * spr.width / spr.height; ctx.drawImage(spr, -w / 2, -h / 2, w, h); }
      else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, h / 3, 0, TAU); ctx.fill(); }
      ctx.restore();
    };
    if (G.orbs) for (const o of G.orbs) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd1dc'; ctx.beginPath(); ctx.arc(o.x, o.y, 22, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; drawSpr('it_naruto', o.x, o.y, 34, now * 9, '#ffd1dc'); }
    for (const it of G.items) { if (!vis(it.x, it.y)) continue; drawSpr(it.k, it.x, it.y, it.k === 'it_rocket' ? (it.mini ? 22 : 34) : 40, it.k === 'it_rocket' ? it.rot : it.rot, it.k === 'it_rocket' ? '#ffe066' : '#a8d4ff'); }
    for (const tp of G.tops) {
      if (!vis(tp.x, tp.y)) continue;
      const fade = Math.min(1, (tp.life - tp.t) / 0.3);
      ctx.globalAlpha = 0.18 * fade; ctx.fillStyle = '#7cc48a'; ctx.beginPath(); ctx.ellipse(tp.x, tp.y, tp.R, tp.R * 0.7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const a = -now * 6 + i * TAU / 3; ctx.beginPath(); ctx.ellipse(tp.x, tp.y, tp.R * 0.7, tp.R * 0.5, 0, a, a + 1.2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.drawImage(shadow, tp.x - 18, tp.y - 5, 36, 12);
      drawSpr('top', tp.x + Math.sin(tp.rot) * 2, tp.y - 20, 42, Math.sin(tp.rot * 0.7) * 0.15, '#7cc48a');
    }
    // 긴팔 털뭉치의 팔
    for (const g of G.grabs) {
      const tx = g.x + Math.cos(g.a) * g.len, ty = g.y + Math.sin(g.a) * g.len;
      ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = '#f6c9a8'; ctx.lineWidth = 6; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, 10, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // 조준 중인 긴팔: 뻗을 방향을 미리 보여 줘요
    for (const e of G.enemies) {
      if (e.type !== 'grab' || e.st !== 'aim' || !vis(e.x, e.y)) continue;
      ctx.globalAlpha = 0.35 + 0.25 * (Math.floor(now * 10) % 2); ctx.strokeStyle = '#e8574c'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 18); ctx.lineTo(e.x + e.dx * 300, e.y - 18 + e.dy * 300); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // 붙잡혀 끌려갈 때: 몸에 줄
    if (G.pull && G.pull.src) { ctx.globalAlpha = 0.6; ctx.strokeStyle = G.pull.src.type === 'boss' ? '#ff8fb1' : '#f6c9a8'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(ix, iy - 14); ctx.lineTo(G.pull.x, G.pull.y - 30); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    // 몬스터 탄 (몽둥이 · 보라 탄 · 검은 별)
    for (const s of G.eshots) {
      if (!vis(s.x, s.y)) continue;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      if (s.k === 'fur') { ctx.fillStyle = s.col; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r = i % 2 ? s.r * 0.8 : s.r * 1.15; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (s.k === 'club') { const spr = ART.club_shot; if (spr) { const h = 22, w = h * spr.width / spr.height; ctx.drawImage(spr, -w / 2, -h / 2, w, h); } else { ctx.fillStyle = s.col; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, TAU); ctx.fill(); ctx.stroke(); } }
      else if (s.k === 'note') {
        ctx.rotate(-s.rot); ctx.fillStyle = s.col; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(-2, 4, s.r * 0.75, s.r * 0.55, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillRect(s.r * 0.4, -s.r * 1.3, 3, s.r * 1.6); ctx.beginPath(); ctx.moveTo(s.r * 0.4 + 3, -s.r * 1.3); ctx.quadraticCurveTo(s.r * 1.4, -s.r * 0.9, s.r * 1.1, -s.r * 0.2); ctx.lineTo(s.r * 0.4 + 3, -s.r * 0.8); ctx.fill();
      } else if (s.k === 'ball') {
        ctx.fillStyle = s.col; ctx.strokeStyle = '#2a2530'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c9c2b8'; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s.r, Math.sin(a) * s.r); ctx.lineTo(Math.cos(a + 0.2) * (s.r + 6), Math.sin(a + 0.2) * (s.r + 6)); ctx.lineTo(Math.cos(a + 0.4) * s.r, Math.sin(a + 0.4) * s.r); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, TAU); ctx.fill();
      }
      else if (s.k === 'bat') {
        ctx.rotate(-s.rot + Math.atan2(s.vy, s.vx) + Math.PI / 2); const f = Math.sin(s.rot * 2) * 0.35;
        ctx.fillStyle = '#b9a3ff'; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, s.r + 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = s.col; ctx.beginPath(); ctx.moveTo(0, -s.r * 0.5);
        ctx.quadraticCurveTo(-s.r * 1.6, -s.r * (1.1 + f), -s.r * 1.7, s.r * 0.2); ctx.lineTo(-s.r * 0.6, 0); ctx.lineTo(0, s.r * 0.6); ctx.lineTo(s.r * 0.6, 0); ctx.lineTo(s.r * 1.7, s.r * 0.2);
        ctx.quadraticCurveTo(s.r * 1.6, -s.r * (1.1 + f), 0, -s.r * 0.5); ctx.fill();
        ctx.fillStyle = '#ff6b8a'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2);
      }
      else if (s.k === 'star') {
        ctx.fillStyle = '#ffe066'; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, s.r + 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = s.col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? s.r * 0.45 : s.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      } else { ctx.fillStyle = s.col; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0, 0, s.r + 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // 퍼지는 충격파
    for (const w of G.waves) {
      const k = Math.min(1, w.t / w.dur), R = w.R0 + (w.R1 - w.R0) * k;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = w.col; ctx.lineWidth = 8 * (1 - k) + 2;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, R, R * 0.7, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    drawFx();
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
    const psx = VW / 2 + (ix - G.cam.x) * sc, psy = VH / 2 + (iy - 14 - G.cam.y) * sc;
    if (G.dark > 0) {
      // 악몽의 밤: 내 주변만 보여요
      const a = Math.min(1, G.dark / 0.6, (4.5 - G.dark) / 0.4) * 0.88;
      const gr = ctx.createRadialGradient(psx, psy, 110 * sc, psx, psy, 250 * sc);
      gr.addColorStop(0, 'rgba(20,12,36,0)'); gr.addColorStop(1, `rgba(20,12,36,${Math.max(0, a)})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    }
    if (G.curse > 0) {
      ctx.save(); ctx.translate(psx, psy); ctx.rotate(-now * 4);
      ctx.strokeStyle = '#7b4fd0'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(0, 0, 30 * sc, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      ctx.font = fs(18); ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText('거꾸로!', psx, psy - 46 * sc); ctx.fillStyle = '#7b4fd0'; ctx.fillText('거꾸로!', psx, psy - 46 * sc);
    }
    if (G.hurtFlash > 0) {
      const a = G.hurtFlash * (opts.lessFlash ? 0.18 : 0.45);
      const gr = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
      gr.addColorStop(0, 'rgba(232,80,80,0)'); gr.addColorStop(1, `rgba(232,80,80,${a})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    }
    drawArrows(sc);
    drawHUD(now);
    drawSlotBtns(now);
    drawCarBtn(now);
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
    const V = VEH[G.char], car = G.car.t > 0 && V && ART[V.art];
    if (car) {
      // 랏코 자동차: 그림이 왼쪽을 봐요 → 오른쪽으로 갈 때만 뒤집어요. 자전거: 그림이 오른쪽을 봐요 → 왼쪽을 볼 때 뒤집어요(멈춰도 보던 쪽 그대로).
      const h = V.h, w = h * car.width / car.height, bob = P.moving ? Math.abs(Math.sin(t * 16)) * 2 : Math.sin(t * 3) * 0.8, flip = V.faceLeft ? P.moving && P.fx > 0.1 : P.fx < -0.1;
      ctx.drawImage(shadow, x - 34, y - 8, 68, 18);
      if (blink) ctx.globalAlpha = 0.55;
      if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(car, -w / 2, y - h - bob + 4, w, h); ctx.restore(); }
      else ctx.drawImage(car, x - w / 2, y - h - bob + 4, w, h);
      ctx.globalAlpha = 1;
      if (P.moving && Math.random() < 0.3) puff(x - P.fx * 30, y - 6, 12, '#ffffff');
      return;
    }
    drawChar(ctx, G.char, x, y, t, { skin: G.skin, moving: P.moving || !!G.dash, fx: P.fx, fy: P.fy, hurt: P.hurtT > 0, alpha: blink ? 0.55 : null, low: P.hp <= P.max * 0.3 });
    if (P.stunT > 0) { // 돌뱀 눈빛: 분홍 돌이 되어 꼼짝 못해요
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#ff8fc8'; ctx.beginPath(); ctx.ellipse(x, y - 24, 30, 30, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; drawIco('star', x + Math.cos(a) * 26 - 9, y - 66 + Math.sin(a) * 6, 18); }
    }
  }

  // 캐릭터 그림 (게임과 선택 화면이 같이 씀)
  const FACE_LEFT = { chiikawa: 1, hachiware: 1 };
  function drawChar(c, kind, x, y, t, s) {
    const moving = !!s.moving, fx = s.fx == null ? 0.4 : s.fx, fy = s.fy || 0;
    const bob = moving ? Math.abs(Math.sin(t * 11)) * 3 : Math.sin(t * 2.2) * 1;
    const sq = moving ? 1 + Math.sin(t * 22) * 0.04 : 1 + Math.sin(t * 2.2) * 0.02;
    c.drawImage(shadow, x - 18, y - 5, 36, 12);
    if (s.alpha != null) c.globalAlpha = s.alpha;
    const skinned = !!(s.skin && ART[s.skin]), spr = skinned ? ART[s.skin] : ART[kind];
    if (spr) {
      const h = (s.size || 44) * sq, w = h * (spr.width / spr.height) / sq;
      const flip = !skinned && FACE_LEFT[kind] ? moving && fx > 0.1 : fx < -0.1; // 왼쪽을 보는 그림은 오른쪽으로 갈 때만 뒤집어요
      if (flip) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(spr, -w / 2, y - h - bob, w, h); c.restore(); }
      else c.drawImage(spr, x - w / 2, y - h - bob, w, h);
      c.globalAlpha = 1;
      return;
    }
    // 그림이 아직 없을 때의 임시 그림: 새싹 달린 동글이 (캐릭터마다 색만 달라요)
    const cy = y - 13 - bob, bw = 16 / sq, bh = 14 * sq;
    const body = s.hurt ? '#ffd6d6' : ({ chiikawa: '#fff1f4', hachiware: '#e6f2ff', usagi: '#fff6cc' })[kind] || '#ffffff';
    c.strokeStyle = '#4a3b35'; c.lineWidth = 2; c.lineJoin = 'round';
    c.strokeStyle = '#5f9e52'; c.beginPath(); c.moveTo(x, cy - bh); c.lineTo(x, cy - bh - 7); c.stroke();
    c.fillStyle = '#86c06a'; c.beginPath(); c.ellipse(x + 5, cy - bh - 8, 6, 3, -0.4, 0, TAU); c.fill();
    c.strokeStyle = '#4a3b35'; c.fillStyle = body; c.beginPath(); c.ellipse(x, cy, bw, bh, 0, 0, TAU); c.fill(); c.stroke();
    const ex = fx * 2.5, ey = fy * 1.5;
    c.fillStyle = '#4a3b35'; c.beginPath(); c.arc(x - 5 + ex, cy + ey, 2.2, 0, TAU); c.arc(x + 5 + ex, cy + ey, 2.2, 0, TAU); c.fill();
    c.globalAlpha = 1;
    if (s.low) { c.fillStyle = '#7fb3ff'; c.beginPath(); c.arc(x + 14, cy - 8 + Math.sin(t * 6) * 2, 2.5, 0, TAU); c.fill(); }
  }

  function drawEnemy(e, x, y, t) {
    const flash = e.flash > 0;
    if (e.hide) {
      // 의태 중인 풍뎅이: 똑같이 생긴 바위들이 들썩여요 (순간이동 중인 모몽가는 안 보여요)
      if (e.spots) e.spots.forEach((q, i) => {
        const j = Math.sin(t * 14 + i * 2) * 2;
        ctx.drawImage(shadow, q.x - 30, q.y - 8, 60, 18);
        ctx.fillStyle = '#9a8a78'; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(q.x + j, q.y - 20, 30, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b8a894'; ctx.beginPath(); ctx.ellipse(q.x - 8 + j, q.y - 28, 10, 6, -0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4a3b35'; ctx.font = '18px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', q.x + j, q.y - 46);
      });
      return;
    }
    if (e.airH) {
      // 공중: 땅엔 그림자만, 몸은 높이만큼 위로
      const k = 1 - e.airH / 300;
      ctx.drawImage(shadow, x - e.r * 1.2 * k, y - e.r * 0.35 * k, e.r * 2.4 * k, e.r * 0.8 * k);
      y -= e.airH;
    }
    if (e.under) {
      // 땅속: 흙더미만 보여요
      const w = Math.sin(t * 12 + e.ph) * 2;
      ctx.fillStyle = '#a0704a'; ctx.beginPath(); ctx.ellipse(x, y - 4, 16 + w, 7, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#7a5236'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + i * 9, y - 6 - Math.abs(Math.sin(t * 9 + i)) * 4, 3, 0, TAU); ctx.fill(); }
      return;
    }
    if (!e.airH) ctx.drawImage(shadow, x - e.r * 1.2, y - e.r * 0.35, e.r * 2.4, e.r * 0.8);
    let rx = e.r, ry = e.r * 0.85;
    if (e.type === 'hopper') {
      if (e.st === 'wait') { const k = 1 - Math.max(0, e.stT) / 0.8; rx *= 1 + 0.25 * k; ry *= 1 - 0.3 * k; }
      else { rx *= 0.85; ry *= 1.2; }
    } else { const w = Math.sin(e.ph * 6) * 0.06; rx *= 1 + w; ry *= 1 - w; }
    if (e.sq) { const k = e.sq * e.sq; rx *= 1 + 0.3 * k; ry *= 1 - 0.25 * k; }
    const cy = y - ry;
    if (e.type === 'mace' && e.st === 'spin') {
      // 쇠공 두 개가 빙빙 (닿으면 아파요)
      for (let i = 0; i < 2; i++) {
        const a = e.ph * 14 + i * Math.PI, bx = x + Math.cos(a) * 70, by = y - 14 + Math.sin(a) * 50;
        ctx.strokeStyle = '#6a6070'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(bx, by); ctx.stroke();
        ctx.fillStyle = '#4a4550'; ctx.strokeStyle = '#2a2530'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 13, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#e8574c'; ctx.beginPath(); ctx.ellipse(x, y, 70, 50, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    const spr = ART[e.art || e.type];
    if (spr) {
      const h = e.r * 2.9 * (ry / (e.r * 0.85)) * ((e.art || e.type) === 'anoko' ? 0.8 : 1), w = h * (spr.width / spr.height) * (rx / e.r); // 아노코는 옆으로 누운 긴 그림이라 조금 낮게
      if (e.type === 'boss' && e.revived) { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 9); ctx.fillStyle = e.kind === 'star' ? '#ff3b30' : '#7b4fd0'; ctx.beginPath(); ctx.ellipse(x, y - h / 2, w * 0.95, h * 0.8, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      if (e.type === 'boss' && e.final) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 6); ctx.fillStyle = e.enr ? '#c0392b' : '#6b4fa0'; ctx.beginPath(); ctx.ellipse(x, y - h / 2, w * 0.7, h * 0.62, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      if (e.type === 'clone') ctx.globalAlpha = 0.72;
      const flip = e.type !== 'boss' && (ELEFT[e.art || e.type] ? e.face > 0 : e.face < 0); // 그림이 보는 쪽에 맞춰 뒤집어요
      if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -w / 2, y - h, w, h); ctx.restore(); }
      else ctx.drawImage(spr, x - w / 2, y - h, w, h);
      ctx.globalAlpha = 1;
      if (e.say && G.t < e.sayUntil) { const pop = Math.min(1, (e.sayUntil - G.t) * 4); ctx.font = '26px Jua, sans-serif'; ctx.textAlign = 'center'; const tw = ctx.measureText(e.say).width + 28, bx = x, by = y - h - 34; ctx.globalAlpha = pop; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8372c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(bx - tw / 2, by - 24, tw, 40, 14); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx - 8, by + 15); ctx.lineTo(bx, by + 28); ctx.lineTo(bx + 8, by + 15); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillText(e.say, bx, by + 5); ctx.globalAlpha = 1; } // 보스 말풍선
      if (e.st === 'wind' || e.st === 'aim' || (e.st === 'warn' && e.type !== 'boss')) { ctx.fillStyle = Math.floor(t * 10) % 2 ? '#e8746c' : '#fff'; ctx.font = '22px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - h - 4); }
      if (e.st === 'glow') { const k = 1 - Math.max(0, e.stT) / 0.7; ctx.globalAlpha = 0.5 + 0.5 * k; ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y - h * 0.62, 6 + 10 * k, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      if (flash) { ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(spr, x - w / 2, y - h, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (e.type === 'boss' && e.st === 'stun') { for (let i = 0; i < 3; i++) { const a = t * 4 + (i * TAU) / 3; drawIco('star', x + Math.cos(a) * 34 - 10, y - h - 16 + Math.sin(a) * 8, 20); } }
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
      for (let i = 0; i < 3; i++) { const a = t * 4 + (i * TAU) / 3; drawIco('star', x + Math.cos(a) * 30 - 9, cy - e.r - 15 + Math.sin(a) * 8, 18); }
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

  // 반짝 효과: 'lighter'로 겹쳐 빛나게 (번쩍임 줄이기를 켜면 약하게)
  function drawFx() {
    const dim = opts.lessFlash ? 0.45 : 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of G.fx) {
      const k = f.t / f.life, a = (1 - k) * dim;
      if (f.k === 'ring') { ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = f.w * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.25 + 0.75 * (1 - (1 - k) * (1 - k))), 0, TAU); ctx.stroke(); }
      else if (f.k === 'flash') { ctx.globalAlpha = a * 0.8; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); g.addColorStop(0, f.col); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); }
      else if (f.k === 'beam') {
        ctx.globalAlpha = a; ctx.lineCap = 'round';
        ctx.strokeStyle = f.col; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
      } else if (f.k === 'bolt') {
        ctx.globalAlpha = a; ctx.lineJoin = 'round';
        for (const [col, lw] of [[f.col, 7], ['#ffffff', 2.5]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
          for (let i = 0; i < f.pts.length - 1; i++) {
            const p0 = f.pts[i], p1 = f.pts[i + 1];
            ctx.moveTo(p0.x, p0.y);
            for (let j = 1; j <= 4; j++) { const q = j / 4, jit = j < 4 ? (Math.sin(f.t * 90 + i * 7 + j * 3) * 9) : 0; ctx.lineTo(p0.x + (p1.x - p0.x) * q + jit, p0.y + (p1.y - p0.y) * q - jit); }
          }
          ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function drawAllies(t) {
    const A = G.ally;
    if (!A.ok || A.t <= 0) return;
    const fade = Math.min(1, A.t / 0.4);
    ALLIES.forEach((al, i) => {
      const h = A.a[i], spr = ART[al.art];
      const y = h.y - (h.hop || 0);
      ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = i ? '#7cc48a' : '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 22, 8, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = fade;
      if (spr) { const H = 46 + Math.sin(t * 8 + i) * 2, W = H * spr.width / spr.height; ctx.drawImage(spr, h.x - W / 2, y - H, W, H); }
      else { ctx.fillStyle = i ? '#9ccf6e' : '#ffd84a'; ctx.beginPath(); ctx.arc(h.x, y - 18, 16, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
  }
  // 동료 소환 버튼 (오른쪽 아래, 쿨타임 동안 회색 부채꼴)
  const carBtn = () => ({ x: VW - 58 - safe.r, y: VH - 64 - safe.b - (G.slots.length ? 112 : 0), r: 40 });
  function drawSumo(t) {
    const S = G.sumo;
    if (!S.ok || S.t <= 0) return;
    const spr = ART.sumo, fall = S.drop > 0 ? S.drop / 0.55 : 0, fade = Math.min(1, S.t / 0.4);
    ctx.drawImage(shadow, S.x - 34 * (1 - fall * 0.6), S.y - 8, 68 * (1 - fall * 0.6), 18);
    ctx.globalAlpha = fade;
    const H = 84 * (S.slap > 0 ? 1.06 : 1), y = S.y - fall * 420;
    if (spr) { const W = H * spr.width / spr.height, sk = S.slap > 0 ? 1.1 : 1; ctx.drawImage(spr, S.x - W * sk / 2, y - H, W * sk, H); }
    else { ctx.fillStyle = '#f3e3c4'; ctx.beginPath(); ctx.arc(S.x, y - 40, 34, 0, TAU); ctx.fill(); }
    if (S.slap > 0) { ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(S.x, S.y - 30, 95, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawCarBtn(t) {
    const C = G.car;
    if (!C.ok) return;
    const b = carBtn(), on = C.t > 0, ready = !on && C.cd <= 0;
    ctx.globalAlpha = 0.92; ctx.fillStyle = on ? '#dff0ff' : ready ? '#fff4c8' : '#e9e1d8'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = on || ready ? '#5aa8e0' : '#bcae9f'; ctx.stroke();
    const spr = ART[VEH[G.char].art]; if (spr) { const h = 58, w = Math.min(58, h * spr.width / spr.height), hh = w * spr.height / spr.width; ctx.drawImage(spr, b.x - w / 2, b.y - hh / 2 - 2, w, hh); }
    if (on) { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#2f7fc0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, -Math.PI / 2, -Math.PI / 2 + TAU * (C.t / T.CAR_DUR)); ctx.stroke(); }
    else if (!ready) { ctx.globalAlpha = 0.55; ctx.fillStyle = '#4a3b35'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * (C.cd / T.CAR_CD)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = fs(20); ctx.textAlign = 'center'; ctx.fillText(Math.ceil(C.cd), b.x, b.y + 7); }
    else { const p = 1 + Math.sin(t * 6) * 0.06; ctx.globalAlpha = 0.6; ctx.strokeStyle = '#5aa8e0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * p + 4, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4a3b35'; ctx.font = fs(14); ctx.textAlign = 'center';
    ctx.fillText(VEH[G.char].name + (usingTouch ? '' : ' [Shift]'), b.x, b.y + b.r + 16);
  }

  // ---------- 지역 소품 · 보스 울타리 (코드로 그린 바닥 장식, 부딪히지 않아요) ----------
  const PCH = 300;
  function drawProps(L, R, Tp, B, t) {
    const bm = BIOMES[G.biome];
    for (let cx = Math.floor(L / PCH) - 1; cx * PCH < R + PCH; cx++) for (let cy = Math.floor(Tp / PCH) - 1; cy * PCH < B + PCH; cy++) {
      const r = Q.mulberry32(((cx * 73856093) ^ (cy * 19349663) ^ (G.biome * 83492791)) >>> 0);
      const n = r() < 0.35 ? 0 : r() < 0.7 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const x = cx * PCH + r() * PCH, y = cy * PCH + r() * PCH, kind = bm.props[Math.floor(r() * bm.props.length)], s = 0.8 + r() * 0.5, v = r();
        if (x < L - 80 || x > R + 80 || y < Tp - 80 || y > B + 120) continue;
        drawProp(kind, x, y, s, t, v);
      }
    }
  }
  function drawProp(kind, x, y, s, t, v) {
    ctx.lineWidth = 2; ctx.strokeStyle = '#4a3b35'; ctx.lineJoin = 'round';
    ctx.drawImage(shadow, x - 24 * s, y - 6 * s, 48 * s, 14 * s);
    if (kind === 'bush') {
      ctx.fillStyle = '#86c06a';
      ctx.beginPath(); ctx.arc(x - 12 * s, y - 10 * s, 12 * s, 0, TAU); ctx.arc(x + 10 * s, y - 11 * s, 13 * s, 0, TAU); ctx.arc(x, y - 20 * s, 14 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9fb5'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 10 * s + i * 10 * s, y - 16 * s - (i % 2) * 6 * s, 2.6 * s, 0, TAU); ctx.fill(); }
    } else if (kind === 'flower') {
      ctx.strokeStyle = '#5f9e52'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 18 * s); ctx.stroke();
      ctx.fillStyle = ['#ffd1dc', '#fff4b0', '#d7c4ff'][Math.floor(v * 3)];
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + Math.sin(t * 1.5 + x) * 0.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 6 * s, y - 20 * s + Math.sin(a) * 6 * s, 4.5 * s, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y - 20 * s, 3.5 * s, 0, TAU); ctx.fill();
    } else if (kind === 'rock') {
      ctx.fillStyle = G.biome === 3 ? '#7d77a8' : '#c9bfae';
      ctx.beginPath(); ctx.moveTo(x - 20 * s, y); ctx.lineTo(x - 16 * s, y - 16 * s); ctx.lineTo(x - 2 * s, y - 24 * s); ctx.lineTo(x + 16 * s, y - 15 * s); ctx.lineTo(x + 20 * s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - 5 * s, y - 16 * s, 6 * s, 3 * s, -0.4, 0, TAU); ctx.fill();
    } else if (kind === 'tree') {
      ctx.fillStyle = '#9a6b45'; ctx.fillRect(x - 6 * s, y - 34 * s, 12 * s, 34 * s); ctx.strokeRect(x - 6 * s, y - 34 * s, 12 * s, 34 * s);
      const sway = Math.sin(t * 1.2 + x * 0.01) * 2;
      ctx.fillStyle = v < 0.5 ? '#5f9e52' : '#6fae5c';
      ctx.beginPath(); ctx.arc(x - 18 * s + sway, y - 44 * s, 18 * s, 0, TAU); ctx.arc(x + 18 * s + sway, y - 46 * s, 18 * s, 0, TAU); ctx.arc(x + sway, y - 62 * s, 22 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x - 6 * s + sway, y - 68 * s, 8 * s, 0, TAU); ctx.fill();
    } else if (kind === 'mush') {
      ctx.fillStyle = '#fff4e6'; ctx.fillRect(x - 4 * s, y - 14 * s, 8 * s, 14 * s); ctx.strokeRect(x - 4 * s, y - 14 * s, 8 * s, 14 * s);
      ctx.fillStyle = v < 0.5 ? '#e8746c' : '#b48ad8'; ctx.beginPath(); ctx.ellipse(x, y - 15 * s, 14 * s, 9 * s, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 5 * s, y - 19 * s, 2.2 * s, 0, TAU); ctx.arc(x + 5 * s, y - 18 * s, 1.8 * s, 0, TAU); ctx.fill();
    } else if (kind === 'log') {
      ctx.fillStyle = '#a87a52'; rrect(x - 26 * s, y - 14 * s, 52 * s, 14 * s, 7 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e2c49a'; ctx.beginPath(); ctx.ellipse(x + 26 * s, y - 7 * s, 5 * s, 7 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (kind === 'pillar') {
      ctx.fillStyle = '#d8c4a0'; ctx.fillRect(x - 10 * s, y - 46 * s, 20 * s, 46 * s); ctx.strokeRect(x - 10 * s, y - 46 * s, 20 * s, 46 * s);
      ctx.fillStyle = '#c4ab82'; ctx.fillRect(x - 14 * s, y - 52 * s, 28 * s, 8 * s); ctx.strokeRect(x - 14 * s, y - 52 * s, 28 * s, 8 * s);
    } else if (kind === 'crystal') {
      const c = G.biome === 3 ? '#b9a3ff' : '#9fd8ff', gl = 0.5 + 0.5 * Math.sin(t * 2 + x);
      ctx.globalAlpha = 0.25 * gl; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - 16 * s, 24 * s, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - 34 * s); ctx.lineTo(x + 9 * s, y - 12 * s); ctx.lineTo(x, y); ctx.lineTo(x - 9 * s, y - 12 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (kind === 'lamp') {
      ctx.fillStyle = '#5a4a6a'; ctx.fillRect(x - 2 * s, y - 40 * s, 4 * s, 40 * s);
      const gl = 0.6 + 0.4 * Math.sin(t * 3 + x);
      ctx.globalAlpha = 0.35 * gl; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(x, y - 44 * s, 22 * s, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y - 44 * s, 7 * s, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  // 보스 울타리: 보스전 동안 둥근 울타리 밖으로 못 나가요 (좁아지기도 해요)
  function drawArena(t) {
    const A = G.arena;
    if (!A) return;
    const col = BIOMES[G.biome].fence, n = Math.max(24, Math.round(A.r / 11));
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#2a1f2a';
    ctx.beginPath(); ctx.arc(A.x, A.y, A.r + 2000, 0, TAU); ctx.arc(A.x, A.y, A.r, 0, TAU, true); ctx.fill('evenodd'); ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.strokeStyle = '#4a3b35'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, x = A.x + Math.cos(a) * A.r, y = A.y + Math.sin(a) * A.r, h = 24 + 5 * Math.sin(i * 1.7 + t * 4);
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 7, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (A.r > A.tr + 2) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 12); ctx.strokeStyle = '#e8574c'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(A.x, A.y, A.tr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
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

  // 캔버스 위에 아이콘 (SVG를 미리 풀어 둔 그림)
  function drawIco(n, x, y, s) { const im = icoImg(n); if (im.complete && im.naturalWidth) ctx.drawImage(im, x, y, s, s); }
  // 글자에 진한 테두리 (밝은 풀밭 위에서도 읽혀요)
  function outText(txt, x, y, col) { ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(74,59,53,.9)'; ctx.strokeText(txt, x, y); ctx.fillStyle = col || '#fff'; ctx.fillText(txt, x, y); }
  function weaponIcon(k, x, y, s) {
    const W = WEAP[k] || SUBS[k];
    if (W && W.img && ART[k]) { const spr = ART[k], ar = spr.width / spr.height, h = Math.min(s * 0.95, s * 1.2 / ar), w = h * ar; ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(-0.45); ctx.drawImage(spr, -w / 2, -h / 2, w, h); ctx.restore(); }
    else drawIco(W ? W.ic : 'star', x, y, s);
  }
  function drawHUD(t) {
    const P = G.player, big = opts.bigText ? 1.15 : 1;
    const x0 = 12 + safe.l, y0 = 12 + safe.t, bw = Math.min(230, VW * 0.4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // 체력: 하트 + 막대 (깎인 만큼 노란 잔상이 잠깐 남았다가 줄어요)
    const hpk = Math.max(0, P.hp) / P.max, gk = Math.max(0, G.hpGhost) / P.max, low = hpk <= 0.3;
    const bx = x0 + 22, bh = 22;
    rrect(bx, y0 + 4, bw, bh, 11); ctx.fillStyle = 'rgba(74,59,53,.7)'; ctx.fill();
    if (gk > hpk) { rrect(bx + 3, y0 + 7, (bw - 6) * gk, bh - 6, 8); ctx.fillStyle = '#ffe1a8'; ctx.fill(); }
    if (hpk > 0) {
      rrect(bx + 3, y0 + 7, Math.max(10, (bw - 6) * hpk), bh - 6, 8);
      ctx.globalAlpha = low ? 0.75 + 0.25 * Math.sin(t * 8) : 1; ctx.fillStyle = low ? '#e8746c' : '#f6a6b8'; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,.45)'; rrect(bx + 6, y0 + 8, Math.max(4, (bw - 12) * hpk), 4, 2); ctx.fill();
      if (G.healGlow > 0) { ctx.globalAlpha = G.healGlow * 0.8; ctx.fillStyle = '#c8f5d0'; rrect(bx + 3 + Math.max(0, (bw - 6) * hpk - 14), y0 + 7, 14, bh - 6, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    const hs = 40 + (low ? Math.sin(t * 8) * 3 : 0) + G.healGlow * 6;
    drawIco('heart', x0 + 4 - (hs - 40) / 2, y0 - 5 - (hs - 40) / 2, hs);
    ctx.font = fs(14); outText(`${Math.max(0, Math.ceil(P.hp))} / ${P.max}` + (G.char === 'chiikawa' && P.hp <= P.max * 0.4 ? '  버티기!' : ''), bx + 22, y0 + 15);
    if (G.vamp || G.car.t > 0) {
      // 흡혈 · 자동차 표시 (체력 막대 오른쪽)
      const tags = []; if (G.vamp) tags.push(['흡혈 ' + (helperOn() ? '2%' : '1%'), '#c0392b']); if (G.car.t > 0) tags.push([VEH[G.char].name + ' ' + Math.ceil(G.car.t), '#2f7fc0']);
      let tx = bx + bw + 8; ctx.font = fs(13);
      for (const [txt, col] of tags) { const w = ctx.measureText(txt).width + 14; rrect(tx, y0 + 5, w, 20, 10); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, tx + 7, y0 + 15); tx += w + 6; }
    }
    // 증표 게이지: 보석 + 막대 + 레벨 배지
    const y1 = y0 + 38, xb = G.xpBump * G.xpBump * 3, xk = Math.min(1, G.xp / G.need);
    rrect(bx, y1 + 2 - xb / 2, bw - 34, 14 + xb, 7); ctx.fillStyle = 'rgba(74,59,53,.6)'; ctx.fill();
    if (xk > 0) { rrect(bx + 2, y1 + 4 - xb / 2, Math.max(6, (bw - 38) * xk), 10 + xb, 5); ctx.fillStyle = G.xpBump > 0.5 ? '#bcd8ff' : '#7fb3ff'; ctx.fill(); }
    drawIco('gem', x0 + 8, y1 - 4, 26);
    const lx = bx + bw - 30;
    rrect(lx, y1 - 4, 32, 26, 10); ctx.fillStyle = '#fffaf3'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#4a3b35'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#4a3b35'; ctx.font = fs(11); ctx.fillText('Lv', lx + 16, y1 + 2); ctx.font = fs(14); ctx.fillText(G.level, lx + 16, y1 + 14);
    ctx.textAlign = 'left';
    // 무기 칸: 아이콘 + 레벨 점 5개 (Lv.5는 금색 테두리)
    let sy = y1 + 30;
    const S = Math.round(34 * big), gap = 6;
    let sx = x0;
    const slot = (k, l, sub) => {
      const evo = !sub && l >= 5;
      rrect(sx, sy, S, S, 10); ctx.fillStyle = evo ? '#fff4c8' : 'rgba(255,250,243,.92)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = evo ? '#e0a83a' : sub ? '#b9a3ff' : '#4a3b35'; ctx.stroke();
      weaponIcon(k, sx + 4, sy + 3, S - 8);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i < l ? (evo ? '#e0a83a' : sub ? '#9b85e6' : '#7cc48a') : 'rgba(74,59,53,.25)'; ctx.beginPath(); ctx.arc(sx + 6 + i * (S - 12) / 4, sy + S + 5, 2.6, 0, TAU); ctx.fill(); }
      sx += S + gap;
    };
    Object.keys(G.weapons).forEach((k) => slot(k, G.weapons[k], false));
    if (Object.keys(G.subs).length) sx += 4;
    Object.keys(G.subs).forEach((k) => slot(k, G.subs[k], true));
    let wy = sy + S + 22;
    if (G.streak >= 2) { drawIco('sparkle', x0, wy - 12, 24); ctx.font = fs(16); outText(`연속 정답 ×${G.streak}`, x0 + 28, wy, '#ffe066'); wy += 26; }

    // 가운데 위: 시계 알약 + 진행 길 (보스 왕관·대습격 표시) 또는 보스 체력
    ctx.textAlign = 'center';
    const narrow = VW < 620;
    const cw = narrow ? Math.min(240, VW - 24) : Math.min(300, VW * 0.36);
    const ccx = narrow ? x0 + cw / 2 : VW / 2, cx0 = ccx - cw / 2;
    const cy0 = narrow ? wy + 4 : 12 + safe.t;
    if (G.boss) {
      const b = G.boss, k = Math.max(0, b.hp / b.max);
      rrect(cx0, cy0 + 14, cw, 22, 11); ctx.fillStyle = 'rgba(74,59,53,.75)'; ctx.fill();
      rrect(cx0 + 3, cy0 + 17, Math.max(8, (cw - 6) * k), 16, 8); ctx.fillStyle = b.st === 'stun' ? '#ffe066' : b.enr ? '#e8574c' : '#c0392b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx0 + cw / 2, cy0 + 17); ctx.lineTo(cx0 + cw / 2, cy0 + 33); ctx.stroke();
      drawIco(b.final ? 'skull' : 'crown', cx0 - 16, cy0 + 6, 36);
      ctx.font = fs(16); outText(b.name + (b.st === 'stun' ? ' · 기절!' : b.enr ? ' · 화남!' : ''), ccx, cy0 + 4);
      drawIco('pause', ccx - 62, cy0 + 40, 16); ctx.font = fs(13); outText(`시계 멈춤 ${fmt(G.clock)}`, ccx + 8, cy0 + 49);
    } else {
      const nb = bossList()[G.bossIdx], soon = nb && nb.at - G.clock < 10;
      rrect(ccx - 84, cy0, 168, 32, 16); ctx.fillStyle = soon ? '#fde8e6' : 'rgba(255,250,243,.95)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#4a3b35'; ctx.stroke();
      drawIco('clock', ccx - 80, cy0 + 2, 28);
      ctx.fillStyle = '#4a3b35'; ctx.font = fs(19); ctx.fillText(`${fmt(G.clock)} / ${fmt(T.RUN)}`, ccx + 14 + (soon ? Math.sin(t * 20) * 1.2 : 0), cy0 + 17);
      const ty = cy0 + 44;
      rrect(cx0, ty - 4, cw, 8, 4); ctx.fillStyle = 'rgba(74,59,53,.35)'; ctx.fill();
      rrect(cx0, ty - 4, Math.max(8, cw * Math.min(1, G.clock / T.RUN)), 8, 4); ctx.fillStyle = '#f2c14e'; ctx.fill();
      if (!G.rushDone) drawIco('monster', cx0 + cw * (T.RUSH_AT / T.RUN) - 9, ty - 9, 18);
      bossList().forEach((B, i) => { if (i < G.bossIdx) return; const s = B.final ? 26 : 20; drawIco(B.final ? 'skull' : 'crown', cx0 + cw * (B.at / T.RUN) - s / 2, ty - s / 2, s); });
      if (soon) { ctx.font = fs(13); outText('곧 보스!', ccx, ty + 18, '#ffd0c8'); }
    }
    // 오른쪽 위: 쫓아낸 수 (쉬기 버튼 왼쪽)
    ctx.textAlign = 'right';
    const kx = VW - 74 - safe.r, ky = 36 + safe.t, kb = 1 + G.killBump * 0.15;
    ctx.font = fs(20 * kb); outText(String(G.kills), kx, ky);
    drawIco('monster', kx - ctx.measureText(String(G.kills)).width - 32, ky - 15, 28);
    ctx.textBaseline = 'alphabetic';
    if (QA) {
      ctx.textAlign = 'left'; ctx.font = '12px monospace'; ctx.fillStyle = '#000';
      ctx.fillText(`QA seed ${G.seed} · 적 ${G.enemies.length} · 프레임 ${frameMs.toFixed(1)}ms 최악 ${worstMs.toFixed(1)}ms · K처치 T+30초 B보스 I무적 L레벨`, 10, VH - 10);
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
      cvs.width = cvs.height = 144; cvs.style.width = cvs.style.height = '68px';
      const c = cvs.getContext('2d'); c.scale(2.25, 2.25);
      drawChar(c, k, 32, 58, 1.3, { size: 52 });
      if (!open) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#6b5c55'; c.fillRect(0, 0, 64, 64); }
      b.appendChild(cvs);
      b.insertAdjacentHTML('beforeend', open
        ? `<div class="info"><div class="nm">${C.name}</div><div class="wp">${ico(W.ic)}${W.name}${WEAP['rod_' + k] ? ` · <img src="art/${WEAP['rod_' + k].img}" alt="">토벌봉` : ''}${C.speed > 1.1 ? ' · 빠름' : ''}</div><div class="ds"><b>${C.passive}</b> ${C.pdesc}${C.bonus ? (hardBonus() ? `<br><span class="bon"><b>${C.bonus.name}</b> 체력 ${C.bonus.hp} · ${C.bonus.desc}</span>` : `<br><span class="bon off">${ico('lock')} 하드를 깨면 체력 ${C.bonus.hp} · ${C.bonus.name}</span>`) : ''}</div><div class="best">최고 기록 ${best[k] || 0}마리</div></div>`
        : `<div class="info"><div class="nm">${ico('lock')}???</div><div class="ds">마지막 보스를 쓰러뜨리면 함께해요</div></div>`);
      b.addEventListener('click', () => {
        Snd.unlock();
        if (!open) { toast('10분을 버티고 마지막 보스를 쓰러뜨리면 열려요!'); Snd.play('no'); return; }
        selChar = k; store.set('chii_char', k); Snd.play('card'); renderChars();
      });
      box.appendChild(b);
    });
  }
  function renderModes() {
    const box = $('modeList');
    box.innerHTML = '';
    if (selMode === 'extreme' && !xOpen()) selMode = 'hard';
    Object.keys(DIFF).forEach((k) => {
      const b = document.createElement('button');
      if (k === 'extreme' && !xOpen()) {
        b.className = 'mode m-extreme locked'; b.setAttribute('aria-disabled', 'true');
        b.innerHTML = `${ico('lock')}<span class="nm">${DIFF[k].name}</span><span class="ds">하드를 깨면 열려요</span>`;
        b.addEventListener('click', () => { Snd.play('no'); toast('하드 모드를 클리어하면 익스트림이 열려요'); });
        box.appendChild(b); return;
      }
      b.className = 'mode m-' + k + (k === selMode ? ' on' : '');
      b.setAttribute('aria-pressed', String(k === selMode));
      b.innerHTML = `${ico(k === 'normal' ? 'heart' : 'skull')}<span class="nm">${DIFF[k].name}</span><span class="ds">${DIFF[k].desc}</span>`;
      b.addEventListener('click', () => { Snd.unlock(); selMode = k; store.set('chii_mode', k); Snd.play('card'); renderModes(); });
      box.appendChild(b);
    });
    // 오늘의 토벌 의뢰: 고른 모드의 보스 순서
    const M = DIFF[selMode], L = M.bosses || BOSSES, fin = '검은 별똥별';
    $('qBody').innerHTML = M.bosses ? '10분 버티고 <b>데카츠요</b>의 정체를 밝혀요!' : `10분 버티고 <b>${fin}</b> 물리치기!`;
    const steps = L.map((B) => [B.at, B.name.replace(' (의태형)', '')]);
    if (!M.bosses) steps.splice(2, 0, [T.RUSH_AT, '대습격']);
    $('qSteps').innerHTML = steps.map(([at, n], i) => `<span${i === steps.length - 1 ? ' class="last"' : ''}><b>${fmt(at)}</b> ${n}</span>`).join('');
  }
  function refreshTitle() {
    renderChars(); renderModes();
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
    if (items.length < 4) { toast('문항이 4개 이상 있어야 시작할 수 있어요. 선생님께 말해 주세요'); return; }
    if (isTouchDev && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (selMode === 'extreme' && !xOpen()) selMode = 'hard';
    newRun();
    if (G.car.ok) setTimeout(() => { if (G && state === 'play') toast(usingTouch ? `오른쪽 아래 ${VEH[G.char].name} 버튼: 10초 동안 빠르고 단단해요` : `Shift 키: ${VEH[G.char].name}를 타면 10초 동안 1.5배 빠르고 피해 -20%`, 5000); }, 2500);
    if (testOn) { G.test = true; G.qaInv = true; toast('테스트 모드: 문제 없이 · 무적 켬 · 왼쪽 버튼으로 시간·보스·레벨 조절', 4500); }
    ['title', 'result', 'err', 'pause', 'settings', 'how', 'note', 'revEnd', 'dex'].forEach(hide); rv = null;
    setState('play');
    acc = 0; lastT = performance.now();
    if (!seen.move) toast(usingTouch ? '화면을 누른 채 끌어서 움직여요' : '방향키나 WASD로 움직여요', 0);
  }
  function goHome() { ['result', 'err', 'pause', 'quiz', 'cards', 'settings', 'how', 'note', 'revEnd'].forEach(hide); quiz = null; rv = null; G = null; setState('title'); refreshTitle(); show('title'); }
  function pauseGame() { if (state !== 'play') return; setState('pause'); clearInput(); show('pause'); }
  function openSettings() {
    $('optSound').checked = opts.sound; $('optMusic').checked = opts.music; $('optVol').value = opts.vol; $('optShakeAmt').value = opts.shakeAmt;
    $('optFlash').checked = opts.lessFlash; $('optBig').checked = opts.bigText;
    $('optVolV').textContent = opts.vol + '%'; $('optShakeV').textContent = opts.shakeAmt + '%';
    show('settings');
  }
  function applyOpts() { document.body.classList.toggle('big', !!opts.bigText); store.set(K_OPT, opts); }
  function resumeGame() { hide('settings'); hide('how'); hide('pause'); setState('play'); lastT = performance.now(); acc = 0; }

  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('homeBtn').addEventListener('click', goHome);
  $('howBtn').addEventListener('click', () => show('how'));
  $('howBtn2').addEventListener('click', () => show('how'));
  $('editBtn').addEventListener('click', openTeacher);
  $('legalBtn').addEventListener('click', () => { Snd.play('click'); show('legal'); });
  $('recBtn').addEventListener('click', () => { renderRecords(); show('records'); });
  $('dexBtn').addEventListener('click', () => { renderDex(); show('dex'); });
  // ---------- 스킨 상점 (관리자 테스트 모드에서만): 수학 5문제 = 가챠권 1장 ----------
  const K_SHOP = 'chii_shop_v1';
  const shopGet = () => Object.assign({ tk: 0, ok: 0, own: {}, eq: {} }, store.get(K_SHOP, {}));
  let shopQ = null;
  // 수학 문제: 선생님 엑셀 360문제 (mathq.js) · 방금 나온 문제는 30개 동안 다시 안 나와요
  const MATH_Q = window.MATH_QUESTIONS || [], MATH_UNIT = { '1단원': '1단원 · 수의 범위와 어림하기', '2단원': '2단원 · 분수의 곱셈', '4단원': '4단원 · 소수의 곱셈' };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const recentQ = [];
  function newMath() {
    let k; do k = Math.floor(Math.random() * MATH_Q.length); while (recentQ.includes(k) && recentQ.length < MATH_Q.length);
    recentQ.push(k); if (recentQ.length > 30) recentQ.shift();
    const [u, q, a] = MATH_Q[k], frac = /기약분수/.test(q);
    shopQ = { q, a, frac };
    $('shopUnit').textContent = MATH_UNIT[u] || u;
    $('shopQ').textContent = q.replace(/\s*\((자연수|소수|기약분수)로 입력[^)]*\)/, '');
    $('shopIn').hidden = frac; $('shopFrac').hidden = !frac; $('fracTip').hidden = !frac;
    $('shopIn').setAttribute('inputmode', /소수/.test(q) ? 'decimal' : 'numeric');
    $('shopIn').placeholder = /소수로/.test(q) ? '소수' : '자연수';
    ['shopIn', 'fW', 'fN', 'fD'].forEach((id) => { $(id).value = ''; $(id).classList.remove('bad'); });
    (frac ? $('fN') : $('shopIn')).focus();
  }
  // 답 확인: 'ok' 정답 · 'reduce' 값은 맞는데 약분이 덜 됨 · 'no' 틀림 · null 빈칸
  function checkMath(Q) {
    if (Q.frac) {
      const w = $('fW').value.trim(), n = $('fN').value.trim(), d = $('fD').value.trim();
      if (!n || !d) return null;
      if (!/^\d*$/.test(w) || !/^\d+$/.test(n) || !/^\d+$/.test(d) || +d === 0) return 'no';
      const [an, ad] = Q.a.includes('/') ? Q.a.split('/').map(Number) : [+Q.a, 1];
      const W = +w || 0, N = +n, D = +d;
      if ((W * D + N) * ad !== an * D) return 'no';
      return gcd(N, D) === 1 && !(W && N >= D) ? 'ok' : 'reduce';
    }
    const v = $('shopIn').value.trim().replace(',', '.');
    if (!v) return null;
    return /^\d*\.?\d+$/.test(v) && Math.abs(+v - +Q.a) < 1e-9 ? 'ok' : 'no';
  }
  const showAns = (a) => { if (!a.includes('/')) return a; const [n, d] = a.split('/').map(Number); return n > d && n % d ? `${a} (= ${Math.floor(n / d)}과 ${n % d}/${d})` : a; };
  function renderShop() {
    const d = shopGet();
    $('shopTk').textContent = d.tk; $('shopProg').textContent = `(지금 ${d.ok}/5)`; $('mathProg').textContent = `· 지금 ${d.ok}/5`; $('mathTk').textContent = d.tk; $('shopDraw').disabled = d.tk < 1;
    $('shopGrid').innerHTML = Object.keys(SHOP_NAMES).map((c) => `<div class="shop-row"><h3>${CHARS[c].name}</h3>` + SHOP.filter((s) => s.c === c).map((s) => {
      const n = d.own[s.id] || 0;
      return `<button class="sk k${s.r}${n ? '' : ' no'}${d.eq[c] === s.id ? ' on' : ''}" data-sk="${s.id}" title="${RAR_NM[s.r]} ${RAR_P[s.r]}% · ${s.n}"><img src="art/${ART_FILES[s.id]}" alt="">${n ? escapeHtml(s.n) : '???'}<small class="r${s.r}">${RAR_NM[s.r]} ${RAR_P[s.r]}%</small>${n > 1 ? `<em>×${n}</em>` : ''}</button>`;
    }).join('') + '</div>').join('');
  }
  function shopAnswer() {
    if (!shopQ || mathLocked()) return;
    const res = checkMath(shopQ);
    if (!res) { $('shopMsg').textContent = '답을 써 주세요'; return; }
    if (res === 'reduce') { $('shopMsg').textContent = '값은 맞아요! 기약분수가 되도록 약분해서 다시 써 보세요'; ['fN', 'fD'].forEach((id) => $(id).classList.add('bad')); Snd.play('no'); return; }
    const d = shopGet();
    if (res === 'ok') {
      d.ok++; d.wrong = 0; Snd.play('ok');
      if (d.ok >= 5) { d.ok = 0; d.tk++; $('shopMsg').textContent = '정답! 가챠권 1장을 받았어요'; Snd.play('cheer'); }
      else $('shopMsg').textContent = `정답! ${5 - d.ok}개 더 맞히면 가챠권`;
    } else {
      // 틀리면 가챠권은 절대 없어요. 3번 연속 틀리면 30초 쉬기 (창을 닫거나 새로 고쳐도 이어져요)
      Snd.play('no'); d.wrong = (d.wrong || 0) + 1;
      $('shopMsg').textContent = `아쉬워요. 답은 ${showAns(shopQ.a)}` + (d.wrong < 3 ? ` · 연속 오답 ${d.wrong}/3` : '');
      if (d.wrong >= 3) { d.wrong = 0; d.lockUntil = Date.now() + 30000; }
    }
    store.set(K_SHOP, d); renderShop(); newMath(); mathLockTick();
  }
  const mathLocked = () => (shopGet().lockUntil || 0) > Date.now();
  let lockTimer = 0;
  function mathLockTick() {
    clearTimeout(lockTimer);
    const left = Math.ceil(((shopGet().lockUntil || 0) - Date.now()) / 1000), on = left > 0;
    $('mathLock').hidden = !on; $('mathLockT').textContent = left;
    ['shopIn', 'fW', 'fN', 'fD', 'shopGo'].forEach((id) => { $(id).disabled = on; });
    if (on) lockTimer = setTimeout(mathLockTick, 250);
    else if ($('shopMsg').dataset.locked) { delete $('shopMsg').dataset.locked; $('shopMsg').textContent = '다시 풀 수 있어요!'; (shopQ && shopQ.frac ? $('fN') : $('shopIn')).focus(); }
    if (on) $('shopMsg').dataset.locked = '1';
  }
  function shopDraw() {
    const d = shopGet(); if (d.tk < 1) return;
    let x = Math.random() * 100, s = SHOP[SHOP.length - 1]; // 스킨마다 등급 확률(3·2·1·0.5%)만큼
    for (const o of SHOP) { x -= RAR_P[o.r]; if (x < 0) { s = o; break; } }
    const r = s.r;
    d.tk--; const dup = !!d.own[s.id]; d.own[s.id] = (d.own[s.id] || 0) + 1; store.set(K_SHOP, d);
    $('shopRes').innerHTML = `<img src="art/${ART_FILES[s.id]}" alt=""><div class="r${r}"><b>${RAR_NM[r]} ${RAR_P[r]}%</b> · ${CHARS[s.c].name} ${escapeHtml(s.n)}${dup ? ' (또 나왔어요!)' : ' NEW!'}</div>`;
    Snd.play(r >= 2 ? 'cheer' : 'card'); renderShop();
  }
  $('shopBtn').addEventListener('click', () => { renderShop(); $('shopRes').innerHTML = ''; show('shop'); });
  $('mathOpen').addEventListener('click', () => { renderShop(); newMath(); $('shopMsg').textContent = '\u00a0'; show('mathPage'); mathLockTick(); });
  $('mathClose').addEventListener('click', () => { clearTimeout(lockTimer); hide('mathPage'); renderShop(); });
  $('shopGo').addEventListener('click', shopAnswer);
  $('shopIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') shopAnswer(); });
  $('fW').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('fN').focus(); });
  $('fN').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('fD').focus(); });
  $('fD').addEventListener('keydown', (e) => { if (e.key === 'Enter') shopAnswer(); });
  $('shopDraw').addEventListener('click', shopDraw);
  $('shopGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sk]'); if (!b || b.classList.contains('no')) return;
    const s = SHOP.find((x) => x.id === b.dataset.sk), d = shopGet();
    d.eq[s.c] = d.eq[s.c] === s.id ? null : s.id; store.set(K_SHOP, d); renderShop();
    toast(d.eq[s.c] ? `${CHARS[s.c].name}: ${s.n} 입었어요` : `${CHARS[s.c].name}: 기본 모습`);
  });
  $('pauseBtn').addEventListener('click', pauseGame);
  $('resumeBtn').addEventListener('click', resumeGame);
  $('quitBtn').addEventListener('click', () => { if (confirm('이번 판을 그만할까요? 기록은 남지 않아요.')) goHome(); });
  // 배경 음악 켜기/끄기 (게임 중 오른쪽 위 음표 버튼 · 설정 · M 키). 효과음과 따로예요.
  function setMusic(on) {
    opts.music = on; applyOpts();
    const b = $('musicBtn'); b.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? '배경 음악 끄기' : '배경 음악 켜기');
    $('optMusic').checked = on;
  }
  setMusic(opts.music);
  $('musicBtn').addEventListener('click', (e) => { Snd.unlock(); setMusic(!opts.music); toast(opts.music ? '배경 음악 켬' : '배경 음악 끔', 1200); e.currentTarget.blur(); });
  $('optMusic').addEventListener('change', (e) => setMusic(e.target.checked));
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { setMusic(!opts.music); if (state === 'play') toast(opts.music ? '배경 음악 켬' : '배경 음악 끔', 1200); } });
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
      // 음악: 보스가 있으면 보스 음악, 아니면 기본 음악 (쉬기·결과·문제 화면에선 작게)
      Music.want = G && G.boss && state !== 'result' ? 'boss' : 'main';
      Music.duck = state === 'play' || state === 'cards' || state === 'title' ? 1 : 0.5;
      Music.tick(dt);
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
  // ---------- 문항 관리 (선생님 코드로 잠김) ----------
  // 코드 글자는 파일에 두지 않고 해시만. 기본 코드는 사용법.md에 있어요. 이 기기에서 바꾸면 그 해시를 저장해요.
  const K_TCODE = 'chii_tcode_v1', TCODE_DEFAULT = '1ilpa20';
  function openTeacher() { $('tgIn').value = ''; $('tgMsg').textContent = ''; show('tgate'); }
  function tryTeacher() {
    if (gateHash($('tgIn').value) === store.get(K_TCODE, TCODE_DEFAULT)) { hide('tgate'); Snd.play('ok'); openEditor(); }
    else { Snd.play('no'); $('tgMsg').textContent = '코드가 달라요.'; const p = $('tgate').querySelector('.panel'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); $('tgIn').select(); }
  }
  $('tgGo').addEventListener('click', tryTeacher);
  $('tgIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryTeacher(); } });

  let edItems = [], edDirty = false, edUnit = '', edEdit = -1;
  const cloneItem = (it) => ({ tag: it.tag, diff: it.diff, q: it.q, ans: it.ans, wrongs: it.wrongs.slice(), exp: it.exp || '' });
  const cell = (v) => String(v || '').replace(/\|/g, '｜').replace(/\r?\n/g, '\\n');
  function edText(list) {
    return ['유형|난이도|문제|정답|오답1|오답2|오답3|해설'].concat(list.map((it) =>
      [it.tag, it.diff, it.q, it.ans, it.wrongs[0], it.wrongs[1], it.wrongs[2], it.exp].map(cell).join('|'))).join('\n');
  }
  function setDirty(v) { edDirty = v; $('qApply').classList.toggle('dirty', v); $('qApply').querySelector('span').textContent = v ? '저장하기 (바뀐 내용 있음)' : '저장하기'; }
  function openEditor() {
    edItems = items.map(cloneItem); edUnit = ''; $('edSearch').value = '';
    $('errs').textContent = ''; $('okmsg').textContent = '';
    setDirty(false); edTab('edList'); renderEd(); show('editor');
  }
  function edTab(id) {
    ['edList', 'edPaste', 'edCode'].forEach((k) => { $(k).hidden = k !== id; });
    document.querySelectorAll('#editor .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    if (id === 'edPaste') $('qtext').value = edText(edItems);
  }
  document.querySelectorAll('#editor .tab').forEach((b) => b.addEventListener('click', () => edTab(b.dataset.tab)));
  function renderEd() {
    const cnt = {}; edItems.forEach((i) => { cnt[i.tag] = (cnt[i.tag] || 0) + 1; });
    const nShort = edItems.filter((i) => !i.wrongs.length).length;
    $('edCount').textContent = `${edItems.length}문제 · 객관식 ${edItems.length - nShort} · 주관식 ${nShort} · 단원 ${Object.keys(cnt).length}개`;
    const ub = $('edUnits'); ub.innerHTML = '';
    const chip = (label, v) => { const b = document.createElement('button'); b.className = 'unit' + (edUnit === v ? ' on' : ''); b.innerHTML = label; b.addEventListener('click', () => { edUnit = v; renderEd(); }); ub.appendChild(b); };
    chip(`전체 <span>${edItems.length}</span>`, '');
    Object.keys(cnt).forEach((t) => chip(`${escapeHtml(t)} <span>${cnt[t]}</span>`, t));
    $('qfTags').innerHTML = Object.keys(cnt).map((t) => `<option value="${escapeHtml(t)}">`).join('');
    const kw = $('edSearch').value.trim();
    const rows = [];
    edItems.forEach((it, i) => {
      if (edUnit && it.tag !== edUnit) return;
      if (kw && (it.q + ' ' + it.ans + ' ' + it.wrongs.join(' ')).indexOf(kw) < 0) return;
      const ls = it.q.split('\n'), ask = ls.pop(), sh = !it.wrongs.length;
      rows.push(`<div class="edrow" data-i="${i}"><span class="no">${i + 1}</span><div class="qq">` +
        (ls.length ? `<div class="psg">${escapeHtml(ls.join(' '))}</div>` : '') + `<div class="ask">${escapeHtml(ask)}</div>` +
        `<div class="meta"><span class="chip">${escapeHtml(it.tag)}</span><span class="chip ${sh ? 'sh' : 'mc'}">${sh ? '주관식' : '객관식'}</span><span class="chip">${ico('star').repeat(it.diff)}</span><span class="chip ans">정답: ${escapeHtml(it.ans)}</span></div></div>` +
        `<div class="acts"><button class="edit" aria-label="${i + 1}번 고치기">${ico('pencil')}고치기</button><button class="del" aria-label="${i + 1}번 지우기">${ico('trash')}</button></div></div>`);
    });
    $('edRows').innerHTML = rows.length ? rows.join('') : '<p class="sub" style="padding:14px">조건에 맞는 문제가 없어요.</p>';
  }
  $('edSearch').addEventListener('input', renderEd);
  $('edRows').addEventListener('click', (e) => {
    const row = e.target.closest('.edrow'); if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest('.del')) { if (confirm(`${i + 1}번 문제를 지울까요?`)) { edItems.splice(i, 1); setDirty(true); renderEd(); } }
    else openForm(i);
  });
  $('edAdd').addEventListener('click', () => openForm(-1));
  // 한 문제 고치기 폼 + 학생 화면 미리보기
  function segVal(id) { const b = $(id).querySelector('.on'); return b ? b.dataset.v : ''; }
  function segSet(id, v) { $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v))); }
  ['qfKind', 'qfDiff'].forEach((id) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; segSet(id, b.dataset.v); qfSync(); }));
  function openForm(i) {
    edEdit = i;
    const it = i >= 0 ? edItems[i] : { tag: edUnit || (edItems[edItems.length - 1] || {}).tag || '', diff: 1, q: '', ans: '', wrongs: [], exp: '' };
    $('qfTitle').textContent = i >= 0 ? `${i + 1}번 문제 고치기` : '새 문제';
    $('qfTag').value = it.tag; $('qfQ').value = it.q; $('qfAns').value = it.ans; $('qfExp').value = it.exp;
    ['qfW1', 'qfW2', 'qfW3'].forEach((k, j) => { $(k).value = it.wrongs[j] || ''; });
    segSet('qfKind', i >= 0 && !it.wrongs.length ? 'short' : 'mc'); segSet('qfDiff', it.diff);
    $('qfDel').style.display = i >= 0 ? '' : 'none'; $('qfErr').textContent = '';
    qfSync(); show('qform'); setTimeout(() => $(i >= 0 ? 'qfQ' : 'qfTag').focus(), 60);
  }
  function qfRead() {
    const short = segVal('qfKind') === 'short';
    return { tag: $('qfTag').value.trim() || '기본', diff: +segVal('qfDiff') || 1, q: $('qfQ').value.replace(/\r/g, '').trim(), ans: $('qfAns').value.trim(),
      wrongs: short ? [] : ['qfW1', 'qfW2', 'qfW3'].map((k) => $(k).value.trim()).filter(Boolean), exp: $('qfExp').value.trim(), short };
  }
  function qfSync() {
    const it = qfRead();
    $('qfWrongs').style.display = it.short ? 'none' : '';
    $('qfAnsHint').textContent = it.short ? '· 학생이 직접 써요. 여러 개면 가/나 · 띄어쓰기는 안 따져요' : '';
    $('pvTag').innerHTML = escapeHtml(it.tag + ' · ') + (it.short ? '주관식' : ico('star').repeat(it.diff));
    const ls = it.q.split('\n').map((l) => l.trim()).filter(Boolean), ask = ls.pop() || '(문제를 써 주세요)';
    $('pvQ').innerHTML = (ls.length ? `<div class="passage">${escapeHtml(ls.join('\n'))}</div>` : '') + `<div class="ask">${escapeHtml(ask)}</div>`;
    if (it.short) {
      const n = Q.hintCells({ ans: it.ans || '' });
      $('pvA').innerHTML = `<div class="pcells">${n.map((c) => c === ' ' ? '<span class="gap"></span>' : '<span></span>').join('')}</div><p class="sub" style="text-align:center;margin:6px 0 0">${n.filter((c) => c !== ' ').length}글자 · 첫 글자 힌트: ${escapeHtml(n[0] || '')}</p>`;
    } else {
      $('pvA').innerHTML = `<div class="pch">${[it.ans].concat(it.wrongs).map((c, j) => `<div class="${j ? '' : 'ok'}">${escapeHtml(c || (j ? '' : '(정답)'))}</div>`).join('')}</div><p class="sub" style="text-align:center;margin:6px 0 0">초록 칸이 정답이에요. 게임에선 순서가 섞여요.</p>`;
    }
  }
  ['qfTag', 'qfQ', 'qfAns', 'qfW1', 'qfW2', 'qfW3', 'qfExp'].forEach((k) => $(k).addEventListener('input', qfSync));
  $('qfSave').addEventListener('click', () => {
    const it = qfRead();
    const err = !it.q ? '문제를 써 주세요.' : !it.ans ? '정답을 써 주세요.' : !it.short && !it.wrongs.length ? '객관식은 오답이 1개 이상 필요해요. 주관식이면 위에서 "주관식"을 눌러요.'
      : it.wrongs.includes(it.ans) ? '오답 칸에 정답과 같은 말이 있어요.' : '';
    if (err) { $('qfErr').textContent = err; Snd.play('no'); return; }
    delete it.short;
    if (edEdit >= 0) edItems[edEdit] = it; else edItems.push(it);
    setDirty(true); hide('qform'); renderEd(); Snd.play('card');
    $('okmsg').textContent = edEdit >= 0 ? `${edEdit + 1}번 문제를 고쳤어요. '저장하기'를 눌러야 게임에 반영돼요.` : `새 문제를 넣었어요 (${edItems.length}번). '저장하기'를 눌러야 게임에 반영돼요.`;
    if (edEdit < 0) setTimeout(() => { const r = $('edRows').lastElementChild; if (r) r.scrollIntoView({ block: 'nearest' }); }, 30);
  });
  $('qfDel').addEventListener('click', () => { if (edEdit >= 0 && confirm('이 문제를 지울까요?')) { edItems.splice(edEdit, 1); setDirty(true); hide('qform'); renderEd(); } });
  function closeForm() { hide('qform'); }
  $('qfCancel').addEventListener('click', closeForm);
  function edClose() { if (edDirty && !confirm('저장하지 않은 변경이 있어요. 저장하지 않고 닫을까요?')) return; hide('editor'); }
  $('edClose').addEventListener('click', edClose);
  // 엑셀 붙여넣기
  function pasteParse(add) {
    const r = Q.parseQuestions($('qtext').value);
    $('errs').textContent = r.errors.map((e) => `${e.line}번째 줄: ${e.msg} (건너뜀)`).join('\n');
    if (!r.items.length) { $('okmsg').textContent = ''; return; }
    edItems = (add ? edItems : []).concat(r.items.map(cloneItem));
    setDirty(true); edTab('edList'); renderEd();
    $('okmsg').textContent = `${r.items.length}문제를 ${add ? '더했어요' : '불러왔어요'}. '저장하기'를 눌러야 게임에 반영돼요.`;
  }
  $('pasteReplace').addEventListener('click', () => { if (confirm('지금 목록을 붙여 넣은 내용으로 바꿀까요?')) pasteParse(false); });
  $('pasteAdd').addEventListener('click', () => pasteParse(true));
  // 선생님 코드 바꾸기
  $('tcSave').addEventListener('click', () => {
    const a = $('tc1').value, b = $('tc2').value;
    if (a.replace(/\s/g, '').length < 4) { $('errs').textContent = '코드는 4글자 이상으로 해 주세요.'; return; }
    if (a !== b) { $('errs').textContent = '두 칸의 코드가 달라요.'; return; }
    store.set(K_TCODE, gateHash(a)); $('tc1').value = $('tc2').value = ''; $('errs').textContent = '';
    $('okmsg').textContent = '선생님 코드를 바꿨어요. 이 기기에서만 적용돼요.'; Snd.play('ok');
  });
  $('qApply').addEventListener('click', () => {
    const txt = edText(edItems), r = Q.parseQuestions(txt);
    $('errs').textContent = r.errors.map((e) => `${e.line - 1}번 문제: ${e.msg}`).join('\n');
    if (r.items.length < 4) { $('okmsg').textContent = ''; $('errs').textContent += (r.errors.length ? '\n' : '') + '쓸 수 있는 문제가 4개 이상 필요해요. 저장하지 않았어요.'; return; }
    qText = txt; items = r.items; store.set(K_Q, txt); setDirty(false);
    const cnt = {}; items.forEach((i) => { cnt[i.tag] = (cnt[i.tag] || 0) + 1; });
    $('okmsg').textContent = `${items.length}문제 (주관식 ${items.filter((x) => x.short).length}개) · 단원 ${Object.keys(cnt).length}개를 저장했어요.`;
    Snd.play('ok'); refreshTitle();
  });
  $('qReset').addEventListener('click', () => {
    if (!confirm('기본 문항(국어 5-2, 180문제)으로 되돌릴까요? 지금 저장된 선생님 문항은 지워져요.')) return;
    store.del(K_Q); qText = window.DEFAULT_QUESTIONS; items = Q.parseQuestions(qText).items;
    edItems = items.map(cloneItem); setDirty(false); renderEd(); $('errs').textContent = ''; $('okmsg').textContent = '기본 문항으로 되돌렸어요.'; refreshTitle();
  });

  // ---------- 테스트 모드 ----------
  // 비밀번호의 해시값만 둬요. 맞히면 이 창을 닫을 때까지 켜져요: 문제 없이 플레이 · 무적 · 잠긴 캐릭터 선택 · 기록 안 남김.
  const TEST_HASH = 'yvz3mb';
  function testBar() {
    const bar = $('testBar'); if (!bar) return;
    bar.hidden = !(G && G.test && state === 'play');
    if (!bar.hidden) $('tbInv').textContent = '무적 ' + (G.qaInv ? '켬' : '끔');
    $('testBtn').textContent = testOn ? '테스트 모드 켜짐 (끄기)' : '테스트 모드';
    $('testBtn').classList.toggle('on', testOn);
    $('startBtn').lastChild.textContent = testOn ? '테스트 시작' : '모험 시작';
  }
  function tryTest() {
    if (gateHash($('xgIn').value) === TEST_HASH) { testOn = true; hide('xgate'); Snd.play('ok'); refreshTitle(); testBar(); toast('테스트 모드를 켰어요. 랏코도 고를 수 있어요'); }
    else { Snd.play('no'); $('xgMsg').textContent = '비밀번호가 달라요.'; const p = $('xgate').querySelector('.panel'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); $('xgIn').select(); }
  }
  $('testBtn').addEventListener('click', () => {
    if (testOn) { testOn = false; if (!isUnlocked(selChar)) selChar = 'chiikawa'; refreshTitle(); testBar(); toast('테스트 모드를 껐어요'); return; }
    $('xgIn').value = ''; $('xgMsg').textContent = ''; show('xgate');
  });
  $('xgGo').addEventListener('click', tryTest);
  $('xgIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryTest(); } });
  const key = (code) => () => { if (state !== 'play') return; dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  [['tbInv', 'KeyI'], ['tbBoss', 'KeyB'], ['tbTime', 'KeyT'], ['tbLvl', 'KeyL'], ['tbKill', 'KeyK'], ['tbHit', 'KeyN']].forEach(([id, c]) => $(id).addEventListener('click', key(c)));
  testBar();

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
    get G() { return G; }, get state() { return state; }, get quiz() { return quiz; }, useAlly, useSlot, useCar, addHelper, HELPERS, answer, submitShort, startReview, pickCard, startGame, afterQuiz, T, setChar(k) { selChar = k; },
    // QA: 화면과 상관없이 n단계 진행 (자동 검사용)
    step(n) { for (let i = 0; i < n && state === 'play'; i++) update(STEP); render(1, 0); },
    qa: { hurtPlayer, feedback, render: (dt) => render(1, dt), hurtEnemy },
  };
})();
