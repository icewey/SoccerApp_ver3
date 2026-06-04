import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ── Renderer ──────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// ── Scene / Camera ────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x9ecde8, 0.006);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.zoom = window.innerWidth > window.innerHeight ? window.innerWidth / window.innerHeight : 1;
camera.updateProjectionMatrix();
camera.position.set(0, 10, 20);

// ── Lighting ──────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xd6eaff, 0.7));
const sun = new THREE.DirectionalLight(0xfffde0, 1.4);
sun.position.set(60, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(4096);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 250 });
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0xb0d4ff, 0.3);
fillLight.position.set(-40, 30, -30);
scene.add(fillLight);

// ── Soccer Field ─────────────────────────────────────────────────────────
function buildField(halfW, halfD) {
  const root   = new THREE.Group();
  const goalX  = halfW + 1.5;
  const totalW = goalX * 2;
  const totalD = halfD * 2;
  const sc     = halfW / 51; // フィールドスケール係数

  const stripeCount = 10, stripeW = totalW / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(stripeW, totalD),
      new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0x2e7d32 : 0x388e3c })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-goalX + stripeW * (i + 0.5), 0, 0);
    stripe.receiveShadow = true;
    root.add(stripe);
  }
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  function line(w, d, x, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), white);
    m.position.set(x, 0.01, z);
    root.add(m);
  }
  line(totalW + 0.2, 0.18, 0,  halfD); line(totalW + 0.2, 0.18, 0, -halfD);
  line(0.18, totalD, goalX, 0); line(0.18, totalD, -goalX, 0);
  line(0.18, totalD, 0, 0);

  const circleR = 9.15 * sc;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(circleR, 0.1, 8, 64), white);
  torus.rotation.x = Math.PI / 2; torus.position.y = 0.01; root.add(torus);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.35 * sc, 16), white);
  spot.rotation.x = -Math.PI / 2; spot.position.y = 0.01; root.add(spot);

  [-1, 1].forEach(s => {
    const ox  = s * goalX;
    const pd  = 16.5 * sc, phz = 20.16 * sc; // ペナルティエリア
    const gd  = 5.5  * sc, ghz = 9.16  * sc; // ゴールエリア
    const ghw = 3.66;                         // ゴール半幅（フィールドサイズに関わらず11v11固定）
    const gdp = 2.2;                          // ゴールネットの奥行き（固定）

    line(pd * 2, 0.18, ox - s * pd, phz);  line(pd * 2, 0.18, ox - s * pd, -phz);
    line(0.18, phz * 2, ox - s * pd * 2, 0);
    line(gd * 2, 0.18, ox - s * gd, ghz);  line(gd * 2, 0.18, ox - s * gd, -ghz);
    line(0.18, ghz * 2, ox - s * gd * 2, 0);

    const goalMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pole = () => new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.44, 10), goalMat);
    [[-ghw], [ghw]].forEach(([z]) => {
      const p = pole(); p.position.set(ox, 1.22, z); p.castShadow = true; root.add(p);
    });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, ghw * 2, 10), goalMat);
    bar.rotation.x = Math.PI / 2; bar.position.set(ox, 2.44, 0); root.add(bar);

    // ゴールネット
    const netMat = new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5 });
    const pts = [];
    const seg = (ax,ay,az,bx,by,bz) => { pts.push(new THREE.Vector3(ax,ay,az), new THREE.Vector3(bx,by,bz)); };
    const HW = ghw, H = 2.44, backX = ox + s * gdp;
    for (let i=0;i<=8;i++) { const z=-HW+(HW*2/8)*i; seg(backX,0,z,backX,H,z); }
    for (let j=0;j<=5;j++) { const y=(H/5)*j;         seg(backX,y,-HW,backX,y,HW); }
    for (let i=0;i<=8;i++) { const z=-HW+(HW*2/8)*i; seg(ox,H,z,backX,H,z); }
    for (let k=0;k<=3;k++) { const x=ox+(s*gdp/3)*k; seg(x,H,-HW,x,H,HW); }
    for (let j=0;j<=5;j++) { const y=(H/5)*j;         seg(ox,y,-HW,backX,y,-HW); }
    for (let k=0;k<=3;k++) { const x=ox+(s*gdp/3)*k; seg(x,0,-HW,x,H,-HW); }
    for (let j=0;j<=5;j++) { const y=(H/5)*j;         seg(ox,y,HW,backX,y,HW); }
    for (let k=0;k<=3;k++) { const x=ox+(s*gdp/3)*k; seg(x,0,HW,x,H,HW); }
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), netMat));
  });
  return root;
}
let fieldRoot = buildField(51, 34);
scene.add(fieldRoot);

// ── Ball ──────────────────────────────────────────────────────────────────
function createBallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#111';
  // 五角形パッチをサッカーボール風に配置
  [[128,128],[64,58],[192,58],[30,162],[226,162],[96,224],[160,224]].forEach(([cx,cy]) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 26, y = cy + Math.sin(a) * 26;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });
  return new THREE.CanvasTexture(canvas);
}

const BALL_R   = 0.13;
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 24, 24),
  new THREE.MeshStandardMaterial({ map: createBallTexture(), roughness: 0.5, metalness: 0.05 })
);
ballMesh.castShadow = true;
ballMesh.position.set(0, BALL_R, 5);
scene.add(ballMesh);

const ballVel     = new THREE.Vector3();
const ballSpin    = new THREE.Vector3(); // 旧カーブ用（未使用）
let   ballCurveRate = 0; // rad/s: 水平速度ベクトルの回転速度（マグナス効果）
const BALL_GRAVITY   = 22;
const BALL_BOUNCE    = 0.45;
const BALL_GRND_FRIC = 0.85;  // 地面摩擦（/秒）
const BALL_AIR_FRIC  = 0.995; // 空気抵抗（/フレーム）
const DRIBBLE_DIST   = 1.0;   // ドリブル開始距離
const DRIBBLE_OFFSET = 0.65;  // ボールの足元オフセット

let isDribbling = false;

// ── 敵キャラ ───────────────────────────────────────────────────────────────
const enemy = new THREE.Group();
let enemyMixer = null;
let enemyCurrent = null;
let enemyState = 'chase'; // 'chase' | 'dribble'
let enemyTackling = false;
let enemyKicking  = false;
let enemyPickupCooldown = 0;
let enemyTackleCooldown = 0;
let hasEnemy = false;
const ENEMY_TACKLE_COOLDOWN  = 2.5;

// ── ボール所有権 ───────────────────────────────────────────────────────────
let ballOwner = 'none'; // 'player' | 'enemy' | 'none'
let playerPickupCooldown = 0; // キック直後に自分がボールを即再拾いするのを防ぐ(秒)
let gkBallHolder = 'none'; // 'none' | 'player_gk' | 'enemy_gk'
let gkSessionId  = 0;     // ゲーム再起動時のstale setTimeoutを無効化するカウンタ

// ── ゴールキーパー ──────────────────────────────────────────────────────────
const playerGKGroup = new THREE.Group();
const enemyGKGroup  = new THREE.Group();
scene.add(playerGKGroup); // enemy と同様にモジュールレベルで追加
scene.add(enemyGKGroup);
playerGKGroup.visible = false;
enemyGKGroup.visible  = false;
let playerGKMixer   = null;
let playerGKCurrent = null;
let enemyGKMixer    = null;
let enemyGKCurrent  = null;
const playerGKChar  = { group: playerGKGroup, animState: null };
const enemyGKChar   = { group: enemyGKGroup,  animState: null };
const pGKSt = { state: 'patrol', holdTimer: 0, patrolPhase: 0, catchAnimTimer: 0 };
const eGKSt = { state: 'patrol', holdTimer: 0, patrolPhase: 0, catchAnimTimer: 0 };

const GK_SPEED        = 2.5;  // 横追従速度（遅いので飛行中に隅まで追いつけない＝隅を狙えば抜ける）
const GK_X_OFFSET     = 2.0;
const GK_PATROL_Z     = 2.5;
const GK_CATCH_REACH  = 1.4;  // 反射セーブの届く範囲（中央は守るが隅は抜ける幅）
const GK_CATCH_CHANCE = 0.85;
const GK_SAVE_DEPTH   = 1.5;  // ゴールラインからこの距離以内でのみセーブ発動（手前で拾わない＝隅に逸れた所で間に合わない）
const GK_TURN_RATE    = 3.5;  // 体の向きの追従速度（小さいほど鈍感）
const GK_HOLD_TIME    = 1.5;
const GK_DIVE_Z_THR   = 1.5;

// ── プニコン（仮想スティック）─────────────────────────────────────────────
const joystick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
const JOY_MAX  = 55; // ドラッグの最大半径(px)
const joyBase  = document.getElementById('joystick-base');
const joyKnob  = document.getElementById('joystick-knob');

// ── 右半分スワイプ（視線回転）─────────────────────────────────────────────
const lookSwipe = { active: false, id: -1, prevX: 0 };
const LOOK_SENSITIVITY = 0.003; // rad/px

// カメラ視点角（Q/E/スワイプで制御。プレイヤー体の向きとは独立）
let viewAngle = 0;

// curve: 0=直線, -1=左カーブ, 1=右カーブ / power: 1.0=通常, 1.5=フル
function kickBall(lofted = false, curve = 0, power = 1.0) {
  const toBall = new THREE.Vector3().subVectors(ballMesh.position, player.position);
  toBall.y = 0;
  if (toBall.length() > 2.0 && !isDribbling) return;

  const pwr = power;
  const isCurve = curve !== 0;

  if (isCurve) {
    // カーブキック: 向きを横にずらして蹴り上げ、空中でバナナ軌道
    const kickAngle = player.rotation.y - curve * (Math.PI / 8);
    ballVel.x = -Math.sin(kickAngle) * 13 * pwr;
    ballVel.y = 14;
    ballVel.z = -Math.cos(kickAngle) * 13 * pwr;
    ballCurveRate = curve * 0.9;
  } else {
    const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
    ballVel.copy(facing).multiplyScalar((lofted ? 14 : 15) * pwr);
    ballVel.y = lofted ? 16 : 3;
    ballCurveRate = 0;
  }
  ballSpin.set(0, 0, 0);
  isDribbling = false;
  ballOwner   = 'none';
}

// ── プレイヤーのワンショット動作（キーボード・モバイル共通）────────────────
// スピンを安全に終了（ボール喪失・シュート・時間切れ時に呼ぶ）。
// isSpinning は本来スピンclipの'finished'で解除されるが、clipが中断されると
// 取りこぼして固着し、自動前進が止まらなくなるため、明示終了経路を用意する。
function endSpin() { isSpinning = false; spinTimer = 0; }

function startSpin() {
  if (!gameStarted || !isDribbling || isSpinning || !clips['spin'] || !mixer) return;
  isSpinning = true;
  spinTimer  = clips['spin'].duration; // 保険のタイマー
  fadeToClip('spin', false);
}

function startKick(lofted, curve, power) {
  if (!gameStarted || !clips['kick'] || !mixer) return;
  endSpin();              // スピン中のシュートはスピンを打ち切ってから蹴る（状態固着防止）
  isKicking = true;
  kickTimer = clips['kick'].duration + 0.1; // finished取りこぼし時の保険
  fadeToClip('kick', false);
  setTimeout(() => kickBall(lofted, curve, power), clips['kick'].duration * 0.55 * 1000);
}

