# AUDIO

효과음 19종 · 파일 31개는 **Pixabay 녹음 소리**예요 (Pixabay 콘텐츠 라이선스: 게임에 출처 표기 없이 사용 가능, 기록용으로 남겨요). AI 생성 표시가 붙은 소리는 쓰지 않았어요.

- 재생: `audio/manifest.js`에 등록된 파일 중 하나를 무작위로, 음높이 ±4% 흔들어서 재생. 파일이 없거나 못 불러오면 합성음으로 대신해요.
- 전체 동시 재생 12개 제한, 소리마다 최소 간격(`SFX[이름].gap`).
- 설정: 소리 켜기/끄기, 소리 크기 0~100% (진행 기록과 따로 저장).
- 처리: 헤드리스 Chrome에서 디코드 → 앞뒤 무음(-50 dBFS 아래) 자르기 → 길이 제한 + 끝 페이드 → 피크 맞추기 → 모노 44.1kHz → MP3 64kb/s (lamejs). 이 컴퓨터에 FFmpeg가 없어서 스킬의 process_sfx.py 대신 같은 단계를 직접 했어요.
- 원본: `~/Downloads/chiikawa-sfx-raw/` (게임 폴더 밖).
- 음악: 선생님이 넣은 음원 파일 2개 (수업용 비공개). 기본 219초 · 보스 81초, MP3 64kb/s 48kHz 스테레오.
  - `audio/bgm_main.mp3`: 기본 음악. 게임 내내(시작 화면 포함) 끝없이 반복.
  - `audio/bgm_boss.mp3`: 보스전 음악. 보스가 나오면 기본 음악에서 부드럽게 바뀌고, 보스를 쓰러뜨리면 다시 기본 음악(이어서). 보스 음악은 보스마다 처음부터 반복.
  - 크기: 설정의 소리 크기 × 기본 0.16 / 보스 0.32. 기본 곡 원본이 보스 곡보다 6.6dB 커서 따로 맞췄고, 둘 다 효과음(때리기 소리)보다 약 6dB 작게 들려요. 쉬기·문제·결과 화면에선 그 절반. 다른 창으로 가면 멈춰요. 소리 끄기면 음악도 꺼져요.
  - 크기를 바꾸려면 `game.js`의 `BGM_VOL` 숫자를 바꿔요 (작게 하면 더 조용해요).

