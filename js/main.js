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
// 各ゴールのネット変形ハンドル（buildFieldで作り直すたびに再登録）。
// { sign:+1/-1, ox, backX, ghw, H, geom, rest:Float32Array }
const goalNets = [];

function buildField(halfW, halfD) {
  goalNets.length = 0;
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
    const netGeom = new THREE.BufferGeometry().setFromPoints(pts);
    root.add(new THREE.LineSegments(netGeom, netMat));
    // ゴール時にボールでへこませるための変形ハンドルを登録
    goalNets.push({
      sign: s, ox, backX, ghw: HW, H, geom: netGeom,
      rest: netGeom.attributes.position.array.slice(),
    });
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
  kaizer:  'kaizer_impact', // カイザー: 超高速ストレートシュート（青白レーザービーム）
  yukimiya: 'yukimiya_gyro',// 雪宮: ドリブルからのジャイロシュート（弧を描く蹴り上げ）
};
let playerSkill  = 'spin';
let enemyCharId  = null;  // 敵CPUのキャラID（玲王のコピー用にスキルを引く）
let skillSession = 0; // スキル中の stale setTimeout を無効化するカウンタ
let chigiriBoostTimer = 0; // 千切ブースト残り時間（>0で加速・奪取不可・ピンク残像）
let bachiraSkillTimer = 0; // 蜂楽スキル残り時間（>0で操作ロック・奪取不可・黄オーラ）
let bachiraSkillTotal = 0;
let bachiraDashStart  = 0; // motion2（急加速）が始まる経過時刻
let barouSkillTimer   = 0; // 馬狼スキル残り時間（>0で赤黒い稲妻エフェクト）

// スキル発動中フラグの“署名”。dispatch前後で変化したら＝スキルが実際に発動した、と判定。
// （ドリブル外でのスピン等、内部ガードで不発のときはチャージを消費しないため）
function skillActiveSig() {
  return (isSpinning ? '1' : '0')
    + (isKicking ? '1' : '0')
    + (chigiriBoostTimer > 0 ? '1' : '0')
    + (bachiraSkillTimer > 0 ? '1' : '0')
    + (shidouJumpTimer  > 0 ? '1' : '0');
}

// スキルボタン/キーの共通エントリ。所持スキルに応じて分岐。
// 1試合に MAX_SKILL_CHARGES 回まで（PK戦は対象外）。
function useSkill() {
  if (!gameStarted || isGoalScene || matchOver || playerStunTimer > 0) return;
  if (isKicking || isPassing || isTackling) return;
  const limited = !isPK;
  if (limited && skillCharges <= 0) { flashNoCharge(); return; }

  const before = skillActiveSig();
  if      (playerSkill === 'fake_volley')   nagiFakeVolley();
  else if (playerSkill === 'barou_curve')   barouCurveShot();
  else if (playerSkill === 'chigiri_boost') chigiriBoost();
  else if (playerSkill === 'bachira_dash')  bachiraDash();
  else if (playerSkill === 'reo_copy')      reoCopySkill();
  else if (playerSkill === 'shidou_smash')  shidouSmash();
  else if (playerSkill === 'kaizer_impact') kaizerImpact();
  else if (playerSkill === 'yukimiya_gyro') yukimiyaGyro();
  else startSpin(); // デフォルト: スピン（ドリブル中のみ・内部でガード）

  // 実際に発動したときだけ1チャージ消費
  if (limited && skillActiveSig() !== before) {
    skillCharges = Math.max(0, skillCharges - 1);
    renderSkillCharges();
  }
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
  else if (copied === 'kaizer_impact') kaizerImpact();
  else if (copied === 'yukimiya_gyro') yukimiyaGyro();
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

// 士道: オーバーヘッド・スマッシュシュート（士道本体＆ボール軌道に黄＆ピンクの残像）
//  - 発動時に体だけ180°反転（オーバーヘッドの見た目）。シュートは元の0°方向へ打つ。
//  1) overhead01 中: 約3m飛び上がりつつ、ボールは士道の腹あたりに保持（ジャンプと共に上昇）。
//  2) 01→02 の切替（=ジャンプ頂点）でボールが最高点 → そのまま前方斜め下30°へ蹴り落とす。
//     着地で体の向きを元へ戻す。
const SHIDOU_BLEND        = 0.1;
const SHIDOU_POWER        = 34;   // 水平初速（強烈）
const SHIDOU_ANGLE_DEG    = 30;   // 地面との入射角（下向き）
const SHIDOU_JUMP_H       = 3.0;  // プレイヤーのジャンプ頂点(m)
const SHIDOU_BELLY_OFFSET = 1.0;  // 足元からの腹の高さ(m)＝保持位置
const SHIDOU_LAND_LEAD    = 1.9;  // 着地の何秒前に打ち出すか（早めるほど大きく）
// スキル中の状態（着地で体の向きを戻す / 切替で1回だけ蹴り落とす）
let shidouJumpTimer = 0, shidouJumpTotal = 0, shidouJumpPeak = 0;
let shidouShotAngle = 0, shidouContactT = 0, shidouSmashed = false;

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

  // 体だけ180°反転（シュートは元の0°方向へ打ち出す）。着地で元に戻す。
  shidouShotAngle = player.rotation.y;
  player.rotation.y = shidouShotAngle + Math.PI;

  fadeToClip('shidou_smash', false);

  // ジャンプ頂点は 01→02 の切替に合わせる。打ち出しは士道が着地する直前
  // （ジャンプ終了の SHIDOU_LAND_LEAD 秒前）まで遅らせ、それまではボールを腹で保持。
  shidouJumpTotal = combo.duration;
  shidouJumpPeak  = c1.duration + SHIDOU_BLEND;
  // 着地の SHIDOU_LAND_LEAD 秒前に打ち出す（0.1秒〜着地直前にクランプ）。
  shidouContactT  = Math.min(shidouJumpTotal - 0.05, Math.max(0.1, shidouJumpTotal - SHIDOU_LAND_LEAD));
  shidouJumpTimer = shidouJumpTotal;
  shidouSmashed   = false;

  // スキル中はボールを拾い直されないようロック。ボールは updateShidouSkill が駆動。
  playerPickupCooldown = combo.duration + 0.2;
  enemyPickupCooldown  = combo.duration + 0.2;
  ballOwner = 'none'; isDribbling = false;
}

// 士道スキルの毎フレーム駆動。ジャンプY＋ボール保持（腹）＋頂点での蹴り落とし。
function updateShidouSkill(dt) {
  if (shidouJumpTimer <= 0) return;
  shidouJumpTimer -= dt;
  const e = shidouJumpTotal - shidouJumpTimer; // 経過時間

  // ジャンプY（頂点を shidouJumpPeak=切替 に合わせた山なり）
  let h;
  if (e <= shidouJumpPeak) {
    const r = shidouJumpPeak > 0 ? e / shidouJumpPeak : 1;
    h = SHIDOU_JUMP_H * (1 - (1 - r) * (1 - r)); // 0→頂点（上昇）
  } else {
    const denom = Math.max(0.001, shidouJumpTotal - shidouJumpPeak);
    const r = (e - shidouJumpPeak) / denom;
    h = SHIDOU_JUMP_H * (1 - r * r);             // 頂点→0（下降）
  }
  const landed = shidouJumpTimer <= 0;
  if (landed) { h = 0; player.rotation.y = shidouShotAngle; } // 着地で向きを元へ
  player.position.y = groundY + Math.max(0, h);

  const fwd = new THREE.Vector3(-Math.sin(shidouShotAngle), 0, -Math.cos(shidouShotAngle));

  if (e < shidouContactT) {
    // 01中: ボールを士道の腹あたりに保持（ジャンプに合わせて上昇＝切替時に頂点）
    ballOwner = 'none'; isDribbling = false; ballCurveRate = 0; ballSpin.set(0, 0, 0);
    ballMesh.position.set(
      player.position.x + fwd.x * 0.35,
      player.position.y + SHIDOU_BELLY_OFFSET,
      player.position.z + fwd.z * 0.35
    );
    ballVel.set(0, 0, 0);
  } else if (!shidouSmashed) {
    // 02切替: 頂点から前方斜め下30°へ蹴り落とす（黄＆ピンクの軌道）
    shidouSmashed = true;
    const vh = SHIDOU_POWER;
    const vy = -vh * Math.tan(SHIDOU_ANGLE_DEG * Math.PI / 180);
    ballOwner = 'none'; ballCurveRate = 0; ballSpin.set(0, 0, 0);
    ballMesh.position.set(
      player.position.x + fwd.x * 0.4,
      player.position.y + SHIDOU_BELLY_OFFSET,
      player.position.z + fwd.z * 0.4
    );
    ballVel.set(fwd.x * vh, vy, fwd.z * vh);
    setBallTrail([0xffd400, 0xff3399], THREE.AdditiveBlending);
  }
  // 蹴った後はボール自由飛行（updateBall/ルーズ物理が処理）
}

