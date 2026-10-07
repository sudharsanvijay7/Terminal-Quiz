if(!requireParticipant()) throw new Error('participant auth required');

/* =========================================================
   ROUND 1 — TECHNICAL QUIZ (terminal theme, fits one screen)
   Same API as before: /api/me /api/questions /api/answer /api/submit-round1
   ========================================================= */
let me=null, questions=[], answers={}, qi=0, mode='quiz';
let endAt=0, timerId=null, submitting=false;

/* answers are also kept in this browser, so a page reload never loses the ticks */
const LSKEY=()=>'tq_r1_'+(me&&me.id||'');
function loadLocal(){try{return JSON.parse(localStorage.getItem(LSKEY())||'{}')}catch{return {}}}
function saveLocal(){try{localStorage.setItem(LSKEY(),JSON.stringify(answers))}catch{}}
const pad=n=>String(n).padStart(2,'0');
const answeredCount=()=>questions.filter(q=>answers[q.id]!=null).length;

async function init(){
  try{
    const [d,q]=await Promise.all([api('/api/me'),api('/api/questions')]);
    if(d.participant?.round1Submitted||d.state.state!=='ROUND1_ACTIVE'){location.href='/participant.html';return}
    me=d.participant; questions=q;
    const saved=loadLocal();
    questions.forEach(x=>{const v=saved[x.id];if(v!=null&&v>=0&&v<x.options.length)answers[x.id]=v});
    const first=questions.findIndex(x=>answers[x.id]==null);
    qi=first<0?0:first;
    /* the timer starts now, for this participant only */
    const st=await api('/api/round1-start',{method:'POST',body:'{}'});
    endAt=Date.now()+st.remainingMs;
    shell(); draw(true); startTimer();
    setInterval(resync,10000);
  }catch(e){
    toast(e.message);
    setTimeout(()=>location.href='/participant.html',1000);
  }
}

/* keeps the clock honest (pause / early end by the admin) */
async function resync(){
  if(submitting)return;
  try{
    const d=await api('/api/me');
    if(d.participant?.round1Submitted||d.state.state!=='ROUND1_ACTIVE'){location.href='/participant.html';return}
    if(d.myRemainingMs!=null)endAt=Date.now()+d.myRemainingMs;
  }catch(e){if(/unauthorized/i.test(e.message))location.href='/participant-login.html'}
}

/* static frame: drawn once, so the timer never flickers */
function shell(){
  $('#app').innerHTML=`<div class="r1">
  <header class="r1-top">
    <span class="r1-brand"><span>&gt;_</span> TERMINAL QUIZ</span>
    <span class="r1-pill"><i></i> ROUND 1 · ${escapeHtml(me.id)}</span>
    <span class="r1-name">${escapeHtml(me.name||'')}</span>
    <div class="r1-timer"><small>TIME LEFT</small><b id="timer">--:--</b></div>
  </header>
  <div class="r1-prog"><i id="prog"></i></div>
  <main class="r1-main" id="main"></main>
</div>`;
}

