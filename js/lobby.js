import { startGame } from './main.js';
import {
  createRoom, joinRoom, watchRoom, cleanupRoom,
  publishPlayer, publishBall, publishScore, publishEvent, watchGame,
} from './multiplayer.js';

const CHARACTERS = [
  {
    id: 'tensei',
    name: '天才キャラ',
    number: '11',
    fbx: './キャラ/天才キャラ/T-Pose.fbx',
    portrait: './キャラ/天才キャラ/ベースイラスト/正面.jpg',
    color: '#00d4ff',
    available: true,
  },
  {
    id: 'nekketsu',
    name: '熱血主人公',
    number: '10',
    fbx: './キャラ/熱血主人公/FBX/T-Pose.fbx',
    portrait: './キャラ/熱血主人公/ベースイラスト/正面.png',
    color: '#ff8c00',
    available: true,
  },
  {
    id: 'reio',
    name: '玲王的キャラ',
    number: '22',
    fbx: './キャラ/玲王的なキャラ/FBX/T-Pose.fbx',
    portrait: './キャラ/玲王的なキャラ/ベースイラスト/正面.png',
    color: '#cc44ff',
    available: true,
  },
  {
    id: 'nagi',
    name: '凪的キャラ',
    number: '18',
    fbx: './キャラ/凪的なキャラ/T-Pose.fbx',
    portrait: './キャラ/凪的なキャラ/ベースイラスト/正面.png',
    color: '#4488ff',
    available: true,
  },
  {
    id: 'barou',
    name: '馬狼的キャラ',
    number: '9',
    fbx: './キャラ/馬狼的なキャラ/T-Pose.fbx',
    portrait: './キャラ/馬狼的なキャラ/ベースイラスト/正面.png',
    color: '#ff4444',
    available: true,
  },
  {
    id: 'chigiri',
    name: '千切的キャラ',
    number: '7',
    fbx: './キャラ/千切的なキャラ/T-Pose.fbx',
    portrait: './キャラ/千切的なキャラ/ベースイラスト/正面.png',
    color: '#ff66aa',
    available: true,
  },
  {
    id: 'bachira',
    name: '蜂楽的キャラ',
    number: '8',
    fbx: './キャラ/蜂楽的なキャラ/T-Pose.fbx',
    portrait: './キャラ/蜂楽的なキャラ/ベースイラスト/正面.png',
    color: '#ffd400',
    available: true,
  },
  {
    id: 'shidou',
    name: '士道的キャラ',
    number: '14',
    fbx: './キャラ/士道的なキャラ/T-Pose.fbx',
    portrait: './キャラ/士道的なキャラ/ベースイラスト/正面.png',
    color: '#ff66cc',
    available: true,
  },
  {
    id: 'kaizer',
    name: 'カイザー的キャラ',
    number: '20',
    fbx: './キャラ/カイザー的なキャラ/T-Pose.fbx',
    portrait: './キャラ/カイザー的なキャラ/ベースイラスト/正面.png',
    color: '#3a8cff',
    available: true,
  },
  {
    id: 'yukimiya',
    name: '雪宮的キャラ',
    number: '23',
    fbx: './キャラ/雪宮的なキャラ/T-Pose.fbx',
    portrait: './キャラ/雪宮的なキャラ/ベースイラスト/正面.png',
    color: '#7fd8ff',
    available: true,
  },
];

let selectedIdx = 0;
let fieldSize   = 'full';
let mpMode       = false;   // true = リアル対戦モード
let currentCode  = null;    // 作成/参加中のルームコード
let roomWatcher  = null;    // Firebase unsubscribe 関数

// ── 3Dカルーセル（円形ホイール） ──────────────────────────────────────
const N          = CHARACTERS.length;
const WHEEL_STEP = 360 / N;     // カード1枚あたりの角度
const DRAG_SENS  = 0.45;        // ドラッグ1pxあたりの回転角(度)
let wheelRot     = 0;           // ホイールの連続回転角(度・累積)
let drag         = null;        // {x, rot, moved}

function cardBaseTransform(i) {
  return `rotateY(${i * WHEEL_STEP}deg) translateZ(var(--wheel-r))`;
}