function startTackle() {
  if (!gameStarted || ballOwner === 'player' || isTackling || !clips['tackle'] || !mixer) return;
  isTackling  = true;
  tackleTimer = TACKLE_LOCK; // 短い前進ランジ。タイマーで必ず解除しclip中断による固着を防ぐ
  fadeToClip('tackle', false);
}

// ── 敵シュート（charShoot を使用）────────────────────────────────────────
function enemyShoot() {
  charShoot(
    enemyChar, 'enemy', -GOAL_X,
    () => enemyKicking,
    v  => { enemyKicking = v; },
    // ボールを蹴り出した瞬間に enemyKicking を解除する。'finished' 頼みだと、
    // 直後にルーズボールを奪われ敵が即タックル(charAnim)へ移ってキックclipが
    // 中断され、'finished' を取りこぼして enemyKicking が固着→敵フリーズしていた。
    () => { enemyKicking = false; enemyPickupCooldown = 1.5; enemyState = 'chase'; }
  );
}

// ════════════════════════════════════════════════════════════════
// ── 共通キャラクター部品（プレイヤー・CPU 両方で使う）──────────
// ════════════════════════════════════════════════════════════════

// キャラエンティティ（group + アニメ状態を1つのオブジェクトに）
// playerChar / enemyChar は startGame 後に mixer がセットされる
const playerChar = { group: null, animState: null }; // startGame で初期化
const enemyChar  = { group: null, animState: null };

// アニメーション切り替え（プレイヤー・CPU 共通）
function charAnim(char, name, loop = true) {
  fadeToMixerClip(char.animState, name, loop);
}

// 目標位置へ移動 + 向き設定（プレイヤー・CPU 共通、同じ速度）
function charMoveTo(char, targetPos, dt) {
  const to = new THREE.Vector3().subVectors(targetPos, char.group.position).setY(0);
  const dist = to.length();
  if (dist < 0.4) return false;
  to.divideScalar(dist);
  char.group.position.addScaledVector(to, Math.min(dist, RUN_SPEED * dt));
  char.group.rotation.y = Math.atan2(-to.x, -to.z);
  return true;
}

// タックル中の前進（プレイヤー・CPU 共通）
function charTackleForward(char, dt) {
  const f = new THREE.Vector3(-Math.sin(char.group.rotation.y), 0, -Math.cos(char.group.rotation.y));
  char.group.position.addScaledVector(f, RUN_SPEED * 1.3 * dt);
}

// ドリブル時のボール配置（プレイヤー・CPU 共通）
function charDribble(char, dt) {
  const facing = new THREE.Vector3(-Math.sin(char.group.rotation.y), 0, -Math.cos(char.group.rotation.y));
  const target = char.group.position.clone().addScaledVector(facing, DRIBBLE_OFFSET);
  target.y = BALL_R;
  ballMesh.position.lerp(target, Math.min(1, 50 * dt));
  ballVel.set(0, 0, 0);
  ballCurveRate = 0;
}

// シュート（プレイヤー・CPU 共通）
function charShoot(char, ownerKey, goalX, getKicking, setKicking, onDone) {
  if (ballOwner !== ownerKey || getKicking()) return;
  setKicking(true);
  charAnim(char, 'kick', false);
  const delay = clips['kick'] ? clips['kick'].duration * 0.55 * 1000 : 300;
  setTimeout(() => {
    if (ballOwner !== ownerKey) { setKicking(false); return; }
    const aimZ   = (Math.random() - 0.5) * 5;
    const goal   = new THREE.Vector3(goalX, 1.0, aimZ);
    const toGoal = new THREE.Vector3().subVectors(goal, ballMesh.position).setY(0);
    const dist   = toGoal.length();
    const dir    = toGoal.normalize();
    const hSpd   = Math.min(24, Math.max(14, dist * 1.1));
    ballVel.set(dir.x * hSpd, dist > 18 ? 7 : 4, dir.z * hSpd);
    ballCurveRate = 0;
    ballOwner = 'none';
    isDribbling = false;
    onDone();
  }, delay);
}

// フィールド内クランプ（プレイヤー・CPU 共通）
function charClampToField(char) {
  char.group.position.x = Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, char.group.position.x));
  char.group.position.z = Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, char.group.position.z));
}

// タックル判定距離（共通）
const TACKLE_DIST = 1.6;

// ── 敵AI（共通部品で実装）────────────────────────────────────────────────
function updateEnemy(dt) {
  if (!hasEnemy || !gameStarted || !enemyChar.animState?.mixer || isGoalScene) return;
  enemyChar.animState.mixer.update(dt);

  if (enemyTackleCooldown > 0) enemyTackleCooldown -= dt;

  const distToBall = new THREE.Vector3().subVectors(ballMesh.position, enemy.position).setY(0).length();

  // タックルによる奪取（プレイヤーと同じ TACKLE_DIST を使用）
  if (enemyTackling && ballOwner !== 'enemy' && distToBall < TACKLE_DIST
      && enemyPickupCooldown <= 0 && !isKicking && gkBallHolder === 'none') {
    ballOwner = 'enemy';
    playerPickupCooldown = 0.6;
    enemyTackling = false;
  }

  // 状態遷移
  enemyState = ballOwner === 'enemy' ? 'dribble' : 'chase';

  // 目標位置を決定
  let targetPos;
  if (enemyState === 'dribble') {
    // ゴール方向へ進む（プレイヤーのドリブルと同じ方向感覚）
    targetPos = new THREE.Vector3(
      Math.max(-(GOAL_X - 4.5), enemy.position.x - 8),
      0,
      enemy.position.z * 0.4
    );
  } else {
    // ボールを追う
    targetPos = new THREE.Vector3(ballMesh.position.x, 0, ballMesh.position.z);
    // タックル（プレイヤーと同じ距離で試みる）。キック中(enemyKicking)は
    // キックclipを中断して状態が固着するため開始しない。
    if (ballOwner === 'player' && distToBall < 3.0 && !enemyTackling && !enemyKicking
        && enemyTackleCooldown <= 0) {
      enemyTackling = true;
      enemyTackleCooldown = ENEMY_TACKLE_COOLDOWN;
      charAnim(enemyChar, 'tackle', false);
    }
  }

  // 自陣GKがキャッチ保持中は、スローを受けて速攻するため敵ゴール方向へ進出する。
  // （ボールを取りに自陣GKへ戻らず、前方=スロー到達範囲のミッドフィールドで待つ）
  if (gkBallHolder === 'enemy_gk') {
    enemyState = 'chase';
    targetPos = new THREE.Vector3(GOAL_X - 35, 0, enemy.position.z * 0.5);
    enemyTackling = false;
  }

  // 移動（charMoveTo = プレイヤーと同じ RUN_SPEED）
  const moving = !enemyTackling && !enemyKicking && charMoveTo(enemyChar, targetPos, dt);

  // タックル中の前進（charTackleForward = プレイヤーと同じ処理）
  if (enemyTackling) charTackleForward(enemyChar, dt);

  // フィールドクランプ（共通）
  charClampToField(enemyChar);

  // ドリブル中はボールを足元へ（charDribble = プレイヤーと同じ処理）
  if (enemyState === 'dribble') charDribble(enemyChar, dt);

  // シュート判定（プレイヤーと同じ距離・角度基準）
  const penZ = FIELD_HALF_D * 0.611;
  if (ballOwner === 'enemy' && !enemyKicking
      && enemy.position.x < -(GOAL_X - FIELD_HALF_W * 0.48)
      && Math.abs(enemy.position.z) <= penZ) {
    const distGoal = Math.abs(-GOAL_X - enemy.position.x);
    if (Math.abs(enemy.position.z) / Math.max(distGoal, 0.1) <= 0.65 || distGoal <= 8) enemyShoot();
  }

  // アニメーション（charAnim = プレイヤーと同じ関数）
  if (!enemyTackling && !enemyKicking) {
    charAnim(enemyChar, moving ? (ballOwner === 'enemy' && clips['dribble'] ? 'dribble' : 'run') : 'idle');
  }
}

// ローカルプレイヤーのボール操作（拾得・タックル・ドリブル）
// マルチプレイでも常に呼ぶ。物理シミュとゴール判定は含まない。
function updateLocalPlayerBall(dt) {
  if (!gameStarted || isGoalScene || gkBallHolder !== 'none') return;

  if (playerPickupCooldown > 0) playerPickupCooldown -= dt;

  const remoteRoleLocal = mpRole === 'host' ? 'guest' : 'host';

  // ── 競合解決: Firebase が相手の所有を確認したら即座に譲る ──────────
  if (isMultiplayer && mpRemoteBallOwner === remoteRoleLocal && ballOwner === 'player') {
    ballOwner = 'none';
    playerPickupCooldown = 0.25;
    isDribbling = false;
    return;
  }

  const distPlayer = new THREE.Vector3()
    .subVectors(ballMesh.position, player.position).setY(0).length();

  // 手放し判定
  if (ballOwner === 'player' && (distPlayer >= DRIBBLE_DIST * 1.5 || (isKicking && !isPassing)))
    ballOwner = 'none';

  // タックル奪取（相手保持中でも可）
  const TACKLE_DIST = 1.6;
  if (isTackling && ballOwner !== 'player' && distPlayer < TACKLE_DIST
      && playerPickupCooldown <= 0) {
    ballOwner = 'player';
    playerPickupCooldown = 0;
    isTackling = false;
  }

  // 通常拾得: 相手が持っていない時のみ
  const canPickup = !isMultiplayer || mpRemoteBallOwner !== remoteRoleLocal;
  if (ballOwner === 'none' && canPickup) {
    if (distPlayer < DRIBBLE_DIST && !isKicking && playerPickupCooldown <= 0) {
      ballOwner = 'player';
      // 即座にパブリッシュして相手に所有権を通知（33ms タイマー待ちなし）
      if (isMultiplayer && mpHandlers && gameStarted) {
        mpHandlers.publishBall({
          x: ballMesh.position.x, y: ballMesh.position.y, z: ballMesh.position.z,
          vx: 0, vy: 0, vz: 0, owner: mpRole,
        });
      }
    }
  }

  isDribbling = ballOwner === 'player';
  if (isDribbling) charDribble(playerChar, dt); // 共通関数を使用
}

