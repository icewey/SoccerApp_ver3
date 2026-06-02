import { startGame } from './main.js';

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
    number: null,
    fbx: null,
    portrait: './キャラ/凪的なキャラ/ベースイラスト/正面.png',
    color: '#4488ff',
    available: false,
  },
  {
    id: 'barou',
    name: '馬狼的キャラ',
    number: null,
    fbx: null,
    portrait: './キャラ/馬狼的なキャラ/ベースイラスト/正面.png',
    color: '#ff4444',
    available: false,
  },
  {
    id: 'chigiri',
    name: '千切的キャラ',
    number: null,
    fbx: null,
    portrait: './キャラ/千切的なキャラ/ベースイラスト/正面.png',
    color: '#ff66aa',
    available: false,
  },
];

let selectedIdx = 0;
let withTeammate = true;

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

function kickOff() {
  const char = CHARACTERS[selectedIdx];
  if (!char.available) return;

  const lobby = document.getElementById('lobby');
  lobby.style.opacity = '0';
  lobby.style.pointerEvents = 'none';
  setTimeout(() => { lobby.style.display = 'none'; }, 380);

  const loadingEl = document.getElementById('loading');
  loadingEl.style.display = 'flex';

  startGame({ charFbx: char.fbx, withTeammate });
}

function init() {
  render();

  document.getElementById('tm-yes').addEventListener('click', () => {
    withTeammate = true;
    document.getElementById('tm-yes').classList.add('active');
    document.getElementById('tm-no').classList.remove('active');
  });
  document.getElementById('tm-no').addEventListener('click', () => {
    withTeammate = false;
    document.getElementById('tm-no').classList.add('active');
    document.getElementById('tm-yes').classList.remove('active');
  });

  document.getElementById('lb-kickoff').addEventListener('click', kickOff);

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
