if(!requireParticipant()) throw new Error('participant auth required');
let poll, lastSig='', waitStart=Date.now();
function title(s,p){if(s==='ROUND1_ACTIVE'&&p?.round1Submitted)return 'Round 1 Submitted';if(s==='ROUND2_ACTIVE'&&p?.round2Submitted)return 'Round 2 Submitted';return {WAITING:'Waiting Room',ROUND1_ACTIVE:'Round 1 In Progress',ROUND1_COMPLETED:'Round 1 Complete',ROUND2_COMPLETED:'Event Complete'}[s]||s.replaceAll('_',' ')}

const STAGES=['WAITING','ROUND1_ACTIVE','ROUND1_COMPLETED','ROUND2_ACTIVE','ROUND2_COMPLETED'];
const STAGE_LABELS=['Lobby','Round 1','R1 done','Round 2','Finish'];

function waiting(s,p){
  /* the page polls every 2s: only redraw when something actually changed (keeps animations smooth) */
  const sig=[s.state,p?.round1Submitted,p?.round2Submitted,s.leaderboardPublished,p.id,p.name].join('|');
  if(sig===lastSig) return; lastSig=sig;

  const submitted=s.state==='ROUND1_ACTIVE'&&p?.round1Submitted;
  const round2Submitted=s.state==='ROUND2_ACTIVE'&&p?.round2Submitted;
  const cur=Math.max(0,STAGES.indexOf(s.state));
  const stages=STAGE_LABELS.map((l,i)=>`<li class="${i<cur?'done':i===cur?'now':''}"><i>${i<cur?'✓':i+1}</i><span>${l}</span></li>`).join('');
  const msg=submitted?'Your Round 1 submission has been recorded. Wait for the coordinator to finish Round 1 and open the next stage.':round2Submitted?'Your Round 2 submission has been recorded. Wait for the coordinator to finish the event.':s.state==='WAITING'?'The coordinator will start Round 1 shortly.':'Stay on this page. Your next stage will appear automatically.';
  const extra=(s.state==='ROUND1_COMPLETED'?'<p class="pw-extra">Round 1 is complete. Wait for the coordinator to open Round 2.</p>':'')
    +(s.state==='ROUND2_COMPLETED'?(s.leaderboardPublished?'<a class="pw-btn" href="/leaderboard.html">VIEW LEADERBOARD →</a>':'<p class="pw-extra">The coordinator has not published the leaderboard yet.</p>'):'');

  $('#app').innerHTML=layout(`
  <main class="pw">
    <section class="pw-win">
      <div class="pw-bar"><b></b><b></b><b></b><span>waiting_room.sh</span></div>
      <div class="pw-body">
        <span class="pw-badge"><i></i>CONNECTED • ${escapeHtml(p.id)}</span>
        <h2 class="pw-hi">Welcome,<br><span>${escapeHtml(p.name)}</span></h2>
        <ol class="pw-stages">${stages}</ol>
        <div class="pw-card">
          <h3>${title(s.state,p)}</h3>
          <p>${msg}</p>
          ${extra}
        </div>
        <p class="pw-wait"><em>&gt;</em> listening for coordinator <span class="pw-dots"><i></i><i></i><i></i></span><b id="pwt">00:00</b></p>
        <button class="pw-exit" onclick="logout()">EXIT</button>
      </div>
    </section>
  </main>`);
  /* remove the symposium text from the top bar */
  document.querySelectorAll('#app *').forEach(e=>{ if(!e.children.length && /symposium/i.test(e.textContent)) e.remove(); });
  initFx();
}

/* effects that must exist only once */
function initFx(){
  if(!document.getElementById('pwrain') && !matchMedia('(prefers-reduced-motion:reduce)').matches){
    const c=document.createElement('canvas'); c.id='pwrain'; document.body.prepend(c);
    const x=c.getContext('2d'), ch='01$#>_/\\|{}[]<>=+*'.split(''), fs=16; let drops;
    const size=()=>{c.width=innerWidth;c.height=innerHeight;drops=Array.from({length:Math.ceil(c.width/fs)},()=>Math.random()*-50)};
    size(); addEventListener('resize',size);
    setInterval(()=>{
      x.fillStyle='rgba(3,8,5,.12)'; x.fillRect(0,0,c.width,c.height); x.font=fs+'px monospace';
      drops.forEach((y,i)=>{ x.fillStyle=Math.random()>.97?'#d6ffe8':'#27b86a'; x.fillText(ch[Math.random()*ch.length|0],i*fs,y*fs); drops[i]=(y*fs>c.height&&Math.random()>.975)?0:y+1; });
    },50);
  }
  const w=document.querySelector('.pw-win');
  if(w) w.addEventListener('pointermove',e=>{const r=w.getBoundingClientRect();w.style.setProperty('--mx',(e.clientX-r.left)+'px');w.style.setProperty('--my',(e.clientY-r.top)+'px')});
}
setInterval(()=>{const t=document.getElementById('pwt'); if(!t) return; const s=Math.floor((Date.now()-waitStart)/1000); t.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000);

function logout(){clearParticipant();location.href='/participant-login.html'}
async function refresh(){try{const d=await api('/api/me');const s=d.state;if(s.state==='ROUND1_ACTIVE'&&!d.participant?.round1Submitted){location.href='/round1.html';return}if(s.state==='ROUND2_ACTIVE'&&!d.participant?.round2Submitted){location.href='/round2.html';return}if(s.state==='ROUND2_COMPLETED'&&s.leaderboardPublished){location.href='/leaderboard.html';return}waiting(s,d.participant)}catch(e){if(isAuthError(e)){clearParticipant();location.href='/participant-login.html'}/* any other error (server restart, network blip): stay on the page, next poll retries */}}
refresh();poll=setInterval(refresh,2000);