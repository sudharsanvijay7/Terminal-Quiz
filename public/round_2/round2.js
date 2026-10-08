if(!requireParticipant()) throw new Error('participant auth required');

let termOut='',currentChallenge=1,timerId;
let ch=null; /* current challenge, sent by the server (per-participant set) */

async function init(){
 try{
  const d=await api('/api/me');
  if(!d.can?.round2){location.href='/participant.html';return}
  currentChallenge=d.terminal.challenge||1;
  ch=await api('/api/round2/challenge');
  if(currentChallenge>ch.total){location.href='/participant.html';return}
  render(d.participant,d.state,d.terminal);
  startTimer(d.state.remainingMs,()=>location.href='/participant.html');
 }catch(e){
  if(isAuthError(e)){clearParticipant();location.href='/participant-login.html';return}
  /* server restarting / network blip: stay here and retry, never log out */
  toast(e.message);setTimeout(init,2000);
 }
}

async function watchRound(){
 try{const d=await api('/api/me');if(!d.can?.round2)location.href='/participant.html'}catch(e){if(isAuthError(e)){clearParticipant();location.href='/participant-login.html'}}
}
setInterval(watchRound,3000);liveUpdates(watchRound);

function render(p,s,t){
 const info=ch,opts=ch.options,N=ch.total;
 const total=ch.totalMarks;
 const pipe=Array.from({length:N},(_,i)=>({title:'Challenge '+(i+1)})).map((x,i)=>{
  const n=i+1;
  const st=n===currentChallenge?'now':(n<currentChallenge?'done':'');
  return (i?'<li class="pl"></li>':'')+`<li class="pn ${st}" title="${escapeHtml(x.title)}"><b>${n}</b></li>`;
 }).join('');
 const dots='<b></b><b></b><b></b>';
 $('#app').innerHTML=layout(`
 <div class="r2">
  <header class="r2-top">
   <div class="r2-brand">&gt;_ TERMINAL<span>_QUIZ</span></div>
   <div class="r2-pill"><i></i>ROUND 2</div>
   <div class="r2-name">${escapeHtml(p.name||p.id)} · ${escapeHtml(p.id)}</div>
   <ol class="r2-pipe">${pipe}</ol>
   <div class="r2-timer" id="timerBox"><small>TIME LEFT</small><b id="timer">${fmt(s.remainingMs)}</b></div>
  </header>
  <div class="r2-prog"><i style="transform:scaleX(${(currentChallenge-1)/N+0.04})"></i></div>

  <main class="r2-main">
   <div class="r2-left r2-in">
    <section class="r2-win r2-mission">
     <div class="r2-bar">${dots}<span>mission.txt</span></div>
     <div class="r2-mbody">
      <div class="r2-mhead">
       <div class="r2-num"><svg viewBox="0 0 100 100"><circle class="a" cx="50" cy="50" r="46"/><circle class="b" cx="50" cy="50" r="46"/></svg><span>${currentChallenge}</span></div>
       <div class="r2-mmeta">
        <p class="r2-eye">Challenge ${currentChallenge} of ${N} · ${escapeHtml(String(info.level||'').toUpperCase())}</p>
        <h2 class="r2-title">${escapeHtml(info.title)}</h2>
        <p class="r2-tags"><em>Skill</em>${escapeHtml(info.skill)}<em style="margin-left:14px">Marks</em>${info.marks}</p>
       </div>
      </div>
      <p class="r2-desc">${escapeHtml(info.description)}</p>
     </div>
    </section>
    <section class="r2-win r2-term" id="term">
     <div class="r2-bar">${dots}<span>student@terminal-quiz:${escapeHtml(t.cwd)}$</span></div>
     <pre class="r2-out" id="out">${escapeHtml(termOut||'Welcome. Type help to see available commands.\n')}</pre>
     <form class="r2-line" id="cmdForm"><span>student@terminal-quiz:~$</span><input id="cmd" autocomplete="off" spellcheck="false" autofocus></form>
    </section>
   </div>

   <div class="r2-right r2-in">
    <section class="r2-win r2-hint">
     <div class="r2-bar">${dots}<span>hint.txt</span></div>
     <div class="r2-hbody"><b>HINT</b><p>${escapeHtml(info.hint)}</p></div>
    </section>
    <section class="r2-win r2-ans">
     <div class="r2-bar">${dots}<span>answer.sh</span></div>
     <div class="r2-abody">
      <p class="r2-q"><em>&gt;</em>Select the value you found<small>1 attempt</small></p>
      <div class="r2-opts" id="answerOptions">
       ${opts.map((o,i)=>`<label class="round2-option" for="answer-${i}"><input type="radio" name="round2Answer" id="answer-${i}" value="${escapeHtml(o)}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${escapeHtml(o)}</span><i class="option-tick">✓</i></label>`).join('')}
      </div>
     </div>
     <div class="r2-afoot"><button id="submitAnswer">SUBMIT ANSWER</button></div>
    </section>
    <div class="r2-stats">
     <div><small>CHALLENGE</small><b>${currentChallenge}<em>/${N}</em></b></div>
     <div><small>THIS ONE</small><b>${info.marks}<em> pts</em></b></div>
     <div><small>ROUND TOTAL</small><b>${total}</b></div>
    </div>
   </div>
  </main>
 </div>`);
 $('#cmdForm').onsubmit=runCmd;
 $('#submitAnswer').onclick=submitAnswer;
 $('#term').addEventListener('click',()=>{if(!String(getSelection()))$('#cmd').focus()});
 document.querySelectorAll('input[name="round2Answer"]').forEach(r=>{
  r.addEventListener('change',()=>{document.querySelectorAll('.round2-option').forEach(x=>x.classList.remove('selected'));r.closest('.round2-option').classList.add('selected')});
 });
 const out=$('#out');out.scrollTop=out.scrollHeight;
 setTimerState(s.remainingMs);
}

async function runCmd(e){
 e.preventDefault();const c=$('#cmd').value;$('#cmd').value='';
 try{
  const d=await api('/api/terminal',{method:'POST',body:JSON.stringify({command:c})});
  termOut+=(termOut?'\n':'')+'$ '+c+'\n'+d.output;
  if(d.output==='__CLEAR__')termOut='';
  const out=$('#out');out.textContent=termOut;out.scrollTop=out.scrollHeight;$('#cmd').focus();
 }catch(x){
  if(isAuthError(x)){clearParticipant();location.href='/participant-login.html';return}
  toast(x.message);
 }
}

async function submitAnswer(){
  const selected=document.querySelector('input[name="round2Answer"]:checked');

  if(!selected){
    toast('Please select one answer before submitting.');
    return;
  }

  const button=$('#submitAnswer');

  // One attempt per challenge: lock every option immediately.
  document.querySelectorAll('input[name="round2Answer"]').forEach(radio=>{radio.disabled=true});
  document.querySelectorAll('.round2-option').forEach(option=>{
    option.style.pointerEvents='none';
    option.style.opacity='0.65';
  });
  button.disabled=true;
  button.textContent='SUBMITTED';

  try{
    const d=await api('/api/terminal',{
      method:'POST',
      body:JSON.stringify({command:'',answer:selected.value,submit:true})
    });

    // The server already moves to the next challenge (correct or incorrect),
    // so just reload the state from the server.
    termOut='';
    await init();

  }catch(e){
    if(isAuthError(e)){clearParticipant();location.href='/participant-login.html';return}
    toast(e.message);
    // request failed (e.g. server restarting): unlock so the participant can retry
    document.querySelectorAll('input[name="round2Answer"]').forEach(r=>r.disabled=false);
    document.querySelectorAll('.round2-option').forEach(o=>{o.style.pointerEvents='';o.style.opacity=''});
    button.disabled=false;
    button.textContent='SUBMIT ANSWER';
  }
}

/* timer colour: amber under 5 min, red under 1 min */
function setTimerState(ms){
 const box=$('#timerBox');if(!box)return;
 box.classList.toggle('low',ms<=300000&&ms>60000);
 box.classList.toggle('crit',ms<=60000);
}

function startTimer(ms,done){
 clearInterval(timerId);let end=Date.now()+ms;
 timerId=setInterval(()=>{const left=Math.max(0,end-Date.now()),el=$('#timer');if(el)el.textContent=fmt(left);setTimerState(left);if(left<=0){clearInterval(timerId);done()}},500);
}
init();