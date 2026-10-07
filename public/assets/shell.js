/*
  Terminal Quiz - Fullscreen Shell
  Served at "/" (start.html). Asks for fullscreen ONCE, shows a short boot screen,
  then loads the whole event inside an iframe so fullscreen is never dropped.

  Leaving fullscreen while logged in:
    1. the server logs a warning (admin sees it in the activity log)
    2. a popup asks "Leave the event?"  -> STAY goes back to fullscreen
    3. YES, LEAVE EVENT tells the server, which locks that participant ID out
       (login is refused until the admin reinstates them).
*/
(function(){
  'use strict';

  // keep the old admin shortcut working: http://IP:3000/#admin
  if (location.hash === '#admin') { location.replace('/admin-login.html'); return; }

  var KEY = 'tq_fs_violations';
  var LAST = 'tq_last_page';
  var started = false;      // boot finished and event is on screen
  var armed = false;        // currently counted as "in fullscreen"
  var locked = false;       // participant confirmed leaving
  var blocked = false;      // device used its 3 fullscreen exits before joining: admin must allow
  var DEV = 'tq_device', PRE = 'tq_pre_strikes', PREB = 'tq_pre_blocked';
  var pollT = null;
  var bootDone = false;     // boot animation + iframe finished, waiting for fullscreen to reveal the event
  var modal, pill, els = {};

  var boot = document.getElementById('tq-boot');
  var bootBtn = document.getElementById('boot-btn');
  var bootLog = document.getElementById('boot-log');
  var bootFill = document.getElementById('boot-fill');
  var bootProg = document.getElementById('boot-progress');
  var bootTag = document.getElementById('boot-tag');
  var frame = document.getElementById('tq-frame');

  function apiFull(){ return document.fullscreenElement || document.webkitFullscreenElement; }
  // also treat browser F11 as fullscreen
  function isFull(){
    if (apiFull()) return true;
    return window.innerHeight >= screen.height - 2 && window.innerWidth >= screen.width - 2;
  }
  function deviceId(){
    try {
      var d = localStorage.getItem(DEV);
      if (d && /^[a-zA-Z0-9]{8,64}$/.test(d)) return d;
      var a = new Uint8Array(12), h = '';
      (window.crypto || window.msCrypto).getRandomValues(a);
      for (var i = 0; i < a.length; i++) h += ('0' + a[i].toString(16)).slice(-2);
      localStorage.setItem(DEV, h);
      return h;
    } catch(e){ return 'nostorage' + Math.random().toString(36).slice(2, 12); }
  }
  function preStrikes(){ try { return parseInt(localStorage.getItem(PRE) || '0', 10) || 0; } catch(e){ return 0; } }
  function postDev(url){
    return fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ deviceId: deviceId() }), keepalive:true })
      .then(function(r){ return r.json(); })
      .catch(function(){ return null; });
  }
  function strikes(){ return parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0; }
  function lastPage(){
    var p = sessionStorage.getItem(LAST);
    return (p && p.charAt(0) === '/' && p.indexOf('//') !== 0) ? p : '';
  }
  function token(){ try { return localStorage.getItem('tq_token'); } catch(e){ return null; } }
  function inAdmin(){
    try { return frame.contentWindow.location.pathname.indexOf('/admin') !== -1; } catch(e){ return false; }
  }
  function post(url){
    var t = token();
    if (!t) return Promise.resolve(null);
    try {
      return fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + t }, body:'{}', keepalive:true })
        .then(function(r){ return r.json(); })
        .catch(function(){ return null; });
    } catch(e){ return Promise.resolve(null); }
  }

  function enter(){
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return Promise.resolve();
    var p;
    try { p = fn.call(el); } catch(e){ return Promise.resolve(); }
    return Promise.resolve(p).then(function(){
      if (isFull()) armed = true;
      // make Esc "hold to exit" where supported (secure contexts only)
      try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']); } catch(e){}
    }).catch(function(){});
  }

  function pips(n){
    var h = '';
    for (var i = 0; i < 3; i++) h += '<span class="pip' + (i < n ? ' on' : '') + '"></span>';
    return h;
  }

  /* ---------- exit popup ---------- */
  function buildModal(){
    modal = document.createElement('div');
    modal.id = 'fsg';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="fsg-win">' +
        '<div class="fsg-bar"><i></i><i></i><i></i><span>root@terminal-quiz:~/secure-mode</span></div>' +
        '<div class="fsg-body">' +
          '<span class="fsg-tag" id="fsg-tag"></span>' +
          '<div class="fsg-title" id="fsg-title"></div>' +
          '<div class="fsg-log" id="fsg-log"></div>' +
          '<div class="fsg-strikes" id="fsg-strikes"></div>' +
          '<div class="fsg-actions" id="fsg-actions">' +
            '<button class="btn" id="fsg-stay" type="button">[ STAY IN FULLSCREEN ]</button>' +
            '<button class="btn alt" id="fsg-exit" type="button">[ YES, LEAVE EVENT ]</button>' +
          '</div>' +
          '<div class="fsg-foot" id="fsg-foot"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    els.tag = modal.querySelector('#fsg-tag');
    els.title = modal.querySelector('#fsg-title');
    els.log = modal.querySelector('#fsg-log');
    els.strikes = modal.querySelector('#fsg-strikes');
    els.actions = modal.querySelector('#fsg-actions');
    els.exit = modal.querySelector('#fsg-exit');
    els.foot = modal.querySelector('#fsg-foot');
    modal.querySelector('#fsg-stay').addEventListener('click', function(){ enter(); });
    els.exit.addEventListener('click', leaveEvent);

    pill = document.createElement('button');
    pill.id = 'fsg-toggle';
    pill.type = 'button';
    pill.textContent = '[ RE-ENTER FULLSCREEN ]';
    pill.style.display = 'none';
    pill.addEventListener('click', function(){ enter(); });
    document.body.appendChild(pill);
  }

  function showExitPopup(joined, n){
    if (n == null) n = strikes();
    var time = new Date().toLocaleTimeString();
    modal.className = 'show warn';
    els.tag.textContent = '\u26A0 WARNING';
    els.actions.style.display = '';
    els.strikes.style.display = '';
    els.strikes.innerHTML = '<span>WARNINGS</span>' + pips(Math.min(n, 3)) + '<span>' + n + ' of 3</span>';
    pill.style.display = 'none';
    if (joined) {
      els.title.innerHTML = 'Leave the <b>event</b>?';
      els.log.innerHTML =
        '<div><span class="bad">!</span> event: <span class="bad">FULLSCREEN_EXIT</span></div>' +
        '<div class="dim">[' + time + '] reported to the coordinator</div>' +
        '<div class="dim">[..] warnings ......... <span class="bad">' + n + ' / 3</span></div>' +
        '<div class="dim">[..] 3 warnings = locked out until the admin approves</div>' +
        '<div class="dim">[..] leaving now ....... <span class="bad">PERMANENT</span></div>' +
        '<div><span class="bad">&gt;</span> Do you really want to get out? You can NOT join again<span class="cur"></span></div>';
      els.exit.style.display = '';
      els.foot.textContent = 'Stay in fullscreen to keep playing. Leaving cannot be undone by you.';
    } else {
      els.title.innerHTML = 'Fullscreen <b>required</b>';
      els.log.innerHTML =
        '<div><span class="bad">!</span> event: <span class="bad">FULLSCREEN_EXIT</span></div>' +
        '<div class="dim">[' + time + '] fullscreen is needed for the event</div>' +
        '<div><span class="bad">&gt;</span> Return to fullscreen to continue<span class="cur"></span></div>';
      els.exit.style.display = 'none';
      els.strikes.innerHTML = '<span>WARNINGS</span>' + pips(Math.min(n, 3)) + '<span>' + n + ' of 3</span>';
      els.log.innerHTML +=
        '<div class="dim">[..] warnings ......... <span class="bad">' + n + ' / 3</span></div>' +
        '<div class="dim">[..] 3 warnings = blocked until the admin allows you</div>';
      els.foot.textContent = 'Fullscreen is required for the whole event. After 3 exits only the admin can let you in.';
    }
  }

  function showLocked(reason){
    modal.className = 'show warn';
    els.tag.textContent = 'ACCESS REVOKED';
    els.title.innerHTML = 'You have <b>left</b> the event';
    els.log.innerHTML =
      '<div><span class="bad">!</span> event: <span class="bad">PARTICIPANT_EXITED</span></div>' +
      '<div class="dim">[..] reason ........... <span class="bad">' + (reason || 'left the event') + '</span></div>' +
      '<div class="dim">[..] session .......... <span class="bad">TERMINATED</span></div>' +
      '<div class="dim">[..] rejoin ........... <span class="bad">DENIED</span></div>' +
      '<div><span class="bad">&gt;</span> Please contact the event coordinator<span class="cur"></span></div>';
    els.strikes.style.display = 'none';
    els.actions.style.display = 'none';
    els.foot.textContent = 'You can close this tab.';
  }

  function showDeviceBlocked(code){
    modal.className = 'show warn';
    els.tag.textContent = 'ENTRY BLOCKED';
    els.title.innerHTML = 'Ask the <b>admin</b> to let you in';
    els.log.innerHTML =
      '<div><span class="bad">!</span> event: <span class="bad">FULLSCREEN_EXIT_LIMIT</span></div>' +
      '<div class="dim">[..] exits before joining . <span class="bad">3 / 3</span></div>' +
      '<div class="dim">[..] device code ........ <span class="bad">' + (code || deviceId().slice(0, 6).toUpperCase()) + '</span></div>' +
      '<div class="dim">[..] entry ............... <span class="bad">BLOCKED</span></div>' +
      '<div><span class="bad">&gt;</span> Show this code to the event coordinator<span class="cur"></span></div>';
    els.strikes.style.display = 'none';
    els.actions.style.display = 'none';
    pill.style.display = 'none';
    els.foot.textContent = 'This screen unlocks by itself once the admin allows you.';
  }

  function blockDevice(code){
    blocked = true;
    try { localStorage.setItem(PREB, '1'); } catch(e){}
    try { frame.src = 'about:blank'; } catch(e){}
    frame.hidden = true;
    showDeviceBlocked(code);
    clearInterval(pollT);
    pollT = setInterval(function(){
      postDev('/api/device-status').then(function(r){
        if (r && r.blocked === false) {            // admin allowed this device: start fresh
          clearInterval(pollT);
          try { localStorage.removeItem(PRE); localStorage.removeItem(PREB); } catch(e){}
          location.reload();
        }
      });
    }, 3000);
  }

  function lockNow(reason){
    locked = true;
    try { localStorage.removeItem('tq_token'); } catch(e){}
    try { frame.src = 'about:blank'; } catch(e){}
    frame.hidden = true;
    pill.style.display = 'none';
    showLocked(reason);
  }

  function leaveEvent(){
    post('/api/exit-event');                 // server marks this ID as exited -> login refused
    lockNow('left the event');
  }

  function check(){
    if (locked || blocked) return;
    if (isFull()) {
      armed = true;
      modal.className = '';
      pill.style.display = 'none';
      if (bootDone && !started) finishStart();            // came back to fullscreen after leaving during loading
    } else if (armed) {
      armed = false;
      if (inAdmin()) { pill.style.display = 'block'; return; }   // admins are never locked out
      var joined = !!token();
      if (!joined) {                                              // before entering the event: only 3 exits allowed
        var n = preStrikes() + 1;
        try { localStorage.setItem(PRE, String(n)); } catch(e){}
        if (n >= 3) blockDevice();
        else showExitPopup(false, n);
        postDev('/api/prejoin-violation').then(function(r){
          if (!r || blocked) return;
          if (r.blocked) blockDevice(r.code);
          else if (modal.className && r.attempts > preStrikes()) { try { localStorage.setItem(PRE, String(r.attempts)); } catch(e){} showExitPopup(false, r.attempts); }
        });
        return;
      }
      sessionStorage.setItem(KEY, String(strikes() + 1));
      showExitPopup(joined, strikes());
      if (joined) {
        post('/api/violation').then(function(r){                  // logged for the admin; 3rd exit locks the ID
          if (!r || locked) return;
          if (r.locked) lockNow('3 fullscreen exits');
          else if (modal.className) showExitPopup(true, r.attempts);
        });
      }
    }
  }

  /* ---------- boot sequence ---------- */
  function line(html){
    var d = document.createElement('div');
    d.innerHTML = html;
    bootLog.appendChild(d);
  }

  function runBoot(){
    bootBtn.disabled = true;
    bootBtn.style.display = 'none';
    bootProg.style.display = 'block';
    bootTag.textContent = 'LOADING';
    bootLog.innerHTML = '<div><span class="ok">$</span> ./start-event --fullscreen</div>';

    var steps = [
      '<span class="ok">[ OK ]</span> secure display ........ fullscreen',
      '<span class="ok">[ OK ]</span> event server .......... connected',
      '<span class="ok">[ OK ]</span> loading interface ..... <span class="cur"></span>'
    ];
    var i = 0;
    var timer = setInterval(function(){
      if (i < steps.length) {
        line(steps[i]);
        bootFill.style.width = Math.round(((i + 1) / steps.length) * 85) + '%';
        i++;
      } else {
        clearInterval(timer);
      }
    }, 450);

    var target = lastPage() || '/index.html';
    var minWait = new Promise(function(r){ setTimeout(r, 1700); });
    var loaded = new Promise(function(r){
      frame.addEventListener('load', function onFirst(){ frame.removeEventListener('load', onFirst); r(); });
      frame.src = target;
    });
    Promise.all([minWait, loaded]).then(function(){
      bootFill.style.width = '100%';
      setTimeout(function(){
        bootDone = true;
        if (isFull()) { finishStart(); return; }
        // fullscreen was left (or refused) while loading: keep the event hidden until the participant is back in fullscreen
        if (!modal.className) showExitPopup(!!token(), token() ? strikes() : preStrikes());
      }, 250);
    });
  }

  function finishStart(){
    if (started || locked || blocked) return;
    started = true;
    frame.hidden = false;
    boot.style.display = 'none';
    armed = true;
    check();
    frame.focus();
  }

  function init(){
    buildModal();
    // a blocked device stays blocked after refresh / reopening the tab until the admin allows it
    var wasBlocked = false;
    try { wasBlocked = localStorage.getItem(PREB) === '1' || preStrikes() >= 3; } catch(e){}
    postDev('/api/device-status').then(function(r){
      if (r && r.blocked) blockDevice(r.code);
      else if (r && !r.blocked) { try { localStorage.removeItem(PREB); if (r.attempts) localStorage.setItem(PRE, String(r.attempts)); else localStorage.removeItem(PRE); } catch(e){} if (blocked) location.reload(); }
      else if (wasBlocked) blockDevice();               // server unreachable: stay blocked
    });
    if (wasBlocked) blockDevice();
    if (lastPage()) {
      bootBtn.textContent = '[ RESUME EVENT ]';
    }
    bootBtn.addEventListener('click', function(){
      if (blocked) return;
      enter().then(runBoot);
    });

    // remember where the participant was, so a refresh resumes the same page
    frame.addEventListener('load', function(){
      if (locked) return;
      try {
        var l = frame.contentWindow.location;
        var p = l.pathname + l.search + l.hash;
        if (l.pathname !== '/' && l.pathname !== '/start.html') sessionStorage.setItem(LAST, p);
      } catch(e){}
    });

    document.addEventListener('fullscreenchange', check);
    document.addEventListener('webkitfullscreenchange', check);
    var t;
    window.addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(check, 150); });
  }

  init();
})();