if(!requireParticipant()) throw new Error('participant auth required');

let termOut='',currentChallenge=1,timerId;
const challengeInfo=[
 {title:'Ghost in the Directory',skill:'Hidden files',marks:5,description:'Some files may be hidden from a normal directory listing. Use the terminal to inspect the directory carefully and find the hidden clue. Once you discover the secret value, select it from the four options below and submit your answer.',hint:'Try checking directory contents with a command that can reveal hidden entries.'},
 {title:'Needle in the Logs',skill:'Searching text with grep',marks:5,description:'Several log files are stored inside the logs directory. One of them contains a special SECRET value. Search through the log files recursively, identify the value after SECRET=, then choose the matching option below.',hint:'A recursive text-search command is useful when the information may be inside multiple files.'},
 {title:'Lost in the Tree',skill:'cd, ls and cat',marks:10,description:'The clue is not in the starting directory. Navigate through the directory tree, locate the archive directory, and inspect the clue file inside it. Read the file carefully, then select the answer you found.',hint:'Move into directories, list their contents, and display the contents of the relevant text file.'},
 {title:'Pipe Dreams',skill:'grep, sort, uniq and head',marks:10,description:'The data file contains several repeated colour names. Your task is to determine which colour appears most frequently. Use the terminal pipeline to search, sort and count the entries, then select the colour with the highest count.',hint:'A pipeline using sort, uniq -c, sort -rn and head can help identify the most frequent entry.'},
 {title:'The Final Chain',skill:'grep, find and grep -c',marks:20,description:'This is the final and highest-value challenge. Several files contain TARGET entries, but only one contains the required final value. Use the terminal to locate the relevant file, inspect its TARGET line, and select the exact value from the options.',hint:'Use file searching and text searching together to locate the TARGET entry.'}
];
const options=[
 ['SECRET-GHOST-42','HIDDEN-GHOST-24','GHOST-SECRET-52','SECRET-FILE-42'],
 ['NEEDLE-731','NEEDLE-713','LOG-NEEDLE-731','SECRET-731'],
 ['TREE-908','TREE-809','ARCHIVE-908','TREE-980'],
 ['red','blue','green','yellow'],
 ['FINAL-2026','FINAL-2062','TARGET-2026','FINAL-2025']
];

async function init(){
 try{
  const d=await api('/api/me');
  if(!d.can?.round2){location.href='/participant.html';return}
  currentChallenge=d.terminal.challenge||1;
  if(currentChallenge>5){location.href='/participant.html';return}
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
 const info=challengeInfo[currentChallenge-1],opts=options[currentChallenge-1];
 const solved=t.solved||{};
 const total=challengeInfo.reduce((a,x)=>a+x.marks,0);
 const pipe=challengeInfo.map((x,i)=>{
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
  <div class="r2-prog"><i style="transform:scaleX(${(currentChallenge-1)/5+0.04})"></i></div>

  <main class="r2-main">
   <div class="r2-left r2-in">
    <section class="r2-win r2-mission">
     <div class="r2-bar">${dots}<span>mission.txt</span></div>
     <div class="r2-mbody">
      <div class="r2-mhead">
       <div class="r2-num"><svg viewBox="0 0 100 100"><circle class="a" cx="50" cy="50" r="46"/><circle class="b" cx="50" cy="50" r="46"/></svg><span>${currentChallenge}</span></div>
       <div class="r2-mmeta">
        <p class="r2-eye">Challenge ${currentChallenge} of 5</p>
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
     <div><small>CHALLENGE</small><b>${currentChallenge}<em>/5</em></b></div>
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