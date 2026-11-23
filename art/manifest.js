// 그림 목록. 투명 배경 PNG를 art/ 폴더에 넣고 이름을 적으면 코드로 그린 임시 그림 대신 그 그림이 나와요.
// 원본: 선생님이 주신 그림 두 장 (enemies = 적 시트 줄·칸, heroes = 주인공·동료 시트 줄·칸). 수업용 비공개.
window.ART_FILES = {
  // 주인공 (오른쪽을 보는 그림이 아니어도 괜찮아요. 왼쪽으로 갈 때 뒤집어 그려요)
  chiikawa: 'heroes/h11.png',
  usagi: 'heroes/h13.png',
  hachiware: 'heroes/h14.png',
  rakko: 'heroes/h22.png',  // 해달 (2줄 2번)
  // 몬스터
  slime: 'enemies/e32.png',   // 기본 몬스터 1 (맨 아랫줄 2번)
  hopper: 'enemies/e34.png',  // 기본 몬스터 2 (맨 아랫줄 4번) · 콩콩 뛰어옴
  big: 'enemies/e31.png',     // 3줄 1번 · 느리고 단단한 노랑 갈기 (아노코가 보스가 되면서 바꿨어요)
  anoko: 'enemies/e11.png',   // 2라운드 보스 아노코 (흰색 털뭉치) · 꼬마 아노코도 같은 그림
  burrow: 'enemies/e13.png',  // 1줄 3번 · 땅속에 숨었다가 튀어나옴
  thrower: 'enemies/e14.png', // 1줄 4번 · 초록 도깨비, 몽둥이를 던짐 (5:00 보스 뒤 동료)
  spitter: 'enemies/e21.png', // 2줄 1번 · 노랑 외눈이, 3갈래 탄 (5:00 보스 뒤 동료)
  charger: 'enemies/e23.png', // 2줄 3번 · 사자탈, 경고선 뒤 돌진
  swoop: 'enemies/e24.png',   // 2줄 4번 · 흰 새, 빙빙 돌다 급강하
  boss: 'enemies/e12.png',    // 1라운드 보스 세이렌
  star: 'enemies/e22.png',    // 마지막 보스 검은 별똥별 (2줄 2번)
  stag: 'enemies/stag.png',   // 새 몬스터 · 빨강 집게투구: 땅을 찍어 가시 줄을 보내요
  mace: 'enemies/mace.png',   // 새 몬스터 · 쇠공 토끼: 쇠공을 빙빙 돌리고 굴려요
  grab: 'enemies/grab.png',   // 새 몬스터 · 긴팔 털뭉치: 팔을 뻗어 끌어당겨요
  mermaid: 'enemies/mermaid.png', // 세이렌이 부르는 인어 (하드 모드에선 물줄기·물방울 공격)
  sumo: 'allies/sumo.png',         // 세이렌을 쓰러뜨리면 합류하는 섬아저씨 (Q 스킬)
  rod_rakko: 'items/rakko_sword.png', // 랏코 전용 칼
  // 던지는 물건 (선생님이 주신 물건 그림)
  it_naruto: 'items/naruto.png',   // 치이카와 전용 · 나루토 원반 (몸 주위를 돌아요)
  it_tempura: 'items/tempura.png', // 하치와레 전용 · 새우튀김 (화면 가장자리에서 튕겨요)
  it_rocket: 'items/rocket.png',   // 우사기 전용 · 쌍둥이 로켓 (적을 쫓아가 터져요)
  top: 'items/top.png',            // 모두 · 팽이 (적을 빨아들여요)
  club_shot: 'items/club.png',     // 도깨비가 던지는 몽둥이
  // 캐릭터 전용 토벌봉 (던지는 무기)
  rod_chiikawa: 'rods/chiikawa.png',   // 분홍
  rod_hachiware: 'rods/hachiware.png', // 파랑
  rod_usagi: 'rods/usagi.png',         // 노랑
};
// 보스를 쓰러뜨릴 때마다 바뀌는 외형 (주인공 시트 줄·칸, 이 중에서 무작위)
window.ART_SKINS = {
  chiikawa: ['h15', 'h31', 'h35', 'h41', 'h44'],
  hachiware: ['h25', 'h33', 'h36', 'h46'],
  usagi: ['h26', 'h34'],
};
