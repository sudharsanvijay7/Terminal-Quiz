/*
  Terminal Quiz - Fullscreen Shell
  Served at "/" (start.html). Asks for fullscreen ONCE, shows a short boot screen,
  then loads the whole event (landing -> login -> rounds -> leaderboard) inside an iframe.
  Because this top page never reloads, fullscreen is never dropped between pages.
  Leaving fullscreen shows a themed "are you sure?" popup and counts a strike.
*/
(function(){
  'use strict';

  // keep the old admin shortcut working: http://IP:3000/#admin
  if (location.hash === '#admin') { location.replace('/admin-login.html'); return; }

  var KEY = 'tq_fs_violations';
  var LAST = 'tq_last_page';
  var started = false;      // boot finished and event is on screen
  var armed = false;        // currently counted as "in fullscreen"
  var modal, pill, els = {};

  var boot = document.getElementById('boot');
  var bootBtn = document.getElementById('boot-btn');
  var bootLog = document.getElementById('boot-log');
  var bootFill = document.getElementById('boot-fill');
  var bootProg = document.getElementById('boot-progress');
  var bootTag = document.getElementById('boot-tag');
  var frame = document.getElementById('frame');

  function apiFull(){ return document.fullscreenElement || document.webkitFullscreenElement; }
  // also treat browser F11 as fullscreen
  function isFull(){
    if (apiFull()) return true;
    return window.innerHeight >= screen.height - 2 && window.innerWidth >= screen.width - 2;
  }
  function strikes(){ return parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0; }
  function lastPage(){
    var p = sessionStorage.getItem(LAST);
    return (p && p.charAt(0) === '/' && p.indexOf('//') !== 0) ? p : '';
  }

  function enter(){
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return Promise.resolve();
    var p;
    try { p = fn.call(el); } catch(e){ return Promise.resolve(); }
    return Promise.resolve(p).then(function(){
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
          '<span class="fsg-tag">\u26A0 SECURITY ALERT</span>' +
          '<div class="fsg-title">Exit <b>fullscreen</b>?</div>' +
          '<div class="fsg-log" id="fsg-log"></div>' +
          '<div class="fsg-strikes" id="fsg-strikes"></div>' +
          '<div class="fsg-actions">' +
            '<button class="btn" id="fsg-stay" type="button">[ STAY IN FULLSCREEN ]</button>' +
            '<button class="btn alt" id="fsg-exit" type="button">[ YES, EXIT ]</button>' +
          '</div>' +
          '<div class="fsg-foot">Every exit is flagged. Repeated violations may lead to disqualification.</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    els.log = modal.querySelector('#fsg-log');
    els.strikes = modal.querySelector('#fsg-strikes');
    modal.querySelector('#fsg-stay').addEventListener('click', function(){ enter(); });
    modal.querySelector('#fsg-exit').addEventListener('click', function(){
      modal.className = '';
      pill.style.display = 'block';
    });

    pill = document.createElement('button');
    pill.id = 'fsg-toggle';
    pill.type = 'button';
    pill.textContent = '[ RE-ENTER FULLSCREEN ]';
    pill.style.display = 'none';
    pill.addEventListener('click', function(){ enter(); });
    document.body.appendChild(pill);
  }

  function showExitPopup(){
    var n = strikes();
    els.log.innerHTML =
      '<div><span class="bad">!</span> event: <span class="bad">FULLSCREEN_EXIT</span></div>' +
      '<div class="dim">[' + new Date().toLocaleTimeString() + '] exiting fullscreen is not permitted</div>' +
      '<div class="dim">[..] strike count ....... <span class="bad">' + n + '</span></div>' +
      '<div><span class="bad">&gt;</span> Are you sure you want to exit?<span class="cur"></span></div>';
    els.strikes.innerHTML = '<span>STRIKES</span>' + pips(Math.min(n, 3)) + '<span>' + n + ' logged</span>';
    pill.style.display = 'none';
    modal.className = 'show warn';
  }

  function check(){
    if (!started) return;
    if (isFull()) {
      armed = true;
      modal.className = '';
      pill.style.display = 'none';
    } else if (armed) {
      armed = false;
      sessionStorage.setItem(KEY, String(strikes() + 1));
      showExitPopup();
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
        if (i === steps.length - 1) { /* last line keeps the cursor */ }
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
        frame.hidden = false;
        boot.style.display = 'none';
        started = true;
        check();
        frame.focus();
      }, 250);
    });
  }

  function init(){
    buildModal();
    if (lastPage()) {
      bootBtn.textContent = '[ RESUME EVENT ]';
    }
    bootBtn.addEventListener('click', function(){
      enter().then(runBoot);
    });

    // remember where the participant was, so a refresh resumes the same page
    frame.addEventListener('load', function(){
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