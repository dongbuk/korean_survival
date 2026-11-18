// 동료 도감 목록 (주인공·동료 그림 시트에서 주인공 4명을 뺀 20명).
// 이름은 선생님이 바꿔 주세요. 판이 끝날 때 만나는 순서는 무작위예요.
window.COMPANIONS = [
  { id: 'h12', img: 'heroes/h12.png', name: '동료 1' },
  { id: 'h15', img: 'heroes/h15.png', name: '동료 2' },
  { id: 'h16', img: 'heroes/h16.png', name: '동료 3' },
  { id: 'h21', img: 'heroes/h21.png', name: '동료 4' },
  { id: 'h23', img: 'heroes/h23.png', name: '동료 5' },
  { id: 'h24', img: 'heroes/h24.png', name: '동료 6' },
  { id: 'h25', img: 'heroes/h25.png', name: '동료 7' },
  { id: 'h26', img: 'heroes/h26.png', name: '동료 8' },
  { id: 'h31', img: 'heroes/h31.png', name: '동료 9' },
  { id: 'h32', img: 'heroes/h32.png', name: '동료 10' },
  { id: 'h33', img: 'heroes/h33.png', name: '동료 11' },
  { id: 'h34', img: 'heroes/h34.png', name: '동료 12' },
  { id: 'h35', img: 'heroes/h35.png', name: '동료 13' },
  { id: 'h36', img: 'heroes/h36.png', name: '동료 14' },
  { id: 'h41', img: 'heroes/h41.png', name: '동료 15' },
  { id: 'h42', img: 'heroes/h42.png', name: '동료 16' },
  { id: 'h43', img: 'heroes/h43.png', name: '동료 17' },
  { id: 'h44', img: 'heroes/h44.png', name: '동료 18' },
  { id: 'h45', img: 'heroes/h45.png', name: '동료 19' },
  { id: 'h46', img: 'heroes/h46.png', name: '동료 20' },
];
// 만나는 조건: 맞힌 문제 5개 이상이면 1명, 토벌 성공이면 2명
window.COMPANION_RULE = { minCorrect: 5, perRun: 1, perWin: 2 };
