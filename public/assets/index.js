$('#app').innerHTML=layout(`
<main class="home">

  <section class="zoom" id="zoom">
    <div class="stage" id="stage">
      <div class="zoom-glow"></div>
      <div class="zoom-hero" id="zhero"><div class="zt">
        <p class="h-eyebrow" id="eyebrow">/ welcome to the</p>
        <h1 class="h-title"><span class="glitch" data-t="Terminal">Terminal</span><span class="o"><i class="q" id="q">Q</i><b class="bl" id="bl"></b>uiz</span></h1>
        <p class="h-type"><em>&gt;</em> <span id="tw"></span><i class="h-caret"></i></p>
      </div></div>
      <aside class="h-pane" id="pane">
        <div class="h-bar"><b></b><b></b><b></b><span>rounds.sh</span></div>
        <div class="h-boot" id="boot"></div>
        <div class="h-row"><span class="h-n">01</span><div><h3>Technical Quiz</h3><p>20 questions · 20 minutes · 20 marks</p></div></div>
        <div class="h-row"><span class="h-n">02</span><div><h3>Terminal Quiz</h3><p>5 challenges · 30 minutes · command-line investigation</p></div></div>
      </aside>
    </div>
  </section>

  <p class="h-sec">$ cat how_it_works.txt</p>
  <ol class="h-steps" id="steps">
    <li><b>01</b><span>Join with your participant ID.</span></li>
    <li><b>02</b><span>Complete the timed technical quiz.</span></li>
    <li><b>03</b><span>Solve five terminal challenges.</span></li>
    <li><b>04</b><span>View the final leaderboard when published.</span></li>
  </ol>

  <div class="h-btns big">
    <a class="h-btn" href="/participant-login.html">ENTER EVENT →</a>
    <a class="h-btn ghost" href="/admin-login.html">ADMIN CONTROL</a>
  </div>
</main>`);

/* remove the "COLLEGE SYMPOSIUM • LAN EVENT" text from the top bar */
document.querySelectorAll('#app *').forEach(e=>{
  if(!e.children.length && /symposium/i.test(e.textContent)) e.remove();
});

/* looping typewriter (unchanged) */
(function(){
  const el=document.getElementById('tw'); if(!el) return;
  const words=['Operating Systems.','Linux fundamentals.','Terminal problem solving.','Think. Type. Solve.'];
  let w=0,i=0,del=false;
  (function tick(){
    const t=words[w];
    el.textContent=t.slice(0,i);
    if(!del&&i===t.length){del=true;return setTimeout(tick,1400)}
    if(del&&i===0){del=false;w=(w+1)%words.length;return setTimeout(tick,350)}
    i+=del?-1:1;
    setTimeout(tick,del?35:70);
  })();
})();

/* matrix rain background */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c=document.createElement('canvas'); c.id='rain'; document.body.prepend(c);
  const x=c.getContext('2d'), chars='01$#>_/\\|{}[]<>=+*ABCDEF'.split(''), fs=16;
  let cols,drops;
  const size=()=>{c.width=innerWidth;c.height=innerHeight;cols=Math.ceil(c.width/fs);drops=Array.from({length:cols},()=>Math.random()*-50)};
  size(); addEventListener('resize',size);
  setInterval(()=>{
    if(document.body.classList.contains('scrolling')) return;
    x.fillStyle='rgba(3,8,5,.12)'; x.fillRect(0,0,c.width,c.height);
    x.font=fs+'px monospace';
    drops.forEach((y,i)=>{
      x.fillStyle=Math.random()>.97?'#d6ffe8':'#27b86a';
      x.fillText(chars[Math.random()*chars.length|0],i*fs,y*fs);
      drops[i]=(y*fs>c.height&&Math.random()>.975)?0:y+1;
    });
  },50);
})();

/* boot log typing */
(function(){
  const el=document.getElementById('boot'); if(!el) return;
  const lines=['[<span class="ok"> OK </span>] mounting /dev/quiz','[<span class="ok"> OK </span>] LAN server online','[<span class="ok"> OK </span>] rounds loaded: 2','[<span class="ok"> OK </span>] awaiting participants_'];
  let n=0;
  (function next(){ if(n>=lines.length) return; el.insertAdjacentHTML('beforeend',lines[n++]+'<br>'); setTimeout(next,450); })();
})();

/* live clock */
(function(){
  const c=document.getElementById('clk');
  const t=()=>{ if(c) c.textContent=new Date().toLocaleTimeString('en-GB'); };
  t(); setInterval(t,1000);
})();


