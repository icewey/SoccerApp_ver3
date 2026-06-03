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
];

let selectedIdx = 0;
let fieldSize   = 'full';
let mpMode       = false;   // true = リアル対戦モード
let currentCode  = null;    // 作成/参加中のルームコード
let roomWatcher  = null;    // Firebase unsubscribe 関数

function buildCard(char, idx) {
  const card = document.createElement('div');
  card.className = 'lb-card'
    + (idx === selectedIdx ? ' lb-selected' : '')
    + (!char.available ? ' lb-locked' : '');
  card.style.setProperty('--cc', char.color);

  const img = document.createElement('img');
  img.src = char.portrait;
  img.alt = char.name;
  img.loading = 'lazy';
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
    card.addEventListener('click', () => selectChar(idx));
    card.addEventListener('touchend', e => { e.preventDefault(); selectChar(idx); });
  }
  return card;
}

function selectChar(idx) {
  if (!CHARACTERS[idx].available) return;
  selectedIdx = idx;
  render();
}

function render() {
  const row = document.getElementById('lb-row');
  row.innerHTML = '';
  CHARACTERS.forEach((ch, i) => row.appendChild(buildCard(ch, i)));

  const cards = row.querySelectorAll('.lb-card');
  if (cards[selectedIdx]) {
    cards[selectedIdx].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
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
  const fs         = hostInfo.fieldSize || 'compact';

  requestFullscreen();

  const lobby = document.getElementById('lobby');
  lobby.style.opacity = '0';
  lobby.style.pointerEvents = 'none';
  setTimeout(() => { lobby.style.display = 'none'; }, 380);
  document.getElementById('loading').style.display = 'flex';

  startGame({
    charFbx:   myChar.fbx,
    fieldSize: fs,
    enemyFbx:  null,
    mp: {
      role,
      code,
      remoteCharFbx,
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

function kickOff() {
  const char = CHARACTERS[selectedIdx];
  if (!char.available) return;

  requestFullscreen();

  // 選択されていないキャラからランダムに敵を選ぶ
  const enemyCandidates = CHARACTERS.filter((c, i) => c.available && i !== selectedIdx);
  const enemyChar = enemyCandidates.length > 0
    ? enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)]
    : null;

  const lobby = document.getElementById('lobby');
  lobby.style.opacity = '0';
  lobby.style.pointerEvents = 'none';
  setTimeout(() => { lobby.style.display = 'none'; }, 380);

  const loadingEl = document.getElementById('loading');
  loadingEl.style.display = 'flex';

  startGame({ charFbx: char.fbx, fieldSize, enemyFbx: enemyChar?.fbx ?? null });
}

function init() {
  render();

  const fsBtns = ['full', 'medium', 'compact'];
  fsBtns.forEach(size => {
    document.getElementById(`fs-${size}`).addEventListener('click', () => {
      fieldSize = size;
      fsBtns.forEach(s => document.getElementById(`fs-${s}`).classList.remove('active'));
      document.getElementById(`fs-${size}`).classList.add('active');
    });
  });

  document.getElementById('lb-kickoff').addEventListener('click', kickOff);

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
      const code = await createRoom({ charFbx: char.fbx, fieldSize });
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
      const room = await joinRoom(code, { charFbx: char.fbx });
      currentCode = code;
      launchMultiplayer('guest', code, room.host, { charFbx: char.fbx });
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
      let i = selectedIdx - 1;
      while (i >= 0 && !CHARACTERS[i].available) i--;
      if (i >= 0) selectChar(i);
    } else if (e.key === 'ArrowRight') {
      let i = selectedIdx + 1;
      while (i < CHARACTERS.length && !CHARACTERS[i].available) i++;
      if (i < CHARACTERS.length) selectChar(i);
    } else if (e.key === 'Enter') {
      kickOff();
    }
  });
}

// モジュールはDOMが解析済み後に実行されるため直接呼び出す
init();