// 雪宮: ドリブルからのジャイロシュート（3モーション連結）。
//  01: 進行方向の左斜め前(45°)へ進む / 02: 右斜め前(45°)へ切り込み /
//  03: 左斜め前へ蹴り上げ → 最高点後は右へ曲がる弧（下が弧）を描いて右下へ。
//      ボール軌道にはオレンジの回転する渦巻きエフェクト。
const YUKI_BLEND      = 0.1;
const YUKI_MOVE_SPEED = 9;     // 01/02 のドリブル移動速度
const YUKI_POWER      = 17;    // 蹴り出しの水平初速
const YUKI_LIFT       = 15;    // 上向き初速（高い最高点）
const YUKI_CURVE      = -1.5;  // 最高点後に右へ曲げるカーブ（マグナス。負=右へ）
let yukiTimer = 0, yukiTotal = 0, yukiT1 = 0, yukiT2 = 0, yukiContactT = 0;
let yukiKicked = false, yukiAngle = 0;
// オレンジの回転渦巻きエフェクト（飛行中、ボール周りを回りながら出す）
let yukiSwirling = false, yukiSwirlT = 0, yukiSwirlPhase = 0;
const yukiSwirl = [];

function yukiHoldBallAtFeet() {
  const fwd = new THREE.Vector3(-Math.sin(yukiAngle), 0, -Math.cos(yukiAngle));
  ballOwner = 'none'; isDribbling = false; ballCurveRate = 0; ballSpin.set(0, 0, 0);
  ballMesh.position.set(player.position.x + fwd.x * DRIBBLE_OFFSET, BALL_R, player.position.z + fwd.z * DRIBBLE_OFFSET);
  ballVel.set(0, 0, 0);
}

function yukimiyaGyro() {
  if (ballOwner !== 'player') return;
  const c1 = clips['yuki01'], c2 = clips['yuki02'], c3 = clips['yuki03'];
  if (!c1 || !c2 || !c3 || !mixer) { startKick(false, 0, 1.8); return; } // 素材が無ければ通常シュート
  if (!clips['yukimiya_gyro']) buildComboClip('yukimiya_gyro', ['yuki01', 'yuki02', 'yuki03'], YUKI_BLEND);
  const combo = clips['yukimiya_gyro'];
  if (!combo) { startKick(false, 0, 1.8); return; }

  endSpin();
  isKicking = true;
  kickTimer = combo.duration + 0.1;
  fadeToClip('yukimiya_gyro', false);

  yukiAngle    = player.rotation.y;
  yukiTotal    = combo.duration;
  yukiT1       = c1.duration + YUKI_BLEND;                       // 01→02 切替
  yukiT2       = yukiT1 + c2.duration + YUKI_BLEND;              // 02→03 切替
  yukiContactT = yukiT2 + Math.min(c3.duration * 0.4, 0.45);    // 03の蹴り接触
  yukiTimer    = yukiTotal;
  yukiKicked   = false;
  playerPickupCooldown = combo.duration + 0.2;
  enemyPickupCooldown  = combo.duration + 0.2;
  ballOwner = 'none'; isDribbling = false; // ボールは updateYukimiyaSkill が駆動
}

// 雪宮スキルの毎フレーム駆動。01左斜め前(45°)→02右斜め前(45°)→03で前方へ蹴り出し。
function updateYukimiyaSkill(dt) {
  if (yukiTimer <= 0) return;
  yukiTimer -= dt;
  const e = yukiTotal - yukiTimer;
  player.position.y = groundY;
  const fwd   = new THREE.Vector3(-Math.sin(yukiAngle), 0, -Math.cos(yukiAngle));
  const right = new THREE.Vector3(Math.cos(yukiAngle), 0, -Math.sin(yukiAngle));
  const left  = right.clone().multiplyScalar(-1);

  if (e < yukiT1) {
    // 01: 左斜め前（45°）へドリブル
    const dir = fwd.clone().add(left).normalize();
    player.position.addScaledVector(dir, YUKI_MOVE_SPEED * dt);
    charClampToField(playerChar);
    yukiHoldBallAtFeet();
  } else if (e < yukiT2) {
    // 02: 右斜め前（45°）へ切り込み
    const dir = fwd.clone().add(right).normalize();
    player.position.addScaledVector(dir, YUKI_MOVE_SPEED * dt);
    charClampToField(playerChar);
    yukiHoldBallAtFeet();
  } else if (e < yukiContactT) {
    // 03前半: 蹴る直前までボール保持
    yukiHoldBallAtFeet();
  } else if (!yukiKicked) {
    // 03接触: 左斜め前(45°)へ蹴り上げ。最高点後は右へ曲がる弧を描いて右下へ（重力＋カーブ）。
    yukiKicked = true;
    const sFwd  = new THREE.Vector3(-Math.sin(yukiAngle), 0, -Math.cos(yukiAngle));
    const sLeft = new THREE.Vector3(-Math.cos(yukiAngle), 0,  Math.sin(yukiAngle));
    const dir   = sFwd.clone().add(sLeft).normalize();          // 左斜め前(45°)
    ballOwner = 'none'; isDribbling = false; ballSpin.set(0, 0, 0);
    ballMesh.position.set(player.position.x + dir.x * 0.4, BALL_R + 0.3, player.position.z + dir.z * 0.4);
    ballVel.set(dir.x * YUKI_POWER, YUKI_LIFT, dir.z * YUKI_POWER);
    ballCurveRate = YUKI_CURVE;                                 // 飛行中に右へ曲げる
    setBallTrail([0xff7a00, 0xffc04a], THREE.AdditiveBlending); // オレンジの軌道
    yukiSwirling = true; yukiSwirlT = 0; yukiSwirlPhase = 0;    // 渦巻きエフェクト開始
  }
}

