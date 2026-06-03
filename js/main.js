import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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
    const ghw = 3.66 * sc;                    // ゴール半幅

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
    const HW = ghw, H = 2.44, backX = ox + s * 2.2 * sc;
    for (let i=0;i<=8;i++) { const z=-HW+(HW*2/8)*i; seg(backX,0,z,backX,H,z); }
    for (let j=0;j<=5;j++) { const y=(H/5)*j;         seg(backX,y,-HW,backX,y,HW); }
    for (let i=0;i<=8;i++) { const z=-HW+(HW*2/8)*i; seg(ox,H,z,backX,H,z); }
    for (let k=0;k<=3;k++) { const x=ox+(s*2.2*sc/3)*k; seg(x,H,-HW,x,H,HW); }
    for (let j=0;j<=5;j++) { const y=(H/5)*j;         seg(ox,y,-HW,backX,y,-HW); }
    for (let k=0;k<=3;k++) { const x=ox+(s*2.2*sc/3)*k; seg(x,0,-HW,x,H,-HW); }
    for (let j=0;j<=5;j++) { const y=(H/5)*j;         seg(ox,y,HW,backX,y,HW); }
    for (let k=0;k<=3;k++) { const x=ox+(s*2.2*sc/3)*k; seg(x,0,HW,x,H,HW); }
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

// ── チームメート ───────────────────────────────────────────────────────────
const teammate    = new THREE.Group();
let teammateMixer = null;
let teammateCurrent = null;
let teammateState   = 'support'; // 'support' | 'receive' | 'dribble'
let teammateKicking = false;
const TEAMMATE_SPEED     = 6.0;
const TEAMMATE_RUN_SPEED = 10.0;

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
const ENEMY_SPEED            = 5.5;
const ENEMY_RUN_SPEED        = 9.5;
const ENEMY_TACKLE_RANGE     = 1.8;
const ENEMY_TACKLE_COOLDOWN  = 2.5;

// ── ボール所有権 ───────────────────────────────────────────────────────────
let ballOwner = 'none'; // 'player' | 'teammate' | 'none'
let playerPickupCooldown   = 0; // パス直後に自分がボールを即再拾いするのを防ぐ(秒)
let teammatePickupCooldown = 0; // パス直後に味方がボールを即再拾いするのを防ぐ(秒)

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

// ── パス（プレイヤー → チームメート）─────────────────────────────────────
function passToTeammate(powered = false) {
  if (!hasTeammate || ballOwner !== 'player') return;
  const passClip = clips['pass'] || clips['kick'];
  if (!passClip || !mixer) return;
  const pwr = powered ? 1.4 : 1.0;

  // isPassing を使う（isKicking にしないことで ballOwner を維持）
  isKicking = false; isPassing = false;
  isPassing = true;
  fadeToClip('pass' in clips ? 'pass' : 'kick', false);

  setTimeout(() => {
    isPassing = false;
    // アニメ発動タイミングでボールを蹴り出す
    const toTM = new THREE.Vector3().subVectors(teammate.position, ballMesh.position);
    toTM.y = 0;
    const dist    = toTM.length();
    const hSpeed  = Math.max(8, Math.min(22, dist * 1.4)) * pwr; // 距離に比例した威力
    const travelTime = Math.max(0.1, dist / hSpeed);
    const tmFwd = new THREE.Vector3(-Math.sin(teammate.rotation.y), 0, -Math.cos(teammate.rotation.y));
    const leadPos = teammate.position.clone().addScaledVector(tmFwd, TEAMMATE_SPEED * travelTime * 0.5);
    const toTarget = new THREE.Vector3().subVectors(leadPos, ballMesh.position);
    toTarget.y = 0;
    const dir = toTarget.normalize();
    ballVel.set(dir.x * hSpeed, Math.max(2, dist * 0.08), dir.z * hSpeed);
    ballCurveRate = 0;
    ballOwner            = 'none';
    isDribbling          = false;
    playerPickupCooldown = 1.0; // 1秒間プレイヤーがボールを拾えないようにする
    teammateState        = 'receive';
  }, passClip.duration * 0.55 * 1000);
}

