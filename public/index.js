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

let results=[],cmdHistory=[],histPos=0;

function render(p,s,t){
 const n=currentChallenge,info=challengeInfo[n-1],opts=options[n-1];
 const pad=x=>String(x).padStart(2,'0');
 const pipe=challengeInfo.map((x,i)=>{
  const k=i+1,st=k<n?(results[i]||'done'):k===n?'now':'todo';
  const mark=st==='ok'?'✓':st==='miss'?'✗':st==='done'?'✓':pad(k);
  return `<li class="pn ${st}" title="${escapeHtml(x.title)}"><b>${mark}</b><span>${x.marks}</span></li>`;
 }).join('<li class="pl"></li>');

 $('#app').innerHTML=`
 <header class="hud2">
  <a class="hb" href="/index.html"><i>&gt;_</i> TERMINAL QUIZ</a>
  <ol class="pipe" aria-label="Challenge progress">${pipe}</ol>
  <div class="clock" id="clock"><small>T-MINUS</small><b class="timer" id="timer">${fmt(s.remainingMs)}</b></div>
 </header>

 <main class="ws">
  <aside class="pane mission">
   <div class="pbar"><i></i><i></i><i></i><span>mission_${pad(n)}.md</span></div>
   <div class="mbody">
    <div class="mtop"><span class="mnum">${pad(n)}</span><span class="mpts"><b>${info.marks}</b> PTS</span></div>
    <p class="meye">/ challenge ${n} of 5 &middot; round 2 &middot; ${escapeHtml(p.id)}</p>
    <h1 class="mtitle">${escapeHtml(info.title)}</h1>
    <p class="mskill"><em>skill</em>${escapeHtml(info.skill)}</p>
    <h3 class="mh">## objective</h3>
    <p class="mdesc">${escapeHtml(info.description)}</p>
    <p class="mhint"><b>// hint</b>${escapeHtml(info.hint)}</p>
    <div class="mfoot"><span>round total <b>50</b></span><span>this one <b>${info.marks}</b></span></div>
   </div>
  </aside>

  <section class="work">
   <div class="pane term">
    <div class="pbar"><i></i><i></i><i></i><span>student@terminal-quiz:${escapeHtml(t.cwd)}</span></div>
    <pre class="termout" id="out">${escapeHtml(termOut||'Welcome. Type help to see available commands.\n')}</pre>
    <form class="termline" id="cmdForm"><span>student@terminal-quiz:~$</span><input id="cmd" autocomplete="off" spellcheck="false" autofocus></form>
   </div>

   <div class="pane flag">
    <div class="pbar"><i></i><i></i><i></i><span>submit_flag.sh</span></div>
    <div class="fbody">
     <p class="fq">&gt; which value did you find?<em> one attempt only</em></p>
     <div class="opts" id="answerOptions">
      ${opts.map((o,i)=>`<label class="round2-option" for="answer-${i}"><input type="radio" name="round2Answer" id="answer-${i}" value="${escapeHtml(o)}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${escapeHtml(o)}</span></label>`).join('')}
     </div>
     <button class="btn" id="submitAnswer">SUBMIT ANSWER</button>
    </div>
   </div>
  </section>
 </main>`;

 $('#cmdForm').onsubmit=runCmd;
 $('#submitAnswer').onclick=submitAnswer;
 const cmd=$('#cmd'),out=$('#out');
 out.scrollTop=out.scrollHeight;
 cmd.addEventListener('keydown',e=>{
  if(e.key==='ArrowUp'&&cmdHistory.length){e.preventDefault();histPos=Math.max(0,histPos-1);cmd.value=cmdHistory[histPos]}
  else if(e.key==='ArrowDown'&&cmdHistory.length){e.preventDefault();histPos=Math.min(cmdHistory.length,histPos+1);cmd.value=cmdHistory[histPos]||''}
 });
 document.querySelectorAll('input[name="round2Answer"]').forEach(r=>{
  r.addEventListener('change',()=>{document.querySelectorAll('.round2-option').forEach(x=>x.classList.remove('selected'));r.closest('.round2-option').classList.add('selected')});
 });
}

async function runCmd(e){
 e.preventDefault();const c=$('#cmd').value;$('#cmd').value='';
 if(c.trim()){cmdHistory.push(c);histPos=cmdHistory.length}
 try{const d=await api('/api/terminal',{method:'POST',body:JSON.stringify({command:c})});termOut+=(termOut?'\n':'')+'$ '+c+'\n'+d.output;if(d.output==='__CLEAR__')termOut='';const o=$('#out');o.textContent=termOut;o.scrollTop=o.scrollHeight;$('#cmd').focus()}catch(x){toast(x.message)}
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
      results[currentChallenge-1]='ok';termOut+='\n✓ Correct! Challenge solved.';
    }else{
      toast('Incorrect answer. Moving to the next challenge.');
      results[currentChallenge-1]='miss';termOut+='\n✗ Incorrect answer.';
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
 timerId=setInterval(()=>{
  const left=Math.max(0,end-Date.now()),el=$('#timer'),box=$('#clock');
  if(el)el.textContent=fmt(left);
  if(box){box.classList.toggle('low',left<300000&&left>=60000);box.classList.toggle('crit',left<60000)}
  if(left<=0){clearInterval(timerId);done()}
 },500);
}
init();