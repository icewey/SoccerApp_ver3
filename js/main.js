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

// ── 2vs2 用のCPUエンティティ（味方1人＋敵2人）────────────────────────────────
// チームA = プレイヤー＋味方(ally) / チームB = 敵2人(enemy, enemy2)。
// 敵#1は既存の enemy グループを流用し、味方と敵#2を新規に用意する。
let mode2v2 = false;          // 2vs2モードか（trueの間は専用AI/所有権を使う）
const ally   = new THREE.Group();
const enemy2 = new THREE.Group();
let allyMixer   = null, allyCurrent   = null;
let enemy2Mixer = null, enemy2Current = null;
const allyChar   = { group: ally,   animState: null };
const enemy2Char = { group: enemy2, animState: null };

// ── ボール所有権 ───────────────────────────────────────────────────────────
// 2vs2では 'ally' / 'enemy2' も取りうる。ソロ/PK/MPでは 'player' | 'enemy' | 'none'。
let ballOwner = 'none';
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

// curve: 0=直線 / +1=右利き(右へ蹴り出し左へ曲がる) / -1=左利き(左右反転)
// power: チャージ量から決まる威力。大きいほど初速・飛距離・浮きが伸びる。
function kickBall(lofted = false, curve = 0, power = 1.0) {
  const toBall = new THREE.Vector3().subVectors(ballMesh.position, player.position);
  toBall.y = 0;
  if (toBall.length() > 2.0 && !isDribbling) return;

  const pwr = power;
  const isCurve = curve !== 0;
  resetBallTrail(); // 通常シュートは青い軌道に戻す

  if (isCurve) {
    // カーブキック: 蹴り出しを foot 側へ振り、空中で逆へ曲げるバナナ軌道。
    // curve=+1(右利き): 右へ蹴り出し → 左へ曲がる。-1(左利き)で左右反転。
    const kickAngle = player.rotation.y - curve * (Math.PI / 8);
    // 最高点をゴール高(2.44m)+約0.5mに抑える固定の打ち出し上方向。
    // peak ≈ vy²/(2g) = 11.1²/44 ≈ 2.8m（+接地高で約2.9m）。
    const CURVE_VY  = 11.1;
    // 滞空時間が短くなる分だけ水平速度を上げ、飛距離は従来(vy=11+4*pwr)と同等に維持。
    const prevVy    = 11 + 4 * pwr;
    const timeComp  = prevVy / CURVE_VY; // 旧/新の滞空時間比
    const hSpd      = 13 * pwr * timeComp;
    ballVel.x = -Math.sin(kickAngle) * hSpd;
    ballVel.z = -Math.cos(kickAngle) * hSpd;
    ballVel.y = CURVE_VY;
    // 曲がりは一定レート（滞空≈1秒なので総bend≈1.1rad≒63°）。
    // パワーで増幅するとブーメランになるため power 非依存にする。
    ballCurveRate = curve * 1.1;
  } else {
    const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
    ballVel.copy(facing).multiplyScalar((lofted ? 14 : 15) * pwr);
    // ストレートもゴロではなく浮かせる（チャージで浮きと飛距離アップ）。
    ballVel.y = lofted ? (13 + 4 * pwr) : (5 + 2.5 * pwr);
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
  if (playerStunTimer > 0) return; // スタン中は操作不可
  isSpinning = true;
  spinTimer  = clips['spin'].duration; // 保険のタイマー
  fadeToClip('spin', false);
}

// キックを少し速く再生してラグを減らしつつ、発射は足がボールに当たる接触フレーム
// （実測 kick.fbx で約0.5）に同期させる。これで「飛び出しが早い/遅い」のズレを解消。
const KICK_SPEED   = 1.4; // キックアニメの再生倍率（大きいほどキビキビ＝ラグ減）
const KICK_CONTACT = 0.5; // クリップ内の足接触フレーム（0..1）
function startKick(lofted, curve, power) {
  if (!gameStarted || !clips['kick'] || !mixer) return;
  if (playerStunTimer > 0) return; // スタン中は操作不可
  endSpin();              // スピン中のシュートはスピンを打ち切ってから蹴る（状態固着防止）
  isKicking = true;
  const dur = clips['kick'].duration;
  kickTimer = dur / KICK_SPEED + 0.1; // 再生が速くなる分ロックも短く（保険）
  fadeToClip('kick', false);
  const act = mixer.clipAction(clips['kick']);
  act.setEffectiveTimeScale(KICK_SPEED); // 速く再生
  // 接触フレームに同期して発射（再生倍率分だけ実時間は短くなる）。
  setTimeout(() => kickBall(lofted, curve, power), (dur * KICK_CONTACT / KICK_SPEED) * 1000);
}

// ── シュートのチャージ（ボタン押下中に威力を溜める）────────────────────────
// 利き足: +1=右利き（カーブは右へ蹴り出し左へ曲がる）。左利きキャラは -1。
let playerFootSign = 1;
let charging   = false;
let chargeKind = null;  // 'straight' | 'curve'
let chargeT    = 0;     // 0..1 チャージ量
const CHARGE_TIME      = 0.85; // 秒でフルチャージ
const CHARGE_MIN_POWER = 0.65; // 最小威力（タップ＝即離し）
const CHARGE_MAX_POWER = 1.95; // 最大威力（フルチャージ）

function startCharge(kind) {
  if (!gameStarted || isGoalScene || ballOwner !== 'player') return;
  if (isKicking || isPassing || isTackling || playerStunTimer > 0) return;
  if (charging) return;
  charging = true; chargeKind = kind; chargeT = 0;
}

function releaseCharge() {
  if (!charging) return;
  const kind = chargeKind, t = chargeT;
  charging = false; chargeKind = null; chargeT = 0;
  const power = CHARGE_MIN_POWER + (CHARGE_MAX_POWER - CHARGE_MIN_POWER) * t;
  if (kind === 'curve') startKick(false, playerFootSign, power);
  else                  startKick(false, 0, power);
}

function cancelCharge() { charging = false; chargeKind = null; chargeT = 0; }

let _chargeBarEl = null, _chargeFillEl = null;
function updateCharge(dt) {
  // ボールを失う/シーン切替で中断
  if (charging && (ballOwner !== 'player' || isGoalScene || !gameStarted)) cancelCharge();
  if (charging) chargeT = Math.min(1, chargeT + dt / CHARGE_TIME);

  if (_chargeBarEl === null) {
    _chargeBarEl  = document.getElementById('charge-bar');
    _chargeFillEl = document.getElementById('charge-fill');
  }
  if (_chargeBarEl) {
    _chargeBarEl.style.display = charging ? 'block' : 'none';
    if (charging && _chargeFillEl) {
      _chargeFillEl.style.width = `${Math.round(chargeT * 100)}%`;
      // 溜まるほど赤→黄へ。フルでほんのり光らせる
      const hue = 10 + chargeT * 45; // 10(赤)〜55(黄)
      _chargeFillEl.style.background = `hsl(${hue}, 95%, 55%)`;
    }
  }
}

function startTackle() {
  if (!gameStarted || ballOwner === 'player' || isTackling || !clips['tackle'] || !mixer) return;
  if (playerStunTimer > 0) return; // スタン中は操作不可
  isTackling  = true;
  // モーションは最後まで再生する（タイマーはclip全長＝finished取りこぼし時の保険）。
  tackleTimer = clips['tackle'].duration + 0.1;
  tackleLungeTimer = TACKLE_LOCK; // 前進ランジ（移動）だけは短く切り上げて飛びすぎを防ぐ
  fadeToClip('tackle', false);
}

// パスボタンの振り分け（2vs2）。自分が保持中＝出す / 味方が保持中＝要求する。
function pressPass() {
  if (!mode2v2) return;
  if (ballOwner === 'ally') requestPass();
  else startPass();
}

// プレイヤーのパス（2vs2専用）。パスモーション再生 → 接触フレームで味方へダイレクトパス。
// パス中は isPassing=true でドリブル保持を維持し、接触まではボールを足元に置く。
function startPass() {
  if (!mode2v2 || !gameStarted || isGoalScene) return;
  if (ballOwner !== 'player' || isPassing || isKicking || isTackling) return;
  if (playerStunTimer > 0 || !clips['pass'] || !mixer) return;
  endSpin();
  isPassing = true;
  const dur = clips['pass'].duration;
  passTimer = dur + 0.15; // 保険: finished取りこぼし時もこの時間で必ず解除
  fadeToClip('pass', false);
  const sess = skillSession;
  setTimeout(() => { if (sess === skillSession && ballOwner === 'player') doPass('player'); },
    dur * 0.35 * 1000);
}

// ── 固有スキル ────────────────────────────────────────────────────────────
// キャラID → スキル種別。未登録は 'spin'（全員デフォルトでスピン）。
const SKILL_BY_CHAR = {
  nagi:    'fake_volley',   // 凪: 2段式フェイクボレー（黒エフェクト）
  barou:   'barou_curve',   // 馬狼: ほんの少し曲がる強烈カーブ（赤黒エフェクト）
  chigiri: 'chigiri_boost', // 千切: ドリブル突破・加速（ピンクエフェクト）
  bachira: 'bachira_dash',  // 蜂楽: その場フェイント→急加速（黄エフェクト・周囲の敵をフリーズ）
  reio:    'reo_copy',      // 玲王: 近くの敵のスキルをコピーして発動（紫エフェクト）
  shidou:  'shidou_smash',  // 士道: オーバーヘッド・スマッシュシュート（黄＆ピンク残像）
};
let playerSkill  = 'spin';
let enemyCharId  = null;  // 敵CPUのキャラID（玲王のコピー用にスキルを引く）
let skillSession = 0; // スキル中の stale setTimeout を無効化するカウンタ
let chigiriBoostTimer = 0; // 千切ブースト残り時間（>0で加速・奪取不可・ピンク残像）
let bachiraSkillTimer = 0; // 蜂楽スキル残り時間（>0で操作ロック・奪取不可・黄オーラ）
let bachiraSkillTotal = 0;
let bachiraDashStart  = 0; // motion2（急加速）が始まる経過時刻

// スキルボタン/キーの共通エントリ。所持スキルに応じて分岐。
function useSkill() {
  if (!gameStarted || isGoalScene || playerStunTimer > 0) return;
  if (isKicking || isPassing || isTackling) return;
  if      (playerSkill === 'fake_volley')   nagiFakeVolley();
  else if (playerSkill === 'barou_curve')   barouCurveShot();
  else if (playerSkill === 'chigiri_boost') chigiriBoost();
  else if (playerSkill === 'bachira_dash')  bachiraDash();
  else if (playerSkill === 'reo_copy')      reoCopySkill();
  else if (playerSkill === 'shidou_smash')  shidouSmash();
  else startSpin(); // デフォルト: スピン（ドリブル中のみ・内部でガード）
}

// 玲王: 近く(REO_COPY_RAD内)にいる敵CPUの固有スキルをコピーして発動する。
const REO_COPY_RAD = 12;
function reoCopySkill() {
  if (!hasEnemy || !enemy) { startSpin(); return; }
  const d = new THREE.Vector3().subVectors(enemy.position, player.position).setY(0).length();
  if (d > REO_COPY_RAD) { startSpin(); return; } // 近くにいなければ通常スピン
  const copied = SKILL_BY_CHAR[enemyCharId] || 'spin';
  if      (copied === 'fake_volley')   nagiFakeVolley();
  else if (copied === 'barou_curve')   barouCurveShot();
  else if (copied === 'chigiri_boost') chigiriBoost();
  else if (copied === 'bachira_dash')  bachiraDash();
  else if (copied === 'shidou_smash')  shidouSmash();
  else startSpin(); // 敵が玲王/無スキルなら通常スピン
}

// 凪の2段式フェイクボレー:
//  1) fakeKick_01 の接触でボールを真上へポップ
//  2) fakeKick_02 の接触（落下してきたタイミング）で前方へ強烈に発射
const FAKE_BLEND     = 0.12; // 連結時の繋ぎ目（buildComboClipと合わせる）
// 足ボーン実測: motion1は t≈0.31s(約0.42)で足が最下点＝すくい上げ接触、
// motion2は開始直後 t≈0.1〜0.4s(約0.12)で足が前方へ鋭くスイング＝蹴り抜き。
// 接触をmotion2前半に合わせることで滞空が短くなり、蹴り上げが低く収まる。
const FAKE_POP_FRAC  = 0.42; // motion1 のどこでボールを上げるか（0..1）
const FAKE_HIT_FRAC  = 0.12; // motion2 のどこで蹴り当てるか（0..1）
const FAKE_CONTACT_H = 1.0;  // 蹴り当てる高さ(m)
const FAKE_POWER     = 44;   // 発射の水平初速（かなり強烈）
const FAKE_VYPOP_MAX = 13;   // 蹴り上げ初速の上限（高くなりすぎ防止 / ピーク約3.9m）
function nagiFakeVolley() {
  if (ballOwner !== 'player') return;
  const c1 = clips['fake01'], c2 = clips['fake02'];
  if (!c1 || !c2 || !mixer) { startKick(false, 0, 1.6); return; } // 素材が無ければ通常シュート
  if (!clips['fake_volley']) buildComboClip('fake_volley', ['fake01', 'fake02'], FAKE_BLEND);
  const combo = clips['fake_volley'];
  if (!combo) { startKick(false, 0, 1.6); return; }

  endSpin();
  isKicking = true;                         // 全モーションをロックして最後まで再生
  kickTimer = combo.duration + 0.1;
  fadeToClip('fake_volley', false);

  // タイミング（連結クリップ内の絶対時刻）
  const tPop     = c1.duration * FAKE_POP_FRAC;
  const tContact = c1.duration + FAKE_BLEND + c2.duration * FAKE_HIT_FRAC;
  const dtAir    = Math.max(0.2, tContact - tPop);
  const h0       = ballMesh.position.y;
  // 落下してちょうど接触高さに来るポップ初速: h(dt)=h0+vy*dt-0.5g dt^2 = CONTACT_H
  // 高くなりすぎないよう上限でクランプ（上限時は接触が多少早まる）。
  const vyPop    = Math.min(FAKE_VYPOP_MAX,
    (FAKE_CONTACT_H - h0 + 0.5 * BALL_GRAVITY * dtAir * dtAir) / dtAir);

  // スキル中はボールを拾い直されないようロック
  playerPickupCooldown = tContact + 0.3;
  enemyPickupCooldown  = tContact + 0.3;

  const sid = ++skillSession;
  const facing = () => new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));

  // ① ボールを真上へポップ
  setTimeout(() => {
    if (sid !== skillSession || !gameStarted || isGoalScene) return;
    const fwd = facing();
    isDribbling = false; ballOwner = 'none';
    ballCurveRate = 0; ballSpin.set(0, 0, 0);
    ballMesh.position.set(player.position.x + fwd.x * 0.5, h0, player.position.z + fwd.z * 0.5);
    ballVel.set(0, vyPop, 0); // 真上
  }, tPop * 1000);

  // ② 落ちてきたボールを前方へ強烈に蹴り出す（黒い残像）
  setTimeout(() => {
    if (sid !== skillSession || !gameStarted || isGoalScene) return;
    const fwd = facing();
    ballOwner = 'none'; ballCurveRate = 0; ballSpin.set(0, 0, 0);
    ballVel.set(fwd.x * FAKE_POWER, 7, fwd.z * FAKE_POWER);
    setBallTrail([0x080808, 0x202020], THREE.NormalBlending); // 黒の軌道
  }, tContact * 1000);
}