function updateBall(dt) {
  if (!gameStarted) return;
  if (isGoalScene) return; // ゴールシーン中は物理停止
  if (gkBallHolder !== 'none') { isDribbling = false; return; }

  const toPlayer   = new THREE.Vector3().subVectors(ballMesh.position, player.position);
  toPlayer.y = 0;
  const distPlayer = toPlayer.length();
  const toEnemyB   = hasEnemy ? new THREE.Vector3().subVectors(ballMesh.position, enemy.position) : new THREE.Vector3(999, 0, 0);
  if (hasEnemy) toEnemyB.y = 0;
  const distEnemy  = toEnemyB.length();

  // ── ボール所有権の更新 ──────────────────────────────────────────────────
  if (playerPickupCooldown > 0) playerPickupCooldown -= dt;
  if (enemyPickupCooldown  > 0) enemyPickupCooldown  -= dt;

  if (ballOwner === 'enemy' && distEnemy >= DRIBBLE_DIST * 1.5 && !enemyKicking) ballOwner = 'none';

  if (!isMultiplayer) {
    // ソロ専用: プレイヤー拾得・タックルはここで処理
    if (ballOwner === 'player' && (distPlayer >= DRIBBLE_DIST * 1.5 || (isKicking && !isPassing))) ballOwner = 'none';
    if (ballOwner === 'none') {
      // プレイヤー拾得: CPUのキックアニメ中(enemyKicking)でもルーズボールを拾える
      // ようにする（以前は !enemyKicking で約1秒間拾えず「取れない」原因だった）
      if      (distPlayer < DRIBBLE_DIST && !isKicking && playerPickupCooldown <= 0) ballOwner = 'player';
      else if (hasEnemy && distEnemy < DRIBBLE_DIST && !isKicking && enemyPickupCooldown <= 0) ballOwner = 'enemy';
    }
    const TACKLE_DIST = 1.6;
    if (isTackling && ballOwner !== 'player' && distPlayer < TACKLE_DIST && playerPickupCooldown <= 0
        && !(ballOwner === 'enemy' && enemyKicking)) {
      ballOwner = 'player';
      enemyPickupCooldown = 0.5;
      isTackling = false;
    }
  } else {
    // マルチ: プレイヤー操作は updateLocalPlayerBall() が担当（二重処理防止）
    // CPU enemy 拾得のみここで処理
    if (ballOwner === 'none') {
      if (hasEnemy && distEnemy < DRIBBLE_DIST && !isKicking && enemyPickupCooldown <= 0) ballOwner = 'enemy';
    }
  }
  isDribbling = ballOwner === 'player';

  if (isDribbling) {
    charDribble(playerChar, dt); // プレイヤードリブル（共通関数）
    const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
    const moving = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('ArrowDown') || keys.has('KeyS')
              || keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('ArrowRight') || keys.has('KeyD');
    if (moving) {
      const rollDir = (keys.has('ArrowUp') || keys.has('KeyW')) ? 1 : -1;
      ballMesh.rotateOnWorldAxis(new THREE.Vector3(facing.z, 0, -facing.x), rollDir * RUN_SPEED * dt / BALL_R);
    }
    return;
  }

  if (ballOwner === 'enemy') {
    charDribble(enemyChar, dt); // 敵ドリブル（共通関数）
    return;
  }

  // 通常物理
  ballVel.y -= BALL_GRAVITY * dt;
  // カーブ: 空中で水平速度ベクトルを回転させてバナナ軌道（マグナス効果）
  if (ballCurveRate !== 0 && ballMesh.position.y > BALL_R + 0.05) {
    const hSpd = Math.sqrt(ballVel.x * ballVel.x + ballVel.z * ballVel.z);
    if (hSpd > 0.1) {
      const a = Math.atan2(ballVel.x, ballVel.z) + ballCurveRate * dt;
      ballVel.x = Math.sin(a) * hSpd;
      ballVel.z = Math.cos(a) * hSpd;
    }
  }
  ballMesh.position.addScaledVector(ballVel, dt);

  if (ballMesh.position.y <= BALL_R) {
    ballMesh.position.y = BALL_R;
    ballVel.y = ballVel.y < -0.5 ? ballVel.y * -BALL_BOUNCE : 0;
    ballCurveRate = 0; // 着地でカーブ終了
    const f = Math.pow(BALL_GRND_FRIC, dt);
    ballVel.x *= f;
    ballVel.z *= f;
  } else {
    ballVel.x *= BALL_AIR_FRIC;
    ballVel.z *= BALL_AIR_FRIC;
  }

  // ゴール判定: ゴール口内（|z|<GOAL_HALF_Z, y<2.44）ならアウト壁をスキップしてゴールへ
  const _inGoalZ = Math.abs(ballMesh.position.z) < GOAL_HALF_Z;
  const _inGoalY = ballMesh.position.y < 2.44 + BALL_R;
  if (_inGoalZ && _inGoalY) {
    if      (ballMesh.position.x >  GOAL_X) { if (isPK) pkResolve('goal'); else scoreGoal('player'); return; }
    else if (ballMesh.position.x < -GOAL_X) { if (!isPK) scoreGoal('cpu'); return; }
  }
  if (Math.abs(ballMesh.position.x) > FIELD_HALF_W + 1 && !(_inGoalZ && _inGoalY)) {
    ballVel.x *= -0.6;
    ballMesh.position.x = Math.sign(ballMesh.position.x) * (FIELD_HALF_W + 1);
  }
  if (Math.abs(ballMesh.position.z) > FIELD_HALF_D + 1) {
    ballVel.z *= -0.6;
    ballMesh.position.z = Math.sign(ballMesh.position.z) * (FIELD_HALF_D + 1);
  }

  const hspeed = Math.sqrt(ballVel.x ** 2 + ballVel.z ** 2);
  if (hspeed > 0.01) {
    const axis = new THREE.Vector3(ballVel.z, 0, -ballVel.x).normalize();
    ballMesh.rotateOnWorldAxis(axis, (hspeed * dt) / BALL_R);
  }

  if (Math.abs(ballMesh.position.x) > 65 || Math.abs(ballMesh.position.z) > 45) {
    ballMesh.position.set(0, BALL_R, 0);
    ballVel.set(0, 0, 0);
  }
}

// ── Input ─────────────────────────────────────────────────────────────────
const keys = new Set();
let lastKeyLog = '(未押下)';

window.addEventListener('keydown', e => {
  if (e.isComposing) return; // IME変換中は無視
  keys.add(e.code);
  lastKeyLog = `${e.code} | gs:${gameStarted} | rep:${e.repeat}`;
  e.preventDefault();

  // PK結果画面: 任意キーで再挑戦
  if (isPK && pkState === 'done' && !e.repeat) { pkRestart(); return; }

  // ワンショット動作はkeydownで即トリガー（animate()ループを待たない）
  if (gameStarted && !e.repeat) {
    if (e.code === 'KeyF' || e.code === 'KeyG') {
      startKick(e.code === 'KeyG', 0, 1.0);
    }
    if (e.code === 'KeyH' || e.code === 'KeyJ') {
      startKick(false, e.code === 'KeyH' ? -1 : 1, 1.0);
    }
    if (e.code === 'KeyT') {
      startTackle(); // タックル（ボール非所持時のみ・内部でガード）
    }
    if (e.code === 'KeyZ') {
      startSpin(); // スピン（ドリブル中のみ・内部でガード）
    }
  }
}, { capture: true }); // captureでブラウザより先にキーを受け取る

window.addEventListener('keyup', e => {
  if (e.isComposing) return;
  keys.delete(e.code);
}, { capture: true });

// ── Character & Animations ────────────────────────────────────────────────
const player  = new THREE.Group();   // 移動・回転はこのグループで制御
scene.add(player);

let character = null;
let mixer     = null;
const clips   = {};
let current   = null;
let isKicking   = false;
let isPassing   = false;
let isTackling  = false;
let isSpinning  = false;
let spinTimer   = 0; // スピン残り時間（finishedイベント取りこぼし対策の保険）
let tackleTimer = 0; // タックル残り時間（同上。割り込みで操作不能になるのを防ぐ）
let kickTimer   = 0; // キック残り時間（同上の保険）
let groundY     = 0;
let playerScore = 0;
let cpuScore    = 0;
let isGoalScene = false;

// ── PKモード ────────────────────────────────────────────────────────────────
let isPK        = false;     // PK戦モードか
let pkState     = 'ready';   // 'ready'(蹴る前) | 'live'(飛行中) | 'resolved' | 'done'
let pkKick      = 0;         // 実施済みキック数
let pkGoals     = 0;         // 成功数
let pkLiveTimer = 0;         // live経過時間（ミス判定用）
const PK_TOTAL  = 5;         // PK本数
const PK_DIST   = 11;        // ペナルティスポットのゴールからの距離

// Mixamoのhipボーン位置トラックを除去してモーション間のジャンプを防ぐ
function stripRootMotion(clip) {
  clip.tracks = clip.tracks.filter(
    t => !(t.name.toLowerCase().includes('hips') && t.name.endsWith('.position'))
  );
  return clip;
}

// ── アニメ状態プロキシ（getter/setter で let 変数を共有参照）─────────────
const playerAnim = {
  get mixer()   { return mixer; },        set mixer(v)   { mixer = v; },
  get current() { return current; },      set current(v) { current = v; },
};
const enemyAnim = {
  get mixer()   { return enemyMixer; },   set mixer(v)   { enemyMixer = v; },
  get current() { return enemyCurrent; }, set current(v) { enemyCurrent = v; },
};
const playerGKAnim = {
  get mixer()   { return playerGKMixer; },   set mixer(v)   { playerGKMixer = v; },
  get current() { return playerGKCurrent; }, set current(v) { playerGKCurrent = v; },
};
const enemyGKAnim = {
  get mixer()   { return enemyGKMixer; },   set mixer(v)   { enemyGKMixer = v; },
  get current() { return enemyGKCurrent; }, set current(v) { enemyGKCurrent = v; },
};
playerGKChar.animState = playerGKAnim;
enemyGKChar.animState  = enemyGKAnim;

// ── 共通アニメーション切り替え ────────────────────────────────────────────
function fadeToMixerClip(anim, name, loop = true) {
  if (!anim.mixer || !clips[name]) return;
  const next = anim.mixer.clipAction(clips[name]);
  if (next === anim.current && loop) return;
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  next.clampWhenFinished = !loop;
  if (anim.current && anim.current !== next) anim.current.fadeOut(0.15);
  next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
  anim.current = next;
}

// ── 共通 CPU シュート ─────────────────────────────────────────────────────
function cpuShoot({ ownerKey, goalX, anim, getKicking, setKicking, onDone }) {
  if (ballOwner !== ownerKey || getKicking()) return;
  setKicking(true);
  fadeToMixerClip(anim, 'kick', false);
  const delay = clips['kick'] ? clips['kick'].duration * 0.55 * 1000 : 300;
  setTimeout(() => {
    if (ballOwner !== ownerKey) { setKicking(false); return; }
    const aimZ   = (Math.random() - 0.5) * 5;
    const goal   = new THREE.Vector3(goalX, 1.0, aimZ);
    const toGoal = new THREE.Vector3().subVectors(goal, ballMesh.position);
    toGoal.y = 0;
    const dist   = toGoal.length();
    const dir    = toGoal.normalize();
    const hSpeed = Math.min(24, Math.max(14, dist * 1.1));
    const vSpeed = dist > 18 ? 7 : 4;
    ballVel.set(dir.x * hSpeed, vSpeed, dir.z * hSpeed);
    ballCurveRate = 0;
    ballOwner     = 'none';
    isDribbling   = false;
    onDone();
  }, delay);
}

// 後方互換ラッパー（charAnim に委譲）
function fadeToClip(name, loop = true)      { charAnim(playerChar, name, loop); }
function fadeToEnemyClip(name, loop = true) { charAnim(enemyChar,  name, loop); }

// ── ゴールキーパー専用関数 ────────────────────────────────────────────────

function gkMoveTo(char, targetPos, dt) {
  const to = new THREE.Vector3().subVectors(targetPos, char.group.position).setY(0);
  const dist = to.length();
  if (dist < 0.25) return false;
  to.divideScalar(dist);
  char.group.position.addScaledVector(to, Math.min(dist, GK_SPEED * dt));
  // 向きは updateGK 側で滑らかに制御するためここでは設定しない
  return true;
}