function buildCard(char, idx) {
  const card = document.createElement('div');
  card.className = 'lb-card' + (!char.available ? ' lb-locked' : '');
  card.style.setProperty('--cc', char.color);
  card.style.transform = cardBaseTransform(idx);
  card.dataset.idx = String(idx);

  const img = document.createElement('img');
  img.src = char.portrait;
  img.alt = char.name;
  img.draggable = false;
  card.appendChild(img);

  const overlay = document.createElement('div');
  overlay.className = 'lb-overlay';
  if (char.available) {
    const num = document.createElement('div');
    num.className = 'lb-num';
    num.textContent = '#' + char.number;
    overlay.appendChild(num);
  }
  const name = document.createElement('div');
  name.className = 'lb-name';
  name.textContent = char.name;
  overlay.appendChild(name);
  card.appendChild(overlay);

  if (!char.available) {
    const badge = document.createElement('div');
    badge.className = 'lb-soon';
    badge.textContent = 'SOON';
    card.appendChild(badge);
  }

  if (char.available) {
    card.addEventListener('click', () => { if (!drag || !drag.moved) selectChar(idx); });
  }
  return card;
}

// 現在の回転から正面に来ているカードのindexを返す
function frontIndex() {
  const i = Math.round(-wheelRot / WHEEL_STEP);
  return ((i % N) + N) % N;
}

// ホイールへ回転を反映し、各カードの見た目（正面ハイライト・奥行きのフェード）を更新
function applyWheel(animate) {
  const wheel = document.getElementById('lb-wheel');
  if (!wheel) return;
  wheel.style.transition = animate ? 'transform 0.55s cubic-bezier(0.22,1,0.36,1)' : 'none';
  wheel.style.transform  = `rotateY(${wheelRot}deg)`;

  const front = frontIndex();
  wheel.querySelectorAll('.lb-card').forEach(card => {
    const i = +card.dataset.idx;
    let ang = (i * WHEEL_STEP + wheelRot) % 360;
    if (ang > 180) ang -= 360;
    if (ang < -180) ang += 360;
    const a = Math.abs(ang);
    card.style.opacity   = Math.max(0.16, 1 - a / 115).toFixed(3);
    card.style.zIndex    = String(Math.round(1000 - a));
    const isFront = (i === front) && CHARACTERS[i].available;
    card.classList.toggle('lb-selected', isFront);
    card.style.transform = cardBaseTransform(i) + (isFront ? ' scale(1.12)' : '');
  });
}

// 指定indexを正面へ（最短回りで）
function rotateToIndex(idx, animate = true) {
  let target = -idx * WHEEL_STEP;
  while (target - wheelRot >  180) target -= 360;
  while (target - wheelRot < -180) target += 360;
  wheelRot = target;
  applyWheel(animate);
}

function selectChar(idx) {
  if (!CHARACTERS[idx].available) return;
  selectedIdx = idx;
  rotateToIndex(idx, true);
}

// 利用可能なキャラへdir方向(±1)に1つ送る（ラップあり）
function stepChar(dir) {
  let i = selectedIdx;
  for (let k = 0; k < N; k++) {
    i = ((i + dir) % N + N) % N;
    if (CHARACTERS[i].available) { selectChar(i); return; }
  }
}

function render() {
  const wheel = document.getElementById('lb-wheel');
  wheel.innerHTML = '';
  CHARACTERS.forEach((ch, i) => wheel.appendChild(buildCard(ch, i)));
  rotateToIndex(selectedIdx, false);
}

// ── ドラッグ操作（マウス・タッチ共通）────────────────────────────────
function initCarousel() {
  const stage = document.getElementById('lb-stage');

  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.lb-nav')) return;
    drag = { x: e.clientX, rot: wheelRot, moved: false };
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    wheelRot = drag.rot + dx * DRAG_SENS;
    applyWheel(false);
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    // 正面に最も近いカードへスナップ（ロックは隣の利用可能へ寄せる）
    let idx = frontIndex();
    if (!CHARACTERS[idx].available) {
      for (let k = 1; k <= N; k++) {
        const a = ((idx - k) % N + N) % N, b = (idx + k) % N;
        if (CHARACTERS[a].available) { idx = a; break; }
        if (CHARACTERS[b].available) { idx = b; break; }
      }
    }
    selectedIdx = idx;
    rotateToIndex(idx, true);
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  document.getElementById('lb-prev').addEventListener('click', e => { e.stopPropagation(); stepChar(-1); });
  document.getElementById('lb-next').addEventListener('click', e => { e.stopPropagation(); stepChar(1); });
}