function draw(animate){
  const main=$('#main'); if(!main)return;
  if(!questions.length){
    main.innerHTML=`<section class="r1-win"><div class="r1-body"><p class="r1-cmd"><em>$</em> ls questions/</p><h1 class="r1-q">No questions are loaded yet.</h1></div></section>`;
    return;
  }
  main.className='r1-main'+(mode==='review'?' review':'');
  main.innerHTML=mode==='review'?reviewHtml(animate):quizHtml(animate);
  const done=answeredCount();
  const bar=$('#prog'); if(bar)bar.style.transform='scaleX('+(done/questions.length)+')';
  if(mode==='quiz'){const cur=main.querySelector('.r1-n.current');if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest'})}
}

function mapHtml(){
  return questions.map((x,i)=>`<button class="r1-n${answers[x.id]!=null?' answered':''}${mode==='quiz'&&i===qi?' current':''}" onclick="goQ(${i})" aria-label="Question ${i+1}">${i+1}</button>`).join('');
}

function quizHtml(animate){
  const q=questions[qi], last=qi===questions.length-1, done=answeredCount();
  return `<section class="r1-win${animate?' r1-in':''}">
    <div class="r1-bar"><b></b><b></b><b></b><span>question_${pad(qi+1)}.sh</span></div>
    <div class="r1-body">
      <p class="r1-cmd"><em>$</em> cat question_${pad(qi+1)}.txt <small>${pad(qi+1)} / ${pad(questions.length)}</small></p>
      <h1 class="r1-q">${escapeHtml(q.text)}</h1>
      <div class="r1-opts">${q.options.map((o,i)=>`<button class="r1-opt${answers[q.id]===i?' selected':''}" onclick="pick(${q.id},${i})"><span class="r1-k">${String.fromCharCode(65+i)}</span><span class="r1-t">${escapeHtml(o)}</span><i class="r1-tick">✓</i></button>`).join('')}</div>
    </div>
    <div class="r1-foot">
      <button class="r1-btn" onclick="prevQ()"${qi===0?' disabled':''}>← PREVIOUS</button>
      <span class="r1-keys">keys: A–D select · ← → move</span>
      <button class="r1-btn go" onclick="nextQ()">${last?'REVIEW ANSWERS':'NEXT →'}</button>
    </div>
  </section>
  <aside class="r1-side${animate?' r1-in':''}">
    <div class="r1-win r1-mapwin">
      <div class="r1-bar"><b></b><b></b><b></b><span>question_map.sh</span></div>
      <div class="r1-body"><div class="r1-map">${mapHtml()}</div></div>
      <div class="r1-legend"><span><i class="a"></i>answered</span><span><i class="p"></i>pending</span><span><i class="c"></i>current</span></div>
    </div>
    <div class="r1-stat"><small>ANSWERED</small><b><em>${done}</em> / ${questions.length}</b></div>
    <button class="r1-submit" onclick="submitR1(false)">SUBMIT QUIZ</button>
  </aside>`;
}

function reviewHtml(animate){
  const done=answeredCount(), left=questions.length-done;
  return `<section class="r1-win${animate?' r1-in':''}">
    <div class="r1-bar"><b></b><b></b><b></b><span>review.sh</span></div>
    <div class="r1-body">
      <p class="r1-cmd"><em>$</em> review --all <small>${done} / ${questions.length} answered</small></p>
      <div class="r1-note${left?' warn':''}">${left?`<b>${left} question${left>1?'s':''} not answered.</b> Unanswered questions score 0. You can still edit any answer.`:`<b>All questions answered.</b> Check your choices, then submit.`}</div>
      <div class="r1-rv">${questions.map((q,i)=>{
        const a=answers[q.id];
        return `<div class="r1-row${a==null?' empty':''}">
          <span class="r1-rn">Q${pad(i+1)}</span>
          <div class="r1-rt"><strong>${escapeHtml(q.text)}</strong><span>${a==null?'not answered':`${String.fromCharCode(65+a)}. ${escapeHtml(q.options[a])}`}</span></div>
          <button class="r1-btn" onclick="editQuestion(${i})">EDIT</button>
        </div>`}).join('')}</div>
    </div>
    <div class="r1-foot">
      <button class="r1-btn" onclick="backToQuiz()">← BACK TO QUIZ</button>
      <button class="r1-btn danger" onclick="submitR1(false)">SUBMIT QUIZ</button>
    </div>
  </section>`;
}

/* ---------- navigation ---------- */
function goQ(i){qi=i;mode='quiz';draw(true)}
function nextQ(){if(qi>=questions.length-1)showReview();else{qi++;draw(true)}}
function prevQ(){if(qi>0){qi--;draw(true)}}
function showReview(){mode='review';draw(true)}
function backToQuiz(){mode='quiz';qi=questions.length-1;draw(true)}
function editQuestion(i){qi=i;mode='quiz';draw(true)}

function pick(qid,i){
  answers[qid]=i;
  saveLocal();
  api('/api/answer',{method:'POST',body:JSON.stringify({questionId:qid,answer:i})}).catch(e=>toast(e.message));
  draw(false);
}

/* ---------- keyboard: A-D / 1-4 select, arrows move ---------- */
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||document.getElementById('r1m')||mode!=='quiz'||!questions.length)return;
  const q=questions[qi];
  if(e.key==='ArrowRight'){e.preventDefault();nextQ();return}
  if(e.key==='ArrowLeft'){e.preventDefault();prevQ();return}
  if(e.key.length!==1)return;
  const k=e.key.toLowerCase();
  let idx='abcdefgh'.indexOf(k);
  if(idx<0&&/[1-9]/.test(k))idx=Number(k)-1;
  if(idx>=0&&idx<q.options.length){e.preventDefault();pick(q.id,idx)}
});

/* ---------- timer ---------- */
function startTimer(){clearInterval(timerId);tick();timerId=setInterval(tick,250)}
function tick(){
  const left=Math.max(0,endAt-Date.now());
  const el=$('#timer');
  if(el){el.textContent=fmt(left);el.classList.toggle('warn',left>0&&left<60000)}
  if(left<=0){clearInterval(timerId);submitR1(true)}
}

/* ---------- themed confirm (replaces the browser confirm box) ---------- */
function confirmSubmit(){
  return new Promise(resolve=>{
    if(document.getElementById('r1m'))return resolve(false);
    const left=questions.length-answeredCount();
    const m=document.createElement('div');m.id='r1m';m.className='r1-m';
    m.innerHTML=`<div class="r1-mwin">
      <div class="r1-mwarn">⚠ CONFIRM SUBMISSION</div>
      <div class="r1-mbody">
        <h3>Submit Round 1?</h3>
        <p>${left?`<b>${left} question${left>1?'s are':' is'} still unanswered</b> and will score 0. `:'All questions are answered. '}You <b>cannot change answers</b> after submitting.</p>
        <div class="r1-mbtns"><button type="button" class="r1-btn" id="r1no">KEEP WORKING</button><button type="button" class="r1-btn go" id="r1yes">SUBMIT NOW</button></div>
      </div></div>`;
    document.body.appendChild(m);
    const close=ok=>{document.removeEventListener('keydown',onKey,true);m.remove();resolve(ok)};
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close(false)}};
    document.addEventListener('keydown',onKey,true);
    m.addEventListener('mousedown',e=>{if(e.target===m)close(false)});
    m.querySelector('#r1no').onclick=()=>close(false);
    m.querySelector('#r1yes').onclick=()=>close(true);
    setTimeout(()=>m.querySelector('#r1no').focus(),30);
  });
}

async function submitR1(auto=false){
  if(submitting)return;
  if(!auto&&!(await confirmSubmit()))return;
  submitting=true;
  try{
    await api('/api/submit-round1',{method:'POST',body:'{}'});
    clearInterval(timerId);
    try{localStorage.removeItem(LSKEY())}catch{}
    location.href='/participant.html';
  }catch(e){
    submitting=false;
    if(auto){location.href='/participant.html'}else toast(e.message);
  }
}

init();