// 士道: オーバーヘッド・スマッシュシュート（黄＆ピンクの残像）
//  1) overhead01 でボールを真上へ約1m上げる
//  2) overhead02 でボールを前方斜め下へ強烈に叩き込む（地面との入射角≈30°）。
//     地面でバウンドしてゴールへ伸びるスマッシュ。
const SHIDOU_BLEND     = 0.1;
const SHIDOU_POP_FRAC  = 0.5;   // motion1 のどこでボールを上げるか
const SHIDOU_HIT_FRAC  = 0.2;   // motion2 のどこで叩き込むか
const SHIDOU_CONTACT_H = 1.0;   // 叩き込む高さ(m)＝約1m上げたところ
const SHIDOU_POWER     = 34;    // 水平初速（強烈）
const SHIDOU_ANGLE_DEG = 30;    // 地面との入射角（下向き）
function shidouSmash() {
  if (ballOwner !== 'player') return;
  const c1 = clips['shidou01'], c2 = clips['shidou02'];
  if (!c1 || !c2 || !mixer) { startKick(false, 0, 1.8); return; } // 素材が無ければ通常シュート
  if (!clips['shidou_smash']) buildComboClip('shidou_smash', ['shidou01', 'shidou02'], SHIDOU_BLEND);
  const combo = clips['shidou_smash'];
  if (!combo) { startKick(false, 0, 1.8); return; }

  endSpin();
  isKicking = true;                         // 全モーションをロックして最後まで再生
  kickTimer = combo.duration + 0.1;
  fadeToClip('shidou_smash', false);

  const tPop     = c1.duration * SHIDOU_POP_FRAC;
  const tContact = c1.duration + SHIDOU_BLEND + c2.duration * SHIDOU_HIT_FRAC;
  const dtAir    = Math.max(0.2, tContact - tPop);
  const h0       = ballMesh.position.y;
  // 接触時にちょうど CONTACT_H へ来るポップ初速
  const vyPop    = (SHIDOU_CONTACT_H - h0 + 0.5 * BALL_GRAVITY * dtAir * dtAir) / dtAir;

  playerPickupCooldown = tContact + 0.3;
  enemyPickupCooldown  = tContact + 0.3;

  const sid = ++skillSession;
  const facing = () => new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));

  // ① ボールを真上へ約1m上げる
  setTimeout(() => {
    if (sid !== skillSession || !gameStarted || isGoalScene) return;
    const fwd = facing();
    isDribbling = false; ballOwner = 'none';
    ballCurveRate = 0; ballSpin.set(0, 0, 0);
    ballMesh.position.set(player.position.x + fwd.x * 0.4, h0, player.position.z + fwd.z * 0.4);
    ballVel.set(0, vyPop, 0);
  }, tPop * 1000);

  // ② 前方斜め下へ叩き込む（入射角≈30°下向き）。黄＆ピンクの残像。
  setTimeout(() => {
    if (sid !== skillSession || !gameStarted || isGoalScene) return;
    const fwd = facing();
    const vh  = SHIDOU_POWER;
    const vy  = -vh * Math.tan(SHIDOU_ANGLE_DEG * Math.PI / 180); // 水平から30°下
    ballOwner = 'none'; ballCurveRate = 0; ballSpin.set(0, 0, 0);
    ballMesh.position.set(player.position.x + fwd.x * 0.5, SHIDOU_CONTACT_H, player.position.z + fwd.z * 0.5);
    ballVel.set(fwd.x * vh, vy, fwd.z * vh);
    setBallTrail([0xffd400, 0xff3399], THREE.AdditiveBlending); // 黄＆ピンクの軌道
  }, tContact * 1000);
}

