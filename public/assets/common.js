const $ = (s) => document.querySelector(s);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
function fmt(ms){ if(ms==null)return '--:--'; ms=Math.max(0,ms); return String(Math.floor(ms/60000)).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0'); }
function toast(s){const x=document.createElement('div');x.className='toast';x.textContent=s;document.body.append(x);setTimeout(()=>x.remove(),2600)}
function layout(content, nav='') { return `<div class="wrap"><div class="nav"><a class="brand link" href="/index.html"><span class="green">&gt;_</span> TERMINAL QUIZ</a><div class="muted small">COLLEGE SYMPOSIUM • LAN EVENT</div>${nav}</div>${content}</div>`; }
function getToken(){return localStorage.getItem('tq_token')}
function getAdmin(){return localStorage.getItem('tq_admin')}
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json'};const t=getToken(),a=getAdmin();if(t&&!url.includes('/admin/'))opt.headers.Authorization='Bearer '+t;if(a&&url.includes('/admin/'))opt.headers.Authorization='Bearer '+a;let r;try{r=await fetch(url,opt)}catch(_){const e=new Error('Server unreachable - retrying...');e.status=0;e.network=true;throw e}const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Request failed');e.status=r.status;throw e}return d}
/* true ONLY when the server explicitly says the token is invalid (HTTP 401). Network errors / restarts / 409s are NOT auth errors. */
function isAuthError(e){return !!e&&e.status===401}
function clearParticipant(){localStorage.removeItem('tq_token')}
function clearAdmin(){localStorage.removeItem('tq_admin')}
function requireParticipant(){if(!getToken()){location.href='/participant-login.html';return false}return true}
function requireAdmin(){if(!getAdmin()){location.href='/admin-login.html';return false}return true}

let participantHeartbeatId=null;
function startParticipantHeartbeat(){
  if(!getToken() || participantHeartbeatId) return;
  const beat=()=>api('/api/heartbeat',{method:'POST',body:'{}'}).catch(()=>{});
  beat();
  participantHeartbeatId=setInterval(beat,5000);
}
if(getToken() && !location.pathname.includes('/admin/')) startParticipantHeartbeat();
/* instant updates: the server pushes a message the moment the admin starts/ends a round; `fn` re-checks the state. Polling stays as a fallback. */
function liveUpdates(fn){
  try{const es=new EventSource('/api/events');es.onmessage=()=>fn()}catch(e){}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)fn()});
  window.addEventListener('focus',()=>fn());
}