// ── オレンジの回転渦巻きエフェクト（飛行中、ボール周りを回転しながら粒子を出す）──
function spawnYukiSwirlParticle(pos, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.085 + Math.random() * 0.05, 6, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.position.copy(pos);
  scene.add(mesh);
  yukiSwirl.push({ mesh, life: 0, maxLife: 0.32 + Math.random() * 0.12 });
}
function updateYukimiyaSwirl(dt) {
  if (yukiSwirling) {
    yukiSwirlT     += dt;
    yukiSwirlPhase += dt * 22; // 回転スピード
    // 飛行が終わったら（着地 or 一定時間）停止
    if (yukiSwirlT > 1.8 || (yukiSwirlT > 0.25 && ballMesh.position.y <= BALL_R + 0.06)) yukiSwirling = false;
    else {
      // 速度に垂直な平面の基底を作り、その円周上に回転しながら粒子を配置＝渦巻き
      const v = new THREE.Vector3(ballVel.x, ballVel.y, ballVel.z);
      if (v.lengthSq() < 0.01) v.set(1, 0, 0);
      v.normalize();
      let up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(v.dot(up)) > 0.9) up.set(1, 0, 0);
      const pA = new THREE.Vector3().crossVectors(v, up).normalize();
      const pB = new THREE.Vector3().crossVectors(v, pA).normalize();
      const r = 0.5;
      for (let k = 0; k < 2; k++) {
        const ang = yukiSwirlPhase + k * Math.PI;
        const off = pA.clone().multiplyScalar(Math.cos(ang) * r).addScaledVector(pB, Math.sin(ang) * r);
        spawnYukiSwirlParticle(
          new THREE.Vector3(ballMesh.position.x + off.x, ballMesh.position.y + off.y, ballMesh.position.z + off.z),
          k === 0 ? 0xff8a1a : 0xffb24a
        );
      }
    }
  }
  for (let i = yukiSwirl.length - 1; i >= 0; i--) {
    const s = yukiSwirl[i];
    s.life += dt;
    const t = s.life / s.maxLife;
    s.mesh.material.opacity = 0.95 * (1 - t);
    s.mesh.scale.setScalar(1 - t * 0.5);
    if (s.life >= s.maxLife) {
      scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose();
      yukiSwirl.splice(i, 1);
    }
  }
}
function clearYukiSwirl() {
  for (const s of yukiSwirl) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
  yukiSwirl.length = 0; yukiSwirling = false;
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
  barouSkillTimer = tHit + BAROU_FOLLOW + 0.25; // 馬狼本体の赤黒い稲妻エフェクト
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

// カイザー: 超高速ストレートシュート（青白のレーザービーム）。
//  まっすぐ・極めて速い・低弾道。発射点から前方へレーザービームのエフェクトを放つ。
const KAIZER_HIT_FRAC = 0.42; // 接触タイミング（クリップ0.7s）
const KAIZER_POWER    = 78;   // 超高速の水平初速（全スキル中最速）
const KAIZER_LIFT     = 5;    // ほぼ直線に見えるよう低めの打ち上げ
const KAIZER_FOLLOW   = 0.45; // 接触後のフォロースルー
function kaizerImpact() {
  if (ballOwner !== 'player') return;
  const clip = clips['kaizer_impact'];
  if (!clip || !mixer) { startKick(false, 0, 2.0); return; } // 素材が無ければ通常シュート
  endSpin();
  isKicking = true;
  const tHit = clip.duration * KAIZER_HIT_FRAC;
  kickTimer = tHit + KAIZER_FOLLOW;
  fadeToClip('kaizer_impact', false);
  playerPickupCooldown = tHit + KAIZER_FOLLOW; enemyPickupCooldown = tHit + KAIZER_FOLLOW;

  const sid = ++skillSession;
  setTimeout(() => {
    if (sid !== skillSession || !gameStarted || isGoalScene) return;
    const ry  = player.rotation.y;
    const fwd = new THREE.Vector3(-Math.sin(ry), 0, -Math.cos(ry));
    ballOwner = 'none'; isDribbling = false; ballSpin.set(0, 0, 0); ballCurveRate = 0; // 完全ストレート
    const origin = new THREE.Vector3(player.position.x + fwd.x * 0.5, BALL_R + 0.9, player.position.z + fwd.z * 0.5);
    ballMesh.position.copy(origin);
    ballVel.set(fwd.x * KAIZER_POWER, KAIZER_LIFT, fwd.z * KAIZER_POWER);
    setBallTrail([0xffffff, 0x49b6ff], THREE.AdditiveBlending); // 青白の軌道
    spawnKaizerBeam(origin, fwd);   // レーザービーム本体
    spawnKaizerFlash(origin);       // 発射フラッシュ
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

// 蜂楽: 急加速(motion2)のみのドリブル突破。
// 黄オーラをまとい、発動時に周囲にいる敵を「！」でフリーズ。奪取不可。
const BACHIRA_BLEND      = 0.1;
const BACHIRA_DASH_SPEED = 18;  // motion2 の前方ダッシュ速度
const BACHIRA_FREEZE_RAD = 9;   // この範囲の敵をフリーズ
function bachiraDash() {
  if (ballOwner !== 'player' || bachiraSkillTimer > 0) return;
  const c2 = clips['bachira02'];
  if (!c2) return;
  bachiraSkillTotal = c2.duration;
  bachiraSkillTimer = c2.duration;
  bachiraDashStart  = 0;            // 最初から急加速（01フェイントは無し）
  fadeToClip('bachira02', false);   // motion2 を1回再生

  // 発動時に周囲にいる敵をモーション中ずっとフリーズ＋「！」マーク
  if (hasEnemy && enemy) {
    const d = new THREE.Vector3().subVectors(enemy.position, player.position).setY(0).length();
    if (d < BACHIRA_FREEZE_RAD) {
      enemyStunTimer = c2.duration;
      spawnStunMark(enemy, c2.duration, _exclaimTexture);
    }
  }
}

// 入力（WASD/矢印/ジョイスティック）からカメラ相対のワールド移動ベクトルを返す。
// 入力が無ければ長さ0。蜂楽スキルの操舵と通常移動の両方で利用。
function computeMoveVec() {
  const camDir   = new THREE.Vector3(-Math.sin(viewAngle), 0, -Math.cos(viewAngle));
  const camRight = new THREE.Vector3( Math.cos(viewAngle), 0, -Math.sin(viewAngle));
  const v = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp'))    v.addScaledVector(camDir,    1);
  if (keys.has('KeyS') || keys.has('ArrowDown'))  v.addScaledVector(camDir,   -1);
  if (keys.has('KeyA') || keys.has('ArrowLeft'))  v.addScaledVector(camRight, -1);
  if (keys.has('KeyD') || keys.has('ArrowRight')) v.addScaledVector(camRight,  1);
  if (joystick.active) {
    if (Math.abs(joystick.dy) > 0.05) v.addScaledVector(camDir,   -joystick.dy);
    if (Math.abs(joystick.dx) > 0.05) v.addScaledVector(camRight,  joystick.dx);
  }
  return v;
}

function updateBachira(dt) {
  if (bachiraSkillTimer <= 0) return;
  bachiraSkillTimer -= dt;
  // 方向キー入力があればその方向へ操舵（機体も向ける）。無ければ現在の向きへ直進。
  const mv = computeMoveVec();
  let dir;
  if (mv.lengthSq() > 0.001) {
    dir = mv.normalize();
    const targetAngle = Math.atan2(-dir.x, -dir.z);
    let diff = targetAngle - player.rotation.y;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    player.rotation.y += diff * Math.min(1, 12 * dt); // 進行方向へ素早く旋回
  } else {
    dir = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
  }
  player.position.addScaledVector(dir, BACHIRA_DASH_SPEED * dt);
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

// ── プレイヤー同士の貫通防止 ───────────────────────────────────────────────
// 単純移動時のみ衝突。スキル/特殊モーション中（キック・タックル・スピン・
// 各種固有スキル）は貫通OK（solid=false）。毎フレーム移動後に呼ぶ。
const CHAR_COLL_R = 0.45; // 1キャラの衝突半径（合計 約0.9mまで近づける）

function playerInSkill() {
  return isKicking || isPassing || isTackling || isSpinning
    || bachiraSkillTimer > 0 || chigiriBoostTimer > 0 || shidouJumpTimer > 0;
}
// スキルモーション中はボールを奪われない（隙をなくす）。ボール保持に関わる
// スキル状態のみ（パス=手放す/タックル=非保持 は含めない）。
function playerSkillBusy() {
  return isSpinning || isKicking
    || chigiriBoostTimer > 0 || bachiraSkillTimer > 0
    || shidouJumpTimer > 0 || barouSkillTimer > 0;
}
function enemyInSkill() { return enemyKicking || enemyTackling; }
function cpu2InSkill(c) { return c.kicking || c.passing || c.tackling || c.oneShotTimer > 0; }

function collidersThisFrame() {
  const list = [];
  list.push({ g: player, solid: !playerInSkill(), movable: true });
  if (mode2v2) {
    list.push({ g: ally,   solid: !cpu2InSkill(c2Ally),   movable: true });
    list.push({ g: enemy,  solid: !cpu2InSkill(c2Enemy),  movable: true });
    list.push({ g: enemy2, solid: !cpu2InSkill(c2Enemy2), movable: true });
  } else if (hasEnemy) {
    list.push({ g: enemy, solid: !enemyInSkill(), movable: true });
  }
  if (isMultiplayer && remotePeer.visible) {
    list.push({ g: remotePeer, solid: true, movable: false }); // リモートは同期優先で動かさない
  }
  return list;
}

// 重なっているキャラ同士を押し戻して貫通を防ぐ
function resolveCharCollisions() {
  const cs = collidersThisFrame();
  const minD = CHAR_COLL_R * 2, minD2 = minD * minD;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (!a.solid || !b.solid) continue;   // どちらかがスキル中なら貫通OK
      if (!a.movable && !b.movable) continue;
      let dx = b.g.position.x - a.g.position.x;
      let dz = b.g.position.z - a.g.position.z;
      let d2 = dx * dx + dz * dz;
      if (d2 >= minD2) continue;
      if (d2 < 1e-6) { dx = 0.01; dz = 0; d2 = 0.0001; } // 完全重なりは適当にずらす
      const d = Math.sqrt(d2);
      const overlap = minD - d;
      const nx = dx / d, nz = dz / d;
      let aShare, bShare;
      if (a.movable && b.movable) { aShare = 0.5; bShare = 0.5; }
      else if (a.movable)         { aShare = 1;   bShare = 0;   }
      else                        { aShare = 0;   bShare = 1;   }
      a.g.position.x -= nx * overlap * aShare;
      a.g.position.z -= nz * overlap * aShare;
      b.g.position.x += nx * overlap * bShare;
      b.g.position.z += nz * overlap * bShare;
    }
  }
  for (const c of cs) {
    if (!c.movable) continue;
    c.g.position.x = Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, c.g.position.x));
    c.g.position.z = Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, c.g.position.z));
  }
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
  // プレイヤーのスキルモーション中(playerSkillBusy)は奪えない（隙をなくす）。
  if (enemyTackling && ballOwner !== 'enemy' && distToBall < TACKLE_DIST
      && enemyPickupCooldown <= 0 && !isKicking && gkBallHolder === 'none'
      && !(ballOwner === 'player' && playerSkillBusy())) {
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
        && enemyTackleCooldown <= 0 && !playerSkillBusy()) {
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
  if (goalCapture) return;  // ゴール捕捉中は updateGoalCapture がボールを駆動
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
  // ── ライン割れ → セットプレー（1v1/2v2のみ）。ゴール枠内は除外（得点/捕捉）。──
  if (setPieceEnabled()) {
    if (Math.abs(ballMesh.position.z) > FIELD_HALF_D) { triggerThrowIn(); return; }
    if (Math.abs(ballMesh.position.x) > GOAL_X && !(_inGoalZ && _inGoalY)) { triggerGoalLineOut(); return; }
  } else {
    // PK/マルチ用フォールバック: 従来どおり壁でバウンド
    if (Math.abs(ballMesh.position.x) > FIELD_HALF_W + 1 && !(_inGoalZ && _inGoalY)) {
      ballVel.x *= -0.6;
      ballMesh.position.x = Math.sign(ballMesh.position.x) * (FIELD_HALF_W + 1);
    }
    if (Math.abs(ballMesh.position.z) > FIELD_HALF_D + 1) {
      ballVel.z *= -0.6;
      ballMesh.position.z = Math.sign(ballMesh.position.z) * (FIELD_HALF_D + 1);
    }
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

  // 凍結中（告知 or 自分が蹴り手の準備）はパス/ドリブルのみ。それ以外の入力は無効。
  if (gameStarted && playerFrozenBySetPiece() && !e.repeat) {
    if (setPiece.phase === 'setup' && setPiece.ready && setPiece.takerKey === 'player') {
      if (e.code === 'KeyG' || e.code === 'KeyF') setPiecePass();
      else if (e.code === 'KeyB') setPieceDribble();
    }
    return;
  }

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
let matchOver   = false;          // 5点先取で試合終了（リザルト表示中）
const MATCH_TARGET = 5;           // 何点先取で終了か

// ── スキルチャージ（1試合に使える回数） ───────────────────────────────────
const MAX_SKILL_CHARGES = 3;
let skillCharges = MAX_SKILL_CHARGES;

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

// ── スキルチャージHUD（右上キューブ×3） ──────────────────────────────────
const skillChargesEl = document.getElementById('skill-charges');
const scCubes = skillChargesEl ? [...skillChargesEl.querySelectorAll('.sc-cube')] : [];
function renderSkillCharges() {
  scCubes.forEach((cube, i) => cube.classList.toggle('spent', i >= skillCharges));
}
function flashNoCharge() {
  if (!skillChargesEl) return;
  skillChargesEl.classList.remove('empty-flash');
  void skillChargesEl.offsetWidth; // reflowでアニメ再起動
  skillChargesEl.classList.add('empty-flash');
}

// ── 試合結果オーバーレイ（リトライ / ロビーに戻る） ───────────────────────
const matchResultEl = document.getElementById('match-result');
let onMatchRetry = null;          // モード別のリトライ処理
function showMatchResult({ title, cls, scoreText, sub, onRetry }) {
  onMatchRetry = onRetry;
  if (!matchResultEl) return;
  if (goalFlashEl) { goalFlashEl.style.display = 'none'; goalFlashEl.classList.remove('conceded'); }
  if (pkHudEl) pkHudEl.style.display = 'none';
  if (skillChargesEl) skillChargesEl.style.display = 'none';
  const t = matchResultEl.querySelector('#mr-title');
  t.textContent = title;
  t.className = cls || '';
  matchResultEl.querySelector('#mr-score').textContent = scoreText || '';
  matchResultEl.querySelector('#mr-sub').textContent   = sub || '';
  matchResultEl.style.display = 'flex';
}
function hideMatchResult() {
  if (matchResultEl) matchResultEl.style.display = 'none';
}
// click と touchend の両方を結線（touchendはpreventDefaultでclick二重発火を抑止）
function bindTap(el, fn) {
  if (!el) return;
  el.addEventListener('click', fn);
  el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
}
if (matchResultEl) {
  bindTap(matchResultEl.querySelector('#mr-retry'), () => {
    hideMatchResult();
    onMatchRetry?.();
  });
  bindTap(matchResultEl.querySelector('#mr-lobby'), () => {
    window.location.reload();      // ロビーへ戻る（確実な復帰）
  });
}

// CPU戦 / 2vs2 の試合をその場で再開（モデル再読み込みなし）
function restartMatch() {
  playerScore = 0; cpuScore = 0; updateScoreDisplay();
  skillCharges = MAX_SKILL_CHARGES; renderSkillCharges();
  if (skillChargesEl && !isPK) skillChargesEl.style.display = 'flex';
  matchOver = false;
  isGoalScene = false;
  resetAfterGoal('cpu');           // プレイヤーがキックオフして再開
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
  barouSkillTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false;
  resetBallTrail();
  clearStunMarks();
  playerPickupCooldown = 0;
  if (mixer)           { mixer.stopAllAction(); current = null; }
  if (remotePeerMixer) { remotePeerMixer.stopAllAction(); remotePeerClipAct = {}; }
  fadeToClip('idle');
  fadeToRemoteClip('idle');
  if (goalFlashEl) { goalFlashEl.style.display = 'none'; goalFlashEl.classList.remove('conceded'); }
}

// ── ゴール時のボール捕捉＆ネットへこみ ───────────────────────────────────
// ゴールに入ったボールは貫通も跳ね返りもさせず、ネットを強くへこませて
// ゴール内に留める。scoreGoal / pkResolve('goal') から開始する。
let goalCapture = null;                  // { sign:+1/-1 }（吸い込み中）
const NET_MAX_DEPTH = 0.75;              // ネットが伸びる最大量(m)
const NET_BULGE_R   = 1.7;              // へこみが及ぶ半径(縦横,m)

function beginGoalCapture(sign) {
  goalCapture = { sign };
}

// ネットの背面/側面/天井の頂点を、ボール接触点(by,bz)を中心に外側へ押し出してへこませる。
// 口元(x=ox)は動かさず奥(backX)ほど大きく変位させて自然なポケットを作る。
function applyNetDent(net, by, bz, depth) {
  const pos  = net.geom.attributes.position;
  const rest = net.rest;
  const { ox, backX, sign } = net;
  const span = Math.abs(backX - ox) || 1;
  for (let i = 0; i < pos.count; i++) {
    const rx = rest[i * 3], ry = rest[i * 3 + 1], rz = rest[i * 3 + 2];
    const xw   = Math.min(1, Math.max(0, ((rx - ox) * sign) / span)); // 口元0→奥1
    const d    = Math.hypot(ry - by, rz - bz);
    const prox = Math.max(0, 1 - d / NET_BULGE_R);
    const push = depth * prox * prox * xw;
    pos.setX(i, rx + sign * push);
    pos.setY(i, ry);
    pos.setZ(i, rz);
  }
  pos.needsUpdate = true;
  net.geom.computeBoundingSphere();
}

function restoreNet(net) {
  const pos = net.geom.attributes.position;
  pos.array.set(net.rest);
  pos.needsUpdate = true;
  net.geom.computeBoundingSphere();
}
function restoreAllNets() { for (const n of goalNets) restoreNet(n); }

// 毎フレーム: ボールをネット手前で受け止め、ゴール内にクランプしつつネットをへこませる。
function updateGoalCapture(dt) {
  if (!goalCapture) return;
  const sign = goalCapture.sign;
  const net  = goalNets.find(n => n.sign === sign);
  const goalLineX = sign * GOAL_X;
  const backX = net ? net.backX : goalLineX + sign * 2.2;
  const ghw   = net ? net.ghw : GOAL_HALF_Z;
  const H     = net ? net.H : 2.44;

  // 物理（重力）＋ネットが運動量を吸収する強めの減衰
  ballVel.y -= BALL_GRAVITY * dt;
  ballVel.x *= 0.88; ballVel.z *= 0.88;
  ballMesh.position.addScaledVector(ballVel, dt);

  // z（ポール内）・y（バー下/地面上）にクランプ
  const zLim = ghw - BALL_R;
  if (ballMesh.position.z >  zLim) { ballMesh.position.z =  zLim; ballVel.z = 0; }
  if (ballMesh.position.z < -zLim) { ballMesh.position.z = -zLim; ballVel.z = 0; }
  if (ballMesh.position.y < BALL_R) {
    ballMesh.position.y = BALL_R;
    ballVel.y = ballVel.y < -1 ? -ballVel.y * 0.2 : 0;
    ballVel.x *= 0.7; ballVel.z *= 0.7; // 着地で転がりを弱める
  }
  const yLim = H - BALL_R;
  if (ballMesh.position.y > yLim) { ballMesh.position.y = yLim; if (ballVel.y > 0) ballVel.y = 0; }

  // x: ネット手前で停止（貫通防止）＋ゴールライン内側より手前へは戻さない（跳ね返り/外出防止）
  const innerBackX = backX - sign * BALL_R;
  const innerLineX = goalLineX + sign * (BALL_R + 0.05);
  if (sign > 0) {
    if (ballMesh.position.x > innerBackX) { ballMesh.position.x = innerBackX; if (ballVel.x > 0) ballVel.x = 0; }
    if (ballMesh.position.x < innerLineX)   ballMesh.position.x = innerLineX;
  } else {
    if (ballMesh.position.x < innerBackX) { ballMesh.position.x = innerBackX; if (ballVel.x < 0) ballVel.x = 0; }
    if (ballMesh.position.x > innerLineX)   ballMesh.position.x = innerLineX;
  }

  // ネットのへこみ量＝ボールがどれだけ奥に入っているか（口元0→奥で最大）
  const span  = Math.abs(backX - goalLineX) || 1;
  const reach = Math.min(1, Math.abs(ballMesh.position.x - goalLineX) / span);
  if (net) applyNetDent(net, ballMesh.position.y, ballMesh.position.z, NET_MAX_DEPTH * reach);

  // 転がり回転
  const hspeed = Math.hypot(ballVel.x, ballVel.z);
  if (hspeed > 0.01) {
    const axis = new THREE.Vector3(ballVel.z, 0, -ballVel.x).normalize();
    ballMesh.rotateOnWorldAxis(axis, (hspeed * dt) / BALL_R);
  }
}

function resetAfterGoal(scorer) {
  goalCapture = null; restoreAllNets();   // ゴール時のネットへこみを元に戻す
  setPiece = null; hideSetPieceUI(); hideSetPieceAnnounce(); // セットプレー中断状態をクリア
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
  barouSkillTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false;
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
  ballOwner = 'none';
  isDribbling = false;
  updateScoreDisplay();
  showGoalFlash(scorer);
  if (isMultiplayer) {
    // MPはネット演出を入れず従来どおりスナップ（同期との競合回避）
    ballMesh.position.set(scorer === 'player' ? GOAL_X + 0.7 : -(GOAL_X + 0.7), BALL_R, 0);
    ballVel.set(0, 0, 0);
    // scorer: 'player'=Hostが得点, 'cpu'=Guestが得点
    const mpScorer = scorer === 'player' ? 'host' : 'guest';
    mpGoalScorer   = mpScorer;
    lastGoalSeq    = Date.now();
    mpHandlers.publishEvent({ type: 'goal', scorer: mpScorer, seq: lastGoalSeq });
    mpHandlers.publishScore({ host: playerScore, guest: cpuScore });
    setTimeout(() => { mpResetAfterGoal(); isGoalScene = false; }, 2500);
  } else {
    // 非MP: ゴールに入ったボールをネットへ吸い込む（貫通/跳ね返り防止＋ネットへこみ）
    beginGoalCapture(scorer === 'player' ? 1 : -1);
    if (playerScore >= MATCH_TARGET || cpuScore >= MATCH_TARGET) {
      // 5点先取で試合終了 → リザルト（リトライ / ロビー）。isGoalScene は維持して停止。
      matchOver = true;
      const win = playerScore > cpuScore;
      setTimeout(() => {
        showMatchResult({
          title: win ? 'WIN!' : 'LOSE...',
          cls:   win ? 'win'  : 'lose',
          scoreText: `${playerScore} - ${cpuScore}`,
          sub: win ? 'You reached 5 goals' : 'CPU reached 5 goals',
          onRetry: restartMatch,
        });
      }, 2200);
    } else {
      setTimeout(() => { resetAfterGoal(scorer); isGoalScene = false; }, 2500);
    }
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
  goalCapture = null; restoreAllNets();    // 前のキックのネットへこみを元に戻す
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
  barouSkillTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false;
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
  if (result === 'goal') { pkGoals++; beginGoalCapture(1); } // ボールをネットへ吸い込む
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
  const win = pkGoals === PK_TOTAL;
  const rank = win ? 'PERFECT!' : pkGoals >= PK_TOTAL * 0.6 ? 'NICE!' : 'もう一度!';
  showMatchResult({
    title: rank,
    cls:   win ? 'win' : pkGoals >= PK_TOTAL * 0.6 ? 'draw' : 'lose',
    scoreText: `${pkGoals} / ${PK_TOTAL}`,
    sub: 'PK戦',
    onRetry: pkRestart,
  });
}

function pkRestart() {
  if (pkResultEl) pkResultEl.style.display = 'none';
  hideMatchResult();
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
  // ── 固有スキルのモーションは各キャラの「Skill」フォルダ配下に配置 ──
  //   キャラ/<キャラ名>/Skill/<スキル名>/*.fbx
  //   Skillフォルダが無い/中身が無いキャラは SKILL_BY_CHAR 未登録→既定のスピン。
  // 凪の固有スキル「2段式フェイクボレー」用（連結して使う）
  ['fake01', './キャラ/凪的なキャラ/Skill/2段式フェイクボレー/fakeKick_01.fbx'],
  ['fake02', './キャラ/凪的なキャラ/Skill/2段式フェイクボレー/fakeKick_02.fbx'],
  // 馬狼の固有スキル「カーブシュート」用
  ['barou_shot', './キャラ/馬狼的なキャラ/Skill/馬狼シュート/Strike Foward Jog.fbx'],
  // 千切の固有スキル「ドリブル突破（加速）」用（連結して使う）
  ['chigiri01', './キャラ/千切的なキャラ/Skill/千切スキル加速/BoostRun01.fbx'],
  ['chigiri02', './キャラ/千切的なキャラ/Skill/千切スキル加速/BoostRun02.fbx'],
  // 蜂楽の固有スキル「ドリブル突破（その場フェイント→急加速）」用（連結して使う）
  ['bachira01', './キャラ/蜂楽的なキャラ/Skill/蜂楽ドリブル突破/bachiraドリブル01.fbx'],
  ['bachira02', './キャラ/蜂楽的なキャラ/Skill/蜂楽ドリブル突破/bachiraドリブル02.fbx'],
  // 士道の固有スキル「オーバーヘッド・スマッシュシュート」用（連結して使う）
  ['shidou01', './キャラ/士道的なキャラ/Skill/士道シュート/overhead01.fbx'],
  ['shidou02', './キャラ/士道的なキャラ/Skill/士道シュート/overhead02.fbx'],
  // カイザーの固有スキル「超高速ストレートシュート」用
  ['kaizer_impact', './キャラ/カイザー的なキャラ/Skill/kaizer_Impact.fbx'],
  // 雪宮の固有スキル「ジャイロシュート」用（3モーション連結）
  ['yuki01', './キャラ/雪宮的なキャラ/Skill/ジャイロシュート/シザーズ01.fbx'],
  ['yuki02', './キャラ/雪宮的なキャラ/Skill/ジャイロシュート/シザーズ02.fbx'],
  ['yuki03', './キャラ/雪宮的なキャラ/Skill/ジャイロシュート/シザーズ03.fbx'],
  // セットプレー用（スローイン / コーナーキック）
  ['throw_in',    './animations/Throw In.fbx'],
  ['corner_kick', './animations/CornerKick.fbx'],
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
  barouSkillTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false;
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
  matchOver = false;
  goalCapture = null;   // ゴール捕捉状態をクリア（ネットはbuildFieldで再生成され初期形）
  setPiece = null; lastTouchTeam = null; hideSetPieceUI(); hideSetPieceAnnounce(); // セットプレー状態クリア
  hideMatchResult();
  // スキルチャージを満タンに（HUDはPK以外で表示）
  skillCharges = MAX_SKILL_CHARGES; renderSkillCharges();
  if (skillChargesEl) skillChargesEl.style.display = config.pk ? 'none' : 'flex';
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

// ── 馬狼: 本体にまとう赤黒い稲妻エフェクト ─────────────────────────────────
const barouBolts = [];
let _barouBoltTimer = 0;
function spawnBarouBolt() {
  // プレイヤー本体に巻きつくように、地面〜頭上へ走るギザギザの稲妻を1本
  const a  = Math.random() * Math.PI * 2;
  const r  = 0.12 + Math.random() * 0.3;        // 体に近づける
  const bx = player.position.x + Math.cos(a) * r;
  const bz = player.position.z + Math.sin(a) * r;
  const segs = 7;
  const y0 = 0.05, y1 = 1.8 + Math.random() * 0.5;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(
      bx + (Math.random() - 0.5) * 0.32,
      y0 + (y1 - y0) * t,
      bz + (Math.random() - 0.5) * 0.32
    ));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  // 赤黒: 鮮やかな赤を通常合成で（緑の芝でも赤く見える）、約3割を黒で混在
  const black = Math.random() < 0.32;
  const mat  = new THREE.LineBasicMaterial({
    color: black ? 0x0a0000 : 0xff1414,
    transparent: true,
    opacity: black ? 0.9 : 1.0,
    depthWrite: false,
  });
  const line = new THREE.Line(geom, mat);
  line.renderOrder = 998;
  scene.add(line);
  barouBolts.push({ line, life: 0, maxLife: 0.06 + Math.random() * 0.09 });
}

// ── カイザー: 超高速シュートの青白レーザービーム ───────────────────────────
const kaizerBeams = [];
const KAIZER_BEAM_LEN = 48;
function spawnKaizerBeam(origin, dir) {
  const d = dir.clone().setY(0).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const mkCyl = (radius, color, op) => {
    const geom = new THREE.CylinderGeometry(radius, radius, KAIZER_BEAM_LEN, 14, 1, true);
    const mat  = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.quaternion.copy(q);
    mesh.position.copy(origin).addScaledVector(d, KAIZER_BEAM_LEN / 2);
    mesh.renderOrder = 997;
    scene.add(mesh);
    return mesh;
  };
  // 外側の青いグロー＋内側の白いコア（三重）
  const meshes = [
    mkCyl(0.75, 0x2a8cff, 0.5),
    mkCyl(0.36, 0x8fd0ff, 0.8),
    mkCyl(0.15, 0xffffff, 1.0),
  ];
  kaizerBeams.push({ meshes, life: 0, maxLife: 0.36 });
}

function spawnKaizerFlash(origin) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.position.copy(origin);
  mesh.renderOrder = 997;
  scene.add(mesh);
  kaizerBeams.push({ meshes: [mesh], life: 0, maxLife: 0.22, flash: true });
}

function updateKaizerBeams(dt) {
  for (let i = kaizerBeams.length - 1; i >= 0; i--) {
    const k = kaizerBeams[i];
    k.life += dt;
    const t = k.life / k.maxLife;
    for (const m of k.meshes) {
      m.material.opacity *= 0.84;
      if (k.flash) m.scale.setScalar(1 + t * 2.2);      // フラッシュは膨らんで消える
      else { m.scale.x = m.scale.z = 1 + t * 0.6; }     // ビームは少し太くなって消える
    }
    if (k.life >= k.maxLife) {
      for (const m of k.meshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      kaizerBeams.splice(i, 1);
    }
  }
}

function updateCharFx(dt) {
  if (chigiriBoostTimer > 0) chigiriBoostTimer -= dt;
  if (barouSkillTimer > 0)   barouSkillTimer -= dt;

  // 発生: 凪=常時黒オーラ / 千切=ブースト中ピンクのオーラ＋残像
  if (gameStarted && !isGoalScene) {
    _auraTimer += dt;
    if (_auraTimer >= 0.045) {
      _auraTimer = 0;
      if (playerSkill === 'fake_volley') spawnAuraParticle(player, 0x0a0a0a, THREE.NormalBlending);
      if (playerSkill === 'reo_copy')    spawnAuraParticle(player, 0x9b30ff, THREE.NormalBlending); // 玲王: 常時紫
      if (chigiriBoostTimer > 0)          spawnAuraParticle(player, 0xff3399, THREE.NormalBlending);
      if (bachiraSkillTimer > 0)          spawnAuraParticle(player, 0xffd400, THREE.NormalBlending);
      // 士道スキル中: 黄＆ピンクのオーラを交互に（加算で発光）
      if (shidouJumpTimer > 0)            spawnAuraParticle(player, Math.random() < 0.5 ? 0xffd400 : 0xff3399, THREE.AdditiveBlending);
      // 雪宮スキル中: オレンジのオーラ
      if (yukiTimer > 0 || yukiSwirling)  spawnAuraParticle(player, 0xff7a00, THREE.AdditiveBlending);
    }
    if (chigiriBoostTimer > 0) {
      _ghostTimer += dt;
      if (_ghostTimer >= 0.05) { _ghostTimer = 0; spawnCharGhost(0xff3399); }
    } else if (bachiraSkillTimer > 0 && (bachiraSkillTotal - bachiraSkillTimer) >= bachiraDashStart) {
      // 残像は motion2（急加速）からのみ。motion1（その場フェイント）では出さない。
      _ghostTimer += dt;
      if (_ghostTimer >= 0.05) { _ghostTimer = 0; spawnCharGhost(0xffd400); }
    } else if (yukiTimer > 0) {
      // 雪宮スキル中: オレンジのシルエット残像
      _ghostTimer += dt;
      if (_ghostTimer >= 0.045) { _ghostTimer = 0; spawnCharGhost(0xff7a00); }
    }
    // 士道はゴースト残像なし。黄＆ピンクの水玉オーラのみ（上の spawnAuraParticle）。

    // 馬狼スキル中: 本体に赤黒い稲妻を高速明滅で複数発生
    if (barouSkillTimer > 0) {
      _barouBoltTimer += dt;
      if (_barouBoltTimer >= 0.025) {
        _barouBoltTimer = 0;
        const n = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) spawnBarouBolt();
      }
    }
  }

  for (let i = barouBolts.length - 1; i >= 0; i--) {
    const b = barouBolts[i];
    b.life += dt;
    b.line.material.opacity *= 0.80; // 明滅しながら消える
    if (b.life >= b.maxLife) {
      scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose();
      barouBolts.splice(i, 1);
    }
  }

  updateKaizerBeams(dt); // カイザーのレーザービーム

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
  for (const b of barouBolts)    { scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); }
  for (const k of kaizerBeams)   { for (const m of k.meshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }
  auraParticles.length = 0; charGhosts.length = 0; barouBolts.length = 0; kaizerBeams.length = 0;
  clearYukiSwirl();
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

  // セットプレー準備中: 所有権/物理は触らずCPUの移動のみ（蹴り手は固定、他は自由に動く）
  if (setPiece) {
    isDribbling = false;
    for (const c of cpu2List) if (c.key !== setPiece.takerKey) update2v2Cpu(c, dt);
    return;
  }

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
  // 千切/蜂楽=保持し続ける（手放さない）。スピンや他スキルは手放し判定はそのまま
  // だが、奪取は playerSkillBusy() で全面ブロックする。
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
    if (ballOwner === 'player' && playerSkillBusy()) continue; // スキル中は奪われない
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
    if (ballOwner !== 'none' && !sameTeam2(c.key, ballOwner)
        && !(ballOwner === 'player' && playerSkillBusy())) { // スキル中のプレイヤーには仕掛けない
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

// ════════════════════════════════════════════════════════════════════════════
// ── セットプレー（スローイン / コーナーキック / ゴールキック）────────────────
// 実サッカー同様、ボールがラインを割ったらプレイを中断。最後に触れたチームの
// 相手にリスタート権。タッチライン=スローイン、ゴールライン=守備側が最後に
// 触れたらコーナー／攻撃側が最後ならゴールキック(GK保持)。プレイヤーチームの
// スロー/コーナーのみボタンUI（パス/ドリブル）で操作。相手・GKは自動再開。
// 1v1/2v2 専用（PK・マルチは従来どおり壁バウンド）。
let lastTouchTeam = null;        // 'A'(プレイヤー側) | 'B'(敵側)
let setPiece = null;             // { kind, timer, ready } プレイヤーが蹴る時のみ
const SETPIECE_SETUP_TIME = 3.0; // 蹴る前の準備（モーション表示）秒数
function setPieceEnabled() {
  return !isPK && !isMultiplayer && !isGoalScene && !matchOver && !goalCapture && !setPiece;
}
function ballTeamOf(key) {
  if (key === 'player' || key === 'ally'  || key === 'player_gk') return 'A';
  if (key === 'enemy'  || key === 'enemy2'|| key === 'enemy_gk')  return 'B';
  return null;
}

// プレイヤーチームでタッカー(プレイヤー)に最も近い味方（2v2は味方CPU。1v1は味方なし
// → 前方スペースへ投げる/蹴る）。GKへの後ろ向きパスはしない。
function nearestTeammateForPlayer() {
  if (mode2v2 && c2Ally) return c2Ally;
  return null;
}
// リスタート位置に最も近い敵エンティティ
function nearestEnemyEntity(spot) {
  const list = mode2v2 ? [c2Enemy, c2Enemy2] : (hasEnemy ? [{ key: 'enemy', group: enemy }] : []);
  let best = null, bd = Infinity;
  for (const e of list) {
    const d = distXZ(e.group.position, spot);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function clearBallMotion() { ballVel.set(0, 0, 0); ballCurveRate = 0; ballOwner = 'none'; isDribbling = false; }

// ── 発生: タッチライン → スローイン ────────────────────────────────────────
function triggerThrowIn() {
  const zSign = Math.sign(ballMesh.position.z) || 1;
  const xPos  = Math.max(-(FIELD_HALF_W - 1), Math.min(FIELD_HALF_W - 1, ballMesh.position.x));
  const awarded = lastTouchTeam === 'A' ? 'B' : 'A'; // 最後に触れた逆チームがスロー
  clearBallMotion();
  // 蹴り手はタッチラインの外に立たせ、フィールド内側を向く
  const taker = { x: xPos, z: zSign * (FIELD_HALF_D + 1.0) };
  const faceRy = zSign > 0 ? 0 : Math.PI;
  if (awarded === 'A') startPlayerSetPiece('throwin', taker, faceRy);
  else                 startOpponentSetPiece('throwin', taker, faceRy);
}

// ── 発生: ゴールライン(枠外) → コーナー or ゴールキック ─────────────────────
function triggerGoalLineOut() {
  const xSign = Math.sign(ballMesh.position.x) || 1;
  const zSign = Math.sign(ballMesh.position.z) || 1;
  const defending = xSign > 0 ? 'B' : 'A';            // この線を守るチーム
  const attacking = defending === 'A' ? 'B' : 'A';
  clearBallMotion();
  if (lastTouchTeam === defending) {
    // 守備側が最後に触れた → 攻撃側のコーナーキック。蹴り手はコーナー外、ゴール方向を向く。
    const taker = { x: xSign * (FIELD_HALF_W - 0.3), z: zSign * (FIELD_HALF_D + 0.8) };
    const faceRy = xSign > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (attacking === 'A') startPlayerSetPiece('corner', taker, faceRy);
    else                   startOpponentSetPiece('corner', taker, faceRy);
  } else {
    // 攻撃側が最後に触れた（or 不明） → 守備側ゴールキック（GK保持スタート）
    startGoalKick(defending);
  }
}

const _setPieceClip = kind => (kind === 'corner' ? 'corner_kick' : 'throw_in');
const ANNOUNCE_TIME = 1.3;       // 告知（メッセージ＋画面遷移）秒数。この間に再配置。
function setPieceAnnouncing() { return setPiece !== null && setPiece.phase === 'announce'; }
function playerIsTaker() { return setPiece !== null && setPiece.takerKey === 'player'; }
// 操作ロック対象か: 告知中は全員停止 / 準備中は蹴り手のみ停止
function playerFrozenBySetPiece() {
  if (!setPiece) return false;
  if (setPiece.phase === 'announce') return true;
  return setPiece.takerKey === 'player';
}
// 蹴り手のグループ（プレイヤー or CPU）
function setPieceTakerGroup() {
  if (!setPiece) return null;
  if (setPiece.takerKey === 'player') return player;
  const e = entity2(setPiece.takerKey);
  return e ? e.group : null;
}

// セットプレー用に選手を戦略的なポジションへ再配置（蹴り手以外＋GK）。
// 極端にボール前へ集めず、攻撃側はボックス/受けに広がり、守備側はゴール前/受け手をケア。
function repositionForSetPiece(kind, takerKey, takerPos) {
  const atk = ballTeamOf(takerKey), def = atk === 'A' ? 'B' : 'A';
  const outfield = t => mode2v2 ? (t === 'A' ? ['player', 'ally'] : ['enemy', 'enemy2'])
                                : (t === 'A' ? ['player'] : ['enemy']);
  const atkGoalX = atk === 'A' ? GOAL_X : -GOAL_X;
  const sgn = Math.sign(atkGoalX);
  const HW = FIELD_HALF_W, HD = FIELD_HALF_D;
  const place = (key, x, z) => {
    if (key === takerKey) return;
    const g = key === 'player' ? player : (entity2(key) ? entity2(key).group : null);
    if (!g) return;
    g.position.set(Math.max(-HW + 1, Math.min(HW - 1, x)), groundY, Math.max(-HD + 1, Math.min(HD - 1, z)));
  };
  let atkSpots, defSpots;
  if (kind === 'corner') {
    const szC = Math.sign(takerPos.z) || 1;
    atkSpots = [[sgn * (HW - 9),  szC * 3], [sgn * (HW - 12), -szC * 5]]; // ボックス内に広がる
    defSpots = [[sgn * (HW - 5),  szC * 1], [sgn * (HW - 6),  -szC * 3]]; // ゴール前を守る
  } else { // throwin
    const szT = Math.sign(takerPos.z) || 1, xp = takerPos.x;
    atkSpots = [[xp + sgn * 4, szT * (HD - 6)], [xp + sgn * 13, szT * (HD - 13)]]; // ショート受け＋前方
    defSpots = [[xp + sgn * 1, szT * (HD - 9)], [xp - sgn * 7,  szT * (HD - 15)]]; // 受け手ケア＋カバー
  }
  outfield(atk).forEach((k, i) => place(k, ...atkSpots[i % atkSpots.length]));
  outfield(def).forEach((k, i) => place(k, ...defSpots[i % defSpots.length]));
  // GKは各ゴール前へ
  const pgy = playerGKChar.group.userData.gkGroundOffset ?? groundY;
  playerGKChar.group.position.set(-(GOAL_X - GK_X_OFFSET), pgy, 0);
  const egy = enemyGKChar.group.userData.gkGroundOffset ?? groundY;
  enemyGKChar.group.position.set(GOAL_X - GK_X_OFFSET, egy, 0);
}

// 共通セットプレー開始: 告知（メッセージ＋画面遷移）→再配置→準備（モーション）→実施
function beginSetPiece(kind, takerKey, takerPos, faceRy) {
  setPiece = { kind, takerKey, phase: 'announce', timer: ANNOUNCE_TIME, ready: false,
               takerPos: { x: takerPos.x, z: takerPos.z } };
  const tg = takerKey === 'player' ? player : entity2(takerKey).group;
  tg.position.set(takerPos.x, groundY, takerPos.z);
  tg.rotation.y = faceRy;
  ballOwner = 'none'; isDribbling = false;
  ballMesh.position.set(takerPos.x, BALL_R, takerPos.z);
  if (takerKey === 'player') { isKicking = isPassing = isTackling = isSpinning = false; if (mixer) fadeToClip('idle'); }
  else { charAnim(entity2(takerKey).char, 'idle'); }
  repositionForSetPiece(kind, takerKey, takerPos);  // 戦略的に再配置
  hideSetPieceUI();
  showSetPieceAnnounce(kind);                        // メッセージ＋画面遷移エフェクト
}

function startPlayerSetPiece(kind, taker, faceRy) { beginSetPiece(kind, 'player', taker, faceRy); }
function startOpponentSetPiece(kind, taker, faceRy) {
  const e = nearestEnemyEntity(taker);
  if (!e) { ballMesh.position.set(taker.x, BALL_R, taker.z); ballOwner = 'none'; return; }
  beginSetPiece(kind, e.key, taker, faceRy);
}

// 準備フェーズ移行時、蹴り手のセットプレーモーションを再生開始
function startTakerMotion() {
  const clipName = _setPieceClip(setPiece.kind);
  const c = clips[clipName] ? clipName : 'idle';
  if (setPiece.takerKey === 'player') { if (mixer) fadeToClip(c, false); }
  else { charAnim(entity2(setPiece.takerKey).char, c, false); }
}

// フェーズ進行: announce(告知1.3s) → setup(準備3s) → ready(ボタン/CPU自動実行)
function updateSetPiecePhase(dt) {
  if (!setPiece || setPiece.ready) return;
  setPiece.timer -= dt;
  if (setPiece.timer > 0) return;
  if (setPiece.phase === 'announce') {
    setPiece.phase = 'setup'; setPiece.timer = SETPIECE_SETUP_TIME;
    hideSetPieceAnnounce();
    startTakerMotion();
  } else { // phase === 'setup'
    setPiece.ready = true;
    if (setPiece.takerKey === 'player') showSetPieceUI(setPiece.kind);
    else cpuSetPieceAct();
  }
}

// ボールを対象へ蹴り出す（コーナー=カーブして蹴り上げ / スロー=ふわり投げ）
function launchSetPieceBall(from, target, kind) {
  const dir  = new THREE.Vector3(target.x - from.x, 0, target.z - from.z);
  const dist = Math.max(1, dir.length()); dir.normalize();
  ballOwner = 'none'; isDribbling = false;
  if (kind === 'corner') {
    const hSpd = Math.min(26, Math.max(14, dist * 0.95));
    ballMesh.position.set(from.x + dir.x * 0.5, BALL_R + 0.1, from.z + dir.z * 0.5);
    ballVel.set(dir.x * hSpd, 11, dir.z * hSpd);
    ballCurveRate = (Math.random() < 0.5 ? 1 : -1) * 0.5;
    setBallTrail([0x3da5ff], THREE.AdditiveBlending);
  } else {
    const hSpd = Math.min(18, Math.max(9, dist * 0.85));
    ballMesh.position.set(from.x + dir.x * 0.4, 1.4, from.z + dir.z * 0.4);
    ballVel.set(dir.x * hSpd, 7, dir.z * hSpd);
    ballCurveRate = 0;
  }
}

// CPUの蹴り手が3秒後に自動実行。
//  スローイン: 必ずパス（味方へ。味方がいなければ前方スペースへ投げる。ドリブル禁止）。
//  コーナー: 味方がいればパス、いなければドリブル開始。
function cpuSetPieceAct() {
  const takerKey = setPiece.takerKey, kind = setPiece.kind;
  const taker = entity2(takerKey);
  const from  = taker.group.position;
  const mate  = mode2v2 ? teammate2(takerKey) : null;
  setPiece = null;
  const sgn = Math.sign(ballTeamOf(takerKey) === 'A' ? GOAL_X : -GOAL_X); // 攻撃方向
  let target = (mate && mate.group) ? mate.group.position : null;
  // スローインは必ずパス: 味方がいなければ前方スペースへ投げる
  if (!target && kind === 'throwin') target = new THREE.Vector3(from.x + sgn * 10, 0, from.z * 0.4);
  if (target) {
    launchSetPieceBall(from, target, kind);
    playerPickupCooldown = 0.4; // 受け手(敵)が拾いやすいよう一瞬プレイヤーを抑える
  } else {
    // コーナーで味方なし → ドリブル開始
    ballOwner = takerKey; isDribbling = false;
    if (!mode2v2) enemyState = 'dribble';
    playerPickupCooldown = 0.6;
  }
  lastTouchTeam = ballTeamOf(takerKey) || lastTouchTeam;
}

function startGoalKick(team) {
  ballOwner = 'none'; ballVel.set(0, 0, 0); ballCurveRate = 0; isDribbling = false;
  if (team === 'A') {
    const gy = playerGKChar.group.userData.gkGroundOffset ?? groundY;
    playerGKChar.group.position.set(-(GOAL_X - GK_X_OFFSET), gy, 0);
    gkBallHolder = 'player_gk'; pGKSt.state = 'hold'; pGKSt.holdTimer = GK_HOLD_TIME; pGKSt.catchAnimTimer = 0;
    ballMesh.position.set(playerGKChar.group.position.x, 1.2, 0);
  } else {
    const gy = enemyGKChar.group.userData.gkGroundOffset ?? groundY;
    enemyGKChar.group.position.set(GOAL_X - GK_X_OFFSET, gy, 0);
    gkBallHolder = 'enemy_gk'; eGKSt.state = 'hold'; eGKSt.holdTimer = GK_HOLD_TIME; eGKSt.catchAnimTimer = 0;
    ballMesh.position.set(enemyGKChar.group.position.x, 1.2, 0);
  }
  lastTouchTeam = team;
}

// セットプレー準備中: 蹴り手の足元にボールを保持し続ける
function updateSetPieceHold() {
  const g = setPieceTakerGroup();
  if (!g) return;
  ballMesh.position.set(g.position.x, BALL_R, g.position.z);
  ballVel.set(0, 0, 0);
}

// ── パス（プレイヤーのスロー/コーナー）。準備(3秒)後のみ受付。────────────────
function setPiecePass() {
  if (!setPiece || !setPiece.ready || setPiece.takerKey !== 'player') return;
  const kind = setPiece.kind;
  const mate = nearestTeammateForPlayer();
  setPiece = null;
  hideSetPieceUI();
  const from = player.position;
  const target = mate
    ? mate.group.position.clone()
    : new THREE.Vector3(from.x + (player.rotation.y < 0 ? 8 : -8), 0, from.z);
  launchSetPieceBall(from, target, kind);
  enemyPickupCooldown = 0.4; // 受け手が拾いやすいよう一瞬敵を抑える
  lastTouchTeam = 'A';
}

// ── ドリブル（プレイヤーのコーナーのみ）。準備(3秒)後のみ受付。──────────────
function setPieceDribble() {
  if (!setPiece || !setPiece.ready || setPiece.kind !== 'corner') return;
  hideSetPieceUI();
  setPiece = null;
  ballOwner = 'player'; isDribbling = true;
  enemyPickupCooldown = 0.6;
  lastTouchTeam = 'A';
}

// ── UI（パス/ドリブルボタン）────────────────────────────────────────────────
const _spBar     = document.getElementById('setpiece-bar');
const _spTitle   = document.getElementById('sp-title');
const _spPassBtn = document.getElementById('sp-pass');
const _spDribBtn = document.getElementById('sp-dribble');
const _touchControls = document.getElementById('touch-controls');
const _uiLegend = document.getElementById('ui');
function showSetPieceUI(kind) {
  if (!_spBar) return;
  _spTitle.textContent = kind === 'corner' ? 'コーナーキック' : 'スローイン';
  _spDribBtn.style.display = kind === 'corner' ? 'flex' : 'none'; // スローインはパスのみ
  _spBar.style.display = 'flex';
  if (_touchControls) _touchControls.style.display = 'none'; // 通常操作ボタンは隠す
  if (_uiLegend) _uiLegend.style.display = 'none';            // キーボード説明も隠す
}
function hideSetPieceUI() {
  if (_spBar) _spBar.style.display = 'none';
  if (_touchControls) _touchControls.style.display = ''; // 通常操作ボタンを戻す（CSSに委ねる）
  if (_uiLegend) _uiLegend.style.display = '';
}
if (_spPassBtn) bindTap(_spPassBtn, () => setPiecePass());
if (_spDribBtn) bindTap(_spDribBtn, () => setPieceDribble());

// ── 告知バナー（メッセージ＋画面遷移エフェクト）─────────────────────────────
const _spaEl   = document.getElementById('setpiece-announce');
const _spaText = document.getElementById('spa-text');
function showSetPieceAnnounce(kind) {
  if (!_spaEl) return;
  _spaText.textContent = kind === 'corner' ? 'コーナーキック' : 'スローイン';
  _spaEl.style.display = 'flex';
  _spaEl.classList.remove('run'); void _spaEl.offsetWidth; _spaEl.classList.add('run'); // アニメ再起動
}
function hideSetPieceAnnounce() {
  if (!_spaEl) return;
  _spaEl.classList.remove('run');
  _spaEl.style.display = 'none';
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(dt);

  // ゴールに入ったボールはネットへ吸い込み＆ネットへこみ（他のボール処理より優先）
  if (goalCapture) updateGoalCapture(dt);

  // ── ボール更新 ───────────────────────────────────────────────────
  const remoteRole = mpRole === 'host' ? 'guest' : 'host';
  const remoteOwns = isMultiplayer && mpRemoteBallOwner === remoteRole;

  if (setPiece) {
    // 告知中=全員停止 / 準備中=蹴り手のみ固定で他は自由に動く
    updateSetPiecePhase(dt);
    if (setPiece && setPiece.phase === 'setup' && mode2v2) update2v2(dt);
    if (setPiece) updateSetPieceHold(); // ボールを蹴り手の足元に固定
  } else if (mode2v2) {
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

  // 最後にボールに触れたチームを記録（ライン割れ時のリスタート権判定用）
  if (!isMultiplayer && !isPK) {
    if (ballOwner !== 'none')           lastTouchTeam = ballTeamOf(ballOwner) || lastTouchTeam;
    else if (gkBallHolder !== 'none')   lastTouchTeam = ballTeamOf(gkBallHolder) || lastTouchTeam;
  }

  if (setPiece) {
    // 告知(announce)中は全員停止。準備(setup)中は蹴り手以外を動かす。
    if (setPiece.phase === 'setup') {
      if (mode2v2) {
        updateGK(playerGKChar, pGKSt, -GOAL_X, playerChar, 'player_gk', dt);
        updateGK(enemyGKChar,  eGKSt,  GOAL_X, enemyChar,  'enemy_gk',  dt);
      } else if (!isMultiplayer) {
        // 敵が蹴り手のときはAIを止めてモーションだけ進める。そうでなければ敵は自由に動く。
        if (setPiece.takerKey === 'enemy') { if (enemyMixer) enemyMixer.update(dt); }
        else                               updateEnemy(dt);
        updateGK(playerGKChar, pGKSt, -GOAL_X, playerChar, 'player_gk', dt);
        if (hasEnemy) updateGK(enemyGKChar, eGKSt, GOAL_X, enemyChar, 'enemy_gk', dt);
      }
    }
  } else if (isPK) {
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
  if (gameStarted && !isGoalScene) updateShidouSkill(dt);
  if (gameStarted && !isGoalScene) updateYukimiyaSkill(dt);
  updateYukimiyaSwirl(dt);

  if (gameStarted) {
  if (!isGoalScene) {
    if (playerStunTimer > 0) playerStunTimer -= dt;
    // スタン/告知中は idle。自分が蹴り手の準備中はモーションを上書きしない。
    let anim;
    if (playerStunTimer > 0 || setPieceAnnouncing()) anim = 'idle';
    else if (playerIsTaker())                        anim = null;
    else                                             anim = getDesiredAnim();
    if (anim) fadeToClip(anim);

    if (!playerFrozenBySetPiece() && playerStunTimer <= 0 && bachiraSkillTimer <= 0 && !isKicking && !isPassing && !isTackling && !isSpinning) {
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

    // プレイヤー同士の貫通防止（移動・AI更新の後に実行）。
    // セットプレー準備中は蹴り手をフィールド外に立たせるため衝突解決はしない。
    if (!setPiece) resolveCharCollisions();
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
// ロビー or 試合結果オーバーレイ表示中はゲーム用タッチ処理を止める（ボタンのタップを通す）
function gameTouchBlocked() {
  if (document.getElementById('lobby')?.style?.display !== 'none') return true;
  if (document.getElementById('match-result')?.style?.display === 'flex') return true;
  if (playerFrozenBySetPiece()) return true; // 凍結中はジョイスティックを止めボタンタップを通す
  return false;
}

document.addEventListener('touchstart', e => {
  if (gameTouchBlocked()) return;
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
  if (gameTouchBlocked()) return;
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