// 馬狼: ほんの少し曲がる強烈カーブシュート（赤黒の残像）
const BAROU_HIT_FRAC = 0.32; // 接触タイミング（実測: 足が前方頂点 t≈0.7/2.2）
const BAROU_POWER    = 34;   // 強烈な水平初速
const BAROU_CURVE    = 0.4;  // ほんの少しだけ曲げる
const BAROU_FOLLOW   = 0.5;  // 接触後のフォロースルー時間（これ以降のジョグ部は再生しない）
function barouCurveShot() {
  if (ballOwner !== 'player') return;
  const clip = clips['barou_shot'];
  if (!clip || !mixer) { startKick(false, playerFootSign, 1.9); return; }
  endSpin();
  isKicking = true;
  const tHit = clip.duration * BAROU_HIT_FRAC;
  // 接触＋フォロースルーで打ち切る（クリップ後半のジョグ＝2回目の振りを出さない）。
  kickTimer = tHit + BAROU_FOLLOW;
  fadeToClip('barou_shot', false);
  playerPickupCooldown = tHit + BAROU_FOLLOW; enemyPickupCooldown = tHit + BAROU_FOLLOW;

  const sid = ++skillSession;
  setTimeout(() => {
    if (sid !== skillSession || !gameStarted || isGoalScene) return;
    const ry  = player.rotation.y;
    const fwd = new THREE.Vector3(-Math.sin(ry), 0, -Math.cos(ry));
    // 蹴り出しを foot 側へわずかに振り、飛行中にほんの少し逆へ曲げる
    const kickAngle = ry - playerFootSign * BAROU_CURVE * (Math.PI / 8);
    ballOwner = 'none'; isDribbling = false; ballSpin.set(0, 0, 0);
    ballMesh.position.set(player.position.x + fwd.x * 0.5, BALL_R + 0.1, player.position.z + fwd.z * 0.5);
    ballVel.set(-Math.sin(kickAngle) * BAROU_POWER, 9, -Math.cos(kickAngle) * BAROU_POWER);
    ballCurveRate = playerFootSign * BAROU_CURVE; // 控えめなカーブ
    setBallTrail([0xcc1111, 0x0a0a0a], THREE.NormalBlending); // 赤黒の軌道
  }, tHit * 1000);
}

// 千切: ドリブル突破（加速）。連結したブースト走モーション中は
// 移動速度2倍・ボール奪取不可・ピンクの残像/オーラ。
const CHIGIRI_SPEED_MULT = 2.0;
function chigiriBoost() {
  if (ballOwner !== 'player' || chigiriBoostTimer > 0) return;
  if (!clips['chigiri_run'] && clips['chigiri01'] && clips['chigiri02']) {
    buildComboClip('chigiri_run', ['chigiri01', 'chigiri02'], 0.1);
  }
  const combo = clips['chigiri_run'];
  chigiriBoostTimer = combo ? combo.duration : 1.8;
}

// 蜂楽: その場フェイント(motion1)→急加速(motion2)のドリブル突破。
// 黄オーラをまとい、発動時に周囲にいる敵を「！」でフリーズ。奪取不可。
const BACHIRA_BLEND      = 0.1;
const BACHIRA_DASH_SPEED = 18;  // motion2 の前方ダッシュ速度
const BACHIRA_FREEZE_RAD = 9;   // この範囲の敵をフリーズ
function bachiraDash() {
  if (ballOwner !== 'player' || bachiraSkillTimer > 0) return;
  if (!clips['bachira_dash'] && clips['bachira01'] && clips['bachira02']) {
    buildComboClip('bachira_dash', ['bachira01', 'bachira02'], BACHIRA_BLEND);
  }
  const combo = clips['bachira_dash'], c1 = clips['bachira01'];
  if (!combo || !c1) return;
  bachiraSkillTotal = combo.duration;
  bachiraSkillTimer = combo.duration;
  bachiraDashStart  = c1.duration + BACHIRA_BLEND; // ここから motion2＝急加速
  fadeToClip('bachira_dash', false);               // 連結モーションを1回再生

  // 発動時に周囲にいる敵をモーション中ずっとフリーズ＋「！」マーク
  if (hasEnemy && enemy) {
    const d = new THREE.Vector3().subVectors(enemy.position, player.position).setY(0).length();
    if (d < BACHIRA_FREEZE_RAD) {
      enemyStunTimer = combo.duration;
      spawnStunMark(enemy, combo.duration, _exclaimTexture);
    }
  }
}

function updateBachira(dt) {
  if (bachiraSkillTimer <= 0) return;
  const elapsed = bachiraSkillTotal - bachiraSkillTimer;
  bachiraSkillTimer -= dt;
  // motion1 はドリブル速度の半分で前進、motion2 区間で前方へ一気に加速。
  const f = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
  const speed = (elapsed >= bachiraDashStart) ? BACHIRA_DASH_SPEED : RUN_SPEED * 0.5;
  player.position.addScaledVector(f, speed * dt);
  player.position.y = groundY;
  charClampToField(playerChar);
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

  // スタン（奪われた直後の硬直）中はAIを止めてその場で待機
  if (enemyStunTimer > 0) {
    enemyStunTimer -= dt;
    charAnim(enemyChar, 'idle');
    charClampToField(enemyChar);
    return;
  }

  if (enemyTackleCooldown > 0) enemyTackleCooldown -= dt;
  // タックルモーションは最後まで再生する（finished取りこぼし時の保険タイマー）
  if (enemyTackleTimer > 0) {
    enemyTackleTimer -= dt;
    if (enemyTackleTimer <= 0) enemyTackling = false;
  }

  const distToBall = new THREE.Vector3().subVectors(ballMesh.position, enemy.position).setY(0).length();

  // タックルによる奪取（プレイヤーと同じ TACKLE_DIST を使用）
  // 千切ブースト中(chigiriBoostTimer>0)はプレイヤーからは奪えない。
  if (enemyTackling && ballOwner !== 'enemy' && distToBall < TACKLE_DIST
      && enemyPickupCooldown <= 0 && !isKicking && gkBallHolder === 'none'
      && !(ballOwner === 'player' && (chigiriBoostTimer > 0 || bachiraSkillTimer > 0))) {
    const stolen = ballOwner === 'player';
    ballOwner = 'enemy';
    playerPickupCooldown = 0.6;
    // 奪った瞬間に enemyTackling を折らず、タックルモーションは最後まで流す。
    if (stolen) applyStealStun('player'); // 奪われたプレイヤーを硬直＋‼️
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
      enemyTackleTimer = clips['tackle'] ? clips['tackle'].duration + 0.1 : 1.0;
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
  // 千切ブースト/蜂楽スキル中は奪われず保持し続ける（シュート中は除く）
  if ((chigiriBoostTimer > 0 || bachiraSkillTimer > 0) && !isKicking) {
    ballOwner = 'player'; isDribbling = true; charDribble(playerChar, dt); return;
  }

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
    // マルチでは相手の硬直はローカルで再現できないため‼️は出さず、
    // タックルモーションだけ最後まで再生する（isTackling を折らない）。
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
  // 千切ブースト/蜂楽スキル中は奪われず保持し続ける（シュート中は除く）
  if ((chigiriBoostTimer > 0 || bachiraSkillTimer > 0) && !isKicking) {
    ballOwner = 'player'; isDribbling = true; charDribble(playerChar, dt); return;
  }

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
      const stolen = ballOwner === 'enemy';
      ballOwner = 'player';
      enemyPickupCooldown = 0.5;
      // isTackling は折らない＝タックルモーションを最後まで再生する。
      if (stolen) applyStealStun('enemy'); // 奪われた敵を硬直＋‼️
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

  ballLoosePhysics(dt);
}

// ── ルーズボール（誰も保持していない）の物理＋ゴール/壁判定（所有権非依存）──
// updateBall（ソロ/MP）と update2v2（2vs2）で共有する。
function ballLoosePhysics(dt) {
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
    // シュート: 押し続けてチャージ、離して発射（F=ストレート / H=カーブ）
    if (e.code === 'KeyF') startCharge('straight');
    if (e.code === 'KeyH') startCharge('curve');
    if (e.code === 'KeyT') {
      startTackle(); // タックル（ボール非所持時のみ・内部でガード）
    }
    if (e.code === 'KeyZ') {
      useSkill(); // 固有スキル（デフォルト=スピン、凪=フェイクボレー）
    }
    if (e.code === 'KeyG') {
      pressPass(); // パス / パス要求（2vs2モードのみ・内部でガード）
    }
  }
}, { capture: true }); // captureでブラウザより先にキーを受け取る