function gkClampToGoalArea(char, myGoalX) {
  const standX = myGoalX > 0 ? myGoalX - GK_X_OFFSET : myGoalX + GK_X_OFFSET;
  char.group.position.x = Math.max(standX - 1.0, Math.min(standX + 1.0, char.group.position.x));
  char.group.position.z = Math.max(-(GOAL_HALF_Z + 1.5), Math.min(GOAL_HALF_Z + 1.5, char.group.position.z));
}

function gkAttemptSave(gkChar, gkSt, myGoalX, ownerKey) {
  if (gkSt.state === 'save' || gkSt.state === 'dive') return;
  const deltaZ  = ballMesh.position.z - gkChar.group.position.z;
  const useDive = Math.abs(deltaZ) > GK_DIVE_Z_THR;
  gkSt.state = useDive ? 'dive' : 'save';
  charAnim(gkChar, useDive ? 'gk_dive' : 'gk_catch', false);

  // 成否は接触の瞬間に即決定する。成功なら即ボールを止めて確保し、ボールが
  // ゴールラインを越える前に得点を防ぐ（旧実装は setTimeout で約500ms遅延し、
  // その間にボールがゴール判定されて必ず失点していた）。
  if (Math.random() < GK_CATCH_CHANCE) {
    gkBallHolder   = ownerKey;
    ballOwner      = 'none';
    ballVel.set(0, 0, 0);
    ballCurveRate  = 0;
    gkSt.state     = 'hold';
    gkSt.holdTimer = GK_HOLD_TIME;
    // 捕球モーションを再生し切る時間（hold中はこの間 idle に上書きしない）
    const saveClip = clips[useDive ? 'gk_dive' : 'gk_catch'];
    gkSt.catchAnimTimer = saveClip ? saveClip.duration : 0.8;
  }
  // 失敗時は state を save/dive のまま維持 → ボールは通過し、セーブ/ダイブ
  // アニメ終了時に mixer の 'finished' リスナが patrol へ戻す。
}

function gkDoThrow(gkChar, gkSt, teammateChar, ownerKey, myGoalX) {
  charAnim(gkChar, 'gk_throw', false);
  const triggerMs = clips['gk_throw'] ? clips['gk_throw'].duration * 0.45 * 1000 : 480;
  setTimeout(() => {
    if (gkBallHolder !== ownerKey) return;
    const from = gkChar.group.position.clone();
    const to   = teammateChar.group.position.clone();
    const dir  = new THREE.Vector3().subVectors(to, from).setY(0);
    const dist = dir.length();
    if (dist < 0.1) { gkBallHolder = 'none'; gkSt.state = 'patrol'; return; }
    dir.divideScalar(dist);
    const hSpd = Math.min(22, Math.max(12, dist * 0.85));
    const vSpd = Math.max(8,  Math.min(16, dist * 0.55));
    // ゴールラインから離れた位置からボールをリリース（ゴール判定を防ぐ）
    const safeOffset = myGoalX > 0 ? -3.0 : 3.0;
    ballMesh.position.set(from.x + safeOffset, from.y + 1.4, from.z);
    ballVel.set(dir.x * hSpd, vSpd, dir.z * hSpd);
    ballCurveRate = 0;
    ballOwner     = 'none';
    gkBallHolder  = 'none';
    if (ownerKey === 'player_gk') playerPickupCooldown = 0;
    else                          enemyPickupCooldown  = 0;
  }, triggerMs);
  const totalMs = clips['gk_throw'] ? clips['gk_throw'].duration * 1000 : 1100;
  setTimeout(() => { if (gkSt.state === 'throw') gkSt.state = 'patrol'; }, totalMs);
}

