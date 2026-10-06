if(!requireAdmin()) throw new Error('admin auth required');
let timerId, pollId, lastSig='', first=true;
const STAGES=['WAITING','ROUND1_ACTIVE','ROUND1_COMPLETED','ROUND2_ACTIVE','ROUND2_COMPLETED'];
const STAGE_LABELS=['Lobby','Round 1','R1 done','Round 2','Finished'];

/* what the coordinator should do next, for each phase */
function phase(s,p){
  const n=s.participantCount, on=s.onlineCount, sub=p.filter(x=>x.round1Submitted).length;
  switch(s.state){
    case 'WAITING': return {t:'Lobby is open',h:`${on} of ${n} participants are online. Start Round 1 when everyone is in.`,a:'start1',l:'START ROUND 1'};
    case 'ROUND1_ACTIVE': return {t:'Round 1 is live',h:`${sub} of ${n} have submitted. The round ends automatically when the timer hits zero.`,a:'end1',l:'END ROUND 1',danger:1};
    case 'ROUND1_COMPLETED': return {t:'Round 1 finished',h:'Check the scores below, then open Round 2.',a:'start2',l:'START ROUND 2'};
    case 'ROUND2_ACTIVE': return {t:'Round 2 is live',h:'Participants are solving the terminal challenges.',a:'end2',l:'END ROUND 2',danger:1};
    case 'ROUND2_COMPLETED': return s.leaderboardPublished
      ? {t:'Event finished',h:'The leaderboard is published and visible to participants.',done:1}
      : {t:'Event finished',h:'Publish the leaderboard when you are ready to reveal it.',a:'publish',l:'PUBLISH LEADERBOARD'};
    default: return {t:String(s.state).replaceAll('_',' '),h:'',done:1};
  }
}

/* time taken to finish a round: 754000 -> '12m 34s'; '—' if the participant has not finished it */
function fmtTaken(ms){if(ms==null)return '<span class="empty">—</span>';const t=Math.round(ms/1000),m=Math.floor(t/60),sec=String(t%60).padStart(2,'0');return m+'m '+sec+'s'}

async function dashboard(){
  clearTimeout(pollId);
  try{
    const [s,p,l]=await Promise.all([api('/api/state'),api('/api/admin/participants'),api('/api/admin/logs')]);
    /* redraw only when data changed (timer excluded): no flicker */
    const sig=JSON.stringify([{...s,remainingMs:null},p,l.slice(0,20)]);
    if(sig!==lastSig){
      lastSig=sig;
      const wasOpen=document.querySelector('.ad-adv')?.open;
      const ph=phase(s,p), cur=Math.max(0,STAGES.indexOf(s.state));
      const steps=STAGE_LABELS.map((t,i)=>`<li class="${i<cur?'done':i===cur?'now':''}"><i>${i<cur?'✓':i+1}</i><span>${t}</span></li>`).join('');
      const action=ph.done?`<div class="ad-ok">✓ All done</div>`:`<button class="ad-go${ph.danger?' danger':''}" onclick="control('${ph.a}')">${ph.l}</button>`;
      $('#app').innerHTML=`<div class="dashboard${first?' enter':''}">
<header class="ad-top">
  <a class="ad-brand" href="/index.html"><span>&gt;_</span> TERMINAL QUIZ</a>
  <span class="ad-pill"><i></i> CONTROL CENTER</span>
  <div class="ad-topbtns">
    <button class="ad-btn" onclick="exportCsv()">EXPORT CSV</button>
    <button class="ad-btn" onclick="logoutAdmin()">LOGOUT</button>
  </div>
</header>
<div class="ad-wrap">
  <section class="ad-console">
    <div class="ad-left">
      <p class="ad-kicker">CURRENT PHASE</p>
      <h1 class="ad-phase">${ph.t}</h1>
      <p class="ad-hint">${ph.h}</p>
      <ol class="ad-steps">${steps}</ol>
    </div>
    <div class="ad-right">
      <div class="ad-timer"><small>TIME LEFT</small><b id="timer" class="${s.remainingMs==null?'idle':''}">${s.remainingMs==null?'--:--':fmt(s.remainingMs)}</b></div>
      ${action}
    </div>
  </section>

  <section class="ad-stats">
    <div><small>PARTICIPANTS</small><b>${s.participantCount}</b></div>
    <div><small>ONLINE</small><b class="g">${s.onlineCount}</b></div>
    <div><small>SUBMITTED R1</small><b>${p.filter(x=>x.round1Submitted).length}</b></div>
    <div><small>TOP SCORE</small><b>${p[0]?.total||0}</b></div>
  </section>

  <section class="ad-cols">
    <div class="ad-panel">
      <div class="ad-ph"><h2>Participants</h2><span>${p.length}</span></div>
      <div class="ad-scroll"><table class="ad-table"><thead><tr><th>#</th><th>Name</th><th>ID</th><th>Status</th><th>R1</th><th>R1 Time</th><th>R2</th><th>R2 Time</th><th>Total</th></tr></thead><tbody>${p.map((x,i)=>`<tr class="${i<3&&x.total>0?'top'+(i+1):''}"><td class="rk">${i+1}</td><td>${escapeHtml(x.name)}</td><td class="id">${escapeHtml(x.id)}</td><td class="${x.online?'on':'off'}"><span class="status-dot ${x.online?'is-online':'is-offline'}"></span>${x.online?'Online':'Offline'}</td><td>${x.round1Score}</td><td>${fmtTaken(x.round1TimeMs)}</td><td>${x.round2Score}</td><td>${fmtTaken(x.round2TimeMs)}</td><td><b>${x.total}</b></td></tr>`).join('')||'<tr><td colspan="9" class="empty">Waiting for participants to join…</td></tr>'}</tbody></table></div>
    </div>
    <div class="ad-panel">
      <div class="ad-ph"><h2>Activity</h2><span>latest ${Math.min(20,l.length)}</span></div>
      <div class="ad-scroll">${l.slice(0,20).map(x=>`<div class="ad-log"><time>${new Date(x.time).toLocaleTimeString()}</time><div><em>${escapeHtml(x.type)}</em>${escapeHtml(x.detail)}</div></div>`).join('')||'<div class="empty">No events yet.</div>'}</div>
    </div>
  </section>

  <details class="ad-adv"${wasOpen?' open':''}>
    <summary>Manual controls</summary>
    <div class="ad-advrow">
      <button class="ad-btn" onclick="control('start1')">START R1</button>
      <button class="ad-btn" onclick="control('end1')">END R1</button>
      <button class="ad-btn" onclick="control('start2')">START R2</button>
      <button class="ad-btn" onclick="control('end2')">END R2</button>
      <button class="ad-btn" onclick="control('publish')">PUBLISH</button>
      <button class="ad-btn red" onclick="control('reset')">RESET EVENT</button>
    </div>
  </details>
</div></div>`;
      first=false;
      if(s.remainingMs!=null)startTimer(s.remainingMs);else clearInterval(timerId);
    }
    pollId=setTimeout(dashboard,3000);
  }catch(e){if(/unauthorized/i.test(e.message)){clearAdmin();location.href='/admin-login.html'}else{pollId=setTimeout(dashboard,3000)}}
}