window.addEventListener('keyup', e => {
  if (e.isComposing) return;
  keys.delete(e.code);
  // チャージ中のシュートキーを離したら発射
  if (e.code === 'KeyF' && chargeKind === 'straight') releaseCharge();
  if (e.code === 'KeyH' && chargeKind === 'curve')    releaseCharge();
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
let tackleTimer = 0; // タックルモーション残り時間（clip全長。最後まで再生するための保険）
let kickTimer   = 0; // キック残り時間（同上の保険）
let passTimer   = 0; // パスモーション残り時間（finished取りこぼしで固着＝永久フリーズ防止の保険）
let tackleLungeTimer = 0; // タックルの前進ランジ時間（モーション全長より短い。移動だけ早く止める）
// 奪われた側の硬直（スタン）残り時間。>0 の間は操作/AIを止め、頭上に‼️を出す。
let playerStunTimer  = 0;
let enemyStunTimer   = 0;
let enemyTackleTimer = 0; // 敵タックルモーション残り時間（finished取りこぼし時の保険）
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

// ── モーション連結 ────────────────────────────────────────────────────────
// 複数の AnimationClip を時間軸に並べて1本のクリップにする。全クリップが
// 同じスケルトン（同じトラック名）であることが前提（Mixamo共通なのでOK）。
// blendTime>0 で繋ぎ目に補間用の隙間を挟み、ポーズの飛び（パッと切替）を緩和する。
function concatClips(clipList, name = 'combo', blendTime = 0.12) {
  const clips = clipList.filter(Boolean);
  if (clips.length === 0) return null;
  if (clips.length === 1) { const c = clips[0].clone(); c.name = name; return c; }

  // 全クリップに登場するトラックの型と要素数(stride)を収集
  const info = new Map(); // trackName -> { ctor, stride }
  for (const clip of clips) for (const tr of clip.tracks) {
    if (!info.has(tr.name)) {
      info.set(tr.name, { ctor: tr.constructor, stride: tr.values.length / tr.times.length });
    }
  }

  const acc = new Map(); // trackName -> { times:[], values:[] }
  for (const nm of info.keys()) acc.set(nm, { times: [], values: [] });

  // クリップに無いトラックを保持するための初期値（直前値が無い場合の単位値）
  const identityFor = (nm, stride) => {
    if (nm.endsWith('.quaternion')) return [0, 0, 0, 1];
    if (nm.endsWith('.scale'))      return new Array(stride).fill(1);
    return new Array(stride).fill(0); // position 等
  };

  let cursor = 0;
  clips.forEach((clip, ci) => {
    const startAt = ci === 0 ? 0 : cursor + blendTime; // 2本目以降は隙間を空けて補間させる
    const byName = new Map(clip.tracks.map(t => [t.name, t]));
    for (const [nm, meta] of info) {
      const a  = acc.get(nm);
      const tr = byName.get(nm);
      if (tr) {
        const n = tr.times.length;
        for (let i = 0; i < n; i++) {
          a.times.push(startAt + tr.times[i]);
          for (let s = 0; s < meta.stride; s++) a.values.push(tr.values[i * meta.stride + s]);
        }
      } else {
        // このクリップに該当トラックが無い → 直前の値（無ければ単位値）を1点だけ保持
        const last = a.values.length >= meta.stride
          ? a.values.slice(a.values.length - meta.stride)
          : identityFor(nm, meta.stride);
        a.times.push(startAt);
        for (let s = 0; s < meta.stride; s++) a.values.push(last[s]);
      }
    }
    cursor = startAt + clip.duration;
  });

  const tracks = [];
  for (const [nm, meta] of info) {
    const a = acc.get(nm);
    tracks.push(new meta.ctor(nm, new Float32Array(a.times), new Float32Array(a.values)));
  }
  return new THREE.AnimationClip(name, cursor, tracks);
}

// clips から名前で複数クリップを連結し clips[outName] に登録する。
// 例: buildComboClip('heel_shot', ['ヒールリフト', 'kick'], 0.15)
function buildComboClip(outName, sourceNames, blendTime = 0.12) {
  const src = sourceNames.map(n => clips[n]);
  const missing = sourceNames.filter((n, i) => !src[i]);
  if (missing.length) { console.warn(`combo "${outName}": 未ロードのクリップ`, missing); return null; }
  const combo = concatClips(src, outName, blendTime);
  if (combo) clips[outName] = combo;
  return combo;
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
const allyAnim = {
  get mixer()   { return allyMixer; },    set mixer(v)   { allyMixer = v; },
  get current() { return allyCurrent; },  set current(v) { allyCurrent = v; },
};
const enemy2Anim = {
  get mixer()   { return enemy2Mixer; },   set mixer(v)   { enemy2Mixer = v; },
  get current() { return enemy2Current; }, set current(v) { enemy2Current = v; },
};
allyChar.animState   = allyAnim;
enemy2Char.animState = enemy2Anim;
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
    // 手のボーンの位置にボールを追従させ、キャッチ/ダイブのポーズに合わせて
    // 「手で抱えている」見た目にする。ボーンが取れない場合は足元基準の
    // 固定高さ（腕の高さ）にフォールバックする。
    const hands = gkChar.handBones;
    if (hands && hands.length > 0) {
      const handPos = new THREE.Vector3();
      const tmp     = new THREE.Vector3();
      hands.forEach(b => { b.getWorldPosition(tmp); handPos.add(tmp); });
      handPos.divideScalar(hands.length); // 両手の中点
      handPos.y += 0.15;                  // 手のひらに乗せるよう少し上へ
      ballMesh.position.copy(handPos);
    } else {
      const gkOffset = gkChar.group.userData.gkGroundOffset ?? 0;
      const feetY    = gkPos.y - gkOffset;        // 足元の世界Y（≒0）
      const ry       = gkChar.group.rotation.y;
      const fwd      = new THREE.Vector3(-Math.sin(ry), 0, -Math.cos(ry));
      ballMesh.position.set(gkPos.x + fwd.x * 0.30, feetY + 1.05, gkPos.z + fwd.z * 0.30);
    }
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
  tackleLungeTimer = playerStunTimer = enemyStunTimer = enemyTackleTimer = 0;
  skillSession++; // 保留中スキルtimeoutを無効化
  chigiriBoostTimer = 0;
  bachiraSkillTimer = 0;
  resetBallTrail();
  clearStunMarks();
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
  spinTimer = tackleTimer = kickTimer = passTimer = 0;
  tackleLungeTimer = playerStunTimer = enemyStunTimer = enemyTackleTimer = 0;
  skillSession++; // 保留中スキルtimeoutを無効化
  chigiriBoostTimer = 0;
  bachiraSkillTimer = 0;
  resetBallTrail();
  clearStunMarks();
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

  // ── 2vs2 のキックオフリセット ──────────────────────────────────────────
  if (mode2v2) {
    passState = null;
    for (const c of cpu2List) {
      c.stun = 0; c.tackling = false; c.kicking = false; c.passing = false;
      c.tackleCd = 0; c.pickupCd = 0; c.passCd = 0; c.oneShotTimer = 0;
    }
    if (allyMixer)   { allyMixer.stopAllAction();   allyCurrent   = null; }
    if (enemyMixer)  { enemyMixer.stopAllAction();  enemyCurrent  = null; }
    if (enemy2Mixer) { enemy2Mixer.stopAllAction(); enemy2Current = null; }
    ally.position.set(-8, groundY, -7);  ally.rotation.y   = -Math.PI / 2;
    enemy.position.set(8, groundY, 7);   enemy.rotation.y  =  Math.PI / 2;
    enemy2.position.set(8, groundY, -7); enemy2.rotation.y =  Math.PI / 2;
    if (scorer === 'cpu') {
      // プレイヤー失点 → プレイヤーチームがキックオフ（プレイヤー保持）
      player.position.set(0, groundY, 0); player.rotation.y = -Math.PI / 2;
      ballOwner = 'player'; isDribbling = true;
    } else {
      // CPU失点 → 敵チームがキックオフ（敵#1保持）
      player.position.set(-8, groundY, 5); player.rotation.y = -Math.PI / 2;
      enemy.position.set(0, groundY, 0);   enemy.rotation.y  =  Math.PI / 2;
      ballOwner = 'enemy'; isDribbling = false;
    }
    ballMesh.position.set(0, BALL_R, 0);
    charAnim(allyChar, 'idle'); charAnim(enemyChar, 'idle'); charAnim(enemy2Char, 'idle');
    fadeToClip('idle');
    if (goalFlashEl) { goalFlashEl.style.display = 'none'; goalFlashEl.classList.remove('conceded'); }
    return;
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
  spinTimer = tackleTimer = kickTimer = passTimer = 0;
  tackleLungeTimer = playerStunTimer = enemyStunTimer = enemyTackleTimer = 0;
  skillSession++; // 保留中スキルtimeoutを無効化
  chigiriBoostTimer = 0;
  bachiraSkillTimer = 0;
  resetBallTrail();
  clearStunMarks();
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
  // 凪の固有スキル「2段式フェイクボレー」用（連結して使う）
  ['fake01', './animations/2段式フェイクボレー/fakeKick_01.fbx'],
  ['fake02', './animations/2段式フェイクボレー/fakeKick_02.fbx'],
  // 馬狼の固有スキル「カーブシュート」用
  ['barou_shot', './animations/馬狼シュート/Strike Foward Jog.fbx'],
  // 千切の固有スキル「ドリブル突破（加速）」用（連結して使う）
  ['chigiri01', './animations/千切スキル加速/BoostRun01.fbx'],
  ['chigiri02', './animations/千切スキル加速/BoostRun02.fbx'],
  // 蜂楽の固有スキル「ドリブル突破（その場フェイント→急加速）」用（連結して使う）
  ['bachira01', './animations/蜂楽ドリブル突破/bachiraドリブル01.fbx'],
  ['bachira02', './animations/蜂楽ドリブル突破/bachiraドリブル02.fbx'],
  // 士道の固有スキル「オーバーヘッド・スマッシュシュート」用（連結して使う）
  ['shidou01', './animations/士道シュート/overhead01.fbx'],
  ['shidou02', './animations/士道シュート/overhead02.fbx'],
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
    if (mode2v2) {
      for (const g of [ally, enemy, enemy2]) { g.position.y = groundY; g.visible = true; }
    }
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
    if (mode2v2) { charAnim(allyChar, 'idle'); charAnim(enemyChar, 'idle'); charAnim(enemy2Char, 'idle'); }
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
  // 利き足: 左利きキャラ作成時は config.leftFooted=true でカーブの左右を反転
  playerFootSign = config.leftFooted ? -1 : 1;
  // 固有スキル: キャラIDから決定（未登録は spin）
  playerSkill = SKILL_BY_CHAR[config.charId] || 'spin';
  enemyCharId = config.enemyId || null; // 玲王のコピー用

  skillSession++; // 前ゲームの保留中スキルtimeoutを無効化
  chigiriBoostTimer = 0;
  bachiraSkillTimer = 0;
  resetBallTrail();
  clearCharFx();
  cancelCharge();
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
  // 2vs2 の味方・敵#2 を除去＋状態リセット
  scene.remove(ally);   while (ally.children.length   > 0) ally.remove(ally.children[0]);
  scene.remove(enemy2); while (enemy2.children.length > 0) enemy2.remove(enemy2.children[0]);
  allyMixer = null; allyCurrent = null;
  enemy2Mixer = null; enemy2Current = null;
  // 共通関数が参照する group / animState を結線（2vs2では enemy も流用する）
  allyChar.group = ally;     allyChar.animState   = allyAnim;
  enemy2Char.group = enemy2; enemy2Char.animState = enemy2Anim;
  enemyChar.group = enemy;   enemyChar.animState  = enemyAnim;
  passState = null;
  mode2v2 = !isPK && !config.mp && !!config.mode2v2;
  for (const c of cpu2List) {
    c.stun = 0; c.tackling = false; c.kicking = false; c.passing = false;
    c.tackleCd = 0; c.pickupCd = 0; c.passCd = 0; c.oneShotTimer = 0;
  }
  playerStunTimer = 0; isPassing = false; passTimer = 0;
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

  // 2vs2: キックオフ配置（プレイヤーは自陣左、攻撃ゴール=+X を向く）＋ボール中央
  if (mode2v2) {
    player.position.set(-8, 0, 5); // yはキャラ読み込み時に接地補正される
    player.rotation.y = -Math.PI / 2;
    ballMesh.position.set(0, BALL_R, 0);
    ballVel.set(0, 0, 0);
    ballCurveRate = 0;
  }

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

  // ── 2vs2: 味方CPU＋敵CPU2人をロード ──────────────────────────────────
  if (mode2v2) {
    CORE_TOTAL += 3;
    c2Ally.zoneZ   = 0;                      // 味方は中央ゾーン（広めにカバー）
    c2Enemy.zoneZ  =  FIELD_HALF_D * 0.35;   // 敵#1は上半分ゾーン
    c2Enemy2.zoneZ = -FIELD_HALF_D * 0.35;   // 敵#2は下半分ゾーン
    const loadCpu2 = (group, animProxy, path, tint, sx, sz, markerColor) => {
      loader.load(path, fbx => {
        fbx.scale.setScalar(0.01);
        fbx.rotation.y = Math.PI;
        fbx.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true; c.receiveShadow = true;
            c.material = Array.isArray(c.material)
              ? c.material.map(m => { const mc = m.clone(); mc.color.set(tint); return mc; })
              : (() => { const mc = c.material.clone(); mc.color.set(tint); return mc; })();
          }
        });
        group.add(fbx);
        group.position.set(sx, 0, sz);
        group.visible = false; // ゲーム開始まで非表示（Tポーズ防止）
        animProxy.mixer = new THREE.AnimationMixer(fbx);
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: markerColor })
        );
        marker.position.set(0, 2.05, 0);
        group.add(marker);
        scene.add(group);
        onCoreLoaded();
      }, undefined, err => { console.error('2vs2 load failed:', path, err); onCoreLoaded(); });
    };
    // 味方=青く着色＋水色マーカー / 敵=赤く着色＋赤マーカー（味方・敵を見分けやすく）
    loadCpu2(ally,   allyAnim,   config.allyFbx   || config.charFbx, 0x4488ff, -8, -7, 0x44aaff);
    loadCpu2(enemy,  enemyAnim,  config.enemy1Fbx || config.charFbx, 0xff4444,  8,  7, 0xff2222);
    loadCpu2(enemy2, enemy2Anim, config.enemy2Fbx || config.charFbx, 0xff4444,  8, -7, 0xff2222);
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
              // 味方GK: モデル本来のデフォルト色で表示する。テクスチャがある場合は
              // 埋め込みの色味（赤などの着色）でテクスチャが乗算されて濁らないよう
              // ベースカラーを白に正規化し、sRGBで素のテクスチャを出す。
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach(m => {
                if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.color?.set(0xffffff); }
                if (m.emissive) m.emissive.set(0x000000);
              });
            }
          }
        });
        // スケール変更後に再計算してY接地オフセットを保存（足が y=0 に来るよう補正）
        gkGroup.updateMatrixWorld(true);
        const gkBox = new THREE.Box3().setFromObject(fbx);
        gkGroup.userData.gkGroundOffset =
          (isFinite(gkBox.min.y) && gkBox.min.y < -0.01) ? -gkBox.min.y : 0;
        // 捕球保持中にボールを手の位置へ追従させるため、手のボーンを拾っておく
        // （Mixamoスケルトン: mixamorigLeftHand / mixamorigRightHand）。指ボーンは除外。
        const handBones = [];
        fbx.traverse(o => {
          if (o.isBone && /hand/i.test(o.name)
              && !/(thumb|index|middle|ring|pinky|pink|end)/i.test(o.name)) {
            handBones.push(o);
          }
        });
        gkChar.handBones = handBones;
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
// リードアヘッド: 移動中は進行方向の前方を画面中心に寄せる
const camLead       = new THREE.Vector3();   // 現在のリードオフセット（ワールド・スムーズ済み）
const _prevPlayerPos = new THREE.Vector3();  // 前フレームのプレイヤー位置（移動方向の算出用）
let _prevPlayerPosInit = false;
const LEAD_DIST     = 3;    // 前方何メートルを中心にするか
const LEAD_MIN_MOVE = 0.01; // この移動量(/frame)未満は停止扱い→中心をプレイヤーへ戻す