// ── パス（チームメート → プレイヤー）─────────────────────────────────────
function passFromTeammate() {
  if (!hasTeammate || ballOwner !== 'teammate') return;
  const toPlayer = new THREE.Vector3().subVectors(player.position, ballMesh.position);
  toPlayer.y = 0;
  const dist   = toPlayer.length();
  const dir    = toPlayer.normalize();
  const hSpeed  = Math.max(8, Math.min(22, dist * 1.4)); // 距離に比例した威力
  const isLofted = dist >= 14;                            // 14m以上は浮き球
  const vSpeed  = isLofted ? Math.max(10, dist * 0.5) : Math.max(2, dist * 0.05);
  ballVel.set(dir.x * hSpeed, vSpeed, dir.z * hSpeed);
  ballCurveRate          = 0;
  ballOwner              = 'none';
  isDribbling            = false;
  teammatePickupCooldown = 1.0; // 1秒間味方がボールを再拾いできないようにする
  teammateState          = 'support';
}

// ── チームメートシュート ───────────────────────────────────────────────────
function teammateShoot() {
  cpuShoot({
    ownerKey:   'teammate',
    goalX:      GOAL_X,
    anim:       teammateAnim,
    getKicking: () => teammateKicking,
    setKicking: v => { teammateKicking = v; },
    onDone:     () => { teammatePickupCooldown = 1.5; teammateState = 'support'; },
  });
}

// ── 敵シュート ────────────────────────────────────────────────────────────
function enemyShoot() {
  cpuShoot({
    ownerKey:   'enemy',
    goalX:      -GOAL_X,
    anim:       enemyAnim,
    getKicking: () => enemyKicking,
    setKicking: v => { enemyKicking = v; },
    onDone:     () => { enemyPickupCooldown = 1.5; enemyState = 'chase'; },
  });
}

// ── チームメートAI ────────────────────────────────────────────────────────
function getTeammateTargetPos() {
  // ドリブル: 常にゴール方向へ前進
  if (ballOwner === 'teammate') {
    return new THREE.Vector3(GOAL_X, 0, teammate.position.z * 0.3);
  }

  // チェイス/プレス: ボールを追う（後退は最大15mに制限）
  if (teammateState === 'chase') {
    const bx = Math.max(ballMesh.position.x, teammate.position.x - 15);
    const bz = ballMesh.position.z;
    return new THREE.Vector3(bx, 0, bz);
  }

  // サポート/レシーブ: 常にボールより前・サイドの受けポジション
  const sideZ    = teammate.position.z >= 0 ? 10 : -10;
  const supportX = Math.max(teammate.position.x, ballMesh.position.x + 8);
  const pos      = new THREE.Vector3(
    Math.min(FIELD_HALF_W - 3, supportX),
    0,
    Math.max(-FIELD_HALF_D + 5, Math.min(FIELD_HALF_D - 5, ballMesh.position.z + sideZ))
  );
  return pos;
}

// ── 共通 CPU 移動（移動 + 方向スナップ、trueなら実際に移動した）──────────
function cpuMove(entity, targetPos, speed, dt) {
  const to = new THREE.Vector3().subVectors(targetPos, entity.position);
  to.y = 0;
  const dist = to.length();
  if (dist < 0.4) return false;
  to.divideScalar(dist); // normalize in-place
  entity.position.addScaledVector(to, Math.min(dist, speed * dt));
  entity.rotation.y = Math.atan2(-to.x, -to.z);
  return true;
}