function updateGK(gkChar, gkSt, myGoalX, teammateChar, ownerKey, dt) {
  if (!gameStarted || !gkChar.animState?.mixer || isGoalScene) return;
  gkChar.animState.mixer.update(dt);

  const gkPos  = gkChar.group.position;
  const standX = myGoalX > 0 ? myGoalX - GK_X_OFFSET : myGoalX + GK_X_OFFSET;

  // ── ボール保持中 ──────────────────────────────────────────────────
  if (gkSt.state === 'hold') {
    ballMesh.position.set(gkPos.x, gkPos.y + 1.2, gkPos.z);
    ballVel.set(0, 0, 0);
    ballCurveRate = 0;
    // キャッチ/ダイブのアニメを最後まで再生してから idle に切り替える
    // （即 idle にすると捕球モーションが一瞬で打ち消されて見えないため）
    if (gkSt.catchAnimTimer > 0) gkSt.catchAnimTimer -= dt;
    else                        charAnim(gkChar, 'idle');
    gkSt.holdTimer -= dt;
    if (gkSt.holdTimer <= 0) {
      gkSt.state = 'throw';
      gkDoThrow(gkChar, gkSt, teammateChar, ownerKey, myGoalX);
    }
    return;
  }

  // ── スロー/セーブアニメ再生中 ────────────────────────────────────
  if (gkSt.state === 'throw' || gkSt.state === 'save' || gkSt.state === 'dive') return;

  // ── 待機：ボールがハーフラインを超えて自陣に来たら、ゴールライン上を
  //    水平移動してボールのZに合わせつつ、体をボールへ正対させる。
  //    自陣にボールが無いときは中央で棒立ち＋フィールド正面を向く。 ────────
  gkSt.state = 'patrol';
  const ballInOwnHalf = Math.sign(ballMesh.position.x) === Math.sign(myGoalX)
                        && Math.abs(ballMesh.position.x) > 0.5;

  // 目標Z: 自陣ならボールのZに追従（ゴール幅にクランプ）、なければ中央へ戻る
  const targetZ = ballInOwnHalf
    ? Math.max(-GOAL_HALF_Z, Math.min(GOAL_HALF_Z, ballMesh.position.z))
    : 0;
  const moved = gkMoveTo(gkChar, new THREE.Vector3(standX, 0, targetZ), dt);
  charAnim(gkChar, moved ? 'gk_sidestep' : 'idle');

  // 体の向き: 目標角へ滑らかに追従（GK_TURN_RATE が小さいほど鈍感）
  let targetRy;
  if (ballInOwnHalf) {
    const toBall = new THREE.Vector3().subVectors(ballMesh.position, gkPos).setY(0);
    targetRy = toBall.lengthSq() > 0.01
      ? Math.atan2(-toBall.x, -toBall.z)
      : gkChar.group.rotation.y;
  } else {
    targetRy = myGoalX > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  let dRy = targetRy - gkChar.group.rotation.y;
  while (dRy >  Math.PI) dRy -= 2 * Math.PI;
  while (dRy < -Math.PI) dRy += 2 * Math.PI;
  gkChar.group.rotation.y += dRy * Math.min(1, GK_TURN_RATE * dt);

  // ── 反射セーブ：棒立ちのまま、手の届く範囲にシュートが来たら
  //    キャッチ（正面）/ ダイブ（左右）を試みる ──────────────────────
  const inSaveX = myGoalX > 0
    ? (ballMesh.position.x > myGoalX - GK_SAVE_DEPTH && ballMesh.position.x < myGoalX + 0.5)
    : (ballMesh.position.x < myGoalX + GK_SAVE_DEPTH && ballMesh.position.x > myGoalX - 0.5);
  const inSaveZ = Math.abs(ballMesh.position.z - gkPos.z) < GK_CATCH_REACH;
  const inSaveY = ballMesh.position.y < 3.0;
  const ballComingIn = myGoalX > 0 ? ballVel.x > 1.0 : ballVel.x < -1.0;
  if (inSaveX && inSaveZ && inSaveY && ballComingIn && ballOwner === 'none') {
    gkAttemptSave(gkChar, gkSt, myGoalX, ownerKey);
  }

  gkClampToGoalArea(gkChar, myGoalX);
}


// ── Loading ───────────────────────────────────────────────────────────────
const loadingEl  = document.getElementById('loading');
const loadingBar = document.getElementById('loading-bar');
const loadingMsg = document.getElementById('loading-msg');
const loadingErr = document.getElementById('loading-error');

// ── Score / Goal ──────────────────────────────────────────────────────────
const scoreDisplay  = document.getElementById('score-display');
const scorePlayerEl = document.getElementById('score-player');
const scoreCpuEl    = document.getElementById('score-cpu');
const goalFlashEl   = document.getElementById('goal-flash');
const goalSubText   = document.getElementById('goal-sub-text');
const pkHudEl       = document.getElementById('pk-hud');
const pkCountEl     = document.getElementById('pk-count');
const pkResultEl    = document.getElementById('pk-result');
if (pkResultEl) {
  const pkRetry = e => { e.preventDefault(); if (isPK && pkState === 'done') pkRestart(); };
  pkResultEl.addEventListener('click', pkRetry);
  pkResultEl.addEventListener('touchstart', pkRetry, { passive: false });
}

function updateScoreDisplay() {
  if (scorePlayerEl) scorePlayerEl.textContent = playerScore;
  if (scoreCpuEl)    scoreCpuEl.textContent    = cpuScore;
}

function showGoalFlash(scorer) {
  if (!goalFlashEl) return;
  const isConcede = scorer === 'cpu';
  const word = goalFlashEl.querySelector('.goal-word');
  const sub  = goalFlashEl.querySelector('.goal-sub');
  word.textContent       = isConcede ? 'SCORED...' : 'GOAL!';
  goalSubText.textContent = isConcede ? '失　点' : 'PLAYER  SCORES!';
  goalFlashEl.classList.toggle('conceded', isConcede);
  // アニメ再トリガー（連続ゴール対応）
  word.style.animation        = 'none';
  sub.style.animation         = 'none';
  goalFlashEl.style.animation = 'none';
  goalFlashEl.style.display   = 'flex';
  requestAnimationFrame(() => {
    word.style.animation        = '';
    sub.style.animation         = '';
    goalFlashEl.style.animation = '';
  });
}

function mpResetAfterGoal() {
  // ホスト: 左側スタート(x<0)・+x向き  ゲスト: 右側スタート(x>0)・-x向き
  const hostX  = -(FIELD_HALF_W * 0.35);
  const guestX =  (FIELD_HALF_W * 0.35);

  if (mpRole === 'host') {
    player.position.set(hostX, groundY, 0);
    player.rotation.y = -Math.PI / 2;   // +x方向
    remotePeer.position.set(guestX, groundY, 0);
  } else {
    player.position.set(guestX, groundY, 0);
    player.rotation.y = Math.PI / 2;    // -x方向
    remotePeer.position.set(hostX, groundY, 0);
  }

  // ボールをセンターへ・バッファクリア
  ballMesh.position.set(0, BALL_R, 0);
  ballVel.set(0, 0, 0);
  ballOwner = 'none';
  mpRemoteBallOwner = 'none';
  peerBuf.length = 0;
  ballBuf.length = 0;

  // 失点したプレイヤーがボールを持ってリスタート
  // mpGoalScorer = 得点したロール → 私が失点 = mpGoalScorer !== mpRole
  if (mpGoalScorer !== mpRole) {
    ballOwner = 'player'; // 私がボールを保持
  }

  isDribbling = isKicking = isPassing = isTackling = isSpinning = false;
  spinTimer = tackleTimer = kickTimer = 0;
  playerPickupCooldown = 0;
  if (mixer)           { mixer.stopAllAction(); current = null; }
  if (remotePeerMixer) { remotePeerMixer.stopAllAction(); remotePeerClipAct = {}; }
  fadeToClip('idle');
  fadeToRemoteClip('idle');
  if (goalFlashEl) { goalFlashEl.style.display = 'none'; goalFlashEl.classList.remove('conceded'); }
}

function resetAfterGoal(scorer) {
  ballMesh.position.set(0, BALL_R, 0);
  ballVel.set(0, 0, 0);
  ballCurveRate = 0;
  ballOwner    = 'none';
  gkBallHolder = 'none';
  isDribbling  = false;
  isKicking = isPassing = isTackling = isSpinning = false;
  spinTimer = tackleTimer = kickTimer = 0;
  playerPickupCooldown = 0;

  pGKSt.state = 'patrol'; pGKSt.holdTimer = 0; pGKSt.patrolPhase = 0;
  eGKSt.state = 'patrol'; eGKSt.holdTimer = 0; eGKSt.patrolPhase = 0;
  if (playerGKMixer) {
    const pgy = playerGKChar.group.userData.gkGroundOffset ?? groundY;
    playerGKChar.group.position.set(-(GOAL_X - GK_X_OFFSET), pgy, 0);
    playerGKMixer.stopAllAction(); playerGKCurrent = null;
    charAnim(playerGKChar, 'idle');
  }
  if (enemyGKMixer) {
    const egy = enemyGKChar.group.userData.gkGroundOffset ?? groundY;
    enemyGKChar.group.position.set(GOAL_X - GK_X_OFFSET, egy, 0);
    enemyGKMixer.stopAllAction(); enemyGKCurrent = null;
    charAnim(enemyGKChar, 'idle');
  }

  if (mixer) { mixer.stopAllAction(); current = null; }
  if (hasEnemy) {
    enemyTackling = enemyKicking = false;
    enemyPickupCooldown = enemyTackleCooldown = 0;
    if (enemyMixer) { enemyMixer.stopAllAction(); enemyCurrent = null; }
  }

  // ── キックオフ: 失点した側がボールを持って中央からスタート ──────────────
  // scorer='player'(プレイヤー得点)=CPU失点 → CPUがキックオフ
  // scorer='cpu'(CPU得点)=プレイヤー失点 → プレイヤーがキックオフ
  const playerConceded = scorer === 'cpu';
  if (playerConceded || !hasEnemy) {
    // プレイヤーがキックオフ（中央でボール保持）
    player.position.set(0, groundY, 0);
    player.rotation.y = -Math.PI / 2;       // 攻撃方向(+x)を向く
    ballMesh.position.set(0, BALL_R, 0);
    ballOwner   = 'player';
    isDribbling = true;
    if (hasEnemy) { enemy.position.set(14, groundY, 0); enemy.rotation.y = Math.PI / 2; enemyState = 'chase'; }
  } else {
    // CPUがキックオフ（中央でボール保持して速攻開始）
    enemy.position.set(0, groundY, 0);
    enemy.rotation.y = Math.PI / 2;          // 攻撃方向(-x)を向く
    ballMesh.position.set(0, BALL_R, 0);
    ballOwner   = 'enemy';
    enemyState  = 'dribble';
    isDribbling = false;
    player.position.set(-14, groundY, 0);
    player.rotation.y = -Math.PI / 2;        // 中央(+x)を向いて守備
  }

  fadeToClip('idle');
  if (hasEnemy) fadeToEnemyClip('idle');

  if (goalFlashEl) { goalFlashEl.style.display = 'none'; goalFlashEl.classList.remove('conceded'); }
}

function scoreGoal(scorer) {
  if (isGoalScene) return;
  isGoalScene = true;
  if (scorer === 'player') playerScore++; else cpuScore++;
  ballMesh.position.set(scorer === 'player' ? GOAL_X + 0.7 : -(GOAL_X + 0.7), BALL_R, 0);
  ballVel.set(0, 0, 0);
  ballOwner = 'none';
  isDribbling = false;
  updateScoreDisplay();
  showGoalFlash(scorer);
  if (isMultiplayer) {
    // scorer: 'player'=Hostが得点, 'cpu'=Guestが得点
    const mpScorer = scorer === 'player' ? 'host' : 'guest';
    mpGoalScorer   = mpScorer;
    lastGoalSeq    = Date.now();
    mpHandlers.publishEvent({ type: 'goal', scorer: mpScorer, seq: lastGoalSeq });
    mpHandlers.publishScore({ host: playerScore, guest: cpuScore });
    setTimeout(() => { mpResetAfterGoal(); isGoalScene = false; }, 2500);
  } else {
    setTimeout(() => { resetAfterGoal(scorer); isGoalScene = false; }, 2500);
  }
}

// ── PKモード ────────────────────────────────────────────────────────────────
function pkSpotX() { return GOAL_X - PK_DIST; }

// goal-flash を流用して GOAL!/SAVED!/MISS! を表示
function pkFlash(word, sub, conceded) {
  if (!goalFlashEl) return;
  const w = goalFlashEl.querySelector('.goal-word');
  const s = goalFlashEl.querySelector('.goal-sub');
  w.textContent = word; goalSubText.textContent = sub;
  goalFlashEl.classList.toggle('conceded', conceded);
  w.style.animation = s.style.animation = goalFlashEl.style.animation = 'none';
  goalFlashEl.style.display = 'flex';
  requestAnimationFrame(() => { w.style.animation = s.style.animation = goalFlashEl.style.animation = ''; });
  setTimeout(() => { if (goalFlashEl) goalFlashEl.style.display = 'none'; }, 1400);
}

function pkRenderHud() {
  if (pkCountEl) pkCountEl.textContent = `${pkGoals} / ${PK_TOTAL}`;
}

// プレイヤーをスポットに、ボールを足元に、GKをゴール中央に配置して次のキック準備
function pkPlaceForKick() {
  if (!isPK) return;
  player.position.set(pkSpotX(), groundY, 0);
  player.rotation.y = -Math.PI / 2;        // 攻撃方向(+x)
  ballMesh.position.set(pkSpotX(), BALL_R, 0);
  ballVel.set(0, 0, 0); ballCurveRate = 0;
  ballOwner = 'player'; isDribbling = true;
  gkBallHolder = 'none';
  isKicking = isPassing = isTackling = isSpinning = false;
  spinTimer = tackleTimer = kickTimer = 0;
  playerPickupCooldown = 0;
  eGKSt.state = 'patrol'; eGKSt.holdTimer = 0; eGKSt.catchAnimTimer = 0;
  if (enemyGKMixer) {
    const egy = enemyGKChar.group.userData.gkGroundOffset ?? groundY;
    enemyGKChar.group.position.set(GOAL_X - GK_X_OFFSET, egy, 0);
    charAnim(enemyGKChar, 'idle');
  }
  if (mixer) charAnim(playerChar, 'idle');
  pkState = 'ready';
  pkLiveTimer = 0;
}

function pkResolve(result) {
  if (pkState !== 'live') return;
  pkState = 'resolved';
  pkKick++;
  if (result === 'goal') pkGoals++;
  gkBallHolder = 'none';     // GKのスローを止める
  pkRenderHud();
  if (result === 'goal')      pkFlash('GOAL!',  'PK  成功', false);
  else if (result === 'save') pkFlash('SAVED!', 'キーパー  セーブ', true);
  else                        pkFlash('MISS!',  '枠　外', true);

  if (pkKick >= PK_TOTAL) {
    pkState = 'done';
    setTimeout(() => pkShowResult(), 1500);
  } else {
    setTimeout(() => pkPlaceForKick(), 1800);
  }
}

function pkShowResult() {
  if (!pkResultEl) { pkPlaceForKick(); return; }
  const rank = pkGoals === PK_TOTAL ? 'PERFECT!' : pkGoals >= PK_TOTAL * 0.6 ? 'NICE!' : 'もう一度!';
  pkResultEl.querySelector('#pk-result-score').textContent = `${pkGoals} / ${PK_TOTAL}`;
  pkResultEl.querySelector('#pk-result-rank').textContent  = rank;
  pkResultEl.style.display = 'flex';
}

function pkRestart() {
  if (pkResultEl) pkResultEl.style.display = 'none';
  pkKick = 0; pkGoals = 0;
  pkRenderHud();
  pkPlaceForKick();
}

function updatePK(dt) {
  if (!gameStarted) return;
  if (pkState === 'ready') {
    // プレイヤーが蹴ったら live へ
    if (ballOwner !== 'player' && ballVel.lengthSq() > 1) { pkState = 'live'; pkLiveTimer = 0; }
    return;
  }
  if (pkState === 'live') {
    pkLiveTimer += dt;
    if (gkBallHolder === 'enemy_gk') { pkResolve('save'); return; }   // GKキャッチ
    const stopped = ballVel.lengthSq() < 1.0 && ballMesh.position.y <= BALL_R + 0.06;
    if (pkLiveTimer > 4.0 || (stopped && pkLiveTimer > 0.5)) { pkResolve('miss'); return; }
  }
}

const loader = new FBXLoader();

const ANIM_FILES = [
  ['idle',    './animations/idle.fbx'],
  ['walk',    './animations/walk.fbx'],
  ['run',     './animations/run.fbx'],
  ['kick',    './animations/kick.fbx'],
  ['dribble', './animations/Dribble.fbx'],
  ['pass',    './animations/Pass.fbx'],
  ['tackle',  './animations/Tackle.fbx'],
  ['spin',       './animations/Spin.fbx'],
  ['gk_sidestep','./animations/Goalkeeper Sidestep.fbx'],
  ['gk_catch',   './animations/Goalkeeper Catch.fbx'],
  ['gk_dive',    './animations/Goalkeeper Diving Save.fbx'],
  ['gk_throw',   './animations/Goalkeeper Overhand Throw.fbx'],
];
let CORE_TOTAL = 1 + ANIM_FILES.length; // キャラ + 全アニメ（敵追加時はstartGame内で+1）
let coreReady = 0;
let gameStarted = false;

// ── マルチプレイヤー ──────────────────────────────────────────────
let isMultiplayer     = false;
let mpRole            = null;
let mpHandlers        = null;
let remotePeer        = new THREE.Group();
let remotePeerMixer   = null;
let remotePeerClipAct = {};
let mpTimer              = 0;
let gameWatcher          = null;
let mpRemoteBallOwner    = 'none'; // 'host' | 'guest' | 'none'
let mpGoalScorer         = null;   // 直前のゴールを決めたロール ('host'|'guest')
let lastGoalSeq          = 0;     // ゴールイベント重複処理防止

// エンティティ補間バッファ（受信スナップショットをタイムスタンプ付きで保持）
const INTERP_DELAY    = 120;   // ms: この分だけ過去を描画してスムーズに補間
const PEER_BUF_MAX    = 16;
const BALL_BUF_MAX    = 16;
const peerBuf         = [];    // { ts, x, z, ry, anim }[]
const ballBuf         = [];    // { ts, x, y, z, vx, vy, vz }[]

function pushPeerBuf(state) {
  peerBuf.push({ ts: Date.now(), ...state });
  if (peerBuf.length > PEER_BUF_MAX) peerBuf.shift();
}
function pushBallBuf(state) {
  ballBuf.push({ ts: Date.now(), ...state });
  if (ballBuf.length > BALL_BUF_MAX) ballBuf.shift();
}

// 補間: renderTime 時点での値を2点間で線形補間して返す
function interpBuf(buf, renderTime) {
  if (buf.length === 0) return null;
  // renderTime より古い最新スナップ
  let prev = null, next = null;
  for (let i = buf.length - 1; i >= 0; i--) {
    if (buf[i].ts <= renderTime) { prev = buf[i]; break; }
  }
  for (let i = 0; i < buf.length; i++) {
    if (buf[i].ts > renderTime) { next = buf[i]; break; }
  }
  if (!prev) return next ?? buf[0];
  if (!next) return prev;
  const t = Math.max(0, Math.min(1, (renderTime - prev.ts) / (next.ts - prev.ts)));
  // 数値フィールドを補間、文字列は prev を使用
  const result = {};
  for (const k of Object.keys(next)) {
    result[k] = (typeof next[k] === 'number')
      ? prev[k] + (next[k] - prev[k]) * t
      : prev[k];
  }
  return result;
}

function fadeToRemoteClip(name) {
  if (!remotePeerMixer || !clips[name]) return;
  const act = remotePeerClipAct[name]
    ?? (remotePeerClipAct[name] = remotePeerMixer.clipAction(clips[name]));
  if (act.isRunning()) return;
  Object.values(remotePeerClipAct).forEach(a => a.fadeOut(0.2));
  act.reset().fadeIn(0.2).play();
}

function onCoreLoaded() {
  coreReady++;
  const pct = Math.round((coreReady / CORE_TOTAL) * 100);
  loadingBar.style.width = pct + '%';
  if (coreReady === CORE_TOTAL) {
    if (hasEnemy) { enemy.position.y = groundY; enemy.visible = true; }
    // PKモードでは自陣GK（プレイヤー側）は不要なので非表示
    if (playerGKMixer && !isPK) {
      const pgy = playerGKChar.group.userData.gkGroundOffset ?? groundY;
      playerGKChar.group.position.set(-(GOAL_X - GK_X_OFFSET), pgy, 0);
      playerGKChar.group.visible = true;
      charAnim(playerGKChar, 'idle');
    } else if (playerGKMixer && isPK) {
      playerGKChar.group.visible = false;
    }
    if (enemyGKMixer) {
      const egy = enemyGKChar.group.userData.gkGroundOffset ?? groundY;
      enemyGKChar.group.position.set(GOAL_X - GK_X_OFFSET, egy, 0);
      enemyGKChar.group.visible = true;
      charAnim(enemyGKChar, 'idle');
    }
    if (isMultiplayer) {
      remotePeer.position.y = groundY;
      remotePeer.visible = true;
      // ゲーム状態を Firebase で監視開始
      gameWatcher = mpHandlers.watchGame(data => {
        const remote = mpRole === 'host' ? data?.guest : data?.host;
        if (remote) pushPeerBuf(remote);
        if (data?.ball) {
          pushBallBuf(data.ball);
          mpRemoteBallOwner = data.ball.owner ?? 'none';
        }
        if (data?.score && mpRole === 'guest') {
          playerScore = data.score.guest ?? 0;
          cpuScore    = data.score.host  ?? 0;
          updateScoreDisplay();
        }
        // ゴールイベント受信（Guest側でリセット実行）
        if (mpRole === 'guest' && data?.event?.type === 'goal'
            && data.event.seq > lastGoalSeq) {
          lastGoalSeq  = data.event.seq;
          mpGoalScorer = data.event.scorer;
          const localScorer = data.event.scorer === 'guest' ? 'player' : 'cpu';
          if (!isGoalScene) {
            isGoalScene = true;
            ballMesh.position.set(
              localScorer === 'player' ? GOAL_X + 0.7 : -(GOAL_X + 0.7), BALL_R, 0
            );
            ballVel.set(0, 0, 0);
            ballOwner = 'none';
            isDribbling = false;
            showGoalFlash(localScorer);
            setTimeout(() => { mpResetAfterGoal(); isGoalScene = false; }, 2500);
          }
        }
      });
    }
    loadingEl.style.display = 'none';
    gameStarted = true;
    fadeToClip('idle');
    if (hasEnemy) fadeToEnemyClip('idle');
    if (isMultiplayer) fadeToRemoteClip('idle');

    if (isPK) {
      // PK戦: スコア表示は隠してPK HUDを表示、スポットに配置
      if (scoreDisplay) scoreDisplay.style.display = 'none';
      if (pkHudEl) pkHudEl.style.display = 'flex';
      pkRenderHud();
      pkPlaceForKick();
    } else if (scoreDisplay) {
      scoreDisplay.style.display = 'flex';
    }
  }
}

// ゲーム開始（lobby.jsからimportされる）
export function startGame(config) {
  // ── 前ゲームの残骸を全てクリア ────────────────────────────────────
  // player の旧キャラ削除
  while (player.children.length > 0) player.remove(player.children[0]);
  // remotePeer の旧キャラ削除
  while (remotePeer.children.length > 0) remotePeer.remove(remotePeer.children[0]);
  scene.remove(remotePeer);
  remotePeerMixer = null; remotePeerClipAct = {};
  // enemy を scene から除去（CPU戦の残骸防止）
  scene.remove(enemy);
  while (enemy.children.length > 0) enemy.remove(enemy.children[0]);
  // GK の旧キャラ削除（scene から除去せず children だけクリア）
  while (playerGKGroup.children.length > 0) playerGKGroup.remove(playerGKGroup.children[0]);
  playerGKGroup.visible = false;
  playerGKMixer = null; playerGKCurrent = null; playerGKChar.animState = playerGKAnim;
  while (enemyGKGroup.children.length > 0) enemyGKGroup.remove(enemyGKGroup.children[0]);
  enemyGKGroup.visible  = false;
  enemyGKMixer = null; enemyGKCurrent = null; enemyGKChar.animState = enemyGKAnim;
  // カウンタとゲーム状態リセット
  CORE_TOTAL = 1 + ANIM_FILES.length;
  coreReady  = 0;
  gameStarted = false;
  isMultiplayer = false; mpRole = null; mpHandlers = null;
  mpTimer = 0; mpRemoteBallOwner = 'none'; mpGoalScorer = null; lastGoalSeq = 0;
  peerBuf.length = 0; ballBuf.length = 0;
  ballOwner = 'none'; gkBallHolder = 'none'; isDribbling = false;
  gkSessionId++;
  pGKSt.state = 'patrol'; pGKSt.holdTimer = 0; pGKSt.patrolPhase = 0;
  eGKSt.state = 'patrol'; eGKSt.holdTimer = 0; eGKSt.patrolPhase = 0;
  playerScore = 0; cpuScore = 0; updateScoreDisplay();
  isGoalScene = false;
  // PKモード状態リセット
  isPK = !!config.pk;
  pkState = 'ready'; pkKick = 0; pkGoals = 0; pkLiveTimer = 0;
  if (pkResultEl) pkResultEl.style.display = 'none';
  if (pkHudEl)    pkHudEl.style.display = 'none';
  if (gameWatcher) { gameWatcher(); gameWatcher = null; }

  // ── フィールドサイズ設定 ──────────────────────────────────────────
  const FIELD_PRESETS = {
    full:    { halfW: 51, halfD: 34 },
    medium:  { halfW: 35, halfD: 25 },
    compact: { halfW: 23, halfD: 16 },
  };
  const fs = FIELD_PRESETS[config.fieldSize] || FIELD_PRESETS.full;
  FIELD_HALF_W = fs.halfW;
  FIELD_HALF_D = fs.halfD - 1;
  GOAL_X       = fs.halfW + 1.5;
  GOAL_HALF_Z  = 3.66; // ゴール幅はフィールドサイズに関わらず11v11固定（小フィールドで点が入らない問題を解消）
  scene.remove(fieldRoot);
  fieldRoot = buildField(fs.halfW, fs.halfD);
  scene.add(fieldRoot);

  hasEnemy = isPK ? false : !!config.enemyFbx; // PKは敵CPUなし（GKのみ）
  if (hasEnemy) CORE_TOTAL++;

  // マルチプレイヤー設定
  if (config.mp) {
    isMultiplayer = true;
    mpRole        = config.mp.role;
    mpHandlers    = config.mp;
    hasEnemy      = false;
    CORE_TOTAL++;  // リモートキャラ読み込み分
    // リモートプレイヤーのキャラ読み込み
    loader.load(
      config.mp.remoteCharFbx,
      fbx => {
        fbx.scale.setScalar(0.01);
        fbx.rotation.y = Math.PI;
        fbx.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true; c.receiveShadow = true;
            c.material = Array.isArray(c.material)
              ? c.material.map(m => { const mc = m.clone(); mc.color.set(0xff8844); return mc; })
              : (() => { const mc = c.material.clone(); mc.color.set(0xff8844); return mc; })();
          }
        });
        remotePeer.add(fbx);
        // リモートプレイヤーは自分と逆サイドに配置
        const remoteStartX = mpRole === 'host' ? 15 : -15;
        remotePeer.position.set(remoteStartX, 0, 0);
        remotePeer.visible = false;
        scene.add(remotePeer);
        remotePeerMixer = new THREE.AnimationMixer(fbx);
        onCoreLoaded();
      },
      undefined,
      () => onCoreLoaded()  // 読み込み失敗でも続行
    );
    // マルチ時のプレイヤー開始x座標はキャラ読み込み後に設定（groundY確定後）
  }

  // キャラクター
  loader.load(
    config.charFbx,
    fbx => {
      character = fbx;
      character.scale.setScalar(0.01);
      character.rotation.y = Math.PI;
      character.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => { if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; });
        }
      });
      player.add(character);
      player.updateMatrixWorld(true);
      const meshBox = new THREE.Box3();
      character.traverse(c => {
        if (c.isMesh && c.geometry) {
          c.geometry.computeBoundingBox();
          const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
          meshBox.union(b);
        }
      });
      if (!meshBox.isEmpty() && isFinite(meshBox.min.y) && meshBox.min.y < -0.01) {
        player.position.y -= meshBox.min.y;
      }
      groundY = player.position.y;
      // マルチ: Host は左側(x<0)・Guest は右側(x>0) からスタート
      if (isMultiplayer) {
        player.position.x = mpRole === 'host' ? -15 : 15;
        player.rotation.y = mpRole === 'host' ? -Math.PI / 2 : Math.PI / 2;
      }
      mixer = new THREE.AnimationMixer(character);
      // playerChar を初期化（共通関数用）
      playerChar.group     = player;
      playerChar.animState = playerAnim;
      mixer.addEventListener('finished', e => {
        if (clips['kick']    && e.action === mixer.clipAction(clips['kick']))    isKicking  = false;
        if (clips['pass']    && e.action === mixer.clipAction(clips['pass']))    isPassing  = false;
        if (clips['tackle']  && e.action === mixer.clipAction(clips['tackle']))  isTackling = false;
        if (clips['spin']    && e.action === mixer.clipAction(clips['spin']))    isSpinning = false;
      });

      onCoreLoaded();
    },
    xhr => {
      const mb = (xhr.loaded / 1024 / 1024).toFixed(1);
      loadingMsg.textContent = `キャラ読み込み中... ${mb}MB`;
    },
    err => {
      console.error(err);
      loadingErr.textContent = `読み込みエラー: ${err?.message || 'ファイルが見つかりません'} — start-server.bat で起動してください`;
    }
  );

  // 敵キャラをロード（選択されなかったキャラをランダムピック）
  if (hasEnemy) {
    loader.load(
      config.enemyFbx,
      fbx => {
        fbx.scale.setScalar(0.01);
        fbx.rotation.y = Math.PI;
        fbx.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            c.material = Array.isArray(c.material)
              ? c.material.map(m => { const mc = m.clone(); mc.color.set(0xff4444); return mc; })
              : (() => { const mc = c.material.clone(); mc.color.set(0xff4444); return mc; })();
          }
        });
        enemy.add(fbx);
        enemy.position.set(-15, 0, 0);
        enemy.visible = false; // ゲーム開始まで非表示（Tポーズ防止）
        scene.add(enemy);
        enemyMixer = new THREE.AnimationMixer(fbx);
        // enemyChar を初期化（共通関数用）
        enemyChar.group     = enemy;
        enemyChar.animState = enemyAnim;
        enemyMixer.addEventListener('finished', e => {
          if (clips['tackle'] && e.action === enemyMixer.clipAction(clips['tackle'])) enemyTackling = false;
          if (clips['kick']   && e.action === enemyMixer.clipAction(clips['kick']))   enemyKicking  = false;
        });
        // 赤いマーカー
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff2222 })
        );
        marker.position.set(0, 2.05, 0);
        enemy.add(marker);
        onCoreLoaded();
      },
      undefined,
      err => {
        console.error('Enemy load failed:', err);
        onCoreLoaded();
      }
    );
  }

  // ゴールキーパーロード（ソロモードのみ、両チーム固定キャラ）
  if (!config.mp) {
    CORE_TOTAL += 2;
    const GK_FBX_PATH = './キャラ/我牙丸吟的なキャラ（ゴールキーパー）/T-Pose.fbx';

    function loadOneGK(gkGroup, gkChar, gkAnimProxy, tintColor, gkSt) {
      loader.load(GK_FBX_PATH, fbx => {
        fbx.rotation.y = Math.PI;
        // ── スケール自動計算（GKモデルはMeshy AIの単位系が他キャラと異なるため、
        // 固定0.01だとサイズ不正になる）。一旦追加して身長を測り1.75mに正規化する ──
        gkGroup.position.set(0, 0, 0); // 再戦時の残留位置を排除して正確に計測
        gkGroup.add(fbx);
        gkGroup.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(fbx);
        const rawH   = rawBox.max.y - rawBox.min.y;
        fbx.scale.setScalar(rawH > 0.01 ? (1.75 / rawH) : 0.01);
        fbx.traverse(c => {
          if (c.isMesh) {
            c.castShadow = c.receiveShadow = true;
            if (tintColor) {
              c.material = Array.isArray(c.material)
                ? c.material.map(m => { const mc = m.clone(); mc.color.set(tintColor); return mc; })
                : (() => { const mc = c.material.clone(); mc.color.set(tintColor); return mc; })();
            } else {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach(m => { if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; });
            }
          }
        });
        // スケール変更後に再計算してY接地オフセットを保存（足が y=0 に来るよう補正）
        gkGroup.updateMatrixWorld(true);
        const gkBox = new THREE.Box3().setFromObject(fbx);
        gkGroup.userData.gkGroundOffset =
          (isFinite(gkBox.min.y) && gkBox.min.y < -0.01) ? -gkBox.min.y : 0;
        const newMixer = new THREE.AnimationMixer(fbx);
        gkAnimProxy.mixer = newMixer;
        gkChar.animState  = gkAnimProxy;
        gkChar.group      = gkGroup;
        newMixer.addEventListener('finished', e => {
          if ((gkSt.state === 'save' || gkSt.state === 'dive')
              && ((clips['gk_catch'] && e.action === newMixer.clipAction(clips['gk_catch']))
               || (clips['gk_dive']  && e.action === newMixer.clipAction(clips['gk_dive'])))) {
            if (gkSt.state !== 'hold') gkSt.state = 'patrol';
          }
          if (gkSt.state === 'throw' && clips['gk_throw']
              && e.action === newMixer.clipAction(clips['gk_throw'])) {
            gkSt.state = 'patrol';
          }
        });
        onCoreLoaded();
      }, undefined, err => { console.error('GK load failed:', err); onCoreLoaded(); });
    }

    loadOneGK(playerGKGroup, playerGKChar, playerGKAnim, null,     pGKSt);
    loadOneGK(enemyGKGroup,  enemyGKChar,  enemyGKAnim,  0xff4444, eGKSt);
  }

  // 全アニメを並列ロード
  ANIM_FILES.forEach(([name, path]) => {
    loader.load(path, fbx => {
      if (fbx.animations.length) {
        const clip = stripRootMotion(fbx.animations[0]);
        clip.name = name;
        clips[name] = clip;
      } else {
        console.warn(`No animations found in ${path}`);
      }
      onCoreLoaded();
    }, undefined, err => {
      console.error(`Failed to load ${path}:`, err);
      onCoreLoaded();
    });
  });
}