function startTimer(ms){clearInterval(timerId);let end=Date.now()+ms;timerId=setInterval(()=>{const el=$('#timer');if(!el)return;const left=Math.max(0,end-Date.now());el.textContent=fmt(left);el.classList.toggle('warn',left>0&&left<60000);if(left<=0)clearInterval(timerId)},500)}
/* RESET needs the admin password: themed modal, verified against the admin login endpoint */
function resetGate(){
  return new Promise(resolve=>{
    if(document.getElementById('rm')) return resolve(false);
    const m=document.createElement('div'); m.id='rm'; m.className='rm';
    m.innerHTML=`<div class="rm-win">
      <div class="rm-warn">⚠ DANGER ZONE</div>
      <div class="rm-body">
        <h3>Reset the entire event?</h3>
        <p>This permanently deletes <b>all participants and scores</b> and returns to the lobby. Enter the admin password to continue.</p>
        <label class="rm-field"><span>$ sudo</span><input id="rmPass" type="password" placeholder="Admin password" autocomplete="off"><button type="button" id="rmEye">SHOW</button></label>
        <p class="rm-err" id="rmErr"></p>
        <div class="rm-btns"><button type="button" class="ad-btn" id="rmNo">CANCEL</button><button type="button" class="rm-go" id="rmGo">RESET EVENT</button></div>
      </div></div>`;
    document.body.appendChild(m);
    const pass=m.querySelector('#rmPass'), err=m.querySelector('#rmErr'), go=m.querySelector('#rmGo'), win=m.querySelector('.rm-win');
    const close=ok=>{document.removeEventListener('keydown',onKey);m.remove();resolve(ok)};
    const onKey=e=>{if(e.key==='Escape')close(false)};
    document.addEventListener('keydown',onKey);
    m.addEventListener('mousedown',e=>{if(e.target===m)close(false)});
    m.querySelector('#rmNo').onclick=()=>close(false);
    m.querySelector('#rmEye').onclick=()=>{const s=pass.type==='password';pass.type=s?'text':'password';m.querySelector('#rmEye').textContent=s?'HIDE':'SHOW';pass.focus()};
    async function submit(){
      if(!pass.value){err.textContent='Enter the admin password.';return}
      go.disabled=true; go.textContent='VERIFYING…'; err.textContent='';
      try{
        await api('/api/admin/verify',{method:'POST',body:JSON.stringify({password:pass.value})});
        close(pass.value);
      }catch(x){
        go.disabled=false; go.textContent='RESET EVENT';
        err.textContent='✗ '+x.message;
        pass.select(); win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
      }
    }
    go.onclick=submit;
    pass.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
    setTimeout(()=>pass.focus(),50);
  });
}
async function control(action){
  let password;
  if(action==='reset'){password=await resetGate();if(!password)return}
  if((action==='end1'||action==='end2')&&!confirm('End the round now for everyone?'))return;
  try{await api('/api/admin/control',{method:'POST',body:JSON.stringify({action,password})});toast(action.toUpperCase()+' completed');lastSig='';dashboard()}catch(x){toast(x.message)}
}
async function exportCsv(){
try{
const r=await fetch('/api/admin/export',{headers:{Authorization:'Bearer '+getAdmin()}});
if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Export failed')}
const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
a.href=url;a.download='terminal-quiz-results.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){toast(e.message)}
}
async function logoutAdmin(){try{await api('/api/admin/logout',{method:'POST',body:'{}'})}catch{}clearAdmin();location.href='/admin-login.html'}
dashboard();