function updateTeammate(dt) {
  if (!hasTeammate || !gameStarted || !teammateMixer || isGoalScene) return;
  teammateMixer.update(dt);

  // ── 状態遷移（シンプル3状態）
  if (ballOwner === 'teammate') {
    teammateState = 'dribble';
  } else if (ballOwner === 'none' || ballOwner === 'enemy') {
    if (teammateState !== 'receive') teammateState = 'chase';
    if (teammateState === 'receive' && ballVel.lengthSq() < 1) teammateState = 'chase';
  } else {
    // ballOwner === 'player'
    teammateState = 'support';
  }

  // ── 移動
  const targetPos    = getTeammateTargetPos();
  const distToTarget = new THREE.Vector3().subVectors(targetPos, teammate.position).setY(0).length();
  const isChase      = teammateState === 'chase';
  const tmSpeed      = (distToTarget > 4 || isChase) ? TEAMMATE_RUN_SPEED : TEAMMATE_SPEED;
  const moving       = !teammateKicking && cpuMove(teammate, targetPos, tmSpeed, dt);
  teammate.position.x = Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, teammate.position.x));
  teammate.position.z = Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, teammate.position.z));

  // ── 向き: ドリブル・サポートは常にゴール方向（+x）を向く
  // チェイス時のみ cpuMove が設定したボール方向を向く
  if (!teammateKicking && teammateState !== 'chase') {
    teammate.rotation.y = -Math.PI / 2; // +x方向（相手ゴール向き）
  }

  // ── ドリブル中はボールをこのフレームの向きで正確に配置（更新順序のズレを補正）
  if (ballOwner === 'teammate') {
    const facing = new THREE.Vector3(-Math.sin(teammate.rotation.y), 0, -Math.cos(teammate.rotation.y));
    const ballTarget = teammate.position.clone().addScaledVector(facing, DRIBBLE_OFFSET);
    ballTarget.y = BALL_R;
    ballMesh.position.copy(ballTarget);
    ballVel.set(0, 0, 0);
  }

  // ── シュート判定
  const PENALTY_Z = FIELD_HALF_D * 0.611;
  if (ballOwner === 'teammate' && !teammateKicking
      && teammate.position.x > GOAL_X - FIELD_HALF_W * 0.48
      && Math.abs(teammate.position.z) <= PENALTY_Z) {
    const distToGoal = GOAL_X - teammate.position.x;
    const angleRatio = distToGoal > 0 ? Math.abs(teammate.position.z) / distToGoal : 0;
    if (angleRatio <= 0.65 || distToGoal <= 8) {
      teammateShoot();
    }
  }

  // ── 敵ボール奪取
  if (ballOwner === 'enemy' && hasEnemy && teammatePickupCooldown <= 0 && !enemyKicking) {
    const dToBall = new THREE.Vector3().subVectors(ballMesh.position, teammate.position);
    dToBall.y = 0;
    if (dToBall.length() < DRIBBLE_DIST * 1.2) {
      ballOwner = 'teammate';
      enemyPickupCooldown = 0.8;
    }
  }

  // ── アニメ
  if (!teammateKicking) fadeToTeammateClip(moving ? 'run' : 'idle');
}

// ── 敵AI ─────────────────────────────────────────────────────────────────
function updateEnemy(dt) {
  if (!hasEnemy || !gameStarted || !enemyMixer || isGoalScene) return;
  enemyMixer.update(dt);

  if (enemyTackleCooldown > 0) enemyTackleCooldown -= dt;

  const toEnemyBall = new THREE.Vector3().subVectors(ballMesh.position, enemy.position);
  toEnemyBall.y = 0;
  const distEnemyBall = toEnemyBall.length();

  // タックルによる奪取
  if (enemyTackling && ballOwner !== 'enemy' && distEnemyBall < ENEMY_TACKLE_RANGE && enemyPickupCooldown <= 0 && !isKicking && !teammateKicking) {
    ballOwner = 'enemy';
    playerPickupCooldown   = 0.6;
    teammatePickupCooldown = 0.6;
    enemyTackling = false;
  }

  // 状態遷移
  enemyState = (ballOwner === 'enemy') ? 'dribble' : 'chase';

  // 目標位置を決定
  let targetPos;
  if (enemyState === 'dribble') {
    // 自陣ゴール方向へ中央に絞り込みながら進む
    const aimZ = enemy.position.z * 0.4;
    targetPos = new THREE.Vector3(Math.max(-(GOAL_X - 4.5), enemy.position.x - 8), 0, aimZ);
  } else {
    // ボールを追う
    targetPos = ballMesh.position.clone();
    targetPos.y = 0;
    // ボール保持者にタックル
    if ((ballOwner === 'player' || ballOwner === 'teammate') &&
        distEnemyBall < 3.0 && !enemyTackling && enemyTackleCooldown <= 0) {
      enemyTackling = true;
      enemyTackleCooldown = ENEMY_TACKLE_COOLDOWN;
      fadeToEnemyClip('tackle', false);
    }
  }

  // 移動
  const distToTarget = new THREE.Vector3().subVectors(targetPos, enemy.position).setY(0).length();
  const enSpeed      = distToTarget > 4 ? ENEMY_RUN_SPEED : ENEMY_SPEED;
  const moving       = !enemyTackling && !enemyKicking && cpuMove(enemy, targetPos, enSpeed, dt);

  // タックル中は向いてる方向に前進
  if (enemyTackling) {
    const facing = new THREE.Vector3(-Math.sin(enemy.rotation.y), 0, -Math.cos(enemy.rotation.y));
    enemy.position.addScaledVector(facing, ENEMY_SPEED * 1.3 * dt);
  }

  enemy.position.x = Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, enemy.position.x));
  enemy.position.z = Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, enemy.position.z));

  // シュート判定: 自陣ペナルティエリア内で角度OK
  const enemyPenZ = FIELD_HALF_D * 0.611;
  if (ballOwner === 'enemy' && !enemyKicking
      && enemy.position.x < -(GOAL_X - FIELD_HALF_W * 0.48)
      && Math.abs(enemy.position.z) <= enemyPenZ) {
    const distToGoal = Math.abs(-GOAL_X - enemy.position.x);
    const angleRatio = distToGoal > 0 ? Math.abs(enemy.position.z) / distToGoal : 0;
    if (angleRatio <= 0.65 || distToGoal <= 8) enemyShoot();
  }

  // アニメーション
  if (!enemyTackling && !enemyKicking) {
    let anim = 'idle';
    if (moving) anim = (ballOwner === 'enemy' && clips['dribble']) ? 'dribble' : 'run';
    fadeToEnemyClip(anim);
  }
}

