import { initializeApp }                              from 'firebase/app';
import { getDatabase, ref, set, get, onValue,
         onDisconnect, remove }                        from 'firebase/database';
import { firebaseConfig }                              from './firebase-config.js';

let db;
function getDb() {
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
  return db;
}

// ランダム4文字コード生成
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ── ルーム作成（host） ────────────────────────────────────────────
export async function createRoom({ charFbx, fieldSize }) {
  const db = getDb();
  let code;
  for (let i = 0; i < 5; i++) {
    code = genCode();
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) break;
  }
  await set(ref(db, `rooms/${code}`), {
    host:   { charFbx, fieldSize },
    guest:  null,
    status: 'waiting',
    ts:     Date.now(),
  });
  // 切断時に自動削除
  onDisconnect(ref(db, `rooms/${code}`)).remove();
  onDisconnect(ref(db, `game/${code}`)).remove();
  return code;
}

// ── ルーム参加（guest） ───────────────────────────────────────────
export async function joinRoom(code, { charFbx }) {
  const db = getDb();
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists())             throw new Error('ルームが見つかりません');
  const room = snap.val();
  if (room.status !== 'waiting') throw new Error('このルームはすでに満員です');
  await set(ref(db, `rooms/${code}/guest`),  { charFbx });
  await set(ref(db, `rooms/${code}/status`), 'playing');
  return room; // host の設定を返す
}

// ── ルーム監視 ────────────────────────────────────────────────────
export function watchRoom(code, cb) {
  return onValue(ref(getDb(), `rooms/${code}`), s => cb(s.val()));
}

// ── ゲーム状態の送受信 ────────────────────────────────────────────
export function publishPlayer(code, role, state) {
  set(ref(getDb(), `game/${code}/${role}`), state);
}

export function publishBall(code, state) {
  set(ref(getDb(), `game/${code}/ball`), state);
}

export function publishScore(code, score) {
  set(ref(getDb(), `game/${code}/score`), score);
}

export function watchGame(code, cb) {
  return onValue(ref(getDb(), `game/${code}`), s => {
    if (s.exists()) cb(s.val());
  });
}

// ── ルーム削除 ────────────────────────────────────────────────────
export async function cleanupRoom(code) {
  const db = getDb();
  await Promise.all([
    remove(ref(db, `rooms/${code}`)),
    remove(ref(db, `game/${code}`)),
  ]);
}