function getDesiredAnim() {
  if (isKicking || isPassing || isTackling) return null;
  if (bachiraSkillTimer > 0) return null; // 蜂楽スキルは専用クリップを再生中（上書きしない）
  if (chigiriBoostTimer > 0 && clips['chigiri_run']) return 'chigiri_run'; // 千切ブースト走（ループ）
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


// ── ‼️ スタンマーク（ボールを奪われた側の頭上に出す）────────────────────────
const stunMarks = [];
function makeStunTexture(symbol) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 104px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 64, 74);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const _stunTexture    = makeStunTexture('‼️'); // タックル奪取で奪われた側
const _exclaimTexture = makeStunTexture('❗'); // 蜂楽スキルで固まった敵

function spawnStunMark(targetGroup, duration, texture = _stunTexture) {
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sp  = new THREE.Sprite(mat);
  sp.scale.set(1.1, 1.1, 1.1);
  sp.renderOrder = 999;
  scene.add(sp);
  stunMarks.push({ sprite: sp, target: targetGroup, life: 0, maxLife: duration });
}

function updateStunMarks(dt) {
  for (let i = stunMarks.length - 1; i >= 0; i--) {
    const m = stunMarks[i];
    m.life += dt;
    const t = m.life / m.maxLife;
    // 頭上に追従＋少し弾むように上下
    m.sprite.position.set(
      m.target.position.x,
      m.target.position.y + 2.4 + Math.sin(t * Math.PI * 3) * 0.08,
      m.target.position.z
    );
    m.sprite.material.opacity = t > 0.75 ? (1 - (t - 0.75) / 0.25) : 1; // 終盤フェードアウト
    if (m.life >= m.maxLife) {
      scene.remove(m.sprite); m.sprite.material.dispose();
      stunMarks.splice(i, 1);
    }
  }
}

function clearStunMarks() {
  for (const m of stunMarks) { scene.remove(m.sprite); m.sprite.material.dispose(); }
  stunMarks.length = 0;
}

// 奪われた側にスタン＋‼️を付与。who: 'player' | 'enemy'
const STUN_TIME = 2.0; // 奪われた側のフリーズ時間
function applyStealStun(who) {
  if (who === 'enemy' && hasEnemy) {
    enemyStunTimer = STUN_TIME;
    spawnStunMark(enemy, STUN_TIME);
  } else if (who === 'player') {
    playerStunTimer = STUN_TIME;
    spawnStunMark(player, STUN_TIME);
  }
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

// ── シュート時の青い軌道トレイル（残像）──────────────────────────────────
// 強く蹴られて誰も保持していないボールが速く飛ぶ間だけ、青く光る残像を
// 連続生成してフェードアウトさせる。間隔を詰めて球を重ね、ひと筋の軌跡に見せる。
const ballTrail = [];
let _ballTrailTimer = 0;
const TRAIL_SPEED_THR = 9;     // この水平＋垂直合成速度以上で軌道を引く（シュート/ロングパス）
const TRAIL_INTERVAL  = 0.014; // 残像の生成間隔（秒）。短いほど密で連続的な筋になる
const TRAIL_MAX_LIFE  = 0.32;  // 残像1個の寿命（秒）
const TRAIL_OPACITY   = 0.55;

// 軌道の色はシュート種別ごとに切り替える。デフォルトは青(加算で光る)。
// 暗い色(黒/赤黒)は加算だと見えないので NormalBlending を指定する。
const TRAIL_DEFAULT_COLORS = [0x3da5ff];
let ballTrailColors = TRAIL_DEFAULT_COLORS;
let ballTrailBlend  = THREE.AdditiveBlending;
let _trailColorIdx  = 0;
function setBallTrail(colors, blend) { ballTrailColors = colors; ballTrailBlend = blend; }
function resetBallTrail() { ballTrailColors = TRAIL_DEFAULT_COLORS; ballTrailBlend = THREE.AdditiveBlending; }

function spawnBallTrail() {
  const color = ballTrailColors[_trailColorIdx++ % ballTrailColors.length];
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R * 1.15, 10, 10),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: TRAIL_OPACITY,
      blending: ballTrailBlend, depthWrite: false
    })
  );
  mesh.position.copy(ballMesh.position);
  scene.add(mesh);
  ballTrail.push({ mesh, life: 0, maxLife: TRAIL_MAX_LIFE });
}

function updateBallTrail(dt) {
  const speed = ballVel.length();
  if (ballOwner === 'none' && speed > TRAIL_SPEED_THR && !isGoalScene) {
    _ballTrailTimer += dt;
    if (_ballTrailTimer >= TRAIL_INTERVAL) { _ballTrailTimer = 0; spawnBallTrail(); }
  } else {
    _ballTrailTimer = TRAIL_INTERVAL; // 次に速くなった瞬間から残像を出せるようにしておく
  }
  for (let i = ballTrail.length - 1; i >= 0; i--) {
    const g = ballTrail[i];
    g.life += dt;
    const t = g.life / g.maxLife;
    g.mesh.material.opacity = TRAIL_OPACITY * (1 - t);
    g.mesh.scale.setScalar(1 - t * 0.55);
    if (g.life >= g.maxLife) {
      scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose();
      ballTrail.splice(i, 1);
    }
  }
}

// ── キャラのオーラ＆残像（スキルエフェクト）─────────────────────────────
// 凪: 常に黒いオーラが漂う。千切: ブースト中はピンクのオーラ＋残像（シルエット）。
const auraParticles = [];
const charGhosts    = [];
let _auraTimer  = 0;
let _ghostTimer = 0;

function spawnAuraParticle(target, color, blend) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 6, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: blend, depthWrite: false })
  );
  const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.4;
  mesh.position.set(target.position.x + Math.cos(a) * r, 0.2 + Math.random() * 1.5, target.position.z + Math.sin(a) * r);
  scene.add(mesh);
  auraParticles.push({ mesh, vy: 0.4 + Math.random() * 0.7, life: 0, maxLife: 0.5 + Math.random() * 0.5, baseOp: 0.6 });
}