// ── Character Control ─────────────────────────────────────────────────────
const MOVE_SPEED   = 8;
const RUN_SPEED    = 11;   // 通常移動速度（少し遅く）
const TURN_SPEED   = 1.2;
const TACKLE_LOCK  = 0.7;  // タックルの操作ロック時間（clip全長1.77sは長すぎるため短い前進ランジに）
let FIELD_HALF_W = 51;
let FIELD_HALF_D = 33;
let GOAL_X       = 52.5;
let GOAL_HALF_Z  = 3.66;

const smoothCamTarget = new THREE.Vector3(0, 1, 0);

function getDesiredAnim() {
  if (isKicking || isPassing || isTackling) return null;
  if (isSpinning && isDribbling) return 'spin';
  const fwd    = keys.has('KeyW') || keys.has('ArrowUp');
  const bwd    = keys.has('KeyS') || keys.has('ArrowDown');
  const strafe = keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('KeyD') || keys.has('ArrowRight');
  const joyFwd  = joystick.active && joystick.dy < -0.1;
  const joyBwd  = joystick.active && joystick.dy >  0.1;
  const joyStrf = joystick.active && Math.abs(joystick.dx) > 0.1;
  const moving  = fwd || bwd || strafe || joyFwd || joyBwd || joyStrf;
  if (isDribbling && moving && clips['dribble']) return 'dribble';
  if (moving) return clips['run'] ? 'run' : 'idle';
  return 'idle';
}


