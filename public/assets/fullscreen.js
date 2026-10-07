(function(){
  'use strict';
  if (window.self !== window.top) return;

  var admin = location.pathname.indexOf('/admin') !== -1;
  if (!admin) { location.replace('/' + location.hash); return; }

  function addToggle(){
    var b = document.createElement('button');
    b.id = 'fsg-toggle';
    b.type = 'button';
    b.textContent = '[ FULLSCREEN ]';
    b.addEventListener('click', function(){
      var d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { var el = d.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }
    });
    document.body.appendChild(b);
  }
  if (document.body) addToggle(); else document.addEventListener('DOMContentLoaded', addToggle);
})();