function spawnCharGhost(color) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.1, 4, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false })
  );
  mesh.position.copy(player.position); mesh.position.y += 0.7;
  mesh.rotation.y = player.rotation.y;
  scene.add(mesh);
  charGhosts.push({ mesh, life: 0, maxLife: 0.35, baseOp: 0.45 });
}

function updateCharFx(dt) {
  if (chigiriBoostTimer > 0) chigiriBoostTimer -= dt;

  // 発生: 凪=常時黒オーラ / 千切=ブースト中ピンクのオーラ＋残像
  if (gameStarted && !isGoalScene) {
    _auraTimer += dt;
    if (_auraTimer >= 0.045) {
      _auraTimer = 0;
      if (playerSkill === 'fake_volley') spawnAuraParticle(player, 0x0a0a0a, THREE.NormalBlending);
      if (playerSkill === 'reo_copy')    spawnAuraParticle(player, 0x9b30ff, THREE.NormalBlending); // 玲王: 常時紫
      if (chigiriBoostTimer > 0)          spawnAuraParticle(player, 0xff3399, THREE.NormalBlending);
      if (bachiraSkillTimer > 0)          spawnAuraParticle(player, 0xffd400, THREE.NormalBlending);
    }
    if (chigiriBoostTimer > 0) {
      _ghostTimer += dt;
      if (_ghostTimer >= 0.05) { _ghostTimer = 0; spawnCharGhost(0xff3399); }
    } else if (bachiraSkillTimer > 0 && (bachiraSkillTotal - bachiraSkillTimer) >= bachiraDashStart) {
      // 残像は motion2（急加速）からのみ。motion1（その場フェイント）では出さない。
      _ghostTimer += dt;
      if (_ghostTimer >= 0.05) { _ghostTimer = 0; spawnCharGhost(0xffd400); }
    }
  }

  for (let i = auraParticles.length - 1; i >= 0; i--) {
    const p = auraParticles[i];
    p.life += dt;
    const t = p.life / p.maxLife;
    p.mesh.position.y += p.vy * dt;
    p.mesh.material.opacity = p.baseOp * (1 - t);
    p.mesh.scale.setScalar(1 - t * 0.4);
    if (p.life >= p.maxLife) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); auraParticles.splice(i, 1); }
  }
  for (let i = charGhosts.length - 1; i >= 0; i--) {
    const g = charGhosts[i];
    g.life += dt;
    const t = g.life / g.maxLife;
    g.mesh.material.opacity = g.baseOp * (1 - t);
    if (g.life >= g.maxLife) { scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); charGhosts.splice(i, 1); }
  }
}

function clearCharFx() {
  for (const p of auraParticles) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
  for (const g of charGhosts)    { scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); }
  auraParticles.length = 0; charGhosts.length = 0;
}

// ════════════════════════════════════════════════════════════════════════════
// ── 2vs2 モード（味方CPU1人＋敵CPU2人）──────────────────────────────────────
// チームA = プレイヤー＋味方(ally) / チームB = 敵2人(enemy, enemy2)。
// 守備はゾーンディフェンス、攻撃はオフザボールでスペースへ動いてパスを受ける。
// パスボタンでダイレクトパス、軌道上に敵がいればパスカット（出し手＋受け手フリーズ）。
// ════════════════════════════════════════════════════════════════════════════
function makeCpu2(group, char, key, team) {
  return {
    group, char, key, team,
    stun: 0, tackling: false, kicking: false, passing: false,
    tackleCd: 0, pickupCd: 0, passCd: 0, oneShotTimer: 0, zoneZ: 0,
  };
}
const c2Ally   = makeCpu2(ally,   allyChar,   'ally',   'A');
const c2Enemy  = makeCpu2(enemy,  enemyChar,  'enemy',  'B');
const c2Enemy2 = makeCpu2(enemy2, enemy2Char, 'enemy2', 'B');
const cpu2List = [c2Ally, c2Enemy, c2Enemy2];
// プレイヤーを共通エンティティ形式で参照（stun はゲッターで playerStunTimer を共有）
const playerEntity2 = { key: 'player', group: player, char: playerChar, get stun() { return playerStunTimer; } };

const PASS_INTERCEPT_R = 1.8;  // パス軌道のカット判定半径(m)
const SUPPORT_MIN_SEP  = 7.0;  // サポート時にボール保持者へ密着しない最小距離
const CPU_TACKLE_RANGE = 3.0;  // CPUがタックルを試みる距離
const ZONE_BAND        = 0.55; // ゾーン幅係数（×FIELD_HALF_D）

let passState = null; // パス飛行中の状態 { passerKey, receiverKey, cutterKey, timer }

const team2     = k => (k === 'player' || k === 'ally') ? 'A' : (k === 'enemy' || k === 'enemy2') ? 'B' : null;
const sameTeam2 = (a, b) => team2(a) !== null && team2(a) === team2(b);
function entity2(key) { return key === 'player' ? playerEntity2 : (cpu2List.find(c => c.key === key) || null); }
function teammate2(key) {
  if (key === 'player') return c2Ally;
  if (key === 'ally')   return playerEntity2;
  if (key === 'enemy')  return c2Enemy2;
  if (key === 'enemy2') return c2Enemy;
  return null;
}
function opponents2(key) {
  const t = team2(key);
  return [playerEntity2, c2Ally, c2Enemy, c2Enemy2].filter(e => team2(e.key) !== t);
}
function distXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function nearestOpp2(c) {
  let best = null, bd = Infinity;
  for (const o of opponents2(c.key)) {
    const d = distXZ(o.group.position, c.group.position);
    if (d < bd) { bd = d; best = o; }
  }
  return { opp: best, dist: bd };
}
// 始点→終点の線分上に敵がいなければ true（対角パスのレーン判定）
function laneClear2(from, to, opps) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return false;
  const ux = dx / len, uz = dz / len;
  for (const o of opps) {
    if (o.stun > 0) continue;
    const rx = o.group.position.x - from.x, rz = o.group.position.z - from.z;
    const t = rx * ux + rz * uz;
    if (t < 1.0 || t > len - 0.6) continue;
    const perp = Math.abs(rx * uz - rz * ux);
    if (perp < PASS_INTERCEPT_R) return false;
  }
  return true;
}
// 任意エンティティをフリーズ＋‼️
function freezeEntity2(key, dur) {
  if (key === 'player') { playerStunTimer = Math.max(playerStunTimer, dur); spawnStunMark(player, dur); }
  else { const c = entity2(key); if (c) { c.stun = Math.max(c.stun, dur); spawnStunMark(c.group, dur); } }
}
function isClosestDefender2(c) {
  let best = c, bd = distXZ(ballMesh.position, c.group.position);
  for (const o of cpu2List) {
    if (o === c || o.team !== c.team) continue;
    const d = distXZ(ballMesh.position, o.group.position);
    if (d < bd) { bd = d; best = o; }
  }
  return best === c;
}

// ── パス実行（出し手→味方へのダイレクトパス。軌道上に敵がいればカット）──────
const PASS_DIRECT_SPEED = 30; // 物理無視で対象へ直進する速度(m/s)
function doPass(passerKey) {
  const passer = entity2(passerKey), recv = teammate2(passerKey);
  if (!passer || !recv) return;
  const from = passer.group.position, to = recv.group.position;
  const dx = to.x - from.x, dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.6) return;
  const ux = dx / dist, uz = dz / dist;
  // カット判定: パス軌道（始点〜終点）の近くにいる敵を拾う（最も出し手寄りを優先）
  let cutter = null, bestT = Infinity;
  for (const o of opponents2(passerKey)) {
    if (o.stun > 0) continue;
    const rx = o.group.position.x - from.x, rz = o.group.position.z - from.z;
    const t = rx * ux + rz * uz;
    if (t < 1.0 || t > dist - 0.4) continue;
    const perp = Math.abs(rx * uz - rz * ux);
    if (perp < PASS_INTERCEPT_R && t < bestT) { bestT = t; cutter = o; }
  }
  ballOwner = 'none'; isDribbling = false; ballCurveRate = 0;
  ballMesh.position.y = BALL_R + 0.25;
  // 物理無視で直進。ballVel は軌道トレイル表示用に向き×速度を入れておく。
  ballVel.set(ux * PASS_DIRECT_SPEED, 0, uz * PASS_DIRECT_SPEED);
  passState = { passerKey, receiverKey: recv.key, cutterKey: cutter ? cutter.key : null, timer: 0 };
}
function cpu2Pass(c) {
  c.passing = true; c.passCd = 2.5;
  const dur = clips['pass'] ? clips['pass'].duration : 0.6;
  c.oneShotTimer = dur;
  charAnim(c.char, 'pass', false);
  const sess = skillSession;
  setTimeout(() => { if (sess === skillSession && ballOwner === c.key) doPass(c.key); }, dur * 0.35 * 1000);
}

// プレイヤーが味方CPUにパスを要求する（味方が保持中のみ）。即座に味方→プレイヤーへ
// ダイレクトパス。軌道上に敵がいれば通常どおりパスカットされる。
function requestPass() {
  if (!mode2v2 || !gameStarted || isGoalScene) return;
  if (ballOwner !== 'ally') return; // 味方が持っている時だけ要求可能
  if (c2Ally.passing || c2Ally.kicking || c2Ally.stun > 0) return;
  cpu2Pass(c2Ally); // teammate2('ally') = プレイヤー宛に飛ぶ
}
function cpu2Shoot(c) {
  if (c.kicking) return;
  const goalX = c.team === 'A' ? GOAL_X : -GOAL_X;
  cpuShoot({
    ownerKey: c.key, goalX, anim: c.char.animState,
    getKicking: () => c.kicking, setKicking: v => { c.kicking = v; },
    onDone: () => { c.kicking = false; c.pickupCd = 1.5; },
  });
  c.oneShotTimer = clips['kick'] ? clips['kick'].duration : 0.6;
}
function shouldCpu2Pass(c, mate) {
  if (!mate || mate.stun > 0) return false;
  const from = c.group.position, to = mate.group.position;
  const dist = distXZ(from, to);
  if (dist < 5 || dist > 42) return false;
  if (!laneClear2(from, to, opponents2(c.key))) return false; // 対角線上に敵がいない
  const gx = c.team === 'A' ? GOAL_X : -GOAL_X;
  const mateAhead = gx > 0 ? (to.x > from.x - 3) : (to.x < from.x + 3);
  if (!mateAhead) return false;
  const mateAdv  = gx > 0 ? (to.x - from.x) : (from.x - to.x); // 味方がどれだけ前進しているか
  const pressured = nearestOpp2(c).dist < 6.0;
  return pressured || mateAdv > 6;
}