function updateBall(dt) {
  if (!gameStarted) return;
  if (isGoalScene) return; // ゴールシーン中は物理停止

  const toPlayer   = new THREE.Vector3().subVectors(ballMesh.position, player.position);
  toPlayer.y = 0;
  const distPlayer = toPlayer.length();
  const toTeam     = new THREE.Vector3().subVectors(ballMesh.position, teammate.position);
  toTeam.y = 0;
  const distTeam   = toTeam.length();
  const toEnemyB   = hasEnemy ? new THREE.Vector3().subVectors(ballMesh.position, enemy.position) : new THREE.Vector3(999, 0, 0);
  if (hasEnemy) toEnemyB.y = 0;
  const distEnemy  = toEnemyB.length();

  // ── ボール所有権の更新 ──────────────────────────────────────────────────
  if (playerPickupCooldown   > 0) playerPickupCooldown   -= dt;
  if (teammatePickupCooldown > 0) teammatePickupCooldown -= dt;
  if (enemyPickupCooldown    > 0) enemyPickupCooldown    -= dt;

  if (ballOwner === 'player'   && (distPlayer >= DRIBBLE_DIST * 1.5 || (isKicking && !isPassing))) ballOwner = 'none';
  if (ballOwner === 'teammate' &&  distTeam   >= DRIBBLE_DIST * 1.5 && !teammateKicking)            ballOwner = 'none';
  if (ballOwner === 'enemy'   &&  distEnemy  >= DRIBBLE_DIST * 1.5 && !enemyKicking)              ballOwner = 'none';
  if (ballOwner === 'none') {
    if      (distPlayer < DRIBBLE_DIST && !isKicking && !enemyKicking && !teammateKicking && playerPickupCooldown <= 0)  ballOwner = 'player';
    else if (distTeam   < DRIBBLE_DIST && !isKicking && !enemyKicking && teammatePickupCooldown <= 0)                    ballOwner = 'teammate';
    else if (hasEnemy && distEnemy < DRIBBLE_DIST && !isKicking && !teammateKicking && enemyPickupCooldown <= 0)         ballOwner = 'enemy';
  }
  // タックル中にボールが射程内 → 所有権奪取
  const TACKLE_DIST = 1.6;
  if (isTackling && ballOwner !== 'player' && distPlayer < TACKLE_DIST && playerPickupCooldown <= 0 && !(ballOwner === 'enemy' && enemyKicking) && !(ballOwner === 'teammate' && teammateKicking)) {
    ballOwner = 'player';
    teammatePickupCooldown = 0.5;
    enemyPickupCooldown    = 0.5;
    isTackling = false;
  }
  isDribbling = ballOwner === 'player';

  if (isDribbling) {
    // プレイヤードリブル
    const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
    const target = player.position.clone().addScaledVector(facing, DRIBBLE_OFFSET);
    target.y = BALL_R;
    ballMesh.position.lerp(target, Math.min(1, 50 * dt));
    ballVel.set(0, 0, 0);
    ballCurveRate = 0;

    const moving = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('ArrowDown') || keys.has('KeyS')
              || keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('ArrowRight') || keys.has('KeyD');
    if (moving) {
      const rollDir = (keys.has('ArrowUp') || keys.has('KeyW')) ? 1 : -1;
      const axis = new THREE.Vector3(facing.z, 0, -facing.x);
      ballMesh.rotateOnWorldAxis(axis, rollDir * MOVE_SPEED * dt / BALL_R);
    }
    return;
  }

  if (ballOwner === 'teammate') {
    // チームメートドリブル
    const facing = new THREE.Vector3(-Math.sin(teammate.rotation.y), 0, -Math.cos(teammate.rotation.y));
    const target = teammate.position.clone().addScaledVector(facing, DRIBBLE_OFFSET);
    target.y = BALL_R;
    ballMesh.position.lerp(target, Math.min(1, 50 * dt));
    ballVel.set(0, 0, 0);
    ballCurveRate = 0;
    return;
  }

  if (ballOwner === 'enemy') {
    // 敵ドリブル
    const facing = new THREE.Vector3(-Math.sin(enemy.rotation.y), 0, -Math.cos(enemy.rotation.y));
    const target = enemy.position.clone().addScaledVector(facing, DRIBBLE_OFFSET);
    target.y = BALL_R;
    ballMesh.position.lerp(target, Math.min(1, 50 * dt));
    ballVel.set(0, 0, 0);
    ballCurveRate = 0;
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
    if      (ballMesh.position.x >  GOAL_X) { scoreGoal('player'); return; }
    else if (ballMesh.position.x < -GOAL_X) { scoreGoal('cpu');    return; }
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

  // ワンショット動作はkeydownで即トリガー（animate()ループを待たない）
  if (gameStarted && !e.repeat) {
    if (e.code === 'KeyF' || e.code === 'KeyG') {
      const lofted = e.code === 'KeyG';
      const power  = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 1.5 : 1.0;
      isKicking = false;
      if (clips['kick'] && mixer) {
        isKicking = true;
        fadeToClip('kick', false);
        setTimeout(() => kickBall(lofted, 0, power), clips['kick'].duration * 0.55 * 1000);
      }
    }
    if (e.code === 'KeyH' || e.code === 'KeyJ') {
      const curveDir = e.code === 'KeyH' ? -1 : 1;
      const power    = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 1.5 : 1.0;
      isKicking = false;
      if (clips['kick'] && mixer) {
        isKicking = true;
        fadeToClip('kick', false);
        setTimeout(() => kickBall(false, curveDir, power), clips['kick'].duration * 0.55 * 1000);
      }
    }
    if (e.code === 'KeyT' && ballOwner !== 'player' && !isTackling) {
      // タックル（ボール非所持時のみ）
      if (clips['tackle'] && mixer) {
        isTackling = true;
        fadeToClip('tackle', false);
      }
    }
    if (e.code === 'KeyZ' && isDribbling && !isSpinning) {
      // スピン（ドリブル中のみ）
      if (clips['spin'] && mixer) {
        isSpinning = true;
        fadeToClip('spin', false);
      }
    }
    if (e.code === 'KeyR' && !isPassing) {
      const powered = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (ballOwner === 'player')        passToTeammate(powered);
      else if (ballOwner === 'teammate') passFromTeammate();
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
let groundY     = 0;
let hasTeammate = true;
let playerScore = 0;
let cpuScore    = 0;
let isGoalScene = false;

// Mixamoのhipボーン位置トラックを除去してモーション間のジャンプを防ぐ
function stripRootMotion(clip) {
  clip.tracks = clip.tracks.filter(
    t => !(t.name.toLowerCase().includes('hips') && t.name.endsWith('.position'))
  );
  return clip;
}

// ── アニメ状態プロキシ（getter/setter で let 変数を共有参照）─────────────
const playerAnim   = {
  get mixer()   { return mixer; },        set mixer(v)   { mixer = v; },
  get current() { return current; },      set current(v) { current = v; },
};
const teammateAnim = {
  get mixer()   { return teammateMixer; },  set mixer(v)   { teammateMixer = v; },
  get current() { return teammateCurrent; },set current(v) { teammateCurrent = v; },
};
const enemyAnim = {
  get mixer()   { return enemyMixer; },   set mixer(v)   { enemyMixer = v; },
  get current() { return enemyCurrent; }, set current(v) { enemyCurrent = v; },
};

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

// ── アニメーションラッパー（呼び出し元は変更不要）────────────────────────
function fadeToClip(name, loop = true)         { fadeToMixerClip(playerAnim,   name, loop); }
function fadeToTeammateClip(name, loop = true) { fadeToMixerClip(teammateAnim, name, loop); }
function fadeToEnemyClip(name, loop = true)    { fadeToMixerClip(enemyAnim,    name, loop); }

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
  playerPickupCooldown = 0;
  if (mixer)           { mixer.stopAllAction(); current = null; }
  if (remotePeerMixer) { remotePeerMixer.stopAllAction(); remotePeerClipAct = {}; }
  fadeToClip('idle');
  fadeToRemoteClip('idle');
  if (goalFlashEl) { goalFlashEl.style.display = 'none'; goalFlashEl.classList.remove('conceded'); }
}

function resetAfterGoal() {
  ballMesh.position.set(0, BALL_R, 0);
  ballVel.set(0, 0, 0);
  ballCurveRate = 0;
  ballOwner = 'none';
  isDribbling = false;
  isKicking = isPassing = isTackling = isSpinning = false;
  playerPickupCooldown = teammatePickupCooldown = 0;

  player.position.set(0, groundY, 0);
  player.rotation.y = 0;

  if (hasTeammate) {
    teammate.position.set(10, groundY, 5);
    teammate.rotation.y = 0;
    teammateKicking = false;
    if (teammateMixer) { teammateMixer.stopAllAction(); teammateCurrent = null; }
    fadeToTeammateClip('idle');
  }

  if (mixer) { mixer.stopAllAction(); current = null; }
  fadeToClip('idle');

  if (hasEnemy) {
    enemy.position.set(-10, groundY, 0);
    enemy.rotation.y = 0;
    enemyState          = 'chase';
    enemyTackling       = false;
    enemyKicking        = false;
    enemyPickupCooldown = 0;
    enemyTackleCooldown = 0;
    if (enemyMixer) { enemyMixer.stopAllAction(); enemyCurrent = null; }
    fadeToEnemyClip('idle');
  }

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
    setTimeout(() => { resetAfterGoal(); isGoalScene = false; }, 2500);
  }
}

const loader = new FBXLoader();

const ANIM_FILES = [
  ['idle',    './animations/idle.fbx'],
  ['walk',    './animations/walk.fbx'],
  ['run',     './animations/run.fbx'],
  ['sprint',  './animations/sprint.fbx'],
  ['kick',    './animations/kick.fbx'],
  ['dribble', './animations/Dribble.fbx'],
  ['pass',    './animations/Pass.fbx'],
  ['tackle',  './animations/Tackle.fbx'],
  ['spin',    './animations/Spin.fbx'],
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
    if (scoreDisplay) scoreDisplay.style.display = 'flex';
    gameStarted = true;
    fadeToClip('idle');
    if (hasTeammate) fadeToTeammateClip('idle');
    if (hasEnemy)    fadeToEnemyClip('idle');
    if (isMultiplayer) fadeToRemoteClip('idle');
  }
}

// ゲーム開始（lobby.jsからimportされる）
export function startGame(config) {
  // フィールドサイズ設定
  const FIELD_PRESETS = {
    full:    { halfW: 51, halfD: 34 },
    medium:  { halfW: 35, halfD: 25 },
    compact: { halfW: 23, halfD: 16 },
  };
  const fs = FIELD_PRESETS[config.fieldSize] || FIELD_PRESETS.full;
  FIELD_HALF_W = fs.halfW;
  FIELD_HALF_D = fs.halfD - 1;
  GOAL_X       = fs.halfW + 1.5;
  GOAL_HALF_Z  = 3.66 * (fs.halfW / 51);
  scene.remove(fieldRoot);
  fieldRoot = buildField(fs.halfW, fs.halfD);
  scene.add(fieldRoot);

  hasTeammate = config.withTeammate;
  hasEnemy    = !!config.enemyFbx;
  if (hasEnemy) CORE_TOTAL++;

  // マルチプレイヤー設定
  if (config.mp) {
    isMultiplayer = true;
    mpRole        = config.mp.role;
    mpHandlers    = config.mp;
    hasTeammate   = false;
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
      mixer.addEventListener('finished', e => {
        if (clips['kick']    && e.action === mixer.clipAction(clips['kick']))    isKicking  = false;
        if (clips['pass']    && e.action === mixer.clipAction(clips['pass']))    isPassing  = false;
        if (clips['tackle']  && e.action === mixer.clipAction(clips['tackle']))  isTackling = false;
        if (clips['spin']    && e.action === mixer.clipAction(clips['spin']))    isSpinning = false;
      });

      if (hasTeammate) {
        const tmFbx = SkeletonUtils.clone(fbx);
        tmFbx.scale.setScalar(0.01);
        tmFbx.rotation.y = Math.PI;
        tmFbx.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            c.material = Array.isArray(c.material)
              ? c.material.map(m => { const mc = m.clone(); mc.color.set(0x88bbff); return mc; })
              : (() => { const mc = c.material.clone(); mc.color.set(0x88bbff); return mc; })();
          }
        });
        teammate.add(tmFbx);
        teammate.position.set(10, player.position.y, 5);
        scene.add(teammate);
        teammateMixer = new THREE.AnimationMixer(tmFbx);
        teammateMixer.addEventListener('finished', e => {
          if (clips['kick'] && e.action === teammateMixer.clipAction(clips['kick'])) teammateKicking = false;
        });
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x2266ff })
        );
        marker.position.set(0, 2.05, 0);
        teammate.add(marker);
      }

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
const RUN_SPEED    = 14;
const TURN_SPEED   = 1.2;
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
  const shift  = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const joyFwd  = joystick.active && joystick.dy < -0.1;
  const joyBwd  = joystick.active && joystick.dy >  0.1;
  const joyStrf = joystick.active && Math.abs(joystick.dx) > 0.1;
  const moving  = fwd || bwd || strafe || joyFwd || joyBwd || joyStrf;
  if (isDribbling && moving && clips['dribble']) return 'dribble';
  if (moving) return ((fwd || joyFwd) && shift && clips['sprint']) ? 'sprint' : (clips['run'] ? 'run' : 'idle');
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

  if (remoteOwns && ballOwner !== 'player') {
    // 相手がボールを保持中 → 最新受信位置を直接適用
    const bs = ballBuf.length > 0 ? ballBuf[ballBuf.length - 1] : null;
    if (bs) {
      ballMesh.position.set(bs.x, bs.y, bs.z);
      ballVel.set(bs.vx ?? 0, bs.vy ?? 0, bs.vz ?? 0);
    }
    ballOwner = 'enemy'; // ローカルの拾得をブロック
  } else if (!isMultiplayer || mpRole === 'host') {
    updateBall(dt);      // ホスト or ソロ: 通常物理
  } else {
    // Guest かつ相手がボールを持っていない場合: Hostの物理を受け取る
    if (ballOwner !== 'player') {
      const bs = interpBuf(ballBuf, Date.now() - 50); // 低遅延で適用
      if (bs) {
        ballMesh.position.x += (bs.x - ballMesh.position.x) * Math.min(1, 20 * dt);
        ballMesh.position.y += (bs.y - ballMesh.position.y) * Math.min(1, 20 * dt);
        ballMesh.position.z += (bs.z - ballMesh.position.z) * Math.min(1, 20 * dt);
        ballVel.set(bs.vx ?? 0, bs.vy ?? 0, bs.vz ?? 0);
      }
    }
  }
  // 'enemy' を継続チェック: 相手がもうボールを持っていなければ解放
  if (isMultiplayer && ballOwner === 'enemy' && !remoteOwns) ballOwner = 'none';

  if (!isMultiplayer) {
    updateTeammate(dt);
    updateEnemy(dt);
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
      const shift    = keys.has('ShiftLeft') || keys.has('ShiftRight');

      // 移動方向はカメラ視点角基準
      const camDir   = new THREE.Vector3(-Math.sin(viewAngle), 0, -Math.cos(viewAngle));
      const camRight = new THREE.Vector3( Math.cos(viewAngle), 0, -Math.sin(viewAngle));

      // Shift+左右 = 平行移動 / 左右のみ = 向きも変える（後退中は向き変更なし）
      const moveVec = new THREE.Vector3();
      let wantTurn  = false;
      if (fwd)               { moveVec.addScaledVector(camDir,    1); wantTurn = true; }
      if (bwd)               { moveVec.addScaledVector(camDir,   -1); }
      if (strafeLt && shift) { moveVec.addScaledVector(camRight, -1); }
      if (strafeRt && shift) { moveVec.addScaledVector(camRight,  1); }
      if (strafeLt && !shift){ moveVec.addScaledVector(camRight, -1); if (!bwd) wantTurn = true; }
      if (strafeRt && !shift){ moveVec.addScaledVector(camRight,  1); if (!bwd) wantTurn = true; }

      // プニコン入力（shift+横のみ = 平行移動: 向き・視点変更しない）
      const joyShift = shift && joystick.active
        && Math.abs(joystick.dx) > 0.05
        && Math.abs(joystick.dy) <= 0.05;
      if (joystick.active) {
        if (Math.abs(joystick.dy) > 0.05) { moveVec.addScaledVector(camDir,   -joystick.dy); wantTurn = true; }
        if (Math.abs(joystick.dx) > 0.05) { moveVec.addScaledVector(camRight,  joystick.dx); if (!joyShift) wantTurn = true; }
      }

      if (moveVec.lengthSq() > 0.001) {
        moveVec.normalize();
        const speed = ((fwd || bwd) && shift) ? RUN_SPEED : MOVE_SPEED;
        player.position.addScaledVector(moveVec, speed * dt);

        if (wantTurn) {
          const targetAngle = Math.atan2(-moveVec.x, -moveVec.z);
          let diff = targetAngle - player.rotation.y;
          while (diff >  Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          player.rotation.y += diff * Math.min(1, 12 * dt);
        }
      }

      player.position.x = Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, player.position.x));
      player.position.z = Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, player.position.z));

      // viewAngle をプレイヤーの向きへゆっくり遅延追従（Q/E・スワイプ中、Shift横移動中は追従しない）
      const shiftStrafeOnly = joyShift
        || (shift && (strafeLt || strafeRt) && !fwd && !bwd && !joystick.active);
      if (!shiftStrafeOnly && !keys.has('KeyQ') && !keys.has('KeyE') && !lookSwipe.active) {
        let camDiff = player.rotation.y - viewAngle;
        while (camDiff >  Math.PI) camDiff -= 2 * Math.PI;
        while (camDiff < -Math.PI) camDiff += 2 * Math.PI;
        viewAngle += camDiff * Math.min(1, 1.5 * dt); // ゆっくり追従（約1〜2秒で追いつく）
      }
    }

    // タックル/スピン中は向いてる方向に自動前進
    if (isTackling || isSpinning) {
      const facing = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y));
      const speed  = isTackling ? MOVE_SPEED * 1.3 : MOVE_SPEED;
      player.position.addScaledVector(facing, speed * dt);
      player.position.y = groundY; // 浮き防止
      player.position.x = Math.max(-FIELD_HALF_W, Math.min(FIELD_HALF_W, player.position.x));
      player.position.z = Math.max(-FIELD_HALF_D, Math.min(FIELD_HALF_D, player.position.z));
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
  // スプリントボタン（押してる間 Shift 扱い）
  const sprintBtn = document.getElementById('btn-sprint');
  if (sprintBtn) {
    sprintBtn.addEventListener('touchstart', e => { e.preventDefault(); keys.add('ShiftLeft'); },   { passive: false });
    sprintBtn.addEventListener('touchend',   e => { e.preventDefault(); keys.delete('ShiftLeft'); }, { passive: false });
    sprintBtn.addEventListener('touchcancel',() => keys.delete('ShiftLeft'));
  }

  // キックボタン（ジョイスティック傾き量でpower決定: 弱押し=弱シュート, フル=強シュート）
  function setupKickBtn(id, lofted, curve) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      if (gameStarted && clips['kick'] && mixer) {
        const joyMag = joystick.active
          ? Math.min(1, Math.sqrt(joystick.dx ** 2 + joystick.dy ** 2))
          : 1.0;
        const power = 0.6 + 0.9 * joyMag; // 0.6(最弱)〜1.5(最強)
        isKicking = false;
        isKicking = true;
        fadeToClip('kick', false);
        setTimeout(() => kickBall(lofted, curve, power), clips['kick'].duration * 0.55 * 1000);
      }
    }, { passive: false });
  }
  setupKickBtn('btn-kick',        false,  0);
  setupKickBtn('btn-loft',        true,   0);
  setupKickBtn('btn-curve-left',  false, -1);
  setupKickBtn('btn-curve-right', false,  1);

  // パスボタン
  const passBtn = document.getElementById('btn-pass');
  if (passBtn) {
    passBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      if (!gameStarted || isPassing) return;
      const powered = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (ballOwner === 'player')        passToTeammate(powered);
      else if (ballOwner === 'teammate') passFromTeammate();
    }, { passive: false });
  }

  // タックルボタン（ボール非所持時のみ有効）
  const tackleBtn = document.getElementById('btn-tackle');
  if (tackleBtn) {
    tackleBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      if (gameStarted && ballOwner !== 'player' && !isTackling && clips['tackle'] && mixer) {
        isTackling = true;
        fadeToClip('tackle', false);
      }
    }, { passive: false });
  }

  // スピンボタン（ドリブル中のみ有効）
  const spinBtn = document.getElementById('btn-spin');
  if (spinBtn) {
    spinBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      if (gameStarted && isDribbling && !isSpinning && clips['spin'] && mixer) {
        isSpinning = true;
        fadeToClip('spin', false);
      }
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
    if (passBtn)   passBtn.style.display   = hasTeammate ? '' : 'none';
  }
  // animate() から呼べるようにグローバル化
  window._updateMobileButtons = updateMobileButtons;
})();

animate();