// ── スピンエフェクト ──────────────────────────────────────────────────────────
const spinParticles = [];
const spinGhosts    = [];
let _spinDustTimer  = 0;
let _spinGhostTimer = 0;
let _prevSpinning   = false;

function spawnSpinBurst() {
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const spd   = 1.8 + Math.random() * 2.5;
    const mesh  = new THREE.Mesh(
      new THREE.SphereGeometry(0.055 + Math.random() * 0.04, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xd4b483, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(player.position);
    mesh.position.y = 0.08;
    scene.add(mesh);
    spinParticles.push({
      mesh,
      vel: new THREE.Vector3(Math.cos(angle) * spd, 1.2 + Math.random() * 2, Math.sin(angle) * spd),
      life: 0,
      maxLife: 0.35 + Math.random() * 0.2
    });
  }
}

function spawnSpinGhost() {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.1, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.28, depthWrite: false })
  );
  mesh.position.copy(player.position);
  mesh.position.y += 0.7;
  mesh.rotation.y = player.rotation.y;
  scene.add(mesh);
  spinGhosts.push({ mesh, life: 0, maxLife: 0.25 });
}

function updateSpinEffects(dt) {
  for (let i = spinParticles.length - 1; i >= 0; i--) {
    const p = spinParticles[i];
    p.life += dt;
    const t = p.life / p.maxLife;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 6 * dt;
    p.mesh.material.opacity = 0.9 * (1 - t * t);
    p.mesh.scale.setScalar(1 + t * 0.8);
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose();
      spinParticles.splice(i, 1);
    }
  }
  for (let i = spinGhosts.length - 1; i >= 0; i--) {
    const g = spinGhosts[i];
    g.life += dt;
    const t = g.life / g.maxLife;
    g.mesh.material.opacity = 0.28 * (1 - t);
    if (g.life >= g.maxLife) {
      scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose();
      spinGhosts.splice(i, 1);
    }
  }
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(dt);

  // ── ボール更新 ───────────────────────────────────────────────────
  const remoteRole = mpRole === 'host' ? 'guest' : 'host';
  const remoteOwns = isMultiplayer && mpRemoteBallOwner === remoteRole;

  if (isMultiplayer && remoteOwns) {
    // 相手がボール保持 → 最新受信位置を直接適用（遅延なし）
    const bs = ballBuf.length > 0 ? ballBuf[ballBuf.length - 1] : null;
    if (bs && ballOwner !== 'player') {
      ballMesh.position.set(bs.x, bs.y, bs.z);
      ballVel.set(bs.vx ?? 0, bs.vy ?? 0, bs.vz ?? 0);
      ballOwner = 'enemy';
    }
    updateLocalPlayerBall(dt); // タックル奪取チェック（競合解決も含む）
  } else if (!isMultiplayer || mpRole === 'host') {
    // ソロ or Host（誰もボールを持っていない or 自分が持っている）
    updateBall(dt);
    // Host が自分でボールを持った場合の即時通知は mpTimer 送信で対応
  } else {
    // Guest: Hostの物理結果を受け取りつつローカル操作
    if (ballOwner !== 'player') {
      const bs = interpBuf(ballBuf, Date.now() - 50);
      if (bs) {
        ballMesh.position.x += (bs.x - ballMesh.position.x) * Math.min(1, 20 * dt);
        ballMesh.position.y += (bs.y - ballMesh.position.y) * Math.min(1, 20 * dt);
        ballMesh.position.z += (bs.z - ballMesh.position.z) * Math.min(1, 20 * dt);
        ballVel.set(bs.vx ?? 0, bs.vy ?? 0, bs.vz ?? 0);
      }
    }
    updateLocalPlayerBall(dt);
  }
  // 相手がボールを手放した → 'enemy' を解放
  if (isMultiplayer && ballOwner === 'enemy' && !remoteOwns) ballOwner = 'none';

  if (isPK) {
    // PK戦: 敵GKのみ守備、updatePKで進行管理（敵CPU・自陣GKは動かさない）
    updateGK(enemyGKChar, eGKSt, GOAL_X, enemyChar, 'enemy_gk', dt);
    updatePK(dt);
  } else if (!isMultiplayer) {
    updateEnemy(dt);
    updateGK(playerGKChar, pGKSt, -GOAL_X, playerChar, 'player_gk', dt);
    if (hasEnemy) updateGK(enemyGKChar, eGKSt, GOAL_X, enemyChar, 'enemy_gk', dt);
  } else if (gameStarted) {
    // リモートプレイヤーをバッファから補間して描画
    if (remotePeerMixer) {
      const renderTime = Date.now() - INTERP_DELAY;
      const ps = interpBuf(peerBuf, renderTime);
      if (ps) {
        remotePeer.position.x = ps.x;
        remotePeer.position.z = ps.z;
        // Y軸回転の最短経路補間
        let ryDiff = (ps.ry - remotePeer.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        remotePeer.rotation.y += ryDiff * Math.min(1, 18 * dt);
        remotePeerMixer.update(dt);
        fadeToRemoteClip(ps.anim !== 'idle' ? 'run' : 'idle');
      }
    }
    // 自分の状態を30Hzで送信
    mpTimer += dt;
    if (mpTimer >= 0.033) {
      mpTimer = 0;
      mpHandlers.publishPlayer(mpRole, {
        x: player.position.x, z: player.position.z,
        ry: player.rotation.y, anim: getDesiredAnim() || 'idle',
      });
      // ボール送信: 自分が持っているか、Hostなら常に送信（ルーズボール物理の権威）
      const shouldPubBall = ballOwner === 'player' || mpRole === 'host';
      if (shouldPubBall) {
        mpHandlers.publishBall({
          x: ballMesh.position.x, y: ballMesh.position.y, z: ballMesh.position.z,
          vx: ballVel.x, vy: ballVel.y, vz: ballVel.z,
          owner: ballOwner === 'player' ? mpRole : 'none', // 誰が持っているか
        });
      }
      if (mpRole === 'host') {
        mpHandlers.publishScore({ host: playerScore, guest: cpuScore });
      }
    }
  }

  updateSpinEffects(dt);

  if (gameStarted) {
  if (!isGoalScene) {
    const anim = getDesiredAnim();
    if (anim) fadeToClip(anim);

    if (!isKicking && !isPassing && !isTackling && !isSpinning) {
      // 視線回転: Q/E キー
      if (keys.has('KeyQ')) viewAngle += TURN_SPEED * dt;
      if (keys.has('KeyE')) viewAngle -= TURN_SPEED * dt;

      const fwd      = keys.has('KeyW') || keys.has('ArrowUp');
      const bwd      = keys.has('KeyS') || keys.has('ArrowDown');
      const strafeLt = keys.has('KeyA') || keys.has('ArrowLeft');
      const strafeRt = keys.has('KeyD') || keys.has('ArrowRight');

      // 移動方向はカメラ視点角基準
      const camDir   = new THREE.Vector3(-Math.sin(viewAngle), 0, -Math.cos(viewAngle));
      const camRight = new THREE.Vector3( Math.cos(viewAngle), 0, -Math.sin(viewAngle));

      const moveVec = new THREE.Vector3();
      let wantTurn  = false;
      if (fwd)      { moveVec.addScaledVector(camDir,    1); wantTurn = true; }
      if (bwd)      { moveVec.addScaledVector(camDir,   -1); }
      if (strafeLt) { moveVec.addScaledVector(camRight, -1); if (!bwd) wantTurn = true; }
      if (strafeRt) { moveVec.addScaledVector(camRight,  1); if (!bwd) wantTurn = true; }

      if (joystick.active) {
        if (Math.abs(joystick.dy) > 0.05) { moveVec.addScaledVector(camDir,   -joystick.dy); wantTurn = true; }
        if (Math.abs(joystick.dx) > 0.05) { moveVec.addScaledVector(camRight,  joystick.dx); wantTurn = true; }
      }

      if (moveVec.lengthSq() > 0.001) {
        moveVec.normalize();
        player.position.addScaledVector(moveVec, RUN_SPEED * dt);

        if (wantTurn) {
          const targetAngle = Math.atan2(-moveVec.x, -moveVec.z);
          let diff = targetAngle - player.rotation.y;
          while (diff >  Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          player.rotation.y += diff * Math.min(1, 12 * dt);
        }
      }

      charClampToField(playerChar);

      // viewAngle をプレイヤーの向きへゆっくり遅延追従
      if (!keys.has('KeyQ') && !keys.has('KeyE') && !lookSwipe.active) {
        let camDiff = player.rotation.y - viewAngle;
        while (camDiff >  Math.PI) camDiff -= 2 * Math.PI;
        while (camDiff < -Math.PI) camDiff += 2 * Math.PI;
        viewAngle += camDiff * Math.min(1, 1.5 * dt); // ゆっくり追従（約1〜2秒で追いつく）
      }
    }

    // ワンショット動作の終了をタイマーで保証する。finishedイベントは別アニメへの
    // 割り込み(例: タックル中にシュート)で取りこぼされ、フラグが固着して操作不能に
    // なるため、時間で必ず解除する。
    if (isSpinning) {
      spinTimer -= dt;
      if (spinTimer <= 0 || ballOwner !== 'player') endSpin();
    }
    if (isTackling) {
      tackleTimer -= dt;
      if (tackleTimer <= 0) isTackling = false;
    }
    if (isKicking) {
      kickTimer -= dt;
      if (kickTimer <= 0) isKicking = false;
    }

    // タックル/スピン中は向いてる方向に自動前進
    if (isTackling || isSpinning) {
      const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
      const speed  = isTackling ? MOVE_SPEED * 1.3 : MOVE_SPEED;
      player.position.addScaledVector(facing, speed * dt);
      player.position.y = groundY; // 浮き防止
      charClampToField(playerChar);
    }

    // スピンエフェクト
    if (isSpinning && isDribbling) {
      if (!_prevSpinning) { spawnSpinBurst(); spawnSpinGhost(); _spinDustTimer = 0; _spinGhostTimer = 0; }
      _spinDustTimer  += dt;
      _spinGhostTimer += dt;
      if (_spinDustTimer  >= 0.15)  { spawnSpinBurst(); _spinDustTimer  = 0; }
      if (_spinGhostTimer >= 0.065) { spawnSpinGhost(); _spinGhostTimer = 0; }
    }
    _prevSpinning = isSpinning;
  } // end !isGoalScene

    // カメラ追従: ターゲット位置をスムーズに追い、そこから固定オフセット分で配置
    // （位置を直接 lerp するとカメラがプレイヤーに近づくズームが起きるため避ける）
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, viewAngle, 0));
    const camOffset   = new THREE.Vector3(0, 8, 16).applyQuaternion(q);
    const idealTarget = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const t = Math.min(1, 7 * dt);
    smoothCamTarget.lerp(idealTarget, t);
    camera.position.copy(smoothCamTarget).add(camOffset);
    camera.lookAt(smoothCamTarget);
  } // end gameStarted

  if (window._updateMobileButtons) window._updateMobileButtons();
  renderer.render(scene, camera);
}