// ── パス飛行中の処理（物理無視で対象へ直進。受け手 or カッター到達で所有権確定）──
function update2v2PassFlight(dt) {
  passState.timer += dt;
  const targetKey = passState.cutterKey || passState.receiverKey;
  const tgt = entity2(targetKey);
  if (!tgt) { passState = null; return; }
  const tp = tgt.group.position;
  const dx = tp.x - ballMesh.position.x, dz = tp.z - ballMesh.position.z;
  const dist = Math.hypot(dx, dz);
  const step = PASS_DIRECT_SPEED * dt;

  // 到達: 所有権確定（カットなら出し手＋受け手をフリーズ）
  if (dist <= Math.max(step, DRIBBLE_DIST * 0.8) || passState.timer > 3.0) {
    ballMesh.position.set(tp.x, BALL_R, tp.z);
    ballVel.set(0, 0, 0); ballCurveRate = 0;
    if (passState.cutterKey) {
      ballOwner = passState.cutterKey;
      const cut = entity2(passState.cutterKey);
      if (cut && cut.pickupCd !== undefined) cut.pickupCd = 0.25;
      freezeEntity2(passState.passerKey,   STUN_TIME); // パスカット成立 → ‼️フリーズ
      freezeEntity2(passState.receiverKey, STUN_TIME);
    } else {
      ballOwner = passState.receiverKey;
    }
    passState = null;
    return;
  }

  // 物理無視で対象へ直進（重力・バウンドなし、低い一定高さ）
  const ux = dx / dist, uz = dz / dist;
  ballMesh.position.x += ux * step;
  ballMesh.position.z += uz * step;
  ballMesh.position.y = BALL_R + 0.25;
  ballMesh.rotateOnWorldAxis(new THREE.Vector3(uz, 0, -ux), step / BALL_R); // 転がり演出
  ballVel.set(ux * PASS_DIRECT_SPEED, 0, uz * PASS_DIRECT_SPEED);            // トレイル速度用
}

// ── 2vs2 メイン更新（所有権・CPU AI・ドリブル配置・ルーズ物理を一括処理）─────
function update2v2(dt) {
  if (allyMixer)   allyMixer.update(dt);
  if (enemyMixer)  enemyMixer.update(dt);
  if (enemy2Mixer) enemy2Mixer.update(dt);
  if (!gameStarted || isGoalScene) return;

  for (const c of cpu2List) {
    if (c.stun > 0)     c.stun     -= dt;
    if (c.tackleCd > 0) c.tackleCd -= dt;
    if (c.pickupCd > 0) c.pickupCd -= dt;
    if (c.passCd > 0)   c.passCd   -= dt;
    if (c.oneShotTimer > 0) {
      c.oneShotTimer -= dt;
      if (c.oneShotTimer <= 0) { c.tackling = false; c.kicking = false; c.passing = false; }
    }
  }
  if (playerPickupCooldown > 0) playerPickupCooldown -= dt;

  // GK保持中はボール操作なし（CPUは動く）
  if (gkBallHolder !== 'none') { isDribbling = false; for (const c of cpu2List) update2v2Cpu(c, dt); return; }

  // 千切/蜂楽スキル中はプレイヤー保持を固定
  if ((chigiriBoostTimer > 0 || bachiraSkillTimer > 0) && !isKicking) ballOwner = 'player';

  // パス飛行中は所有権判定を止めて専用処理へ
  if (passState) { update2v2PassFlight(dt); return; }

  update2v2Possession(dt);
  for (const c of cpu2List) update2v2Cpu(c, dt);

  // 保持者の足元にボールを置く or ルーズ物理
  if (ballOwner === 'player') {
    charDribble(playerChar, dt);
    const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
    const moving = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('ArrowDown') || keys.has('KeyS')
                || keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('ArrowRight') || keys.has('KeyD')
                || joystick.active;
    if (moving) {
      const rollDir = (keys.has('ArrowUp') || keys.has('KeyW') || joystick.active) ? 1 : -1;
      ballMesh.rotateOnWorldAxis(new THREE.Vector3(facing.z, 0, -facing.x), rollDir * RUN_SPEED * dt / BALL_R);
    }
    isDribbling = true;
  } else if (ballOwner === 'ally')   { charDribble(allyChar,   dt); isDribbling = false; }
  else if   (ballOwner === 'enemy')  { charDribble(enemyChar,  dt); isDribbling = false; }
  else if   (ballOwner === 'enemy2') { charDribble(enemy2Char, dt); isDribbling = false; }
  else { isDribbling = false; ballLoosePhysics(dt); }
}

function update2v2Possession(dt) {
  const DR = DRIBBLE_DIST;
  const skillHold = (chigiriBoostTimer > 0 || bachiraSkillTimer > 0);
  // 手放し: プレイヤー
  if (ballOwner === 'player') {
    const dp = distXZ(ballMesh.position, player.position);
    if (!skillHold && (dp >= DR * 1.5 || (isKicking && !isPassing))) ballOwner = 'none';
  }
  // 手放し: CPU
  for (const c of cpu2List) {
    if (ballOwner === c.key) {
      const d = distXZ(ballMesh.position, c.group.position);
      if (d >= DR * 1.5 && !c.kicking && !c.passing) ballOwner = 'none';
    }
  }
  // タックル奪取: プレイヤー → 敵チームから
  if (isTackling && playerPickupCooldown <= 0 && ballOwner !== 'player' && team2(ballOwner) === 'B') {
    const dp = distXZ(ballMesh.position, player.position);
    if (dp < TACKLE_DIST) {
      const victim = entity2(ballOwner);
      ballOwner = 'player';
      if (victim && victim.pickupCd !== undefined) victim.pickupCd = 0.5;
      freezeEntity2(victim ? victim.key : 'enemy', STUN_TIME);
    }
  }
  // タックル奪取: CPU → 相手チームから
  for (const c of cpu2List) {
    if (!c.tackling || c.pickupCd > 0) continue;
    if (ballOwner === 'none' || sameTeam2(c.key, ballOwner)) continue;
    if (ballOwner === 'player' && (skillHold || isKicking)) continue;
    if (distXZ(ballMesh.position, c.group.position) >= TACKLE_DIST) continue;
    const victimKey = ballOwner;
    ballOwner = c.key;
    if (victimKey === 'player') { playerPickupCooldown = 0.6; freezeEntity2('player', STUN_TIME); }
    else { const v = entity2(victimKey); if (v && v.pickupCd !== undefined) v.pickupCd = 0.6; freezeEntity2(victimKey, STUN_TIME); }
  }
  // ルーズボール拾得（最も近いエンティティ）
  if (ballOwner === 'none') {
    let best = null, bestD = DR;
    if (!isKicking && playerPickupCooldown <= 0) {
      const d = distXZ(ballMesh.position, player.position);
      if (d < bestD) { bestD = d; best = 'player'; }
    }
    for (const c of cpu2List) {
      if (c.kicking || c.passing || c.pickupCd > 0 || c.stun > 0) continue;
      const d = distXZ(ballMesh.position, c.group.position);
      if (d < bestD) { bestD = d; best = c.key; }
    }
    if (best) ballOwner = best;
  }
}

function update2v2Cpu(c, dt) {
  if (c.stun > 0)   { charAnim(c.char, 'idle'); charClampToField(c.char); return; }
  if (c.tackling)   { charTackleForward(c.char, dt); charClampToField(c.char); return; }
  if (c.kicking || c.passing || c.oneShotTimer > 0) { charClampToField(c.char); return; }

  const attackGoalX = c.team === 'A' ? GOAL_X : -GOAL_X;
  const teamOwns = ballOwner !== 'none' && team2(ballOwner) === c.team;

  if (ballOwner === c.key) update2v2Carrier(c, attackGoalX, dt);
  else if (teamOwns)       update2v2Support(c, attackGoalX, dt);
  else                     update2v2Defend(c, -attackGoalX, dt);

  charClampToField(c.char);
}

function update2v2Carrier(c, gx, dt) {
  const pos = c.group.position;
  const penZ = FIELD_HALF_D * 0.611;
  // シュート判定（敵CPUと同じ基準）
  const inThird = c.team === 'A' ? pos.x > (GOAL_X - FIELD_HALF_W * 0.48)
                                 : pos.x < -(GOAL_X - FIELD_HALF_W * 0.48);
  if (inThird && Math.abs(pos.z) <= penZ) {
    const distGoal = Math.abs(gx - pos.x);
    if (Math.abs(pos.z) / Math.max(distGoal, 0.1) <= 0.65 || distGoal <= 8) { cpu2Shoot(c); return; }
  }
  // パス判定（味方が前方で開いている時）
  const mate = teammate2(c.key);
  if (c.passCd <= 0 && shouldCpu2Pass(c, mate)) { cpu2Pass(c); return; }
  // ドリブルでゴールへ
  const tx = gx > 0 ? Math.min(gx - 4, pos.x + 9) : Math.max(gx + 4, pos.x - 9);
  const moving = charMoveTo(c.char, new THREE.Vector3(tx, 0, pos.z * 0.7), dt);
  charAnim(c.char, moving ? (clips['dribble'] ? 'dribble' : 'run') : 'idle');
}

