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
  if(d.state.state!=='ROUND2_ACTIVE'){location.href='/participant.html';return}
  currentChallenge=d.terminal.challenge||1;
  if(currentChallenge>5){location.href='/participant.html';return}
  render(d.participant,d.state,d.terminal);
  startTimer(d.state.remainingMs,()=>location.href='/participant.html');
 }catch(e){toast(e.message)}
}

function render(p,s,t){
 const info=challengeInfo[currentChallenge-1],opts=options[currentChallenge-1];
 $('#app').innerHTML=layout(`
 <div class="top">
  <div class="actions" style="justify-content:space-between">
   <div><span class="badge">ROUND 2 • ${escapeHtml(p.id)}</span><h2>Terminal Challenge</h2></div>
   <div class="timer" id="timer">${fmt(s.remainingMs)}</div>
  </div>
  <div class="card">
   <div class="actions" style="justify-content:space-between;align-items:flex-start">
    <div><span class="badge">CHALLENGE ${currentChallenge} OF 5 • ${info.marks} MARKS</span><h3 style="margin-bottom:6px">${escapeHtml(info.title)}</h3><p class="muted" style="margin-top:0">Skill: ${escapeHtml(info.skill)}</p></div>
    <div class="badge">${info.marks} MARKS</div>
   </div>
   <div class="card" style="margin-top:16px;padding:18px;background:#0a1118">
    <h3 style="margin-bottom:8px">Your Task</h3>
    <p style="line-height:1.7;margin:0">${escapeHtml(info.description)}</p>
    <p class="muted" style="margin:12px 0 0;line-height:1.6"><strong>Hint:</strong> ${escapeHtml(info.hint)}</p>
   </div>
   <div class="terminal" style="margin-top:16px">
    <div class="termbar">student@terminal-quiz:${escapeHtml(t.cwd)}$</div>
    <pre class="termout" id="out">${escapeHtml(termOut||'Welcome. Type help to see available commands.\n')}</pre>
    <form class="termline" id="cmdForm"><span>student@terminal-quiz:~$</span><input id="cmd" autocomplete="off" autofocus></form>
   </div>
   <div class="grid" style="margin-top:16px">
    <div class="card">
     <h3>Choose Your Answer</h3>
     <p class="muted" style="line-height:1.5">Use the terminal above to solve the challenge. Then select the answer you discovered.</p>
     <div id="answerOptions" style="display:grid;gap:10px;margin-top:14px">
      ${opts.map((o,i)=>`<label class="round2-option" for="answer-${i}"><input type="radio" name="round2Answer" id="answer-${i}" value="${escapeHtml(o)}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(o)}</span></label>`).join('')}
     </div>
     <button class="btn" id="submitAnswer" style="margin-top:16px;width:100%">SUBMIT ANSWER</button>
    </div>
    <div class="card">
     <h3>Progress</h3><p>Challenge ${currentChallenge} of 5</p><p class="muted">Current challenge: ${info.marks} marks</p><p class="muted">Total Round 2: 50 marks</p>
     <div style="margin-top:16px"><div class="muted" style="font-size:13px;margin-bottom:8px">CHALLENGES</div>
      ${challengeInfo.map((x,i)=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #18232d"><span style="${i+1===currentChallenge?'font-weight:700':''}">${i+1}. ${escapeHtml(x.title)}</span><span class="muted">${x.marks}</span></div>`).join('')}
     </div>
    </div>
   </div>
  </div>
 </div>`);
 $('#cmdForm').onsubmit=runCmd;
 $('#submitAnswer').onclick=submitAnswer;
 document.querySelectorAll('input[name="round2Answer"]').forEach(r=>{
  r.addEventListener('change',()=>{document.querySelectorAll('.round2-option').forEach(x=>x.classList.remove('selected'));r.closest('.round2-option').classList.add('selected')});
 });
}

async function runCmd(e){
 e.preventDefault();const c=$('#cmd').value;$('#cmd').value='';
 try{const d=await api('/api/terminal',{method:'POST',body:JSON.stringify({command:c})});termOut+=(termOut?'\n':'')+'$ '+c+'\n'+d.output;if(d.output==='__CLEAR__')termOut='';$('#out').textContent=termOut;$('#cmd').focus()}catch(x){toast(x.message)}
}

async function submitAnswer(){
  const selected=document.querySelector('input[name="round2Answer"]:checked');

  if(!selected){
    toast('Please select one answer before submitting.');
    return;
  }

  const button=$('#submitAnswer');

  // Once SUBMIT is clicked, the participant gets only one attempt
  // for this challenge. Disable every option immediately.
  document.querySelectorAll('input[name="round2Answer"]').forEach(radio=>{
    radio.disabled=true;
  });
  document.querySelectorAll('.round2-option').forEach(option=>{
    option.style.pointerEvents='none';
    option.style.opacity='0.65';
  });

  button.disabled=true;
  button.textContent='SUBMITTED';

  try{
    const d=await api('/api/terminal',{
      method:'POST',
      body:JSON.stringify({
        command:'',
        answer:selected.value,
        submit:true
      })
    });

    if(d.solved){
      toast('Correct! Moving to the next challenge.');
      termOut+='\\n✓ Correct! Challenge solved.';
    }else{
      toast('Incorrect answer. Moving to the next challenge.');
      termOut+='\\n✗ Incorrect answer.';
    }

    // The participant cannot change the submitted answer.
    // init() loads the next challenge because the server advances
    // the challenge after a correct submission; for an incorrect
    // submission we explicitly advance the UI to the next challenge.
    if(!d.solved){
      await advanceAfterIncorrect();
    }else{
      await init();
    }

  }catch(e){
    // The answer has already been locked. Do not re-enable options.
    toast(e.message);
    button.textContent='SUBMITTED';
  }
}

async function advanceAfterIncorrect(){
  // The server intentionally does not advance an incorrect challenge.
  // For the one-submit-per-question rule, move the participant forward
  // only in the client UI while preserving the server's scoring behavior.
  currentChallenge++;

  if(currentChallenge>5){
    location.href='/participant.html';
    return;
  }

  try{
    const d=await api('/api/me');
    render(d.participant,d.state,{...d.terminal,challenge:currentChallenge,cwd:d.terminal.cwd});
    startTimer(d.state.remainingMs,()=>location.href='/participant.html');
  }catch(e){
    toast(e.message);
  }
}

function startTimer(ms,done){
 clearInterval(timerId);let end=Date.now()+ms;
 timerId=setInterval(()=>{const left=Math.max(0,end-Date.now()),el=$('#timer');if(el)el.textContent=fmt(left);if(left<=0){clearInterval(timerId);done()}},500);
}
init();