// リアル対戦UIをリセット
function mpReset() {
  currentCode = null;
  roomWatcher = null;
  document.getElementById('mp-choice').style.display    = '';
  document.getElementById('mp-waiting').style.display   = 'none';
  document.getElementById('mp-join-form').style.display = 'none';
  document.getElementById('mp-code-val').textContent    = '----';
  document.getElementById('mp-code-input').value        = '';
  document.getElementById('mp-err').textContent         = '';
  document.getElementById('mp-create').disabled         = false;
  document.getElementById('mp-enter').disabled          = false;
}

// マルチプレイヤーゲーム開始
function launchMultiplayer(role, code, hostInfo, guestInfo) {
  const myChar     = CHARACTERS[selectedIdx];
  const remoteCharFbx = role === 'host' ? guestInfo.charFbx : hostInfo.charFbx;
  const remoteCharId  = role === 'host' ? guestInfo.charId  : hostInfo.charId;
  const fs         = hostInfo.fieldSize || 'compact';

  requestFullscreen();

  const lobby = document.getElementById('lobby');
  lobby.style.opacity = '0';
  lobby.style.pointerEvents = 'none';
  setTimeout(() => { lobby.style.display = 'none'; }, 380);
  document.getElementById('loading').style.display = 'flex';

  startGame({
    charFbx:   myChar.fbx,
    charId:    myChar.id,
    fieldSize: fs,
    enemyFbx:  null,
    mp: {
      role,
      code,
      remoteCharFbx,
      enemyId: remoteCharId ?? null, // 玲王のスキルボタン用（相手のキャラID）
      publishPlayer: (r, s) => publishPlayer(code, r, s),
      publishBall:   s      => publishBall(code, s),
      publishScore:  s      => publishScore(code, s),
      publishEvent:  e      => publishEvent(code, e),
      watchGame:     cb     => watchGame(code, cb),
    },
  });
}

function requestFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  fn?.call(el);
}

function closeLobbyAndLoad() {
  const lobby = document.getElementById('lobby');
  lobby.style.opacity = '0';
  lobby.style.pointerEvents = 'none';
  setTimeout(() => { lobby.style.display = 'none'; }, 380);
  document.getElementById('loading').style.display = 'flex';
}

function kickOff() {
  const char = CHARACTERS[selectedIdx];
  if (!char.available) return;

  requestFullscreen();

  // 選択されていないキャラからランダムに敵を選ぶ
  const enemyCandidates = CHARACTERS.filter((c, i) => c.available && i !== selectedIdx);
  const enemyChar = enemyCandidates.length > 0
    ? enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)]
    : null;

  closeLobbyAndLoad();
  startGame({ charFbx: char.fbx, charId: char.id, fieldSize,
    enemyFbx: enemyChar?.fbx ?? null, enemyId: enemyChar?.id ?? null });
}

// PK戦: プレイヤー vs CPUキーパー
function startPK() {
  const char = CHARACTERS[selectedIdx];
  if (!char.available) return;
  requestFullscreen();
  closeLobbyAndLoad();
  startGame({ charFbx: char.fbx, charId: char.id, fieldSize: 'full', enemyFbx: null, pk: true });
}

// 2vs2: プレイヤー＋味方CPU vs 敵CPU2人
function start2v2() {
  const char = CHARACTERS[selectedIdx];
  if (!char.available) return;
  requestFullscreen();

  // プレイヤー以外から味方1・敵2をランダムに選ぶ（重複なし、足りなければ流用）
  const pool = CHARACTERS.filter((c, i) => c.available && i !== selectedIdx);
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const allyC   = shuffled[0] || char;
  const enemy1  = shuffled[1] || char;
  const enemy2  = shuffled[2] || allyC;

  closeLobbyAndLoad();
  startGame({
    charFbx: char.fbx, charId: char.id, fieldSize,
    mode2v2: true,
    allyFbx:   allyC.fbx,  allyId:   allyC.id,
    enemy1Fbx: enemy1.fbx, enemy1Id: enemy1.id,
    enemy2Fbx: enemy2.fbx, enemy2Id: enemy2.id,
  });
}

