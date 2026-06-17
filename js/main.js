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
let mode2v2 = false;          // チーム戦モード(2vs2 or 3vs3)か（専用AI/所有権を使う）
let teamSize = 2;             // 1チームの人数（2 or 3）。3vs3で ally2/enemy3 を追加。
const ally    = new THREE.Group();
const ally2   = new THREE.Group();
const enemy2  = new THREE.Group();
const enemy3  = new THREE.Group();
let allyMixer   = null, allyCurrent   = null;
let ally2Mixer  = null, ally2Current  = null;
let enemy2Mixer = null, enemy2Current = null;
let enemy3Mixer = null, enemy3Current = null;
const allyChar   = { group: ally,   animState: null };
const ally2Char  = { group: ally2,  animState: null };
const enemy2Char = { group: enemy2, animState: null };
const enemy3Char = { group: enemy3, animState: null };

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

  // 糸師冴フロー中のシュートは、どこからでもゴール左隅へ巻き込む誘導カーブに上書き。
  if (saeSkillTimer > 0) { saeCurveShot(); return; }

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
  kickBallFollow = false; // 接触＝発射。追従終了。
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
// 移動入力があるか（キー or ジョイスティック）。グライド開始判定に使用。
function playerHasMoveInput() {
  return keys.has('KeyW') || keys.has('ArrowUp') || keys.has('KeyS') || keys.has('ArrowDown')
      || keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('KeyD') || keys.has('ArrowRight')
      || joystick.active;
}

function startKick(lofted, curve, power) {
  if (!gameStarted || !clips['kick'] || !mixer) return;
  if (playerStunTimer > 0) return; // スタン中は操作不可
  endSpin();              // スピン中のシュートはスピンを打ち切ってから蹴る（状態固着防止）
  isKicking = true;
  const dur = clips['kick'].duration;
  kickTimer = dur / KICK_SPEED + 0.1; // 再生が速くなる分ロックも短く（保険）
  // 移動中なら滑りながら蹴る。減速はキックモーション全体に広げて自然に止める。
  kickGlide = playerHasMoveInput() ? 1 : 0;
  kickGlideTime = kickTimer;
  kickBallFollow = true; // 接触フレームまでボールを足元に追従（置き去り防止）
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
  // 味方CPUが保持中＝要求 / 自分が保持中＝出す
  if (ballOwner !== 'player' && ballTeamOf(ballOwner) === 'A') requestPass();
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
  // 移動中なら滑りながらパス。減速はパスモーション全体に広げて自然に止める。
  kickGlide = playerHasMoveInput() ? 1 : 0;
  kickGlideTime = passTimer;
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
  sae:     'sae_flow',      // 糸師冴: フロー状態。10秒間 加速＋奪取不可＋ピンクのネオン数字残像
};
let playerSkill  = 'spin';
let enemyCharId  = null;  // 敵CPUのキャラID（玲王のコピー用にスキルを引く）

// 玲王: その試合の敵キャラ分のスキルボタンを用意（コピー自動発動は廃止）。
// 各ボタンは敵キャラ固有スキルを直接発動し、エフェクトは全て紫に上書きする。
// チャージは全ボタン合計で MAX_SKILL_CHARGES 回（共有プール）。
let reoSkills = []; // [{ id, skill, name }]
const CHAR_SHORT = {
  tensei: '天才', nekketsu: '熱血', reio: '玲王', nagi: '凪', barou: '馬狼',
  chigiri: '千切', bachira: '蜂楽', shidou: '士道', kaizer: 'カイザー', yukimiya: '雪宮',
  sae: '糸師冴',
};
const SKILL_SHORT = {
  fake_volley: 'ボレー', barou_curve: 'カーブ', chigiri_boost: '加速',
  bachira_dash: 'フェイント', shidou_smash: 'スマッシュ', kaizer_impact: '高速弾',
  yukimiya_gyro: 'ジャイロ', sae_flow: 'フロー', spin: 'スピン',
};
// 玲王エフェクト用の紫パレット（ボール軌道/オーラ/残像/ビーム/稲妻を上書き）
const REO_FX1 = 0x9b30ff; // 鮮やかな紫
const REO_FX2 = 0xc77dff; // 明るい紫
const REO_FX3 = 0xe6ccff; // 紫がかった白（コア）
const isReo = () => playerSkill === 'reo_copy';
let skillSession = 0; // スキル中の stale setTimeout を無効化するカウンタ
let chigiriBoostTimer = 0; // 千切ブースト残り時間（>0で加速・奪取不可・ピンク残像）
let bachiraSkillTimer = 0; // 蜂楽スキル残り時間（>0で操作ロック・奪取不可・黄オーラ）
let nagiSkillTimer    = 0; // 凪フェイクボレー残り時間（>0で5m内の敵を❗フリーズ）
let bachiraSkillTotal = 0;
let bachiraDashStart  = 0; // motion2（急加速）が始まる経過時刻
let barouSkillTimer   = 0; // 馬狼スキル残り時間（>0で本体に赤黒い稲妻）
let barouBallFxTimer  = 0; // 馬狼シュート飛行中の軌道イナズマ残り時間
let saeSkillTimer     = 0; // 糸師冴フロー残り時間（>0で加速・奪取不可・ピンクのネオン数字残像）
let saeShotActive     = false; // 糸師冴フロー中に放った誘導カーブシュートが飛行中
const saeShotTarget   = new THREE.Vector3(); // 誘導先（攻撃側ゴールの左隅）

// スキル発動中フラグの“署名”。dispatch前後で変化したら＝スキルが実際に発動した、と判定。
// （ドリブル外でのスピン等、内部ガードで不発のときはチャージを消費しないため）
function skillActiveSig() {
  return (isSpinning ? '1' : '0')
    + (isKicking ? '1' : '0')
    + (chigiriBoostTimer > 0 ? '1' : '0')
    + (bachiraSkillTimer > 0 ? '1' : '0')
    + (shidouJumpTimer  > 0 ? '1' : '0')
    + (saeSkillTimer    > 0 ? '1' : '0');
}

// スキルボタン/キーの共通エントリ。所持スキルに応じて分岐。
// 1試合に MAX_SKILL_CHARGES 回まで（PK戦は対象外）。
function useSkill() {
  if (!gameStarted || isGoalScene || matchOver || playerStunTimer > 0) return;
  if (isKicking || isPassing || isTackling) return;
  // 玲王はスキルボタン(複数)で発動。KeyZ/単一ボタンは先頭スキルにマップ。
  if (isReo()) { useReoSkill(0); return; }
  const limited = !isPK;
  if (limited && skillCharges <= 0) { flashNoCharge(); return; }
  kickGlide = 0; // スキルは独自に移動制御するためグライド無効

  const before = skillActiveSig();
  fireSkillByName(playerSkill);

  // 実際に発動したときだけ1チャージ消費
  if (limited && skillActiveSig() !== before) {
    skillCharges = Math.max(0, skillCharges - 1);
    renderSkillCharges();
  }
}

// スキル名から該当スキルを発動（玲王のボタンと共通）。未登録はスピン。
function fireSkillByName(name) {
  if      (name === 'fake_volley')   nagiFakeVolley();
  else if (name === 'barou_curve')   barouCurveShot();
  else if (name === 'chigiri_boost') chigiriBoost();
  else if (name === 'bachira_dash')  bachiraDash();
  else if (name === 'shidou_smash')  shidouSmash();
  else if (name === 'kaizer_impact') kaizerImpact();
  else if (name === 'yukimiya_gyro') yukimiyaGyro();
  else if (name === 'sae_flow')      saeFlow();
  else startSpin();
}

// 玲王: idx 番目の敵キャラスキルを発動（共有チャージを1消費・エフェクトは紫）。
function useReoSkill(idx) {
  if (!gameStarted || isGoalScene || matchOver || playerStunTimer > 0) return;
  if (isKicking || isPassing || isTackling) return;
  const entry = reoSkills[idx];
  if (!entry) return;
  const limited = !isPK;
  if (limited && skillCharges <= 0) { flashNoCharge(); return; }
  kickGlide = 0; // スキルは独自に移動制御するためグライド無効

  const before = skillActiveSig();
  fireSkillByName(entry.skill);

  if (limited && skillActiveSig() !== before) {
    skillCharges = Math.max(0, skillCharges - 1);
    renderSkillCharges();
  }
}

// その試合の敵キャラ分のスキルリストを構築（玲王のボタン用）。
function computeReoSkills(config) {
  if (SKILL_BY_CHAR[config.charId] !== 'reo_copy') return [];
  const ids = [];
  if (config.mode2v2 || config.mode3v3) {
    // 2vs2=敵2人 / 3vs3=敵3人。その試合の敵キャラ分のボタンを出す。
    for (const k of ['enemy1Id', 'enemy2Id', 'enemy3Id']) if (config[k]) ids.push(config[k]);
  } else if (config.mp) {
    if (config.mp.enemyId) ids.push(config.mp.enemyId);
  } else if (config.enemyId) {
    ids.push(config.enemyId);
  }
  const list = ids.map(id => {
    const raw   = SKILL_BY_CHAR[id];
    const skill = (raw && raw !== 'reo_copy') ? raw : 'spin'; // 無スキル/玲王同士はスピン
    return { id, skill, name: CHAR_SHORT[id] || id };
  });
  // 敵が取得できない場合でも最低1ボタン（スピン）は出す
  if (list.length === 0) list.push({ id: null, skill: 'spin', name: 'スピン' });
  return list;
}

// 玲王のスキルボタン群を #touch-controls 内に動的生成。非玲王は単一スキルボタン。
function buildReoSkillButtons() {
  const container = document.getElementById('reo-skills');
  const single    = document.getElementById('btn-skill');
  if (!container) return;
  container.innerHTML = '';
  // 表示/非表示は updateMobileButtons() が毎フレーム制御（ボール保持時のみ表示）。
  // ここではボタンの中身だけ構築する。
  if (!isReo()) { container.style.display = 'none'; if (single) single.style.display = ''; return; }

  if (single) single.style.display = 'none';
  container.style.display = 'none'; // 初期は隠す（保持時に updateMobileButtons が flex に）
  reoSkills.forEach((entry, i) => {
    const btn = document.createElement('div');
    btn.className = 'reo-skill-btn';
    btn.innerHTML = `<span class="rs-name">${entry.name}</span><span class="rs-skill">${SKILL_SHORT[entry.skill] || entry.skill}</span>`;
    bindTap(btn, () => useReoSkill(i));
    container.appendChild(btn);
  });
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
  nagiSkillTimer = combo.duration + 0.1;    // モーション中、5m内に入った敵を❗フリーズ
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
//  01: 右へ移動(移動速度2倍) / 02: sprintで正面へ移動(2倍・0.5秒のみ) /
//  03: 普通のカーブシュートのミラー軌道（左へ蹴り出し→右へ曲がる）。
//      ボール軌道にはオレンジの回転する渦巻きエフェクト。
//      地面バウンド時は物理法則を無視して左斜め前へ跳ねる。
const YUKI_BLEND      = 0.1;
const YUKI_SPEED      = 1.8;   // 一連のモーション再生速度（大きいほど速い）
const YUKI_DIST_01    = 3;     // 01(右移動)の移動距離(m)。フェーズ全体で連続移動
const YUKI_DIST_02    = 5;     // 02(前方sprint)の移動距離(m)。フェーズ全体で連続移動
const YUKI_01_DUR     = 0.4;   // 01(右移動)を流す時間（秒）。短めにして繋ぎを軽快に
const YUKI_SPRINT_DUR = 0.45;  // 02(sprint)を流す時間（秒）
const YUKI_PWR        = 1.7;   // カーブシュート相当の威力（charge の power に相当）
const YUKI_BOUNCE_SPD = 14;    // バウンド時の左斜め前への水平速度（物理無視・固定）
const YUKI_BOUNCE_VY  = 5;     // バウンド時の上向き初速
let yukiBounceTimer   = 0;     // >0 の間、最初の地面バウンドで左斜め前へ跳ねさせる
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
  // 01・02は短めにトリム（先頭から）して繋ぎを軽快にする
  if (!clips['yuki01_short']) {
    clips['yuki01_short'] = THREE.AnimationUtils.subclip(c1, 'yuki01_short', 0, Math.round(YUKI_01_DUR * 30), 30);
  }
  if (!clips['yuki02_short']) {
    clips['yuki02_short'] = THREE.AnimationUtils.subclip(c2, 'yuki02_short', 0, Math.round(YUKI_SPRINT_DUR * 30), 30);
  }
  const c1s = clips['yuki01_short'], c2s = clips['yuki02_short'];
  if (!clips['yukimiya_gyro']) buildComboClip('yukimiya_gyro', ['yuki01_short', 'yuki02_short', 'yuki03'], YUKI_BLEND);
  const combo = clips['yukimiya_gyro'];
  if (!combo) { startKick(false, 0, 1.8); return; }

  endSpin();
  isKicking = true;
  fadeToClip('yukimiya_gyro', false);
  mixer.clipAction(clips['yukimiya_gyro']).setEffectiveTimeScale(YUKI_SPEED); // 一連を速く再生
  kickTimer = combo.duration / YUKI_SPEED + 0.1;

  // 各タイミングは再生速度に合わせて短縮（移動距離は固定なので速くなる）
  yukiAngle    = player.rotation.y;
  yukiTotal    = combo.duration / YUKI_SPEED;
  yukiT1       = (c1s.duration + YUKI_BLEND) / YUKI_SPEED;                   // 01→02 切替
  yukiT2       = yukiT1 + (c2s.duration + YUKI_BLEND) / YUKI_SPEED;          // 02→03 切替
  yukiContactT = yukiT2 + Math.min(c3.duration * 0.4, 0.45) / YUKI_SPEED;   // 03の蹴り接触
  yukiTimer    = yukiTotal;
  yukiKicked   = false;
  playerPickupCooldown = yukiTotal + 0.2;
  enemyPickupCooldown  = yukiTotal + 0.2;
  ballOwner = 'none'; isDribbling = false; // ボールは updateYukimiyaSkill が駆動
}