| 게임 이름 | 파일 | Pixabay 제목 | 만든 사람 | ID | 길이 (원본→게임) | 원본 바이트 | 게임 바이트 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| boss | boss.mp3 | taiko | freesound_community | [43348](https://pixabay.com/sound-effects/43348/) | 1.82s → 1.50s | 36,480 | 12,329 |
| bubble | bubble1.mp3 | Bubble Pop | DRAGON-STUDIO | [406640](https://pixabay.com/sound-effects/406640/) | 1.03s → 0.32s | 33,024 | 2,925 |
| bubble | bubble2.mp3 | Bubble Pop 04 | Universfield | [323580](https://pixabay.com/sound-effects/323580/) | 1.08s → 0.05s | 34,560 | 835 |
| card | card1.mp3 | flipCard | freesound_community | [91468](https://pixabay.com/sound-effects/91468/) | 0.97s → 0.40s | 30,929 | 3,552 |
| card | card2.mp3 | Page Flip | freesound_community | [47177](https://pixabay.com/sound-effects/47177/) | 0.62s → 0.40s | 19,968 | 3,552 |
| cheer | cheer.mp3 | yay! | freesound_community | [104840](https://pixabay.com/sound-effects/104840/) | 1.46s → 1.20s | 46,848 | 9,822 |
| click | click1.mp3 | UI click | freesound_community | [43196](https://pixabay.com/sound-effects/43196/) | 0.55s → 0.15s | 11,040 | 1,462 |
| click | click2.mp3 | UI click | freesound_community | [97915](https://pixabay.com/sound-effects/97915/) | 0.65s → 0.01s | 12,960 | 417 |
| dash | dash1.mp3 | Cartoon Comical Fast Movement Whistle 1 | AppleHillStudios | [543567](https://pixabay.com/sound-effects/543567/) | 0.91s → 0.50s | 29,184 | 4,388 |
| dash | dash2.mp3 | Simple Whoosh | DRAGON-STUDIO | [382724](https://pixabay.com/sound-effects/382724/) | 0.57s → 0.31s | 18,390 | 2,925 |
| heal | heal.mp3 | cartoon_wink_magic_sparkle | freesound_community | [6896](https://pixabay.com/sound-effects/6896/) | 1.32s → 0.37s | 26,400 | 3,134 |
| hit | hit1.mp3 | Cartoonish hit 1 | EAGLAXLE | [464009](https://pixabay.com/sound-effects/464009/) | 1.57s → 0.35s | 50,155 | 3,134 |
| hit | hit2.mp3 | Cartoonish hit 2 | EAGLAXLE | [464010](https://pixabay.com/sound-effects/464010/) | 1.65s → 0.35s | 52,662 | 3,134 |
| hit | hit3.mp3 | Cartoonish hit 3 | EAGLAXLE | [464011](https://pixabay.com/sound-effects/464011/) | 1.59s → 0.35s | 50,991 | 3,134 |
| hurt | hurt1.mp3 | Comical Character Ouch 1 | AppleHillStudios | [543564](https://pixabay.com/sound-effects/543564/) | 0.79s → 0.60s | 25,344 | 5,015 |
| hurt | hurt2.mp3 | ouch | freesound_community | [43811](https://pixabay.com/sound-effects/43811/) | 1.27s → 0.60s | 25,440 | 5,015 |
| kill | kill1.mp3 | Pop Cartoon | CreatorsHome | [328167](https://pixabay.com/sound-effects/328167/) | 1.04s → 0.07s | 33,436 | 835 |
| kill | kill2.mp3 | Pop | SoundReality | [423717](https://pixabay.com/sound-effects/423717/) | 1.97s → 0.12s | 62,976 | 1,253 |
| no | no.mp3 | Wrong Answer Beep | Universfield | [149895](https://pixabay.com/sound-effects/149895/) | 1.07s → 0.78s | 34,272 | 6,478 |
| ok | ok.mp3 | Correct | DRAGON-STUDIO | [472358](https://pixabay.com/sound-effects/472358/) | 1.32s → 1.00s | 42,240 | 8,359 |
| open | open.mp3 | Paper Swish UI | the1957files | [529818](https://pixabay.com/sound-effects/529818/) | 2.56s → 0.50s | 81,920 | 4,388 |
| pick | pick1.mp3 | Coin Pickup | freesound_community | [98269](https://pixabay.com/sound-effects/98269/) | 1.97s → 0.30s | 39,360 | 2,716 |
| pick | pick2.mp3 | Money Pickup 2 | freesound_community | [89563](https://pixabay.com/sound-effects/89563/) | 0.37s → 0.26s | 11,702 | 2,298 |
| shoot | shoot1.mp3 | Rubber Band | 49053354 | [318238](https://pixabay.com/sound-effects/318238/) | 1.01s → 0.40s | 8,064 | 3,552 |
| shoot | shoot2.mp3 | Rubber Band 2 | 49053354 | [447370](https://pixabay.com/sound-effects/447370/) | 0.91s → 0.40s | 18,286 | 3,552 |
| stomp | stomp1.mp3 | Wooden Thud (Mono) | freesound_community | [6244](https://pixabay.com/sound-effects/6244/) | 0.58s → 0.50s | 11,520 | 4,388 |
| stomp | stomp2.mp3 | post_in_the_ground | freesound_community | [105966](https://pixabay.com/sound-effects/105966/) | 1.85s → 0.50s | 36,960 | 4,388 |
| swing | swing1.mp3 | Swing Whoosh | Jofae | [110410](https://pixabay.com/sound-effects/110410/) | 0.37s → 0.16s | 11,702 | 1,671 |
| swing | swing2.mp3 | Whoosh | freesound_community | [6316](https://pixabay.com/sound-effects/6316/) | 0.48s → 0.40s | 9,600 | 3,552 |
| warn | warn.mp3 | Slide Whistle Up | Universfield | [326154](https://pixabay.com/sound-effects/326154/) | 1.13s → 0.66s | 36,096 | 5,642 |
| win | win.mp3 | Triumph (jingle) | freesound_community | [40125](https://pixabay.com/sound-effects/40125/) | 7.82s → 3.00s | 156,480 | 24,241 |

합계: 1,098,989 → 142,086 바이트 (88% 줄어듦). 재사용 없음, 소리마다 따로 골랐어요.
