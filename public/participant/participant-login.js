/* Only skip the login page if the saved token is still valid on the server */
if(getToken()){
  api('/api/me').then(()=>{location.href='/participant.html'}).catch(e=>{if(isAuthError(e))clearParticipant()});
}
$('#app').innerHTML=layout(`
<main class="pl">
  <section class="pl-win">
    <div class="pl-bar"><b></b><b></b><b></b><span>login.sh</span></div>
    <div class="pl-body">
      <p class="pl-eyebrow">/ participant access</p>
      <h2 class="pl-title">Enter the<br><span>competition</span></h2>
      <p class="pl-type"><em>&gt;</em> <span id="pltw"></span><i class="pl-caret"></i></p>

      <form class="pl-form" id="loginForm" autocomplete="off">
        <label class="pl-field"><span>$ name</span>
          <input id="name" placeholder="Full name" required maxlength="80"></label>
        <label class="pl-field"><span>$ id</span>
          <input id="reg" placeholder="Register number / Participant ID" required maxlength="30"></label>
        <button class="pl-btn" id="plBtn">JOIN EVENT →</button>
      </form>

      <p class="pl-note">// use the same participant ID throughout the event</p>
      <a class="pl-back" href="/index.html">← back to event home</a>
    </div>
  </section>
</main>`);

/* login logic (unchanged) + loading / shake feedback */
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=$('#plBtn'), win=document.querySelector('.pl-win');
  btn.disabled=true; btn.textContent='AUTHENTICATING…';
  try{
    const d=await api('/api/login',{method:'POST',body:JSON.stringify({name:$('#name').value,registerNumber:$('#reg').value})});
    localStorage.setItem('tq_token',d.token);
    btn.textContent='ACCESS GRANTED ✓';
    setTimeout(()=>location.href='/participant.html',350);
  }catch(x){
    toast(x.message);
    btn.disabled=false; btn.textContent='JOIN EVENT →';
    win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
  }
};

/* typewriter */
(function(){
  const el=document.getElementById('pltw'); if(!el) return;
  const words=['Authenticate.','Compete.','Think. Type. Solve.'];
  let w=0,i=0,del=false;
  (function tick(){
    const t=words[w]; el.textContent=t.slice(0,i);
    if(!del&&i===t.length){del=true;return setTimeout(tick,1300)}
    if(del&&i===0){del=false;w=(w+1)%words.length;return setTimeout(tick,300)}
    i+=del?-1:1; setTimeout(tick,del?35:70);
  })();
})();

/* matrix rain */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c=document.createElement('canvas'); c.id='plrain'; document.body.prepend(c);
  const x=c.getContext('2d'), ch='01$#>_/\\|{}[]<>=+*'.split(''), fs=16; let drops;
  const size=()=>{c.width=innerWidth;c.height=innerHeight;drops=Array.from({length:Math.ceil(c.width/fs)},()=>Math.random()*-50)};
  size(); addEventListener('resize',size);
  setInterval(()=>{
    x.fillStyle='rgba(3,8,5,.12)'; x.fillRect(0,0,c.width,c.height); x.font=fs+'px monospace';
    drops.forEach((y,i)=>{
      x.fillStyle=Math.random()>.97?'#d6ffe8':'#27b86a';
      x.fillText(ch[Math.random()*ch.length|0],i*fs,y*fs);
      drops[i]=(y*fs>c.height&&Math.random()>.975)?0:y+1;
    });
  },50);
})();

/* cursor glow on the window */
(function(){
  const p=document.querySelector('.pl-win'); if(!p) return;
  p.addEventListener('pointermove',e=>{const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px')});
  setTimeout(()=>document.getElementById('name')?.focus(),900);
})();