// 雪宮スキルの毎フレーム駆動。01=右移動(2倍)→02=sprintで正面移動(2倍)→03でシュート。
function updateYukimiyaSkill(dt) {
  if (yukiTimer <= 0) return;
  yukiTimer -= dt;
  const e = yukiTotal - yukiTimer;
  player.position.y = groundY;
  const fwd   = new THREE.Vector3(-Math.sin(yukiAngle), 0, -Math.cos(yukiAngle));
  const right = new THREE.Vector3(Math.cos(yukiAngle), 0, -Math.sin(yukiAngle));

  if (e < yukiT1) {
    // 01: 右へ約3m。フェーズ全体で割った一定速度で連続移動（止まらない）
    player.position.addScaledVector(right, (YUKI_DIST_01 / Math.max(0.05, yukiT1)) * dt);
    charClampToField(playerChar);
    yukiHoldBallAtFeet();
  } else if (e < yukiT2) {
    // 02: 正面へ約5m。フェーズ全体で連続移動 → 01からの繋ぎが止まらず自然
    player.position.addScaledVector(fwd, (YUKI_DIST_02 / Math.max(0.05, yukiT2 - yukiT1)) * dt);
    charClampToField(playerChar);
    yukiHoldBallAtFeet();
  } else if (e < yukiContactT) {
    // 03前半: 蹴る直前までボール保持
    yukiHoldBallAtFeet();
  } else if (!yukiKicked) {
    // 03接触: 普通のカーブシュート(右へ蹴り出し→左へ曲がる)のミラー。
    //         左へ蹴り出し → 右へ曲がる。kickBall のカーブ式をミラーで再現。
    yukiKicked = true;
    const pwr       = YUKI_PWR;
    const kickAngle = yukiAngle + Math.PI / 8;        // 左へ蹴り出し（通常は -π/8 のミラー）
    const CURVE_VY  = 11.1;
    const hSpd      = 13 * pwr * ((11 + 4 * pwr) / CURVE_VY);
    const fwd       = new THREE.Vector3(-Math.sin(yukiAngle), 0, -Math.cos(yukiAngle));
    ballOwner = 'none'; isDribbling = false; ballSpin.set(0, 0, 0);
    ballMesh.position.set(player.position.x + fwd.x * 0.5, BALL_R + 0.1, player.position.z + fwd.z * 0.5);
    ballVel.set(-Math.sin(kickAngle) * hSpd, CURVE_VY, -Math.cos(kickAngle) * hSpd);
    ballCurveRate = -1.1;                                       // 右へ曲げる（通常 +1.1 のミラー）
    setBallTrail([0xff7a00, 0xffc04a], THREE.AdditiveBlending); // オレンジの軌道
    yukiSwirling = true; yukiSwirlT = 0; yukiSwirlPhase = 0;    // 渦巻きエフェクト開始
    yukiBounceTimer = 3.0;                                      // 次の地面バウンドで左斜め前へ跳ねる
  }
}

