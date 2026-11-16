// 単語レイド：クラス対戦の通信（Firebase Realtime Database 版）
//
// index.html は claude.ai の room 機能と同じ形のオブジェクト（roomNS）を使っています。
// このファイルは、同じ使い方ができるオブジェクトを Firebase で作ります。
// Firebase の関数は引数 fb で受け取るので、テストでは偽物に差し替えられます。
//
// データの置き場所
//   rooms/{6けたコード}/meta            { host: 先生のID, created: 作成時刻 }
//   rooms/{6けたコード}/players/{ID}    { role, nick, dmg, combo, state }  … 部屋の全員が読める
//   rooms/{6けたコード}/stats/{ID}      { st, sum }                        … 先生だけが読める
//   rooms/{6けたコード}/start           { mode, deck, secs, epoch, words? } … 先生だけが書ける

export const ROOM_TTL = 6 * 60 * 60 * 1000; // 作成から6時間で空き部屋として扱う
const PUB = ['role', 'nick', 'dmg', 'combo', 'state'];
const PRIV = ['st', 'sum'];

const err = (code, message) => Object.assign(new Error(message || code), { code });
const mapErr = e => err(/permission/i.test(String(e && (e.code || e.message))) ? 'not_permitted' : 'upstream_error', e && e.message);

export function createNet(fb, uid) {
  const { db, ref, get, set, update, remove, onValue, onDisconnect, runTransaction } = fb;
  const now = () => Date.now();

  // 先生用：使われていない6けたコードを確保する（重複防止）
  async function create() {
    for (let i = 0; i < 12; i++) {
      const code = String(100000 + Math.floor(Math.random() * 900000));
      let r;
      try {
        r = await runTransaction(ref(db, `rooms/${code}`), cur => {
          if (cur && cur.meta && cur.meta.created > now() - ROOM_TTL) return; // 使用中 → この番号はやめる
          return { meta: { host: uid, created: now() } };
        }, { applyLocally: false });
      } catch (e) { throw mapErr(e); }
      if (r && r.committed) return code;
    }
    throw err('limit_reached', '空いている教室コードが見つかりませんでした');
  }

  // 部屋に入る（name は index.html が渡す 'raid-123456'）
  async function join(name) {
    const m = /^raid-(\d{6})$/.exec(String(name));
    if (!m) throw err('invalid_argument');
    const base = `rooms/${m[1]}`;
    let meta;
    try { meta = (await get(ref(db, `${base}/meta`))).val(); } catch (e) { throw mapErr(e); }
    if (!meta || !(meta.created > now() - ROOM_TTL)) throw err('not_found', '部屋が見つかりません');

    const isHost = meta.host === uid;
    const listeners = new Set(), unsubs = [], mine = {};
    let players = {}, stats = {}, snapshot = Object.freeze([]), started = false, left = false;

    const build = () => {
      snapshot = Object.freeze(Object.entries(players || {}).map(([id, p]) => Object.freeze({
        peer: id, by: null, isMe: id === uid, sameTab: id === uid, kind: 'viewer', guest: false,
        presence: Object.freeze({ ...(p || {}), ...(isHost && stats && stats[id] || {}) }),
        updatedAt: now()
      })));
      const change = { peers: snapshot, joined: [], left: [], updated: [] };
      listeners.forEach(f => { try { f(change); } catch (e) { console.error(e); } });
    };
    unsubs.push(onValue(ref(db, `${base}/players`), s => { players = s.val() || {}; build(); }, () => {}));
    if (isHost) unsubs.push(onValue(ref(db, `${base}/stats`), s => { stats = s.val() || {}; build(); }, () => {}));

    return {
      name,
      async presence(patch) {
        if (left) throw err('invalid_argument');
        if (isHost) return; // 先生の状態は保存しない
        const pu = {}, pr = {};
        for (const [k, v] of Object.entries(patch || {})) {
          if (PUB.includes(k)) { pu[k] = v; mine[k] = v; }
          else if (PRIV.includes(k)) pr[k] = v;
        }
        try {
          if (!started) {
            started = true;
            await onDisconnect(ref(db, `${base}/players/${uid}`)).remove();
            await onDisconnect(ref(db, `${base}/stats/${uid}`)).remove();
            await set(ref(db, `${base}/players/${uid}`), { ...mine });
          } else if (Object.keys(pu).length) {
            await update(ref(db, `${base}/players/${uid}`), pu);
          }
          if (Object.keys(pr).length) await update(ref(db, `${base}/stats/${uid}`), pr);
        } catch (e) { throw mapErr(e); }
      },
      peers() { return snapshot; },
      onPeers(fn) {
        listeners.add(fn);
        setTimeout(() => { if (listeners.has(fn)) fn({ peers: snapshot, joined: snapshot, left: [], updated: [] }); }, 0);
        return () => listeners.delete(fn);
      },
      on(topic, fn) {
        if (topic !== 'start') return () => {};
        let first = true; // 参加した時点で残っている古い合図は無視する
        const u = onValue(ref(db, `${base}/start`), s => {
          if (first) { first = false; return; }
          const v = s.val();
          if (v) fn({ topic, data: v, peer: '', by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false });
        }, () => {});
        unsubs.push(u);
        return u;
      },
      async emit(topic, data) {
        if (topic !== 'start') throw err('invalid_argument');
        if (!isHost) throw err('not_permitted');
        try { await set(ref(db, `${base}/start`), data); } catch (e) { throw mapErr(e); }
      },
      connected() { return true; },
      onConnection(fn) { setTimeout(() => fn(true), 0); return () => {}; },
      async leave() {
        if (left) return;
        left = true;
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        listeners.clear();
        try {
          if (isHost) await remove(ref(db, base)); // 部屋を閉じる → 部屋ごと消す
          else { await remove(ref(db, `${base}/players/${uid}`)); await remove(ref(db, `${base}/stats/${uid}`)); }
        } catch (e) {}
      }
    };
  }

  return { join, create };
}