/* cursor spotlight on the pane */
(function(){
  const p=document.getElementById('pane'); if(!p) return;
  p.addEventListener('pointermove',e=>{
    const r=p.getBoundingClientRect();
    p.style.setProperty('--mx',(e.clientX-r.left)+'px');
    p.style.setProperty('--my',(e.clientY-r.top)+'px');
  });
})();

/* press Enter to join */
addEventListener('keydown',e=>{
  if(e.key==='Enter' && !/INPUT|TEXTAREA|A|BUTTON/.test(document.activeElement.tagName))
    location.href='/participant-login.html';
});

/* steps: reveal one by one, typing each line */
(function(){
  const box=document.getElementById('steps'); if(!box) return;
  const items=[...box.children].map(li=>{const s=li.querySelector('span');const t=s.textContent;s.textContent='';return {li,s,t}});
  let started=false; box.classList.add('seq');
  function run(k){
    if(k>=items.length) return;
    const {li,s,t}=items[k]; li.classList.add('on'); let i=0;
    (function type(){ s.textContent=t.slice(0,++i); if(i<t.length) setTimeout(type,28); else setTimeout(()=>run(k+1),350); })();
  }
  new IntersectionObserver((e,o)=>{ if(e[0].isIntersecting&&!started){started=true;o.disconnect();run(0)} },{threshold:.35}).observe(box);
})();


/* ===== v9: CYBER LAYER =====  */
document.body.insertAdjacentHTML('beforeend',`<div class="floor"></div>
<div class="hud tl">SYS // <b>ONLINE</b></div><div class="hud tr">DEPTH <b id="depth">000</b>%</div>
<div class="hud bl">NET // LAN · <b>${location.host}</b></div><div class="hud br">TERMINAL-QUIZ // v1.0</div>
<div class="hud-line"><i id="hprog"></i></div>`);

/* text decode / scramble effect */
function scramble(el,text,dur=900){
  const ch='!<>-_\\/[]{}=+*^?#01', n=Math.ceil(dur/30); let f=0;
  const id=setInterval(()=>{
    el.textContent=text.split('').map((c,i)=>c===' '?' ':(i<text.length*f/n?c:ch[Math.random()*ch.length|0])).join('');
    if(++f>n){clearInterval(id);el.textContent=text}
  },30);
}
(function(){
  const ey=document.getElementById('eyebrow'); if(ey){ setTimeout(()=>scramble(ey,'/ welcome to the'),1700); setInterval(()=>scramble(ey,'/ welcome to the',700),8000); }
  const sec=document.querySelector('.h-sec'); if(sec){ const t=sec.textContent; new IntersectionObserver((e,o)=>{ if(e[0].isIntersecting){o.disconnect();scramble(sec,t,800)} },{threshold:.6}).observe(sec); }
  document.querySelectorAll('.h-btn').forEach(b=>{ const t=b.textContent; b.addEventListener('mouseenter',()=>scramble(b,t,350)); });
})();

/* boot screen (once per browser session) */
(function(){
  const home=document.querySelector('.home');
  if(sessionStorage.getItem('tqboot')||!home) return;
  sessionStorage.setItem('tqboot','1'); home.classList.add('booting');
  const o=document.createElement('div'); o.className='bootscr'; document.body.appendChild(o);
  const lines=['> connecting to '+location.host+' ...','> handshake ........ OK','> loading terminal_quiz ...','> ACCESS GRANTED'];
  let i=0; (function nx(){ if(i<lines.length){o.insertAdjacentHTML('beforeend','<div>'+lines[i++]+'</div>');setTimeout(nx,380)} else setTimeout(()=>{o.classList.add('out');home.classList.remove('booting');setTimeout(()=>o.remove(),600)},450) })();
})();

/* ===== normal scrolling: no zoom, just the HUD scroll meter ===== */
(function(){
  const depthEl=document.getElementById('depth'), prog=document.getElementById('hprog');
  let ticking=false, st;
  function update(){
    ticking=false;
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    const p=Math.min(1,Math.max(0,scrollY/max));
    if(depthEl) depthEl.textContent=String(Math.round(p*100)).padStart(3,'0');
    if(prog) prog.style.transform='scaleY('+p+')';
  }
  addEventListener('scroll',()=>{
    document.body.classList.add('scrolling'); clearTimeout(st); st=setTimeout(()=>document.body.classList.remove('scrolling'),140);
    if(!ticking){ticking=true;requestAnimationFrame(update)}
  },{passive:true});
  addEventListener('resize',update);
  update();
})();