function init() {
  render();
  initCarousel();

  const fsBtns = ['full', 'medium', 'compact'];
  fsBtns.forEach(size => {
    document.getElementById(`fs-${size}`).addEventListener('click', () => {
      fieldSize = size;
      fsBtns.forEach(s => document.getElementById(`fs-${s}`).classList.remove('active'));
      document.getElementById(`fs-${size}`).classList.add('active');
    });
  });

  document.getElementById('lb-kickoff').addEventListener('click', kickOff);
  document.getElementById('lb-pk').addEventListener('click', startPK);
  document.getElementById('lb-2v2').addEventListener('click', start2v2);

  // ── モード切替 ───────────────────────────────────────────────────
  function setMode(real) {
    mpMode = real;
    document.getElementById('mode-cpu').classList.toggle('active', !real);
    document.getElementById('mode-real').classList.toggle('active',  real);
    document.getElementById('cpu-controls').style.display = real ? 'none' : '';
    document.getElementById('mp-panel').classList.toggle('open', real);
    if (!real) mpReset();
  }
  document.getElementById('mode-cpu').addEventListener('click',  () => setMode(false));
  document.getElementById('mode-real').addEventListener('click', () => setMode(true));

  // ── リアル対戦: ルーム作成 ────────────────────────────────────────
  document.getElementById('mp-create').addEventListener('click', async () => {
    const char = CHARACTERS[selectedIdx];
    if (!char.available) return;
    document.getElementById('mp-create').disabled = true;
    try {
      const code = await createRoom({ charFbx: char.fbx, charId: char.id, fieldSize });
      currentCode = code;
      document.getElementById('mp-code-val').textContent = code;
      document.getElementById('mp-choice').style.display  = 'none';
      document.getElementById('mp-waiting').style.display = '';
      // ゲスト参加を待つ
      roomWatcher = watchRoom(code, room => {
        if (!room) { mpReset(); return; }
        if (room.status === 'playing' && room.guest) {
          roomWatcher?.();
          launchMultiplayer('host', code, room.host, room.guest);
        }
      });
    } catch (e) {
      alert('ルーム作成に失敗しました: ' + e.message);
      document.getElementById('mp-create').disabled = false;
    }
  });

  // ── リアル対戦: ルーム参加フォーム表示 ───────────────────────────
  document.getElementById('mp-join-open').addEventListener('click', () => {
    document.getElementById('mp-choice').style.display    = 'none';
    document.getElementById('mp-join-form').style.display = '';
    document.getElementById('mp-code-input').focus();
  });
  document.getElementById('mp-back').addEventListener('click', () => {
    document.getElementById('mp-join-form').style.display = 'none';
    document.getElementById('mp-choice').style.display    = '';
    document.getElementById('mp-err').textContent         = '';
  });

  // ── リアル対戦: 入室 ─────────────────────────────────────────────
  document.getElementById('mp-enter').addEventListener('click', async () => {
    const code = document.getElementById('mp-code-input').value.trim().toUpperCase();
    const err  = document.getElementById('mp-err');
    if (code.length !== 4) { err.textContent = 'コードは4文字です'; return; }
    const char = CHARACTERS[selectedIdx];
    if (!char.available) { err.textContent = 'キャラを選択してください'; return; }
    document.getElementById('mp-enter').disabled = true;
    err.textContent = '';
    try {
      const room = await joinRoom(code, { charFbx: char.fbx, charId: char.id });
      currentCode = code;
      launchMultiplayer('guest', code, room.host, { charFbx: char.fbx, charId: char.id });
    } catch (e) {
      err.textContent = e.message;
      document.getElementById('mp-enter').disabled = false;
    }
  });
  document.getElementById('mp-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('mp-enter').click();
  });

  // ── キャンセル ────────────────────────────────────────────────────
  document.getElementById('mp-cancel').addEventListener('click', async () => {
    roomWatcher?.();
    if (currentCode) await cleanupRoom(currentCode);
    mpReset();
  });

  // ── コードコピー ──────────────────────────────────────────────────
  document.getElementById('mp-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(currentCode ?? '');
    document.getElementById('mp-copy').textContent = '✓';
    setTimeout(() => { document.getElementById('mp-copy').textContent = 'コピー'; }, 1200);
  });

  document.addEventListener('keydown', e => {
    const lobby = document.getElementById('lobby');
    if (!lobby || lobby.style.display === 'none') return;
    if (e.key === 'ArrowLeft') {
      stepChar(-1);
    } else if (e.key === 'ArrowRight') {
      stepChar(1);
    } else if (e.key === 'Enter') {
      kickOff();
    }
  });
}

// モジュールはDOMが解析済み後に実行されるため直接呼び出す
init();
