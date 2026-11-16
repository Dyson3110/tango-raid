// 単語レイド：公開版の設定
// Firebase の設定値は、ブラウザに配る前提の公開してよい値です（安全性は database.rules.json で守ります）。
// 空のままだと、クラス機能とアクセス解析は無効になり、ひとりモードだけ動きます。
window.SITE_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",   // 例: https://xxxx-default-rtdb.asia-southeast1.firebasedatabase.app
    projectId: "",
    appId: ""
  },
  gaId: ""             // Google Analytics 4 の測定ID。例: G-XXXXXXXXXX
};