function syncCameraToViewport() {
  // 横持ち時: 画面の高さが縦持ちより短い分だけズームして同じ表示サイズをキープ
  camera.zoom = window.innerWidth > window.innerHeight
    ? window.innerWidth / window.innerHeight
    : 1;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', syncCameraToViewport);
window.addEventListener('orientationchange', () => setTimeout(syncCameraToViewport, 100));

// ブラウザのピンチ・スクロールズームを無効化
document.addEventListener('wheel', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart',  e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });

// ── タッチ操作 ────────────────────────────────────────────────────────────

// ▼ プニコン（仮想スティック）— 画面左半分のタッチで起動
// ▼ 右半分スワイプ — 視線回転
document.addEventListener('touchstart', e => {
  // ロビー表示中はゲーム用タッチ処理を無効化
  if (document.getElementById('lobby')?.style?.display !== 'none') return;
  for (const t of e.changedTouches) {
    const isBtn = t.target.closest?.('.touch-btn');
    if (t.clientX < window.innerWidth * 0.5 && !joystick.active) {
      e.preventDefault();
      joystick.active = true;
      joystick.id = t.identifier;
      joystick.ox = t.clientX;
      joystick.oy = t.clientY;
      joystick.dx = 0;
      joystick.dy = 0;
      joyBase.style.display = 'block';
      joyBase.style.left = t.clientX + 'px';
      joyBase.style.top  = t.clientY + 'px';
      joyKnob.style.transform = 'translate(-50%,-50%)';
    } else if (!isBtn && t.clientX >= window.innerWidth * 0.5 && !lookSwipe.active) {
      // ボタン以外の右半分タッチ → 視線回転スワイプ開始
      e.preventDefault();
      lookSwipe.active = true;
      lookSwipe.id = t.identifier;
      lookSwipe.prevX = t.clientX;
    }
  }
}, { passive: false });

document.addEventListener('touchmove', e => {
  if (document.getElementById('lobby')?.style?.display !== 'none') return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystick.id) {
      const ddx = t.clientX - joystick.ox;
      const ddy = t.clientY - joystick.oy;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      const cl  = Math.min(len, JOY_MAX);
      joystick.dx = (len > 0 ? ddx / len : 0) * cl / JOY_MAX;
      joystick.dy = (len > 0 ? ddy / len : 0) * cl / JOY_MAX;
      joyKnob.style.transform =
        `translate(calc(-50% + ${joystick.dx * JOY_MAX}px), calc(-50% + ${joystick.dy * JOY_MAX}px))`;
    } else if (t.identifier === lookSwipe.id) {
      // 右スワイプで視線回転（viewAngle を変える。プレイヤー体は変えない）
      const dx = t.clientX - lookSwipe.prevX;
      lookSwipe.prevX = t.clientX;
      viewAngle -= dx * LOOK_SENSITIVITY;
    }
  }
}, { passive: false });

function releaseTouch(id) {
  if (id === joystick.id) {
    joystick.active = false;
    joystick.id = -1;
    joystick.dx = 0;
    joystick.dy = 0;
    joyBase.style.display = 'none';
  }
  if (id === lookSwipe.id) {
    lookSwipe.active = false;
    lookSwipe.id = -1;
  }
}
document.addEventListener('touchend',    e => { for (const t of e.changedTouches) releaseTouch(t.identifier); });
document.addEventListener('touchcancel', e => { for (const t of e.changedTouches) releaseTouch(t.identifier); });

// ▼ アクションボタン（右半分）
(function setupActionBtns() {

  // キックボタン（ジョイスティック傾き量でpower決定: 弱押し=弱シュート, フル=強シュート）
  function setupKickBtn(id, lofted, curve) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      const joyMag = joystick.active
        ? Math.min(1, Math.sqrt(joystick.dx ** 2 + joystick.dy ** 2))
        : 1.0;
      const power = 0.6 + 0.9 * joyMag; // 0.6(最弱)〜1.5(最強)
      startKick(lofted, curve, power);
    }, { passive: false });
  }
  setupKickBtn('btn-kick',        false,  0);
  setupKickBtn('btn-loft',        true,   0);
  setupKickBtn('btn-curve-left',  false, -1);
  setupKickBtn('btn-curve-right', false,  1);

  // タックルボタン（ボール非所持時のみ有効）
  const tackleBtn = document.getElementById('btn-tackle');
  if (tackleBtn) {
    tackleBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      startTackle();
    }, { passive: false });
  }

  // スピンボタン（ドリブル中のみ有効）
  const spinBtn = document.getElementById('btn-spin');
  if (spinBtn) {
    spinBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      startSpin();
    }, { passive: false });
  }

  // ボール所持状態に応じてボタン表示切替
  function updateMobileButtons() {
    const hasBall = ballOwner === 'player';
    ['btn-kick', 'btn-loft', 'btn-curve-left', 'btn-curve-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = hasBall ? '' : 'none';
    });
    if (tackleBtn) tackleBtn.style.display = hasBall ? 'none' : '';
    if (spinBtn)   spinBtn.style.display   = hasBall ? '' : 'none';
  }
  // animate() から呼べるようにグローバル化
  window._updateMobileButtons = updateMobileButtons;
})();

animate();
