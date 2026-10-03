if(getAdmin()){location.href='/admin.html'}

$('#app').innerHTML=layout(`
<main class="al">
  <section class="al-win">
    <div class="al-bar"><b></b><b></b><b></b><span>sudo ./control_center</span></div>
    <div class="al-warn">⚠ RESTRICTED AREA · COORDINATORS ONLY</div>
    <div class="al-body">
      <p class="al-eyebrow">/ coordinator control</p>
      <h2 class="al-title">Admin<br><span>Login</span></h2>
      <p class="al-type"><em>&gt;</em> <span id="altw"></span><i class="al-caret"></i></p>

      <form class="al-form" id="adminForm" autocomplete="off">
        <label class="al-field"><span>$ sudo</span>
          <input id="pass" type="password" placeholder="Admin password" required>
          <button type="button" class="al-eye" id="alEye" aria-label="Show password">SHOW</button>
        </label>
        <p class="al-caps" id="alCaps">⚠ CAPS LOCK IS ON</p>
        <button class="al-btn" id="alBtn">OPEN CONTROL CENTER →</button>
      </form>

      <p class="al-note">// authorized access only · all attempts are logged</p>
      <a class="al-back" href="/index.html">← back to event home</a>
    </div>
  </section>
</main>`);

/* login logic (unchanged) + feedback */
$('#adminForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=$('#alBtn'), win=document.querySelector('.al-win');
  btn.disabled=true; btn.textContent='VERIFYING…';
  try{
    const d=await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#pass').value})});
    localStorage.setItem('tq_admin',d.token);
    btn.textContent='ACCESS GRANTED ✓';
    setTimeout(()=>location.href='/admin.html',350);
  }catch(x){
    toast(x.message);
    btn.disabled=false; btn.textContent='OPEN CONTROL CENTER →';
    $('#pass').select();
    win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
  }
};

/* show / hide password */
$('#alEye').onclick=()=>{const p=$('#pass'),s=p.type==='password';p.type=s?'text':'password';$('#alEye').textContent=s?'HIDE':'SHOW';p.focus()};
/* caps lock warning */
$('#pass').addEventListener('keyup',e=>{$('#alCaps').classList.toggle('on',e.getModifierState&&e.getModifierState('CapsLock'))});

/* typewriter */
(function(){
  const el=document.getElementById('altw'); if(!el) return;
  const words=['sudo access required.','Authenticate to continue.','Run the event.'];
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
  const c=document.createElement('canvas'); c.id='alrain'; document.body.prepend(c);
  const x=c.getContext('2d'), ch='01$#>_/\\|{}[]<>=+*'.split(''), fs=16; let drops;
  const size=()=>{c.width=innerWidth;c.height=innerHeight;drops=Array.from({length:Math.ceil(c.width/fs)},()=>Math.random()*-50)};
  size(); addEventListener('resize',size);
  setInterval(()=>{
    x.fillStyle='rgba(3,8,5,.12)'; x.fillRect(0,0,c.width,c.height); x.font=fs+'px monospace';
    drops.forEach((y,i)=>{ x.fillStyle=Math.random()>.97?'#d6ffe8':'#27b86a'; x.fillText(ch[Math.random()*ch.length|0],i*fs,y*fs); drops[i]=(y*fs>c.height&&Math.random()>.975)?0:y+1; });
  },50);
})();

/* cursor glow + autofocus */
(function(){
  const p=document.querySelector('.al-win'); if(!p) return;
  p.addEventListener('pointermove',e=>{const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px')});
  setTimeout(()=>document.getElementById('pass')?.focus(),900);
})();