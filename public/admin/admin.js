if(!requireAdmin()) throw new Error('admin auth required');
let timerId, pollId, lastSig='', first=true;
const STAGES=['WAITING','ROUND1_ACTIVE','ROUND1_COMPLETED','ROUND2_ACTIVE','ROUND2_COMPLETED'];
const STAGE_LABELS=['Lobby','Round 1','R1 done','Round 2','Finished'];

/* what the coordinator should do next, for each phase */
function phase(s,p){
  const n=s.participantCount, on=s.onlineCount;
  const inB=b=>p.filter(x=>(x.batch||'Batch 1')===b);
  switch(s.state){
    case 'WAITING': return {t:'Lobby is open',h:`${on} of ${n} participants are online (Batch 1: ${s.batch1Count}, Batch 2: ${s.batch2Count}). Start Round 1 for ${s.r1Next||'Batch 1'} when its participants are seated.`,a:'start1',l:'START ROUND 1 — '+String(s.r1Next||'Batch 1').toUpperCase()};
    case 'ROUND1_ACTIVE': {const b=inB(s.r1Batch),sub=b.filter(x=>x.round1Submitted).length;return {t:`Round 1 · ${s.r1Batch} is live`,h:`${sub} of ${b.length} in ${s.r1Batch} have submitted. Each participant has their own 20-minute timer that starts when their quiz opens. Press END once everyone in this batch has finished - their results are saved to a separate CSV.`,a:'end1',l:'END ROUND 1 — '+String(s.r1Batch).toUpperCase(),danger:1}}
    case 'ROUND1_COMPLETED': {
      const done=Object.keys(s.r1Done||{}).filter(k=>s.r1Done[k]).join(' + ')||'Round 1';
      const pend=s.r1Next&&inB(s.r1Next).length>0;
      if(pend) return {t:`Round 1 finished · ${done}`,h:`${s.r1Next} has ${inB(s.r1Next).length} participants waiting. Seat them, then start their Round 1. (To skip it, use the shortlist panel below.)`,a:'start1',l:'START ROUND 1 — '+String(s.r1Next).toUpperCase()};
      if(!s.shortlistDone) return {t:'Round 1 finished for all batches',h:'Choose how many participants go to the final round and press SHORTLIST below.'};
      return {t:'Finalists selected',h:`${s.shortlistedCount} participants are shortlisted for Round 2. Start the final round when they are seated.`,a:'start2',l:'START ROUND 2 (FINAL)'};
    }
    case 'ROUND2_ACTIVE': return {t:'Round 2 (final) is live',h:'The shortlisted participants are solving the terminal challenges.',a:'end2',l:'END ROUND 2',danger:1};
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
    const [s,p,l,dv,bi]=await Promise.all([api('/api/state'),api('/api/admin/participants'),api('/api/admin/logs'),api('/api/admin/devices').catch(()=>[]),api('/api/batch-status').catch(()=>null)]);
    /* redraw only when data changed (timer excluded): no flicker */
    const sig=JSON.stringify([{...s,remainingMs:null},p,l.slice(0,20),dv,bi]);
    if(sig!==lastSig){
      lastSig=sig;
      const wasOpen=document.querySelector('.ad-adv')?.open; const keepN=document.getElementById('slN')?.value; window.curBatch=s.state==='ROUND1_ACTIVE'?s.r1Batch:null; window.pendingBatch=(s.state==='ROUND1_COMPLETED'&&s.r1Next&&p.filter(x=>(x.batch||'Batch 1')===s.r1Next).length>0)?s.r1Next:null;
      const ph=phase(s,p), cur=Math.max(0,STAGES.indexOf(s.state));
      const steps=STAGE_LABELS.map((t,i)=>`<li class="${i<cur?'done':i===cur?'now':''}"><i>${i<cur?'✓':i+1}</i><span>${t}</span></li>`).join('');
      const action=ph.done?`<div class="ad-ok">✓ All done</div>`:!ph.a?'':`<button class="ad-go${ph.danger?' danger':''}" onclick="control('${ph.a}')">${ph.l}</button>`;
      $('#app').innerHTML=`<div class="dashboard${first?' enter':''}">
<header class="ad-top">
  <a class="ad-brand" href="/index.html"><span>&gt;_</span> TERMINAL QUIZ</a>
  <span class="ad-pill"><i></i> CONTROL CENTER</span>
  <div class="ad-topbtns">
    <button class="ad-btn" onclick="exportCsv('1')">BATCH 1 CSV</button>
    <button class="ad-btn" onclick="exportCsv('2')">BATCH 2 CSV</button>
    ${s.shortlistDone?`<button class="ad-btn" onclick="exportCsv('shortlist')">SHORTLIST CSV</button>`:''}
    <button class="ad-btn" onclick="exportCsv()">FINAL CSV</button>
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

  ${s.state==='ROUND1_COMPLETED'?`<section class="ad-panel" style="margin-bottom:18px">
    <div class="ad-ph"><h2>Shortlist for the final round</h2><span>${s.shortlistDone?s.shortlistedCount+' selected':'not done yet'}</span></div>
    <div style="padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span>Top</span><input id="slN" type="number" min="1" value="${keepN||s.shortlistCount||20}" style="width:90px;padding:8px 10px;background:#04100a;color:#d6ffe8;border:1px solid #1f6b43;border-radius:6px;font:inherit">
      <span style="opacity:.75">from both batches combined - highest Round 1 score first, faster time wins a tie</span>
      <button class="ad-btn" onclick="shortlist()">${s.shortlistDone?'RE-SHORTLIST':'SHORTLIST'}</button>
    </div></section>`:''}

  <section class="ad-stats">
    <div><small>PARTICIPANTS</small><b>${s.participantCount}</b></div>
    <div><small>ONLINE</small><b class="g">${s.onlineCount}</b></div>
    <div><small>SUBMITTED R1</small><b>${p.filter(x=>x.round1Submitted).length}</b></div>
    <div><small>TOP SCORE</small><b>${p[0]?.total||0}</b></div>
  </section>
  ${bi?`<section class="ad-stats">
    <div><small>SEATS IN USE</small><b class="${bi.full?'':'g'}"${bi.full?' style="color:#ff7d89"':''}>${bi.seatsInUse} / ${bi.seatLimit}</b></div>
    <div><small>BATCH 1 JOINED</small><b>${bi.batch1Count} / ${bi.batch1Size}</b></div>
    <div><small>BATCH 2</small><b>${bi.batch2Open||bi.batch2Count?bi.batch2Count+' (active)':'locked'}</b></div>
    <div><small>NEXT JOINER</small><b>#${bi.nextNo}</b></div>
  </section>`:''}

  ${dv.length?`<section class="ad-panel" style="margin-bottom:18px;border-color:#6b2630">
    <div class="ad-ph"><h2 style="color:#ff7d89">Blocked devices (left fullscreen 3 times before joining)</h2><span>${dv.length}</span></div>
    <div class="ad-scroll"><table class="ad-table"><thead><tr><th>Code</th><th>IP</th><th>Browser</th><th>Blocked at</th><th></th></tr></thead><tbody>${dv.map(x=>`<tr><td class="id"><b>${escapeHtml(x.code)}</b></td><td>${escapeHtml(x.ip||'-')}</td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(x.ua||'')}">${escapeHtml(x.ua||'-')}</td><td>${x.blockedAt?new Date(x.blockedAt).toLocaleTimeString():'-'}</td><td><button class="ad-btn allowdev" style="padding:4px 10px;font-size:11px" data-id="${escapeHtml(x.id)}" data-code="${escapeHtml(x.code)}">ALLOW ENTRY</button></td></tr>`).join('')}</tbody></table></div>
  </section>`:''}
  <section class="ad-cols">
    <div class="ad-panel">
      <div class="ad-ph"><h2>Participants</h2><span>${p.length}</span></div>
      <div class="ad-scroll"><table class="ad-table"><thead><tr><th>#</th><th>Join #</th><th>Name</th><th>ID</th><th>Batch</th><th>Status</th><th>R1</th><th>R1 Time</th><th>R2</th><th>R2 Time</th><th>Total</th><th>Final</th></tr></thead><tbody>${p.map((x,i)=>`<tr class="${i<3&&x.total>0?'top'+(i+1):''}"><td class="rk">${i+1}</td><td>${x.joinNo||'-'}</td><td>${escapeHtml(x.name)}</td><td class="id">${escapeHtml(x.id)}</td><td>${escapeHtml(x.batch||'-')}</td><td class="${x.online&&!x.exited?'on':'off'}"><span class="status-dot ${x.online&&!x.exited?'is-online':'is-offline'}"></span>${x.exited?'<b style="color:#ff5f6d">EXITED</b> <button class="ad-btn rein" style="padding:3px 8px;font-size:11px;margin-left:6px" data-id="'+escapeHtml(x.id)+'">REINSTATE</button>':(x.online?'Online':'Offline')}${x.exitAttempts?' <span title="Fullscreen exits" style="color:#ff7d89;font-size:12px">&#9888;'+x.exitAttempts+'</span>':''}</td><td>${x.round1Score}</td><td>${fmtTaken(x.round1TimeMs)}</td><td>${x.round2Score}</td><td>${fmtTaken(x.round2TimeMs)}</td><td><b>${x.total}</b></td><td>${x.shortlisted?'<b style="color:#37d67a">★ YES</b>':(s.shortlistDone?'<span class="empty">—</span>':'')}</td></tr>`).join('')||'<tr><td colspan="12" class="empty">Waiting for participants to join…</td></tr>'}</tbody></table></div>
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
  if((action==='end1'||action==='end2')&&!confirm('End this Round 1 batch now? Anyone still answering is submitted automatically.'))return;
  const endedBatch=action==='end1'?window.curBatch:null;
  try{await api('/api/admin/control',{method:'POST',body:JSON.stringify({action,password})});toast(action.toUpperCase()+' completed');lastSig='';dashboard();if(endedBatch)exportCsv(endedBatch==='Batch 2'?'2':'1')}catch(x){toast(x.message)}
}
async function exportCsv(kind){
try{
const r=await fetch('/api/admin/export'+(kind?'?batch='+kind:''),{headers:{Authorization:'Bearer '+getAdmin()}});
if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Export failed')}
const name=kind==='1'||kind==='2'?'terminal-quiz-batch'+kind+'-round1.csv':kind==='shortlist'?'terminal-quiz-shortlist-round2.csv':'terminal-quiz-results.csv';
const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){toast(e.message)}
}
async function shortlist(){
  const n=Math.floor(Number(document.getElementById('slN').value));
  if(!(n>=1)){toast('Enter how many go to the final round');return}
  if(window.pendingBatch&&!confirm(window.pendingBatch+' has not played Round 1 yet. Shortlist without them?'))return;
  try{await api('/api/admin/control',{method:'POST',body:JSON.stringify({action:'shortlist',count:n})});toast('Top '+n+' shortlisted');lastSig='';dashboard()}catch(x){toast(x.message)}
}
async function logoutAdmin(){try{await api('/api/admin/logout',{method:'POST',body:'{}'})}catch{}clearAdmin();location.href='/admin-login.html'}
/* let an exited participant rejoin (data-id + delegated click: no inline JS with user data) */
async function reinstate(id){if(!confirm('Allow '+id+' to rejoin the event?'))return;try{await api('/api/admin/reinstate',{method:'POST',body:JSON.stringify({id})});toast(id+' can rejoin');lastSig='';dashboard()}catch(x){toast(x.message)}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.rein');if(b)reinstate(b.dataset.id)});
dashboard();
/* let a blocked device (3 fullscreen exits before joining) enter the event again */
async function allowDevice(id,code){if(!confirm('Allow device '+code+' to enter the event?'))return;try{await api('/api/admin/allow-device',{method:'POST',body:JSON.stringify({id})});toast('Device '+code+' allowed');lastSig='';dashboard()}catch(x){toast(x.message)}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.allowdev');if(b)allowDevice(b.dataset.id,b.dataset.code)});