function update2v2Support(c, gx, dt) {
  const carrier = entity2(ballOwner);
  if (!carrier) { update2v2Defend(c, -gx, dt); return; }
  const cpos = carrier.group.position;
  // 保持者と逆サイドの前方スペースへ動き、対角のパスコースを作る（密着しない）
  const side = cpos.z >= 0 ? -1 : 1;
  let tx = gx > 0 ? Math.min(gx - 8, cpos.x + 8) : Math.max(gx + 8, cpos.x - 8);
  let tz = side * Math.min(FIELD_HALF_D * 0.62, Math.abs(cpos.z) + 9);
  const no = nearestOpp2(c);
  if (no.opp && distXZ(no.opp.group.position, { x: tx, z: tz }) < 4) tz += side * 4.5;
  tz = Math.max(-FIELD_HALF_D * 0.72, Math.min(FIELD_HALF_D * 0.72, tz));
  const target = new THREE.Vector3(tx, 0, tz);
  // 保持者へ密着しない: ターゲットが近すぎたら離す
  if (distXZ(target, cpos) < SUPPORT_MIN_SEP) {
    const ax = target.x - cpos.x, az = target.z - cpos.z;
    const l = Math.hypot(ax, az) || 1;
    target.x = cpos.x + ax / l * SUPPORT_MIN_SEP;
    target.z = cpos.z + az / l * SUPPORT_MIN_SEP;
  }
  const moving = charMoveTo(c.char, target, dt);
  charAnim(c.char, moving ? 'run' : 'idle');
}

function update2v2Defend(c, defendGoalX, dt) {
  const ball = ballMesh.position;
  const inMyZone = Math.abs(ball.z - c.zoneZ) < FIELD_HALF_D * ZONE_BAND;
  let target;
  if (inMyZone && isClosestDefender2(c)) {
    target = new THREE.Vector3(ball.x, 0, ball.z); // プレス
    if (ballOwner !== 'none' && !sameTeam2(c.key, ballOwner)) {
      const d = distXZ(ball, c.group.position);
      if (d < CPU_TACKLE_RANGE && c.tackleCd <= 0) {
        c.tackling = true; c.tackleCd = ENEMY_TACKLE_COOLDOWN;
        c.oneShotTimer = clips['tackle'] ? clips['tackle'].duration + 0.1 : 1.0;
        charAnim(c.char, 'tackle', false);
        charTackleForward(c.char, dt);
        return;
      }
    }
  } else {
    // ゾーン保持: 自陣ゴール側に構えつつ自分のゾーンZへ、ボール深さに少し追従
    target = new THREE.Vector3(defendGoalX * 0.42 + ball.x * 0.28, 0, c.zoneZ * 0.6 + ball.z * 0.25);
  }
  const moving = charMoveTo(c.char, target, dt);
  charAnim(c.char, moving ? 'run' : 'idle');
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(dt);

  // ── ボール更新 ───────────────────────────────────────────────────
  const remoteRole = mpRole === 'host' ? 'guest' : 'host';
  const remoteOwns = isMultiplayer && mpRemoteBallOwner === remoteRole;

  if (mode2v2) {
    // 2vs2: 所有権・CPU AI・ドリブル配置・ルーズ物理を update2v2 が一括処理
    update2v2(dt);
  } else if (isMultiplayer && remoteOwns) {
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
  } else if (mode2v2) {
    // 2vs2: 両ゴールにGK。スローの戻し先は各チームのCPU（enemy）/プレイヤー。
    updateGK(playerGKChar, pGKSt, -GOAL_X, playerChar, 'player_gk', dt);
    updateGK(enemyGKChar,  eGKSt,  GOAL_X, enemyChar,  'enemy_gk',  dt);
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
  updateBallTrail(dt);
  updateStunMarks(dt);
  updateCharge(dt);
  updateCharFx(dt);
  if (gameStarted && !isGoalScene) updateBachira(dt);

  if (gameStarted) {
  if (!isGoalScene) {
    if (playerStunTimer > 0) playerStunTimer -= dt;
    // スタン中は入力に関わらず idle 固定（足踏み防止）
    const anim = playerStunTimer > 0 ? 'idle' : getDesiredAnim();
    if (anim) fadeToClip(anim);

    if (playerStunTimer <= 0 && bachiraSkillTimer <= 0 && !isKicking && !isPassing && !isTackling && !isSpinning) {
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
        const moveSpeed = RUN_SPEED * (chigiriBoostTimer > 0 ? CHIGIRI_SPEED_MULT : 1);
        player.position.addScaledVector(moveVec, moveSpeed * dt);

        if (wantTurn) {
          const targetAngle = Math.atan2(-moveVec.x, -moveVec.z);
          let diff = targetAngle - player.rotation.y;
          while (diff >  Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          player.rotation.y += diff * Math.min(1, 12 * dt);
        }
      }

      charClampToField(playerChar);

      // 視点の遅延追従。移動中はプレイヤーの向き（=進行方向）に追従。
      // 2vs2で静止時はデフォルトでボール保持者の方を向く（ルーズ時はボール）。
      // 自分が保持中はその場の向きを維持。GK保持中は作動させず（投げたら切替）。
      if (!keys.has('KeyQ') && !keys.has('KeyE') && !lookSwipe.active) {
        const isMoving = moveVec.lengthSq() > 0.001;
        let targetAng = player.rotation.y;
        if (mode2v2 && !isMoving && gkBallHolder === 'none') {
          let holderPos = null;
          if      (ballOwner === 'ally')   holderPos = ally.position;
          else if (ballOwner === 'enemy')  holderPos = enemy.position;
          else if (ballOwner === 'enemy2') holderPos = enemy2.position;
          else if (ballOwner === 'none')   holderPos = ballMesh.position; // ルーズ=ボールを向く
          if (holderPos) {
            const dx = holderPos.x - player.position.x, dz = holderPos.z - player.position.z;
            if (dx * dx + dz * dz > 0.25) targetAng = Math.atan2(-dx, -dz);
          }
        }
        let camDiff = targetAng - viewAngle;
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
      tackleTimer      -= dt;
      tackleLungeTimer -= dt;
      if (tackleTimer <= 0) isTackling = false;
    }
    if (isKicking) {
      kickTimer -= dt;
      if (kickTimer <= 0) isKicking = false;
    }
    if (isPassing) {
      // スタンでパスclipが中断され finished を取りこぼすと固着＝永久フリーズになるため
      // 時間で必ず解除する。スタン中はパスを即キャンセル（受け手フリーズ等で動けなくする）。
      passTimer -= dt;
      if (passTimer <= 0 || playerStunTimer > 0) isPassing = false;
    }

    // タックルの前進ランジ（短時間だけ）／スピン中の自動前進
    const tackleLunging = isTackling && tackleLungeTimer > 0;
    if (tackleLunging || isSpinning) {
      const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
      const speed  = tackleLunging ? MOVE_SPEED * 1.3 : MOVE_SPEED;
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

    // リードアヘッド: 実際の移動量から進行方向を求め、移動中は前方 LEAD_DIST m を
    // 画面中心に寄せる。停止時は 0 に戻してプレイヤーを中心にする。
    if (!_prevPlayerPosInit) { _prevPlayerPos.copy(player.position); _prevPlayerPosInit = true; }
    const frameMove = new THREE.Vector3().subVectors(player.position, _prevPlayerPos).setY(0);
    const desiredLead = new THREE.Vector3();
    if (frameMove.length() > LEAD_MIN_MOVE) {
      desiredLead.copy(frameMove).normalize().multiplyScalar(LEAD_DIST);
    }
    camLead.lerp(desiredLead, Math.min(1, 6 * dt)); // 進行方向へ素早く寄せる/戻す
    _prevPlayerPos.copy(player.position);

    // カメラ追従: ターゲット位置をスムーズに追い、そこから固定オフセット分で配置
    // （位置を直接 lerp するとカメラがプレイヤーに近づくズームが起きるため避ける）
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, viewAngle, 0));
    const camOffset   = new THREE.Vector3(0, 8, 16).applyQuaternion(q);
    const idealTarget = player.position.clone().add(new THREE.Vector3(0, 1.2, 0)).add(camLead);
    const t = Math.min(1, 9 * dt);
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

  // シュートボタン: 押している間チャージ → 離して発射（威力はチャージ量で決定）
  function setupChargeBtn(id, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); startCharge(kind); }, { passive: false });
    const fire = e => {
      e.preventDefault();
      if (chargeKind === kind) releaseCharge();
    };
    el.addEventListener('touchend',    fire, { passive: false });
    el.addEventListener('touchcancel', fire, { passive: false });
  }
  setupChargeBtn('btn-straight', 'straight');
  setupChargeBtn('btn-curve',    'curve');

  // タックルボタン（ボール非所持時のみ有効）
  const tackleBtn = document.getElementById('btn-tackle');
  if (tackleBtn) {
    tackleBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      startTackle();
    }, { passive: false });
  }

  // スキルボタン（ボール所持/ドリブル中に有効。キャラ固有スキルを発動）
  const skillBtn = document.getElementById('btn-skill');
  if (skillBtn) {
    skillBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      useSkill();
    }, { passive: false });
  }

  // パスボタン（2vs2: 自分保持中=パス / 味方保持中=パス要求）
  const passBtn = document.getElementById('btn-pass');
  if (passBtn) {
    passBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      pressPass();
    }, { passive: false });
  }

  // ボール所持状態に応じてボタン表示切替
  function updateMobileButtons() {
    const hasBall = ballOwner === 'player';
    ['btn-straight', 'btn-curve'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = hasBall ? '' : 'none';
    });
    if (tackleBtn) tackleBtn.style.display = hasBall ? 'none' : '';
    if (skillBtn)  skillBtn.style.display  = hasBall ? '' : 'none';
    // パスボタン: 自分保持中=「パス」、味方保持中=「パス要求」。それ以外は非表示。
    // #btn-pass はCSSで display:none を指定しているため、表示時は明示的に flex を入れる
    // （'' だとCSSのnoneに戻り、ボタンが出ないため）。
    if (passBtn) {
      const showPass = mode2v2 && (ballOwner === 'player' || ballOwner === 'ally');
      passBtn.style.display = showPass ? 'flex' : 'none';
      if (showPass) passBtn.textContent = ballOwner === 'ally' ? 'パス要求' : 'パス';
    }
  }
  // animate() から呼べるようにグローバル化
  window._updateMobileButtons = updateMobileButtons;
})();

animate();
