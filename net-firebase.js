// 単語レイド：Firebase に接続して、通信オブジェクトを index.html に渡す
// site-config.js に Firebase の設定がなければ何もしません（ひとりモードだけ動きます）。
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set, update, remove, onValue, onDisconnect, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { createNet } from './net-core.js';

const done = v => { if (window.__tangoNetResolve) window.__tangoNetResolve(v); };

(async () => {
  try {
    const c = window.SITE_CONFIG && window.SITE_CONFIG.firebase;
    if (!c || !c.apiKey || !c.databaseURL) return done(null);
    const app = initializeApp(c);
    const auth = getAuth(app);
    await setPersistence(auth, browserSessionPersistence); // タブごとに別の匿名IDにする
    const { user } = await signInAnonymously(auth);        // 本名・メールアドレスは使わない
    done(createNet({ db: getDatabase(app), ref, get, set, update, remove, onValue, onDisconnect, runTransaction }, user.uid));
  } catch (e) {
    console.error('[単語レイド] Firebase に接続できませんでした', e);
    done(null);
  }
})();