// ── オレンジの回転渦巻きエフェクト（飛行中、ボール周りを回転しながら粒子を出す）──
function spawnYukiSwirlParticle(pos, color) {
  if (isReo()) color = REO_FX1; // 玲王のコピー時は紫の渦巻き
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.085 + Math.random() * 0.05, 6, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.position.copy(pos);
  scene.add(mesh);
  yukiSwirl.push({ mesh, life: 0, maxLife: 0.32 + Math.random() * 0.12 });
}
function updateYukimiyaSwirl(dt) {
  if (yukiBounceTimer > 0) yukiBounceTimer -= dt; // バウンド反転の有効時間（毎フレーム減衰）
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
const BAROU_POWER    = 56;   // 強烈な水平初速（威力大幅アップ）
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
    ballVel.set(-Math.sin(kickAngle) * BAROU_POWER, 8, -Math.cos(kickAngle) * BAROU_POWER);
    ballCurveRate = playerFootSign * BAROU_CURVE; // 控えめなカーブ
    setBallTrail([0xcc1111, 0x0a0a0a], THREE.NormalBlending); // 赤黒の軌道
    barouBallFxTimer = 1.8; // 飛行中の軌道に赤黒イナズマを走らせる
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

// 糸師冴: フロー状態。発動から10秒間、移動速度がわずかに上がり・ボール奪取不可・
// ピンクのネオン数字が残像のように舞う（専用モーションは無し＝通常ドリブルのまま）。
const SAE_FLOW_DURATION = 10.0;
const SAE_SPEED_MULT    = 1.25; // 「気持ち速くなる」程度（千切の2.0より控えめ）
function saeFlow() {
  if (ballOwner !== 'player' || saeSkillTimer > 0) return;
  saeSkillTimer = SAE_FLOW_DURATION;
}

// 糸師冴フロー中のシュート: 攻撃側ゴールの「左隅」へ誘導する高速バナナシュート。
// 初速はゴール中央寄りに撃ち出し、飛行中に左隅へ巻き込む（ballLoosePhysicsで誘導）。
const SAE_SHOT_HSPD = 30;   // 水平初速(m/s)
const SAE_SHOT_VY   = 6;    // 打ち出しの上向き初速（以降は誘導でvyを上書き）
const SAE_SHOT_LOCK = 3.5;  // 左隅へ向く追従の強さ（大きいほど速く向く＝カーブがきつい）
const SAE_CORNER_Z  = 0.82; // ゴール左隅のz位置（×GOAL_HALF_Z, ポストの少し内側）
const SAE_CORNER_Y  = 0.7;  // 左隅の高さ(m)（低い隅を狙う）
function saeCurveShot() {
  // プレイヤーが攻めるゴール（ソロ/MPホスト=+X / MPゲスト=-X）
  const atkX     = (isMultiplayer && mpRole === 'guest') ? -GOAL_X : GOAL_X;
  const leftSign = atkX > 0 ? -1 : 1; // 進行方向から見た左（+X攻め=-Z / -X攻め=+Z）
  saeShotTarget.set(atkX, SAE_CORNER_Y, leftSign * GOAL_HALF_Z * SAE_CORNER_Z);

  // 初速はゴール中央(z=0)方向へ撃ち出す → 飛行中に左隅へ巻き込まれてカーブに見える。
  const a0 = Math.atan2(atkX - ballMesh.position.x, 0 - ballMesh.position.z);
  ballVel.set(Math.sin(a0) * SAE_SHOT_HSPD, SAE_SHOT_VY, Math.cos(a0) * SAE_SHOT_HSPD);
  ballCurveRate = 0;        // マグナスは使わず誘導でカーブさせる
  ballSpin.set(0, 0, 0);
  isDribbling   = false;
  ballOwner     = 'none';
  kickBallFollow = false;
  saeShotActive = true;
  setBallTrail(SAE_TRAIL_COLORS, THREE.AdditiveBlending); // ピンクの軌道
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

// 凪フェイクボレー: モーション中、5m内に入った敵を❗マークでフリーズし続ける。
// 範囲に入った瞬間にだけ❗を出し（マーク多重生成防止）、残りモーション時間ぶん固める。
const NAGI_FREEZE_RAD = 5;
function updateNagiFreeze(dt) {
  if (nagiSkillTimer <= 0) return;
  nagiSkillTimer -= dt;
  const remain = nagiSkillTimer;
  if (remain <= 0) return;
  if (mode2v2) {
    for (const c of cpu2List) {
      if (c.team !== 'B') continue; // 敵チームのみ
      if (distXZ(c.group.position, player.position) >= NAGI_FREEZE_RAD) continue;
      if (c.stun < 0.05) spawnStunMark(c.group, remain, _exclaimTexture); // 新規凍結時だけ❗
      c.stun = Math.max(c.stun, remain);
    }
  } else if (hasEnemy && enemy) {
    if (distXZ(enemy.position, player.position) < NAGI_FREEZE_RAD) {
      if (enemyStunTimer < 0.05) spawnStunMark(enemy, remain, _exclaimTexture);
      enemyStunTimer = Math.max(enemyStunTimer, remain);
    }
  }
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
    || bachiraSkillTimer > 0 || chigiriBoostTimer > 0 || shidouJumpTimer > 0
    || saeSkillTimer > 0;
}
// スキルモーション中はボールを奪われない（隙をなくす）。ボール保持に関わる
// スキル状態のみ（パス=手放す/タックル=非保持 は含めない）。
function playerSkillBusy() {
  return isSpinning || isKicking
    || chigiriBoostTimer > 0 || bachiraSkillTimer > 0
    || shidouJumpTimer > 0 || barouSkillTimer > 0 || saeSkillTimer > 0;
}
function enemyInSkill() { return enemyKicking || enemyTackling; }
function cpu2InSkill(c) { return c.kicking || c.passing || c.tackling || c.oneShotTimer > 0; }

function collidersThisFrame() {
  const list = [];
  list.push({ g: player, solid: !playerInSkill(), movable: true });
  if (mode2v2) {
    for (const c of cpu2List) list.push({ g: c.group, solid: !cpu2InSkill(c), movable: true });
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

  // キックオフ・ホールド中: 味方(プレイヤー)のアクション待ち。敵は速攻せず待機。
  if (kickoffHold) { charAnim(enemyChar, 'idle'); charClampToField(enemyChar); return; }

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

// ── リアル対戦(1v1): ホスト権威モデル ───────────────────────────────────
// 計算(所有権・物理・ゴール)は全て Host が行い、Guest は入力送信＋描画のみ。
// これで「両者が所有権を計算して取れる/取れないが食い違う」競合を根絶する。
//  - Host : 自分とゲスト(remotePeer)の位置/タックル/スキル/キックから所有権を決定し、
//           ボール物理を回し、owner と ボール位置を配信する。
//  - Guest: 自分の位置/タックル/スキル/キックを送り、Host のボールを描画する。
//           自分が保持中は足元にボールを置き（即応）、発射時はキックを Host へ転送。
function updateMultiplayerBall(dt) {
  if (!gameStarted || goalCapture || isGoalScene) return;
  if (gkBallHolder !== 'none') { isDribbling = false; return; }
  if (mpRole === 'host') updateMpHost(dt);
  else                   updateMpGuest(dt);
}

// Host: 全計算。ballOwner は Host視点（'player'=Host保持 / 'enemy'=Guest保持 / 'none'=ルーズ）。
function updateMpHost(dt) {
  if (playerPickupCooldown > 0) playerPickupCooldown -= dt;
  if (enemyPickupCooldown  > 0) enemyPickupCooldown  -= dt;

  // Host自身の千切/蜂楽/糸師冴スキル中は保持し続ける（奪われない）
  if ((chigiriBoostTimer > 0 || bachiraSkillTimer > 0 || saeSkillTimer > 0) && !isKicking) {
    ballOwner = 'player'; isDribbling = true; charDribble(playerChar, dt); mpCheckGoal(); return;
  }

  const TACKLE_DIST = 1.8;
  const distHost  = distXZ(ballMesh.position, player.position);
  const distGuest = distXZ(ballMesh.position, remotePeer.position);

  if (ballOwner === 'player') {
    // Host保持: ゲストのタックルで奪われる / 手放し・シュートでルーズへ
    if (remoteTackling && distGuest < TACKLE_DIST && !playerSkillBusy()) {
      ballOwner = 'enemy'; playerPickupCooldown = 0.5; enemyPickupCooldown = 0;
    } else if (distHost >= DRIBBLE_DIST * 1.6 || (isKicking && !isPassing && !kickBallFollow)) {
      ballOwner = 'none';
    }
  } else if (ballOwner === 'enemy') {
    // Guest保持: Hostのタックルで奪う / ゲストが大きく離したらルーズへ
    // （ゲストのキックは applyGuestKick が owner='none' にする）
    if (isTackling && distGuest < TACKLE_DIST && !remoteSkillBusy) {
      ballOwner = 'player'; enemyPickupCooldown = 0.5; playerPickupCooldown = 0;
    } else if (distGuest >= DRIBBLE_DIST * 1.8) {
      ballOwner = 'none';
    }
  } else {
    // ルーズ: Host が物理を回し、近接した方が拾う
    ballLoosePhysics(dt);
    if      (distHost  < DRIBBLE_DIST && !isKicking && playerPickupCooldown <= 0) ballOwner = 'player';
    else if (distGuest < DRIBBLE_DIST && enemyPickupCooldown <= 0)                ballOwner = 'enemy';
  }

  // ボール配置
  if (ballOwner === 'player') {
    isDribbling = true; charDribble(playerChar, dt); mpRollBallWithPlayer(dt);
  } else if (ballOwner === 'enemy') {
    isDribbling = false; placeBallAtRemoteFeet();
  } else {
    isDribbling = false;
  }

  mpCheckGoal();
}

// Guest: 計算しない。Host の owner に従いボールを描画。自分の保持は足元予測＝即応。
function updateMpGuest(dt) {
  const owner = mpRemoteBallOwner; // 'host'|'guest'|'none'（Hostが配信した所有者）

  if (mpGuestPredict) {
    // 自分の発射をクライアント予測中。Host が発射を認識(owner!=='guest')したら同期。
    ballOwner = 'none'; isDribbling = false;
    ballLoosePhysics(dt);
    if (owner !== 'guest') { mpGuestPredict = false; mpPendingKick = null; applyHostBall(dt); }
    return;
  }

  if (owner === 'guest') {
    // 自分が保持。発射(高速 ballVel)を検出したら Host へキック転送＆予測開始。
    if (ballVel.lengthSq() > 4) {
      queueGuestKick();
      mpGuestPredict = true; ballOwner = 'none'; isDribbling = false;
      return;
    }
    ballOwner = 'player'; isDribbling = true;
    charDribble(playerChar, dt); mpRollBallWithPlayer(dt);
  } else if (owner === 'host') {
    ballOwner = 'enemy'; isDribbling = false; applyHostBall(dt);
  } else {
    ballOwner = 'none'; isDribbling = false; applyHostBall(dt);
  }
}

// 受信した Host のボール状態へ寄せる（カクつき防止に軽く lerp）。
function applyHostBall(dt) {
  const bs = ballBuf.length ? ballBuf[ballBuf.length - 1] : null;
  if (!bs) return;
  ballMesh.position.x += (bs.x - ballMesh.position.x) * Math.min(1, 25 * dt);
  ballMesh.position.y += (bs.y - ballMesh.position.y) * Math.min(1, 25 * dt);
  ballMesh.position.z += (bs.z - ballMesh.position.z) * Math.min(1, 25 * dt);
  ballVel.set(bs.vx ?? 0, bs.vy ?? 0, bs.vz ?? 0);
}

// ボールを相手(remotePeer)の足元へ（Host がゲスト保持を描画するとき）。
function placeBallAtRemoteFeet() {
  const f = new THREE.Vector3(-Math.sin(remotePeer.rotation.y), 0, -Math.cos(remotePeer.rotation.y));
  ballMesh.position.set(
    remotePeer.position.x + f.x * DRIBBLE_OFFSET, BALL_R,
    remotePeer.position.z + f.z * DRIBBLE_OFFSET);
  ballVel.set(0, 0, 0);
}

// 自分のドリブル中、進行方向にボールを転がす回転（見た目）。
function mpRollBallWithPlayer(dt) {
  const moving = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('ArrowDown') || keys.has('KeyS')
              || keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('ArrowRight') || keys.has('KeyD')
              || joystick.active;
  if (!moving) return;
  const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
  ballMesh.rotateOnWorldAxis(new THREE.Vector3(facing.z, 0, -facing.x), RUN_SPEED * dt / BALL_R);
}

// Guest: 自分の発射(キック/パス/スキルシュート)を Host へ転送するキューに積む。
function queueGuestKick() {
  mpKickSeq++;
  mpPendingKick = {
    seq: mpKickSeq,
    x: ballMesh.position.x, y: ballMesh.position.y, z: ballMesh.position.z,
    vx: ballVel.x, vy: ballVel.y, vz: ballVel.z, cr: ballCurveRate,
  };
}

// Host: ゲストから受け取ったキックを適用してボールをルーズ発射する。
function applyGuestKick(k) {
  if (!k || k.seq <= mpLastKickSeq) return;
  mpLastKickSeq = k.seq;
  ballMesh.position.set(k.x, k.y, k.z);
  ballVel.set(k.vx, k.vy, k.vz);
  ballCurveRate = k.cr || 0;
  ballOwner = 'none'; isDribbling = false;
  enemyPickupCooldown = 0.4; // ゲストが自分の発射を即回収しないように
}

// Host専用: 同期済みボール位置からゴールを判定（+X=Host得点 / -X=Guest得点）
function mpCheckGoal() {
  if (isGoalScene) return;
  const inZ = Math.abs(ballMesh.position.z) < GOAL_HALF_Z;
  const inY = ballMesh.position.y < 2.44 + BALL_R;
  if (!inZ || !inY) return;
  if      (ballMesh.position.x >  GOAL_X) scoreGoal('player');
  else if (ballMesh.position.x < -GOAL_X) scoreGoal('cpu');
}

function updateBall(dt) {
  if (!gameStarted) return;
  if (goalCapture) return;  // ゴール捕捉中は updateGoalCapture がボールを駆動
  if (isGoalScene) return; // ゴールシーン中は物理停止
  if (gkBallHolder !== 'none') { isDribbling = false; return; }
  // 千切ブースト/蜂楽/糸師冴スキル中は奪われず保持し続ける（シュート中は除く）
  if ((chigiriBoostTimer > 0 || bachiraSkillTimer > 0 || saeSkillTimer > 0) && !isKicking) {
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
    if (ballOwner === 'player' && (distPlayer >= DRIBBLE_DIST * 1.5 || (isKicking && !isPassing && !kickBallFollow))) ballOwner = 'none';
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
  // 糸師冴の誘導カーブシュート: 水平はゴール左隅へ向き続け、垂直は左隅の高さへ到達
  // するようvyを毎フレーム解く（＝どこから撃ってもほぼ確実に左隅へ巻き込む）。
  if (saeShotActive && ballOwner === 'none') {
    const dx  = saeShotTarget.x - ballMesh.position.x;
    const dz  = saeShotTarget.z - ballMesh.position.z;
    const dxz = Math.hypot(dx, dz);
    const hSpd = Math.hypot(ballVel.x, ballVel.z) || SAE_SHOT_HSPD;
    // 水平: 現在の進行角を左隅方向へ指数追従（初速の中央向きから巻き込む＝カーブ）
    const curAng = Math.atan2(ballVel.x, ballVel.z);
    const tgtAng = Math.atan2(dx, dz);
    let dA = tgtAng - curAng;
    while (dA >  Math.PI) dA -= 2 * Math.PI;
    while (dA < -Math.PI) dA += 2 * Math.PI;
    const na = curAng + dA * Math.min(1, SAE_SHOT_LOCK * dt);
    ballVel.x = Math.sin(na) * hSpd;
    ballVel.z = Math.cos(na) * hSpd;
    // 垂直: 残り時間で左隅の高さに着くようvyを設定（重力ぶんを補正）
    const t = Math.max(0.05, dxz / hSpd);
    ballVel.y = (saeShotTarget.y - ballMesh.position.y + 0.5 * BALL_GRAVITY * t * t) / t;
    // ゴールラインを越えた/十分近づいたら誘導終了（以降は通常物理）
    if (Math.abs(ballMesh.position.x) >= Math.abs(saeShotTarget.x) - 0.2 || dxz < 0.6) saeShotActive = false;
  }
  // カーブ: 空中で水平速度ベクトルを回転させてバナナ軌道（マグナス効果）
  else if (ballCurveRate !== 0 && ballMesh.position.y > BALL_R + 0.05) {
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
    const bounced = ballVel.y < -0.5;
    ballVel.y = bounced ? ballVel.y * -BALL_BOUNCE : 0;
    ballCurveRate = 0; // 着地でカーブ終了
    saeShotActive = false; // 着地で誘導終了（以降は通常のルーズボール）
    // 雪宮スキル: 最初の地面バウンドで物理法則を無視して左斜め前へ跳ねる（固定ベクトル）
    if (bounced && yukiBounceTimer > 0) {
      const flx = -Math.sin(yukiAngle) - Math.cos(yukiAngle); // sFwd.x + sLeft.x（左斜め前）
      const flz = -Math.cos(yukiAngle) + Math.sin(yukiAngle); // sFwd.z + sLeft.z
      const fl  = Math.hypot(flx, flz) || 1;
      ballVel.x = (flx / fl) * YUKI_BOUNCE_SPD;
      ballVel.z = (flz / fl) * YUKI_BOUNCE_SPD;
      ballVel.y = YUKI_BOUNCE_VY; // 軽く上へ跳ねる
      yukiBounceTimer = 0;
    }
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
    // MPでは得点処理は Host の mpCheckGoal が一元担当（Guest権威時の視点反転バグ防止）。
    // ここでは return でボールをゴール口に留める（貫通防止）だけ行う。
    if      (ballMesh.position.x >  GOAL_X) { if (isPK) pkResolve('goal'); else if (!isMultiplayer) scoreGoal('player'); return; }
    else if (ballMesh.position.x < -GOAL_X) { if (!isPK && !isMultiplayer) scoreGoal('cpu'); return; }
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

  // V: 没入カメラ切替（凍結中でも有効にしたいのでガード前に処理）
  if (gameStarted && e.code === 'KeyV' && !e.repeat) { toggleImmersiveCam(); return; }

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
    // 玲王: 数字キー1..Nで敵キャラ分のスキルを使い分け
    if (isReo() && /^Digit[1-9]$/.test(e.code)) {
      useReoSkill(parseInt(e.code.slice(5), 10) - 1);
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
// ── キックオフ・ホールド（ゴール後の再開時、味方のアクションを待ってからCPUが動く）──
let kickoffHold      = false;     // true中はCPU敵が速攻せずキックオフ位置で待機
let kickoffHoldTimer = 0;         // 自動解除までの猶予（味方が動かない場合の保険）
const KICKOFF_GRACE  = 10.0;      // 何も操作が無くてもこの秒数で自動的に再開
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
const ally2Anim = {
  get mixer()   { return ally2Mixer; },   set mixer(v)   { ally2Mixer = v; },
  get current() { return ally2Current; }, set current(v) { ally2Current = v; },
};
const enemy2Anim = {
  get mixer()   { return enemy2Mixer; },   set mixer(v)   { enemy2Mixer = v; },
  get current() { return enemy2Current; }, set current(v) { enemy2Current = v; },
};
const enemy3Anim = {
  get mixer()   { return enemy3Mixer; },   set mixer(v)   { enemy3Mixer = v; },
  get current() { return enemy3Current; }, set current(v) { enemy3Current = v; },
};
allyChar.animState   = allyAnim;
ally2Char.animState  = ally2Anim;
enemy2Char.animState = enemy2Anim;
enemy3Char.animState = enemy3Anim;
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
  anim.currentName = name; // リアル対戦で相手に「今再生中のクリップ名」を同期するため
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
// 没入カメラ切替ボタン（PC/スマホ共通・キーボードは V）
bindTap(document.getElementById('btn-cam'), toggleImmersiveCam);
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
  remoteTackling = false; remoteSkillBusy = false;
  mpGuestPredict = false; mpPendingKick = null;
  peerBuf.length = 0;
  ballBuf.length = 0;

  // 失点側がボールを持ってリスタート。所有権の真実は Host が決める。
  //  Host視点 ballOwner: 'player'=Host保持 / 'enemy'=Guest保持。
  //  mpGoalScorer = 得点したロール。失点側 = mpGoalScorer の逆。
  if (mpRole === 'host') {
    ballOwner = (mpGoalScorer === 'host') ? 'enemy' : 'player'; // Hostが得点=Guest失点=Guest保持
  }
  // Guest は ballOwner を Host の配信(owner)に従わせる（ここでは none のまま）。

  isDribbling = isKicking = isPassing = isTackling = isSpinning = false;
  spinTimer = tackleTimer = kickTimer = 0;
  tackleLungeTimer = playerStunTimer = enemyStunTimer = enemyTackleTimer = 0;
  skillSession++; // 保留中スキルtimeoutを無効化
  chigiriBoostTimer = 0;
  saeSkillTimer = 0;
  bachiraSkillTimer = 0; nagiSkillTimer = 0;
  barouSkillTimer = 0; barouBallFxTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false; yukiBounceTimer = 0;
  resetBallTrail();
  clearStunMarks();
  playerPickupCooldown = 0;
  if (mixer)           { mixer.stopAllAction(); current = null; }
  if (remotePeerMixer) { remotePeerMixer.stopAllAction(); remotePeerClipAct = {}; remoteLastAnim = null; }
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
  saeSkillTimer = 0;
  bachiraSkillTimer = 0; nagiSkillTimer = 0;
  barouSkillTimer = 0; barouBallFxTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false; yukiBounceTimer = 0;
  resetBallTrail();
  clearStunMarks();
  playerPickupCooldown = 0;

  // キックオフ・ホールド: 自分(プレイヤー)ボールの時だけCPUを待機させる。
  // 相手ボール(CPUキックオフ)の時は待機なしで即開始。
  // scorer==='cpu' = プレイヤー失点 → プレイヤーがキックオフ。
  kickoffHold = (scorer === 'cpu');
  kickoffHoldTimer = KICKOFF_GRACE;
  if (kickoffHold) showKickoff(); else hideKickoff();

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
      const mx = c.char.animState.mixer; if (mx) { mx.stopAllAction(); c.char.animState.current = null; }
      c.group.position.set(c.homeX ?? 0, groundY, c.homeZ ?? 0);
      c.group.rotation.y = c.homeRy ?? Math.PI / 2;
    }
    if (scorer === 'cpu') {
      // プレイヤー失点 → プレイヤーチームがキックオフ（プレイヤー保持）
      player.position.set(0, groundY, 0); player.rotation.y = -Math.PI / 2;
      ballOwner = 'player'; isDribbling = true;
    } else {
      // CPU失点 → 敵チームがキックオフ（敵#1保持）
      player.position.set(-8, groundY, 5); player.rotation.y = -Math.PI / 2;
      const carrier = cpu2List.find(c => c.team === 'B');
      if (carrier) { carrier.group.position.set(0, groundY, 0); ballOwner = carrier.key; }
      isDribbling = false;
    }
    ballMesh.position.set(0, BALL_R, 0);
    for (const c of cpu2List) charAnim(c.char, 'idle');
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
  saeSkillTimer = 0;
  bachiraSkillTimer = 0; nagiSkillTimer = 0;
  barouSkillTimer = 0; barouBallFxTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false; yukiBounceTimer = 0;
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

// オブジェクト（キャラFBX）の現在の最下点yをワールドで測る。スキンメッシュは
// 現在のボーン姿勢を反映した bounding box を使う（バインドポーズではなく実描画姿勢）。
function measureMinY(obj) {
  obj.updateMatrixWorld(true);
  let minY = Infinity;
  obj.traverse(c => {
    if (!c.isMesh || !c.geometry) return;
    if (c.isSkinnedMesh && typeof c.computeBoundingBox === 'function') c.computeBoundingBox();
    else c.geometry.computeBoundingBox();
    const bb = (c.isSkinnedMesh && c.boundingBox) ? c.boundingBox : c.geometry.boundingBox;
    if (!bb) return;
    const b = bb.clone().applyMatrix4(c.matrixWorld);
    if (b.min.y < minY) minY = b.min.y;
  });
  return minY;
}

// キャラの足元を、自身の親グループ内ローカル原点(y=0)へ接地する。
// （親グループの position.y を 0 に置けば足が地面に乗る）
function groundCharLocal(fbx) {
  const minY = measureMinY(fbx);
  if (isFinite(minY) && Math.abs(minY) > 0.001) fbx.position.y -= minY;
}

// FBXの単位系がキャラごとに異なる（Meshy AI出力等で固定0.01だとサイズ不正）。
// 実寸の身長を測り1.75mに正規化し、足元をローカル原点(y=0)へ接地する共通処理。
// 標準的な約175単位モデルは 1.75/175=0.01 となり従来のサイズと一致する。
function fitCharFbx(fbx) {
  fbx.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(fbx);
  const rawH   = rawBox.max.y - rawBox.min.y;
  fbx.scale.setScalar(rawH > 0.01 ? (1.75 / rawH) : 0.01);
  groundCharLocal(fbx);
}

// プレイヤーキャラを idle ポーズで再接地する。バインドポーズ(T-pose)と実際の
// アニメ姿勢で足位置がズレるキャラ（糸師冴等）が地面に埋まる/浮くのを防ぐ。
// 全アニメ読込後（clips['idle']が利用可能）に1度だけ呼ぶ。
function groundPlayerToIdle() {
  if (!mixer || !character) return;
  if (clips['idle']) {
    const act = mixer.clipAction(clips['idle']);
    act.reset(); act.play();
    mixer.update(0); // 0秒進めて idle 1フレーム目の姿勢を確定
  }
  groundCharLocal(character);
}

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
  //  01=右移動 / 02=sprint前方(0.5sのみ) / 03=シュート
  ['yuki01', './キャラ/雪宮的なキャラ/Skill/ジャイロシュート/01_右移動.fbx'],
  ['yuki02', './キャラ/雪宮的なキャラ/Skill/ジャイロシュート/02_sprint前方.fbx'],
  ['yuki03', './キャラ/雪宮的なキャラ/Skill/ジャイロシュート/03_シュート.fbx'],
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
let remoteLastAnim    = null; // 相手の現在再生中クリップ名（再トリガ防止）
let mpTimer              = 0;
let gameWatcher          = null;
let mpRemoteBallOwner    = 'none'; // Hostが配信した所有者 'host' | 'guest' | 'none'
let mpGoalScorer         = null;   // 直前のゴールを決めたロール ('host'|'guest')
let lastGoalSeq          = 0;     // ゴールイベント重複処理防止
// ── リアル対戦: ホスト権威モデル ───────────────────────────────────
// 計算は全て Host。Guest は入力(位置/タックル/スキル/キック)送信＋描画のみ。
let remoteTackling       = false;  // 相手のタックル中フラグ（Hostが奪取判定に使用）
let remoteSkillBusy      = false;  // 相手がスキルモーション中か（奪取不可判定）
let mpKickSeq            = 0;      // Guest: 自分の発射の連番（Hostへ転送）
let mpLastKickSeq        = 0;      // Host: 処理済みのゲストキック連番
let mpPendingKick        = null;   // Guest: 送信中のキックペイロード
let mpGuestPredict       = false;  // Guest: 自分の発射をクライアント予測中か

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

// ループ再生するクリップ（これら以外は一回再生＝kick/pass/tackle/spin/スキル）
const REMOTE_LOOP_ANIMS = new Set(['idle', 'run', 'dribble', 'chigiri_run']);
function fadeToRemoteClip(name) {
  if (!remotePeerMixer || !clips[name]) return;
  if (name === remoteLastAnim) return; // 同じクリップが連続で来ても再トリガしない
  remoteLastAnim = name;
  const loop = REMOTE_LOOP_ANIMS.has(name);
  const act = remotePeerClipAct[name]
    ?? (remotePeerClipAct[name] = remotePeerMixer.clipAction(clips[name]));
  act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  act.clampWhenFinished = !loop;
  Object.values(remotePeerClipAct).forEach(a => { if (a !== act) a.fadeOut(0.15); });
  act.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play();
}

function onCoreLoaded() {
  coreReady++;
  const pct = Math.round((coreReady / CORE_TOTAL) * 100);
  loadingBar.style.width = pct + '%';
  if (coreReady === CORE_TOTAL) {
    // 全アニメ読込後に idle ポーズで足元を正確に接地（埋まり/浮きを補正）
    groundPlayerToIdle();
    if (hasEnemy) { enemy.position.y = groundY; enemy.visible = true; }
    if (mode2v2) {
      for (const c of cpu2List) { c.group.position.y = groundY; c.group.visible = true; }
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
        if (remote) {
          pushPeerBuf(remote);
          remoteTackling  = !!remote.tackling;
          remoteSkillBusy = !!remote.skillBusy;
          // Host: ゲストの発射(キック)を受け取りボールをルーズ発射
          if (mpRole === 'host' && remote.kick) applyGuestKick(remote.kick);
        }
        if (data?.ball) {
          pushBallBuf(data.ball);
          // owner は Host が配信する唯一の真実。Guest はこれに従う。
          if (mpRole === 'guest') mpRemoteBallOwner = data.ball.owner ?? 'none';
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
    const camBtn = document.getElementById('btn-cam');
    if (camBtn) camBtn.style.display = 'flex';
    setImmersiveCam(immersiveCam); // ボタンの表示(ON/OFF・色)を現在状態に同期
    fadeToClip('idle');
    if (hasEnemy) fadeToEnemyClip('idle');
    if (mode2v2) { for (const c of cpu2List) charAnim(c.char, 'idle'); }
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
  reoSkills   = computeReoSkills(config); // 玲王: その試合の敵キャラ分のスキルボタン
  buildReoSkillButtons();

  skillSession++; // 前ゲームの保留中スキルtimeoutを無効化
  chigiriBoostTimer = 0;
  saeSkillTimer = 0;
  bachiraSkillTimer = 0; nagiSkillTimer = 0;
  barouSkillTimer = 0; barouBallFxTimer = 0;
  shidouJumpTimer = 0;
  yukiTimer = 0; yukiSwirling = false; yukiBounceTimer = 0;
  kickoffHold = false; kickoffHoldTimer = 0; hideKickoff();
  resetBallTrail();
  clearCharFx();
  cancelCharge();
  // ── 前ゲームの残骸を全てクリア ────────────────────────────────────
  // player の旧キャラ削除
  while (player.children.length > 0) player.remove(player.children[0]);
  // remotePeer の旧キャラ削除
  while (remotePeer.children.length > 0) remotePeer.remove(remotePeer.children[0]);
  scene.remove(remotePeer);
  remotePeerMixer = null; remotePeerClipAct = {}; remoteLastAnim = null;
  // enemy を scene から除去（CPU戦の残骸防止）
  scene.remove(enemy);
  while (enemy.children.length > 0) enemy.remove(enemy.children[0]);
  // チーム戦CPU(味方・敵 追加分)を除去＋状態リセット
  for (const g of [ally, ally2, enemy2, enemy3]) { scene.remove(g); while (g.children.length > 0) g.remove(g.children[0]); }
  allyMixer = allyCurrent = null;   ally2Mixer = ally2Current = null;
  enemy2Mixer = enemy2Current = null; enemy3Mixer = enemy3Current = null;
  // 共通関数が参照する group / animState を結線
  allyChar.group  = ally;   allyChar.animState   = allyAnim;
  ally2Char.group = ally2;  ally2Char.animState  = ally2Anim;
  enemy2Char.group = enemy2; enemy2Char.animState = enemy2Anim;
  enemy3Char.group = enemy3; enemy3Char.animState = enemy3Anim;
  enemyChar.group = enemy;   enemyChar.animState  = enemyAnim;
  passState = null;
  mode2v2 = !isPK && !config.mp && (!!config.mode2v2 || !!config.mode3v3);
  teamSize = config.mode3v3 ? 3 : 2;
  rebuildCpu2List();
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
  remoteTackling = false; remoteSkillBusy = false;
  mpKickSeq = 0; mpLastKickSeq = 0; mpPendingKick = null; mpGuestPredict = false;
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
    // キックオフ: 中央ルーズボール。Host が物理を回し先に触れた方が拾う。
    CORE_TOTAL++;  // リモートキャラ読み込み分
    // リモートプレイヤーのキャラ読み込み
    loader.load(
      config.mp.remoteCharFbx,
      fbx => {
        fbx.rotation.y = Math.PI;
        fitCharFbx(fbx);
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
      // スケール自動計算: FBXの単位系がキャラごとに異なる（Meshy AI出力など）ため、
      // 固定0.01ではサイズが不正になる（糸師冴等が極端に小さくなる）。実寸の身長を
      // 測って1.75mに正規化する。標準的な約175単位のモデルは 1.75/175=0.01 で従来同等。
      character.scale.setScalar(1);
      player.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(character);
      const rawH   = rawBox.max.y - rawBox.min.y;
      character.scale.setScalar(rawH > 0.01 ? (1.75 / rawH) : 0.01);
      // 暫定接地: T-poseの足元を player グループ内のローカル原点(y=0)へ。
      // 正確な接地は全アニメ読込後に idle ポーズで再計測する（groundPlayerToIdle）。
      groundCharLocal(character);
      groundY = 0; // 足元はキャラ内部で原点に揃えるため、地面の基準は常に0
      player.position.y = 0;
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
        fbx.rotation.y = Math.PI;
        fitCharFbx(fbx);
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

  // ── チーム戦(2vs2/3vs3): 味方CPU＋敵CPUをロード ──────────────────────
  if (mode2v2) {
    const HD = FIELD_HALF_D, AF = config.charFbx;
    // ロスター: {e:entity, a:anim, fbx, tint, sx, sz, mk:marker, zoneZ}
    const roster = teamSize >= 3 ? [
      { e: c2Ally,   a: allyAnim,   fbx: config.allyFbx   || AF, tint: 0x4488ff, sx: -8, sz: -10, mk: 0x44aaff, zoneZ:  HD * 0.45 },
      { e: c2Ally2,  a: ally2Anim,  fbx: config.ally2Fbx  || AF, tint: 0x4488ff, sx: -8, sz:  10, mk: 0x44aaff, zoneZ: -HD * 0.45 },
      { e: c2Enemy,  a: enemyAnim,  fbx: config.enemy1Fbx || AF, tint: 0xff4444, sx:  8, sz:  10, mk: 0xff2222, zoneZ:  HD * 0.45 },
      { e: c2Enemy2, a: enemy2Anim, fbx: config.enemy2Fbx || AF, tint: 0xff4444, sx:  8, sz:   0, mk: 0xff2222, zoneZ:  0 },
      { e: c2Enemy3, a: enemy3Anim, fbx: config.enemy3Fbx || AF, tint: 0xff4444, sx:  8, sz: -10, mk: 0xff2222, zoneZ: -HD * 0.45 },
    ] : [
      { e: c2Ally,   a: allyAnim,   fbx: config.allyFbx   || AF, tint: 0x4488ff, sx: -8, sz: -7, mk: 0x44aaff, zoneZ: 0 },
      { e: c2Enemy,  a: enemyAnim,  fbx: config.enemy1Fbx || AF, tint: 0xff4444, sx:  8, sz:  7, mk: 0xff2222, zoneZ:  HD * 0.35 },
      { e: c2Enemy2, a: enemy2Anim, fbx: config.enemy2Fbx || AF, tint: 0xff4444, sx:  8, sz: -7, mk: 0xff2222, zoneZ: -HD * 0.35 },
    ];
    CORE_TOTAL += roster.length;
    for (const r of roster) {
      r.e.zoneZ = r.zoneZ;
      r.e.homeX = r.sx; r.e.homeZ = r.sz;
      r.e.homeRy = r.e.team === 'A' ? -Math.PI / 2 : Math.PI / 2;
    }
    const loadCpu2 = (group, animProxy, path, tint, sx, sz, markerColor) => {
      loader.load(path, fbx => {
        fbx.rotation.y = Math.PI;
        fitCharFbx(fbx);
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
    for (const r of roster) loadCpu2(r.e.group, r.a, r.fbx, r.tint, r.sx, r.sz, r.mk);
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
// シュート/パスのモーション中の「滑り(グライド)」: 急停止せず減速しながら進む
const KICK_GLIDE_MAX  = 0.9;  // 開始時の速度（RUN_SPEED比）。高めで初速の急落を防ぐ
let kickGlide = 0;            // 0..1。シュート/パス開始時に1（移動入力時のみ）→減衰
let kickGlideTime = 0.5;     // グライドが0へ減衰する秒数（=キック/パス硬直の長さ）
// 通常シュートの振りかぶり中はボールを足元に保持（追従）し、接触フレームで蹴り出す。
// これがないとグライドで前進した分ボールが置き去りになる。kickBall発射でfalse。
let kickBallFollow = false;
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

// ── 没入カメラ ────────────────────────────────────────────────────────────
// 通常: 高く真上気味の俯瞰。没入: 低く浅い入射角で、プレイヤーの全身が映る
// ギリギリまで寄りつつ、進行方向(=敵ゴール)が視野に入る。
// tgtY を上げると視線が前方へ倒れ、遠くのゴールがフレームに入る。
const CAM_NORMAL    = { h: 8,   dist: 16,   tgtY: 1.2 };
const CAM_IMMERSIVE = { h: 1.8, dist: 7.2, tgtY: 2.0 };
let immersiveCam = true; // デフォルトで没入モードON
const camRig = { ...CAM_IMMERSIVE }; // 補間中のカメラ姿勢（プリセット間を滑らかに遷移）。初期は没入

function setImmersiveCam(on) {
  immersiveCam = !!on;
  const btn = document.getElementById('btn-cam');
  if (btn) {
    btn.classList.toggle('active', immersiveCam);
    btn.textContent = immersiveCam ? '没入ON' : '没入OFF';
  }
}
function toggleImmersiveCam() { setImmersiveCam(!immersiveCam); }
window._toggleImmersiveCam = toggleImmersiveCam;

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
// 糸師冴の誘導シュート用: 鮮ピンク→マゼンタ→白ピンクを巡回させ、光るネオンの筋に。
const SAE_TRAIL_COLORS = [0xff2d9b, 0xff66c4, 0xffd9ec];
let ballTrailColors = TRAIL_DEFAULT_COLORS;
let ballTrailBlend  = THREE.AdditiveBlending;
let _trailColorIdx  = 0;
function setBallTrail(colors, blend) {
  // 玲王: どのスキルを使ってもボール軌道は紫に統一
  if (isReo()) { colors = [REO_FX1, REO_FX2]; blend = THREE.AdditiveBlending; }
  ballTrailColors = colors; ballTrailBlend = blend;
}
function resetBallTrail() { ballTrailColors = TRAIL_DEFAULT_COLORS; ballTrailBlend = THREE.AdditiveBlending; saeShotActive = false; }

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
  if (saeShotActive) spawnSaeShotHalo();
}

// 糸師冴シュートの追加フレア: ボールを包む大きめの淡いピンクのグロー＋飛び散る火花。
function spawnSaeShotHalo() {
  // ふわっと大きいピンクのハロー（コメットの芯）
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R * 2.3, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff2d9b, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  halo.position.copy(ballMesh.position);
  scene.add(halo);
  ballTrail.push({ mesh: halo, life: 0, maxLife: TRAIL_MAX_LIFE * 1.3 });
  // 後方へ散るピンクの火花を1〜2個
  const n = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * (0.35 + Math.random() * 0.35), 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8fd4, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sp.position.set(
      ballMesh.position.x + (Math.random() - 0.5) * 0.5,
      ballMesh.position.y + (Math.random() - 0.5) * 0.5,
      ballMesh.position.z + (Math.random() - 0.5) * 0.5
    );
    scene.add(sp);
    ballTrail.push({ mesh: sp, life: 0, maxLife: TRAIL_MAX_LIFE * 0.7 });
  }
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
  if (isReo() && target === player) color = REO_FX1; // 玲王のオーラは紫
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
  if (isReo()) color = REO_FX1; // 玲王の残像は紫
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.1, 4, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false })
  );
  mesh.position.copy(player.position); mesh.position.y += 0.7;
  mesh.rotation.y = player.rotation.y;
  scene.add(mesh);
  charGhosts.push({ mesh, life: 0, maxLife: 0.35, baseOp: 0.45 });
}

// ── 糸師冴: ピンクのネオン数字が残像のように舞うエフェクト ───────────────────
// Canvasで0〜9をネオン発光に焼いたテクスチャを初回だけ生成し再利用。
// 各数字スプライトは少し上に漂いながらフェードして「残像」を作る。
const saeGlyphs    = [];
const _saeDigitTex = [];
let _saeGlyphTimer = 0;
function _ensureSaeDigits() {
  if (_saeDigitTex.length) return;
  for (let d = 0; d <= 9; d++) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 100px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 外側のピンクのグロー（2度塗りで濃く）→ 内側の明るいコア
    ctx.shadowColor = '#ff2d9b';
    ctx.shadowBlur  = 26;
    ctx.fillStyle   = '#ff4fa8';
    ctx.fillText(String(d), 64, 70);
    ctx.fillText(String(d), 64, 70);
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = '#ffd9ec';
    ctx.fillText(String(d), 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    _saeDigitTex.push(tex);
  }
}
function spawnSaeGlyph() {
  _ensureSaeDigits();
  const tex = _saeDigitTex[(Math.random() * 10) | 0];
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
    opacity: 0.9, blending: THREE.AdditiveBlending,
    color: isReo() ? REO_FX1 : 0xffffff, // 玲王コピー時は紫に上書き
  });
  const sp = new THREE.Sprite(mat);
  const a  = Math.random() * Math.PI * 2;
  const r  = 0.3 + Math.random() * 0.6;
  const sz = 0.45 + Math.random() * 0.4;
  sp.scale.set(sz, sz, 1);
  sp.position.set(
    player.position.x + Math.cos(a) * r,
    0.4 + Math.random() * 1.7,
    player.position.z + Math.sin(a) * r
  );
  sp.renderOrder = 998;
  scene.add(sp);
  saeGlyphs.push({ sprite: sp, life: 0, maxLife: 0.6 + Math.random() * 0.5, vy: 0.2 + Math.random() * 0.4 });
}

// ── 馬狼: 本体にまとう赤黒い稲妻エフェクト ─────────────────────────────────
// VFX/lightning_red|black.png（CC0スプライトシート: 8フレーム×128x512）を
// フリップブックとしてビルボード表示する。手続き的なLineより質感のある稲妻。
const barouBolts = [];
let _barouBoltTimer = 0;
let _barouBallBoltTimer = 0;

const LIGHTNING_FRAMES = 8;
const _boltFramesRed   = []; // 加算合成で光る赤い稲妻フレーム
const _boltFramesBlack = []; // 通常合成で芝に映える黒い稲妻フレーム
function _sliceLightning(tex, out) {
  // スプライトシートを横8分割し、各フレームをUVオフセット済みクローンに切り出す。
  // clone() は .source（GPU画像）を共有するため、アップロードは1回で済む。
  for (let k = 0; k < LIGHTNING_FRAMES; k++) {
    const t = tex.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1 / LIGHTNING_FRAMES, 1);
    t.offset.set(k / LIGHTNING_FRAMES, 0);
    t.needsUpdate = true;
    out.push(t);
  }
}
{
  const loader = new THREE.TextureLoader();
  loader.load('./VFX/lightning_red.png',   (t) => _sliceLightning(t, _boltFramesRed));
  loader.load('./VFX/lightning_black.png', (t) => _sliceLightning(t, _boltFramesBlack));
}

function _makeBoltSprite(black) {
  const frames = black ? _boltFramesBlack : _boltFramesRed;
  if (!frames.length) return null; // テクスチャ未ロード時はこのフレームはスキップ
  const tex = frames[(Math.random() * LIGHTNING_FRAMES) | 0];
  let color = 0xffffff; // 赤黒はテクスチャにベイク済みなので素の白で
  if (isReo()) color = black ? 0x6a1aa0 : REO_FX1; // 玲王コピー時のみ紫にtint
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    depthWrite: false,
    opacity: black ? 0.92 : 1.0,
    blending: black ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 998;
  return sp;
}

// 飛行中のボール周囲に走る赤黒の稲妻（軌道エフェクト）
function spawnBarouBallBolt() {
  const black = Math.random() < 0.35;
  const sp = _makeBoltSprite(black);
  if (!sp) return;
  const c  = ballMesh.position;
  const sz = 0.8 + Math.random() * 0.9;
  sp.scale.set(sz * 0.5, sz, 1);            // 縦長フレーム（1:4）を控えめに
  sp.material.rotation = Math.random() * Math.PI; // 軌道なので向きはランダム
  sp.position.set(
    c.x + (Math.random() - 0.5) * 0.55,
    c.y + (Math.random() - 0.5) * 0.45,
    c.z + (Math.random() - 0.5) * 0.55
  );
  scene.add(sp);
  barouBolts.push({ sprite: sp, life: 0, maxLife: 0.07 + Math.random() * 0.1 });
}
function spawnBarouBolt() {
  // プレイヤー本体に巻きつくように、地面〜頭上へ走る縦の稲妻を1本
  const black = Math.random() < 0.32; // 約3割を黒で混在
  const sp = _makeBoltSprite(black);
  if (!sp) return;
  const a = Math.random() * Math.PI * 2;
  const r = 0.12 + Math.random() * 0.35;    // 体に近づける
  const h = 1.9 + Math.random() * 0.8;      // 縦稲妻の高さ
  sp.scale.set(0.45 + Math.random() * 0.5, h, 1);
  sp.material.rotation = (Math.random() - 0.5) * 0.5; // わずかに傾ける
  sp.position.set(
    player.position.x + Math.cos(a) * r,
    h * 0.5,                                 // 地面〜頭上に収まるよう中心を半分の高さに
    player.position.z + Math.sin(a) * r
  );
  scene.add(sp);
  barouBolts.push({ sprite: sp, life: 0, maxLife: 0.06 + Math.random() * 0.1 });
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
  const meshes = isReo() ? [
    mkCyl(0.75, REO_FX1, 0.5),
    mkCyl(0.36, REO_FX2, 0.8),
    mkCyl(0.15, REO_FX3, 1.0),
  ] : [
    mkCyl(0.75, 0x2a8cff, 0.5),
    mkCyl(0.36, 0x8fd0ff, 0.8),
    mkCyl(0.15, 0xffffff, 1.0),
  ];
  kaizerBeams.push({ meshes, life: 0, maxLife: 0.36 });
}

function spawnKaizerFlash(origin) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    new THREE.MeshBasicMaterial({ color: isReo() ? REO_FX3 : 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
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
  if (barouBallFxTimer > 0)  barouBallFxTimer -= dt;
  if (saeSkillTimer > 0)     saeSkillTimer -= dt;

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
      // 糸師冴フロー中: 黒×紫がかった暗いオーラ（ネオン数字を引き立てる地）
      if (saeSkillTimer > 0)              spawnAuraParticle(player, 0x12001a, THREE.NormalBlending);
    }
    // 糸師冴フロー中: ピンクのネオン数字が残像のように舞う
    if (saeSkillTimer > 0) {
      _saeGlyphTimer += dt;
      if (_saeGlyphTimer >= 0.05) { _saeGlyphTimer = 0; spawnSaeGlyph(); spawnSaeGlyph(); }
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

    // 馬狼スキル中: 本体にまとう稲妻は控えめに（たまに1本だけ明滅）
    if (barouSkillTimer > 0) {
      _barouBoltTimer += dt;
      if (_barouBoltTimer >= 0.11) {
        _barouBoltTimer = 0;
        if (Math.random() < 0.6) spawnBarouBolt(); // 6割の確率で1本だけ
      }
    }

    // 馬狼シュートの軌道: 飛行中（ルーズ＆高速）のボール周囲に赤黒イナズマ
    if (barouBallFxTimer > 0 && ballOwner === 'none' && ballVel.lengthSq() > 9) {
      _barouBallBoltTimer += dt;
      if (_barouBallBoltTimer >= 0.018) {
        _barouBallBoltTimer = 0;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) spawnBarouBallBolt();
      }
    }
  }

  for (let i = barouBolts.length - 1; i >= 0; i--) {
    const b = barouBolts[i];
    b.life += dt;
    b.sprite.material.opacity *= 0.82; // 明滅しながら消える
    if (b.life >= b.maxLife) {
      scene.remove(b.sprite); b.sprite.material.dispose(); // mapは共有フレームなのでdisposeしない
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
  for (let i = saeGlyphs.length - 1; i >= 0; i--) {
    const g = saeGlyphs[i];
    g.life += dt;
    const t = g.life / g.maxLife;
    g.sprite.position.y += g.vy * dt;
    g.sprite.material.opacity = 0.9 * (1 - t);
    if (g.life >= g.maxLife) { scene.remove(g.sprite); g.sprite.material.dispose(); saeGlyphs.splice(i, 1); }
  }
}

function clearCharFx() {
  for (const p of auraParticles) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
  for (const g of charGhosts)    { scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); }
  for (const g of saeGlyphs)     { scene.remove(g.sprite); g.sprite.material.dispose(); }
  for (const b of barouBolts)    { scene.remove(b.sprite); b.sprite.material.dispose(); }
  for (const k of kaizerBeams)   { for (const m of k.meshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }
  auraParticles.length = 0; charGhosts.length = 0; saeGlyphs.length = 0; barouBolts.length = 0; kaizerBeams.length = 0;
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
const c2Ally2  = makeCpu2(ally2,  ally2Char,  'ally2',  'A');
const c2Enemy  = makeCpu2(enemy,  enemyChar,  'enemy',  'B');
const c2Enemy2 = makeCpu2(enemy2, enemy2Char, 'enemy2', 'B');
const c2Enemy3 = makeCpu2(enemy3, enemy3Char, 'enemy3', 'B');
// アクティブなCPU一覧（モードで再構築: 2vs2=3体 / 3vs3=5体）。
let cpu2List = [c2Ally, c2Enemy, c2Enemy2];
function rebuildCpu2List() {
  cpu2List = teamSize >= 3
    ? [c2Ally, c2Ally2, c2Enemy, c2Enemy2, c2Enemy3]
    : [c2Ally, c2Enemy, c2Enemy2];
}
// プレイヤーを共通エンティティ形式で参照（stun はゲッターで playerStunTimer を共有）
const playerEntity2 = { key: 'player', group: player, char: playerChar, get stun() { return playerStunTimer; } };

const PASS_INTERCEPT_R = 1.8;  // パス軌道のカット判定半径(m)
const SUPPORT_MIN_SEP  = 7.0;  // サポート時にボール保持者へ密着しない最小距離
const CPU_TACKLE_RANGE = 3.0;  // CPUがタックルを試みる距離
const ZONE_BAND        = 0.55; // ゾーン幅係数（×FIELD_HALF_D）

let passState = null; // パス飛行中の状態 { passerKey, receiverKey, cutterKey, timer }

const TEAM_A_KEYS = ['player', 'ally', 'ally2'];
const team2     = k => TEAM_A_KEYS.includes(k) ? 'A' : (k === 'enemy' || k === 'enemy2' || k === 'enemy3') ? 'B' : null;
const sameTeam2 = (a, b) => team2(a) !== null && team2(a) === team2(b);
function entity2(key) { return key === 'player' ? playerEntity2 : (cpu2List.find(c => c.key === key) || null); }
// 同チームのエンティティ（自分以外）。プレイヤーも含む。
function teammatesOf2(key) {
  return [playerEntity2, ...cpu2List].filter(e => e.key !== key && sameTeam2(e.key, key));
}
// パス先に最適な味方（前方で開いている味方を優先）。requestPass等の単一取得用。
function teammate2(key) {
  const mates = teammatesOf2(key);
  if (mates.length === 0) return null;
  const gx = team2(key) === 'A' ? GOAL_X : -GOAL_X;
  const from = entity2(key) ? entity2(key).group.position : null;
  // 前進度（攻撃ゴール方向に進んでいるほど高評価）で選ぶ
  let best = mates[0], bestScore = -Infinity;
  for (const m of mates) {
    if (m.stun > 0) continue;
    const adv = gx > 0 ? m.group.position.x : -m.group.position.x;
    if (adv > bestScore) { bestScore = adv; best = m; }
  }
  return best;
}
function opponents2(key) {
  const t = team2(key);
  return [playerEntity2, ...cpu2List].filter(e => team2(e.key) !== t);
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
// プレイヤーの向き(rotation.y)に応じてパス先を選ぶ。
// 少しでも右(+Z側)を向いていれば右側で最も近い味方、左(-Z側)なら左側で最も近い味方。
// その側に味方がいなければ全味方から最も近い味方へ。（チームAは+X攻撃、右=+Z）
function passReceiverForPlayer() {
  const mates = teammatesOf2('player').filter(m => m.stun <= 0);
  if (mates.length === 0) return null;
  const facingZ = -Math.cos(player.rotation.y); // >0=右(+Z) / <0=左(-Z)
  const side = facingZ > 0.05 ? 1 : facingZ < -0.05 ? -1 : 0;
  const nearestIn = pool => {
    let best = null, bd = Infinity;
    for (const m of pool) { const d = distXZ(m.group.position, player.position); if (d < bd) { bd = d; best = m; } }
    return best;
  };
  if (side !== 0) {
    const onSide = mates.filter(m => {
      const lat = m.group.position.z - player.position.z; // +Z=右
      return side > 0 ? lat > 0.3 : lat < -0.3;
    });
    if (onSide.length > 0) return nearestIn(onSide);
  }
  return nearestIn(mates);
}

function doPass(passerKey, forcedRecvKey) {
  const passer = entity2(passerKey);
  const recv = forcedRecvKey ? entity2(forcedRecvKey)
             : passerKey === 'player' ? passReceiverForPlayer()
             : teammate2(passerKey);
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
function cpu2Pass(c, forcedRecvKey) {
  c.passing = true; c.passCd = 2.5;
  const dur = clips['pass'] ? clips['pass'].duration : 0.6;
  c.oneShotTimer = dur;
  charAnim(c.char, 'pass', false);
  const sess = skillSession;
  setTimeout(() => { if (sess === skillSession && ballOwner === c.key) doPass(c.key, forcedRecvKey); }, dur * 0.35 * 1000);
}

// プレイヤーが味方CPUにパスを要求する（味方CPUが保持中のみ）。即座にプレイヤーへ
// ダイレクトパス。軌道上に敵がいれば通常どおりパスカットされる。
function requestPass() {
  if (!mode2v2 || !gameStarted || isGoalScene) return;
  const c = cpu2List.find(e => e.key === ballOwner && e.team === 'A');
  if (!c || c.passing || c.kicking || c.stun > 0) return;
  cpu2Pass(c, 'player'); // プレイヤー宛に飛ばす
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
  for (const c of cpu2List) { const mx = c.char.animState.mixer; if (mx) mx.update(dt); }
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

  // 千切/蜂楽/糸師冴スキル中はプレイヤー保持を固定
  if ((chigiriBoostTimer > 0 || bachiraSkillTimer > 0 || saeSkillTimer > 0) && !isKicking) ballOwner = 'player';

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
  } else if (ballOwner !== 'none') {
    const c = cpu2List.find(e => e.key === ballOwner);
    if (c) charDribble(c.char, dt);
    isDribbling = false;
  } else { isDribbling = false; ballLoosePhysics(dt); }
}

function update2v2Possession(dt) {
  const DR = DRIBBLE_DIST;
  // 千切/蜂楽=保持し続ける（手放さない）。スピンや他スキルは手放し判定はそのまま
  // だが、奪取は playerSkillBusy() で全面ブロックする。
  const skillHold = (chigiriBoostTimer > 0 || bachiraSkillTimer > 0 || saeSkillTimer > 0);
  // 手放し: プレイヤー
  if (ballOwner === 'player') {
    const dp = distXZ(ballMesh.position, player.position);
    if (!skillHold && (dp >= DR * 1.5 || (isKicking && !isPassing && !kickBallFollow))) ballOwner = 'none';
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
  // キックオフ・ホールド中: CPUは敵味方関係なく全員、ボールホルダーのアクション待ちで待機。
  if (kickoffHold) { charAnim(c.char, 'idle'); charClampToField(c.char); return; }
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

// 攻撃時のオフザボール: ボールホルダーの5-10m範囲に、味方同士で被らないよう
// 攻撃方向へ扇状に展開してポジショニングする。
const SUPPORT_R_MIN = 5, SUPPORT_R_MAX = 10, SUPPORT_R_MID = 7.5;
function update2v2Support(c, gx, dt) {
  const carrier = entity2(ballOwner);
  if (!carrier) { update2v2Defend(c, -gx, dt); return; }
  const cpos = carrier.group.position;
  const sgn  = Math.sign(gx) || 1; // 攻撃方向(+x or -x)

  // 同チームのサポーター(保持者以外のCPU)を列挙し、index で扇の角度を割り当てる
  const supporters = cpu2List.filter(o => o.team === c.team && o.key !== ballOwner);
  const idx = Math.max(0, supporters.indexOf(c));
  const n   = Math.max(1, supporters.length);
  // 攻撃方向を中心に -55°..+55° へ均等配置（味方同士が被らない）
  const spread  = (n === 1) ? 0 : ((idx / (n - 1)) - 0.5) * (Math.PI * 110 / 180);
  const baseAng = sgn > 0 ? 0 : Math.PI;
  const ang = baseAng + spread;
  let tx = cpos.x + Math.cos(ang) * SUPPORT_R_MID;
  let tz = cpos.z + Math.sin(ang) * SUPPORT_R_MID;

  // 他の味方(プレイヤー含む)と近すぎたら押し離して被りを防ぐ
  for (const m of teammatesOf2(c.key)) {
    if (m.key === ballOwner) continue;
    const d = distXZ({ x: tx, z: tz }, m.group.position);
    if (d < SUPPORT_R_MIN) {
      const ax = tx - m.group.position.x, az = tz - m.group.position.z, l = Math.hypot(ax, az) || 1;
      tx += ax / l * (SUPPORT_R_MIN - d); tz += az / l * (SUPPORT_R_MIN - d);
    }
  }
  // 保持者から 5-10m を維持
  const dc = distXZ({ x: tx, z: tz }, cpos) || 1;
  const r  = Math.max(SUPPORT_R_MIN, Math.min(SUPPORT_R_MAX, dc));
  tx = cpos.x + (tx - cpos.x) / dc * r;
  tz = cpos.z + (tz - cpos.z) / dc * r;
  // フィールド内へクランプ
  tx = Math.max(-FIELD_HALF_W + 2, Math.min(FIELD_HALF_W - 2, tx));
  tz = Math.max(-FIELD_HALF_D * 0.85, Math.min(FIELD_HALF_D * 0.85, tz));

  const moving = charMoveTo(c.char, new THREE.Vector3(tx, 0, tz), dt);
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
const THROW_RELEASE_FRAC  = 0.55; // スローインモーションのどこでボールを放すか(0..1)
const THROW_BALL_Y        = 2.15; // スローイン中ボールを頭上の手元に保持する高さ(m)
function setPieceEnabled() {
  return !isPK && !isMultiplayer && !isGoalScene && !matchOver && !goalCapture && !setPiece;
}
function ballTeamOf(key) {
  if (key === 'player' || key === 'ally' || key === 'ally2' || key === 'player_gk') return 'A';
  if (key === 'enemy'  || key === 'enemy2' || key === 'enemy3' || key === 'enemy_gk')  return 'B';
  return null;
}

// プレイヤーチームでタッカー(プレイヤー)に最も近い味方（2v2は味方CPU。1v1は味方なし
// → 前方スペースへ投げる/蹴る）。GKへの後ろ向きパスはしない。
function nearestTeammateForPlayer() {
  if (!mode2v2) return null;
  let best = null, bd = Infinity;
  for (const m of cpu2List) {
    if (m.team !== 'A') continue;
    const d = distXZ(m.group.position, player.position);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
// リスタート位置に最も近い敵エンティティ
function nearestEnemyEntity(spot) {
  const list = mode2v2 ? cpu2List.filter(c => c.team === 'B') : (hasEnemy ? [{ key: 'enemy', group: enemy }] : []);
  let best = null, bd = Infinity;
  for (const e of list) {
    const d = distXZ(e.group.position, spot);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function clearBallMotion() { ballVel.set(0, 0, 0); ballCurveRate = 0; ballOwner = 'none'; isDribbling = false; }

// (fromX,fromZ) から (toX,toZ) を向く rotation.y を返す（facing=(-sin,0,-cos)）。
function faceRyToward(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

// ── 発生: タッチライン → スローイン ────────────────────────────────────────
function triggerThrowIn() {
  const zSign = Math.sign(ballMesh.position.z) || 1;
  const xPos  = Math.max(-(FIELD_HALF_W - 1), Math.min(FIELD_HALF_W - 1, ballMesh.position.x));
  const awarded = lastTouchTeam === 'A' ? 'B' : 'A'; // 最後に触れた逆チームがスロー
  clearBallMotion();
  // 蹴り手はタッチラインの外に立ち、フィールド内側(攻撃方向＋中央)を向く＝カメラも内向き
  const taker = { x: xPos, z: zSign * (FIELD_HALF_D + 1.0) };
  const sgn   = awarded === 'A' ? 1 : -1; // 攻撃方向(+X/-X)
  const faceRy = faceRyToward(taker.x, taker.z, xPos + sgn * 6, 0);
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
    // 守備側が最後に触れた → 攻撃側のコーナーキック。蹴り手はコーナー外、
    // ゴール前の箱(フィールド内側)を向く＝カメラも内向き。
    const taker = { x: xSign * (FIELD_HALF_W - 0.3), z: zSign * (FIELD_HALF_D + 0.8) };
    const faceRy = faceRyToward(taker.x, taker.z, xSign * (GOAL_X - 10), 0);
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
  const outfield = t => mode2v2
    ? [playerEntity2, ...cpu2List].filter(e => team2(e.key) === t).map(e => e.key)
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
               takerPos: { x: takerPos.x, z: takerPos.z }, faceRy };
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

// フェーズ進行: announce(告知1.3s) → setup → ready(ボタン/CPU自動実行) → acting(押下後のモーション)
function updateSetPiecePhase(dt) {
  if (!setPiece || setPiece.ready || setPiece.phase === 'acting') return;
  setPiece.timer -= dt;
  if (setPiece.timer > 0) return;
  if (setPiece.phase === 'announce') {
    setPiece.phase = 'setup';
    hideSetPieceAnnounce();
    if (setPiece.takerKey === 'player') {
      // プレイヤーはモーションを再生せず、すぐボタン表示。実際のモーションは押下時のみ。
      setPiece.timer = 0.25;
    } else {
      // CPUはモーションを表示し、放球フレームで自動実行。
      setPiece.timer = (setPiece.kind === 'throwin')
        ? (clips['throw_in'] ? clips['throw_in'].duration * THROW_RELEASE_FRAC : 0.8)
        : SETPIECE_SETUP_TIME;
      startTakerMotion();
    }
  } else { // phase === 'setup'
    setPiece.ready = true;
    if (setPiece.takerKey === 'player') showSetPieceUI(setPiece.kind);
    else cpuSetPieceAct();
  }
}

// ボールを受け手へカーブ軌道でパス（コーナー=高め / スロー=低め、どちらも巻く）。
// 受け手に届かせるため、初速方向をカーブと逆に半分プリ回転し、カーブで戻して到達させる。
function launchSetPieceBall(from, target, kind, atkGoalX) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const dist = Math.max(2, Math.hypot(dx, dz));
  const aStraight = Math.atan2(dx, dz); // +z基準で+x方向への角度（Magnusと同系）
  ballOwner = 'none'; isDribbling = false;
  const lofted  = kind === 'corner';
  const vy      = lofted ? 12 : 7;                       // コーナー=高めのクロス / スロー=低め
  // スローインは頭上の手元(THROW_BALL_Y)から放球、コーナーは地面から。
  const startY  = lofted ? BALL_R + 0.1 : THROW_BALL_Y - 0.15;
  // 放球高さ→地面 までの実飛行時間（高い位置から放るほど長く飛ぶので補正）
  const flightT = (vy + Math.sqrt(vy * vy + 2 * BALL_GRAVITY * Math.max(0, startY - BALL_R))) / BALL_GRAVITY;
  const hSpd    = Math.min(lofted ? 38 : 30, Math.max(11, dist / Math.max(0.35, flightT)));
  // カーブ向き: 攻撃ゴール側(中央)へ巻く。立ち位置zの符号×攻撃方向で決定。
  const cmag    = lofted ? 0.6 : 0.85;
  const curve   = cmag * (Math.sign(from.z) || 1) * (Math.sign(atkGoalX ?? GOAL_X) || 1);
  const aInit   = aStraight - 0.5 * curve * flightT;     // 逆に半分プリ回転
  const sx = Math.sin(aInit), sz = Math.cos(aInit);
  ballMesh.position.set(from.x + sx * 0.5, startY, from.z + sz * 0.5);
  ballVel.set(sx * hSpd, vy, sz * hSpd);
  ballCurveRate = curve;
  setBallTrail([0x3da5ff, 0x9fe0ff], THREE.AdditiveBlending);
}

// CPUの蹴り手が3秒後に自動実行。
//  スローイン/コーナーとも CPU は必ずパス/センタリング（ドリブル禁止）。
//  味方がいれば味方の位置へ。いなければ前方スペース(スロー)/箱中央(コーナー)へ。
//  重要: 蹴り手自身がクールダウンを持たないと投げた瞬間に拾い直して
//  「ドリブルしてくる」ため、蹴り手の pickup を必ず抑える。
function cpuSetPieceAct() {
  const takerKey = setPiece.takerKey, kind = setPiece.kind;
  const taker = entity2(takerKey);
  const from  = taker.group.position.clone();
  const mate  = mode2v2 ? teammate2(takerKey) : null;
  setPiece = null;
  const atkGoalX = ballTeamOf(takerKey) === 'A' ? GOAL_X : -GOAL_X; // 攻撃ゴール
  const sgn = Math.sign(atkGoalX);

  // ターゲット決定（必ずパス先を作る＝ドリブル分岐を廃止）
  let target;
  if (mate && mate.group) {
    target = mate.group.position.clone();                                  // 味方へ
  } else if (kind === 'corner') {
    target = new THREE.Vector3(sgn * (GOAL_X - 9), 0, (Math.random() - 0.5) * 6); // 箱中央へセンタリング
  } else {
    // スロー: 前方スペースへ（再ライン割れ防止にフィールド内へクランプ）
    target = new THREE.Vector3(
      Math.max(-(FIELD_HALF_W - 4), Math.min(FIELD_HALF_W - 4, from.x + sgn * 11)),
      0, from.z * 0.35);
  }

  launchSetPieceBall(from, target, kind, atkGoalX);

  // 蹴り手が自分の投球/クロスを即回収しないようクールダウン（ドリブル化を防ぐ）。
  enemyPickupCooldown = 1.0;                       // 1v1の敵(updateEnemy)用
  if (taker && taker.pickupCd !== undefined) taker.pickupCd = 1.0; // 2v2の蹴り手CPU用
  playerPickupCooldown = 0.3;                      // プレイヤーが密着時のみ軽く抑える
  lastTouchTeam = ballTeamOf(takerKey) || lastTouchTeam;
}

function startGoalKick(team) {
  ballOwner = 'none'; ballVel.set(0, 0, 0); ballCurveRate = 0; saeShotActive = false; isDribbling = false;
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

// セットプレー準備中: 蹴り手の足元(/手元)にボールを保持し続ける
function updateSetPieceHold() {
  const g = setPieceTakerGroup();
  if (!g) return;
  if (setPiece.kind === 'throwin') {
    // スロー: モーション再生中(=acting / CPUのsetup)は頭上、待機中は胸元の手で保持。
    const motion = setPiece.phase === 'acting'
      || (setPiece.takerKey !== 'player' && setPiece.phase === 'setup');
    const y = motion ? THROW_BALL_Y : 1.35;
    const f = new THREE.Vector3(-Math.sin(g.rotation.y), 0, -Math.cos(g.rotation.y));
    ballMesh.position.set(g.position.x + f.x * 0.25, y, g.position.z + f.z * 0.25);
  } else {
    ballMesh.position.set(g.position.x, BALL_R, g.position.z);
  }
  ballVel.set(0, 0, 0);
}

// プレイヤーのセットプレー: 押下時に近くの味方を狙う目標を計算する。
function playerSetPieceTarget(kind) {
  const from = player.position;
  const mate = mode2v2 ? passReceiverForPlayer() : null; // 向きに応じた近くの味方
  if (mate && mate.group) return mate.group.position.clone();
  if (kind === 'corner')  return new THREE.Vector3(GOAL_X - 9, 0, (Math.random() - 0.5) * 6); // 箱中央
  return new THREE.Vector3(Math.min(FIELD_HALF_W - 4, from.x + 11), 0, from.z * 0.35);          // 前方
}

// ── パス（プレイヤーのスロー/コーナー）。押下時にモーション再生→放球フレームで発射。──
let _setPieceActSession = 0;
function setPiecePass() {
  if (!setPiece || !setPiece.ready || setPiece.takerKey !== 'player') return;
  const kind = setPiece.kind;
  hideSetPieceUI();
  // モーション再生開始（蹴り手は acting フェーズで固定したまま放球フレームまで再生）。
  setPiece.phase = 'acting'; setPiece.ready = false;
  const clipName = kind === 'corner' ? 'corner_kick' : 'throw_in';
  if (mixer && clips[clipName]) fadeToClip(clipName, false);
  const dur = clips[clipName] ? clips[clipName].duration : 0.8;
  // 放球タイミング（モーションの接触フレーム）。長尺クリップでも待たせすぎない上限。
  const releaseT = Math.min(dur * (kind === 'corner' ? 0.5 : THROW_RELEASE_FRAC), 1.5);
  const sess = ++_setPieceActSession;
  setTimeout(() => {
    if (sess !== _setPieceActSession || !setPiece) return;
    // 放球フレームで近くの味方へ発射（モーションしながらパス）。
    const target = playerSetPieceTarget(kind);
    launchSetPieceBall(player.position.clone(), target, kind, GOAL_X);
    enemyPickupCooldown  = 0.4; // 受け手(敵)が拾いやすいよう一瞬抑える
    playerPickupCooldown = 0.8; // 蹴り手(自分)が自分の投球を即回収しないように
    lastTouchTeam = 'A';
    setPiece = null;
  }, releaseT * 1000);
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

// ── キックオフ告知バナー（ゴール後の再開合図）─────────────────────────────
let _kickoffEl = null;
function showKickoff() {
  if (!_kickoffEl) {
    _kickoffEl = document.createElement('div');
    _kickoffEl.id = 'kickoff-banner';
    _kickoffEl.innerHTML = '<div style="font:800 30px/1.1 system-ui,sans-serif;letter-spacing:4px">KICK OFF</div>'
      + '<div style="margin-top:6px;font:600 14px/1.3 system-ui,sans-serif;opacity:0.85">移動・パス・シュートで再開</div>';
    _kickoffEl.style.cssText = [
      'position:fixed', 'top:16%', 'left:50%', 'transform:translateX(-50%)',
      'padding:12px 30px', 'text-align:center', 'color:#fff',
      'background:rgba(18,22,38,0.74)', 'border:2px solid #ffd400', 'border-radius:12px',
      'z-index:60', 'pointer-events:none', 'text-shadow:0 2px 8px rgba(0,0,0,0.6)',
      'box-shadow:0 6px 22px rgba(0,0,0,0.45)',
    ].join(';');
    document.body.appendChild(_kickoffEl);
  }
  _kickoffEl.style.display = 'block';
}
function hideKickoff() { if (_kickoffEl) _kickoffEl.style.display = 'none'; }

// キックオフ・ホールドの解除判定: ボールホルダー(プレイヤー保持時)がアクション
// するまでCPUは全員停止。プレイヤーが保持していない(CPUキックオフ)時は猶予で再開。
function updateKickoff(dt) {
  if (!kickoffHold) return;
  kickoffHoldTimer -= dt;
  const moved = keys.has('KeyW') || keys.has('ArrowUp') || keys.has('KeyS') || keys.has('ArrowDown')
             || keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('KeyD') || keys.has('ArrowRight')
             || joystick.active;
  const playerActed = ballOwner === 'player' && (moved || isKicking || isPassing || isTackling);
  if (kickoffHoldTimer <= 0 || playerActed) {
    kickoffHold = false;
    hideKickoff();
  }
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(dt);

  // ゴールに入ったボールはネットへ吸い込み＆ネットへこみ（他のボール処理より優先）
  if (goalCapture) updateGoalCapture(dt);

  // ── ボール更新 ───────────────────────────────────────────────────
  if (setPiece) {
    // 告知中=全員停止 / 準備中=蹴り手のみ固定で他は自由に動く
    updateSetPiecePhase(dt);
    if (setPiece && setPiece.phase === 'setup' && mode2v2) update2v2(dt);
    if (setPiece) updateSetPieceHold(); // ボールを蹴り手の足元に固定
  } else if (mode2v2) {
    // 2vs2: 所有権・CPU AI・ドリブル配置・ルーズ物理を update2v2 が一括処理
    update2v2(dt);
  } else if (isMultiplayer) {
    // リアル対戦: 権威モデルで拾得/タックル/ドリブル/ルーズ物理を一括処理
    updateMultiplayerBall(dt);
  } else {
    // ソロ: 所有権・物理・ゴール判定を updateBall が一括処理
    updateBall(dt);
  }

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
        fadeToRemoteClip(ps.anim || 'idle'); // 相手の実クリップ名をそのまま再生
      }
    }
    // 自分の状態を30Hzで送信
    mpTimer += dt;
    if (mpTimer >= 0.033) {
      mpTimer = 0;
      mpHandlers.publishPlayer(mpRole, {
        x: player.position.x, z: player.position.z,
        ry: player.rotation.y,
        // 今プレイヤーが実際に再生中のクリップ名を送る（kick/pass/tackle/dribble/spin/スキル含む）
        anim: playerChar.animState?.currentName || 'idle',
        tackling:  isTackling,         // Host: 奪取判定に使用
        skillBusy: playerSkillBusy(),  // Host: スキル中は奪わない
        kick:      mpRole === 'guest' ? mpPendingKick : null, // Guest: 発射転送
      });
      // ボールは Host が唯一配信（全計算がHost側＝二重計算の競合を根絶）。
      if (mpRole === 'host') {
        mpHandlers.publishBall({
          x: ballMesh.position.x, y: ballMesh.position.y, z: ballMesh.position.z,
          vx: ballVel.x, vy: ballVel.y, vz: ballVel.z,
          owner: ballOwner === 'player' ? 'host' : (ballOwner === 'enemy' ? 'guest' : 'none'),
        });
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
  if (gameStarted && !isGoalScene) updateNagiFreeze(dt);
  if (gameStarted && !isGoalScene) updateKickoff(dt);
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
        const moveSpeed = RUN_SPEED * (chigiriBoostTimer > 0 ? CHIGIRI_SPEED_MULT
          : (saeSkillTimer > 0 ? SAE_SPEED_MULT : 1));
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
          if (ballOwner === 'none') holderPos = ballMesh.position; // ルーズ=ボールを向く
          else if (ballOwner !== 'player') {
            const h = cpu2List.find(c => c.key === ballOwner);
            if (h) holderPos = h.group.position;
          }
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

    // シュート/パスのモーション中: 急停止せず、方向キー方向(無入力なら向き)へ
    // 減速しながら滑る。通常速度ではなく徐々に止まる自然な慣性。
    if (!playerFrozenBySetPiece() && playerStunTimer <= 0 && !isTackling && !isSpinning
        && (isKicking || isPassing) && kickGlide > 0) {
      kickGlide = Math.max(0, kickGlide - dt / Math.max(0.2, kickGlideTime));
      const camDir   = new THREE.Vector3(-Math.sin(viewAngle), 0, -Math.cos(viewAngle));
      const camRight = new THREE.Vector3( Math.cos(viewAngle), 0, -Math.sin(viewAngle));
      const mv = new THREE.Vector3();
      if (keys.has('KeyW') || keys.has('ArrowUp'))    mv.add(camDir);
      if (keys.has('KeyS') || keys.has('ArrowDown'))  mv.addScaledVector(camDir, -1);
      if (keys.has('KeyA') || keys.has('ArrowLeft'))  mv.addScaledVector(camRight, -1);
      if (keys.has('KeyD') || keys.has('ArrowRight')) mv.addScaledVector(camRight, 1);
      if (joystick.active) {
        if (Math.abs(joystick.dy) > 0.05) mv.addScaledVector(camDir,   -joystick.dy);
        if (Math.abs(joystick.dx) > 0.05) mv.addScaledVector(camRight,  joystick.dx);
      }
      // 無入力なら向いている方向へ慣性で滑る（完全停止しない）
      if (mv.lengthSq() <= 0.001) mv.set(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
      mv.normalize();
      player.position.addScaledVector(mv, RUN_SPEED * KICK_GLIDE_MAX * kickGlide * dt);
      charClampToField(playerChar);
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

    // セットプレー(自分が蹴り手): カメラを蹴り手の後ろに置き、向いている方向
    // (=味方/攻撃方向)を見る。viewAngle を faceRy へ寄せると camOffset が背後に回る。
    if (setPiece && setPiece.takerKey === 'player') {
      const d = ((setPiece.faceRy - viewAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      viewAngle += d * Math.min(1, 8 * dt);
      camLead.set(0, 0, 0); // 蹴り手は静止。リードを切ってブレを防ぐ
    }

    // カメラ追従: ターゲット位置をスムーズに追い、そこから固定オフセット分で配置
    // （位置を直接 lerp するとカメラがプレイヤーに近づくズームが起きるため避ける）
    // 没入/通常プリセットへ向けてカメラ姿勢を補間（切替時に滑らかに寄る/引く）
    const camPreset = immersiveCam ? CAM_IMMERSIVE : CAM_NORMAL;
    const ct = Math.min(1, 5 * dt);
    camRig.h    += (camPreset.h    - camRig.h)    * ct;
    camRig.dist += (camPreset.dist - camRig.dist) * ct;
    camRig.tgtY += (camPreset.tgtY - camRig.tgtY) * ct;

    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, viewAngle, 0));
    const camOffset   = new THREE.Vector3(0, camRig.h, camRig.dist).applyQuaternion(q);
    const idealTarget = player.position.clone().add(new THREE.Vector3(0, camRig.tgtY, 0)).add(camLead);
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
    // 玲王のスキルボタン(.reo-skill-btn)もボタン扱い。除外しないとタップで
    // ルックスワイプが開始し、ボタンのstopPropagationでtouchendが届かず視点が固着する。
    const isBtn = t.target.closest?.('.touch-btn, .reo-skill-btn');
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
// キャプチャ段階で受ける: ボタンの touchend が stopPropagation してもジョイ
// スティック/ルックスワイプの解放が必ず実行され、視点や移動の固着を防ぐ。
document.addEventListener('touchend',    e => { for (const t of e.changedTouches) releaseTouch(t.identifier); }, true);
document.addEventListener('touchcancel', e => { for (const t of e.changedTouches) releaseTouch(t.identifier); }, true);

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
    // 玲王: 通常スキルボタンは使わず常に隠し、敵キャラ分のボタン群(#reo-skills)を
    // ボール保持中だけ表示する（通常スキルボタンと同じ出現条件）。
    const reoEl = document.getElementById('reo-skills');
    if (isReo()) {
      if (skillBtn) skillBtn.style.display = 'none';
      if (reoEl)    reoEl.style.display = hasBall ? 'flex' : 'none';
    } else {
      if (skillBtn) skillBtn.style.display = hasBall ? '' : 'none';
      if (reoEl)    reoEl.style.display = 'none';
    }
    // パスボタン: 自分保持中=「パス」、味方保持中=「パス要求」。それ以外は非表示。
    // #btn-pass はCSSで display:none を指定しているため、表示時は明示的に flex を入れる
    // （'' だとCSSのnoneに戻り、ボタンが出ないため）。
    if (passBtn) {
      const allyHolds = ballOwner !== 'player' && ballTeamOf(ballOwner) === 'A'; // 味方CPU保持
      const showPass = mode2v2 && (ballOwner === 'player' || allyHolds);
      passBtn.style.display = showPass ? 'flex' : 'none';
      if (showPass) passBtn.textContent = allyHolds ? 'パス要求' : 'パス';
    }
  }
  // animate() から呼べるようにグローバル化
  window._updateMobileButtons = updateMobileButtons;
})();

animate();
