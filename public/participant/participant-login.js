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
        <div class="pl-batch" role="radiogroup" aria-label="Batch"><span>$ batch</span>
          <div class="pl-opts">
            <label class="pl-opt" id="plb1"><input type="radio" name="batch" value="Batch 1" disabled><i>BATCH 1</i></label>
            <label class="pl-opt" id="plb2"><input type="radio" name="batch" value="Batch 2" disabled><i>BATCH 2</i></label>
          </div>
        </div>
        <p class="pl-note" id="plNote"></p>
        <p class="pl-seats" id="plSeats">// checking seats…</p>
        <button class="pl-btn" id="plBtn">JOIN EVENT →</button>
      </form>

      <section class="plw" id="plWait" hidden>
        <p class="plw-badge"><i></i> BATCH 1 · COMPLETED</p>
        <ol class="plw-steps">
          <li class="done"><i>✓</i><span>Batch 1<br>Round 1</span></li>
          <li class="now"><i>2</i><span>Batch 2<br>login</span></li>
          <li><i>3</i><span>Batch 2<br>Round 1</span></li>
        </ol>
        <p class="plw-msg">Round 1 for <b>Batch 1</b> is over. The coordinator is getting the computers ready for <b>Batch 2</b>.</p>
        <p class="plw-msg dim" id="plwThanks" hidden>Your Round 1 answers are saved - thank you! You will be asked to log in again for the final round (Round 2).</p>
        <p class="plw-wait"><em>&gt;</em> waiting for coordinator to open Batch 2 login <span class="plw-dots"><i></i><i></i><i></i></span> <b id="plwT">00:00</b></p>
        <p class="plw-hint">// stay on this page - the login form appears automatically</p>
      </section>

      <p class="pl-note" id="plHint">// use the same participant ID throughout the event</p>
      <a class="pl-back" href="/index.html">← back to event home</a>
    </div>
  </section>
</main>`);

/* login logic (unchanged) + loading / shake feedback */
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=$('#plBtn'), win=document.querySelector('.pl-win');
  btn.disabled=true; btn.dataset.busy='1'; btn.textContent='AUTHENTICATING…';
  try{
    const d=await api('/api/login',{method:'POST',body:JSON.stringify({name:$('#name').value,registerNumber:$('#reg').value})});
    localStorage.setItem('tq_token',d.token);
    btn.textContent='ACCESS GRANTED ✓';
    setTimeout(()=>location.href='/participant.html',350);
  }catch(x){
    toast(x.message);
    btn.disabled=false; delete btn.dataset.busy; btn.textContent='JOIN EVENT →'; loadSeats();
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

/* batch + seat status: Batch 1 = first 60 to join, Batch 2 unlocks once 60 have joined; max 60 computers in use at once */
async function loadSeats(){
  try{
    const r=await fetch('/api/batch-status',{cache:'no-store'}); if(!r.ok) return; const d=await r.json();
    const b1=$('#plb1'), b2=$('#plb2');
    /* final round: no batches - hide the batch selector and any batch wording */
    document.querySelector('.pl-batch').style.display=d.finalRound?'none':'';
    setWaitingRoom(!!d.waitingRoom);
    b1.querySelector('input').checked=d.batch1Open; b2.querySelector('input').checked=d.batch2Open;
    b1.classList.toggle('off',!d.batch1Open); b2.classList.toggle('off',!d.batch2Open);
    $('#plSeats').innerHTML=d.full
      ? '<b class="bad">// all '+d.seatLimit+' computers are in use - new participants wait for a free seat</b>'
      : d.finalRound
        ? '// final round · '+d.seatsFree+' of '+d.seatLimit+' seats free'
        : '// you will be <b>#'+d.nextNo+'</b> · Batch '+d.nextBatch+' · '+d.seatsFree+' of '+d.seatLimit+' seats free';
  }catch(e){}
}
loadSeats(); setInterval(loadSeats,3000); liveUpdates(loadSeats);

/* WAITING ROOM: Batch 1 is finished, Batch 2 login not opened yet -> hide the form until the coordinator opens it */
let wrOn=null, wrSince=Date.now();
function setWaitingRoom(on){
  if(wrOn===on) return;
  const first=wrOn===null; wrOn=on;
  $('#loginForm').style.display=on?'none':'';
  $('#plWait').hidden=!on;
  $('#plHint').style.display=on?'none':'';
  const t=document.querySelector('.pl-title'); if(t) t.innerHTML=on?'Batch 1<br><span>completed</span>':'Enter the<br><span>competition</span>';
  const ty=document.querySelector('.pl-type'); if(ty) ty.style.display=on?'none':'';
  if(on){ wrSince=Date.now(); $('#plwThanks').hidden=!new URLSearchParams(location.search).get('done'); }
  else if(!first){ toast('Batch 2 login is now open'); setTimeout(()=>document.getElementById('name')?.focus(),200); }
}
setInterval(()=>{const t=document.getElementById('plwT'); if(!t||$('#plWait').hidden) return; const s=Math.floor((Date.now()-wrSince)/1000); t.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000);
/* shown after a round ends and the participant was logged out automatically */
if(new URLSearchParams(location.search).get('done')){ const n=document.getElementById('plNote'); if(n) n.innerHTML='<b>Round finished - you have been logged out.</b><br>Thank you for taking part! Log in again for the final round when the coordinator opens the final round login.'; }