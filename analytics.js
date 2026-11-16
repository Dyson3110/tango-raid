// 単語レイド：アクセス解析（Google Analytics 4）
// ・SITE_CONFIG.gaId が空なら何も読み込みません。
// ・ニックネーム、教室コード、点数など個人に結びつく情報は送りません（下の ALLOW にある項目だけ送信）。
// ・広告用の機能（Googleシグナル、広告のパーソナライズ）は使いません。
// ・privacy.html で「計測しない」を選んだブラウザでは読み込みません。
(function () {
  window.tangoMetric = function () {};
  var id = window.SITE_CONFIG && window.SITE_CONFIG.gaId;
  var off = false;
  try { off = localStorage.getItem('tango-analytics-off') === '1'; } catch (e) {}
  if (!id || off) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);

  // 送ってよいイベントと項目
  var ALLOW = {
    game_start: ['play', 'mode', 'deck', 'secs'],   // ゲーム開始回数（ひとり／クラス）
    room_create: [],                                 // 対戦ルーム開催回数
    room_start: ['players', 'mode', 'deck', 'secs'], // 開始時の参加者数
    room_join: []                                    // 参加者数（参加した回数）
  };
  window.tangoMetric = function (name, p) {
    var keys = ALLOW[name];
    if (!keys) return;
    var o = {};
    keys.forEach(function (k) { if (p && p[k] != null) o[k] = p[k]; });
    gtag('event', name, o);
  };
})();
