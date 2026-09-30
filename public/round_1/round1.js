if(!requireParticipant()) throw new Error('participant auth required');
let questions=[],answers={},qi=0,timerId,reviewMode=false;

async function init(){
  try{
    const [d,q]=await Promise.all([api('/api/me'),api('/api/questions')]);
    if(d.participant?.round1Submitted){ location.href='/participant.html'; return; }
    if(d.state.state!=='ROUND1_ACTIVE'){ location.href='/participant.html'; return; }
    questions=q;
    render(d.participant,d.state);
    startTimer(d.state.remainingMs,()=>submitR1(true));
  }catch(e){
    toast(e.message);
    setTimeout(()=>location.href='/participant.html',1000);
  }
}

function render(p,s){
  if(reviewMode){ renderReview(p,s); return; }
  const q=questions[qi];
  $('#app').innerHTML=layout(`<div class="top">
    <div class="actions" style="justify-content:space-between">
      <div><span class="badge">ROUND 1 • ${escapeHtml(p.id)}</span><h2>Technical Quiz</h2></div>
      <div class="timer" id="timer">${fmt(s.remainingMs)}</div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 260px">
      <div class="card">
        <div class="muted small">QUESTION ${qi+1} / ${questions.length}</div>
        <div class="question">${escapeHtml(q.text)}</div>
        ${q.options.map((o,i)=>`<button class="option ${answers[q.id]===i?'selected':''}" onclick="pick(${q.id},${i})">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</button>`).join('')}
        <div class="actions" style="margin-top:20px">
          <button class="btn alt" onclick="prevQ()">PREVIOUS</button>
          <button class="btn" onclick="${qi===questions.length-1?'showReview()':'nextQ()'}">${qi===questions.length-1?'REVIEW':'NEXT'}</button>
          <button class="btn danger" onclick="submitR1(false)">SUBMIT QUIZ</button>
        </div>
      </div>
      <div class="card">
        <h3>Question Map</h3>
        <div class="palette">${questions.map((x,i)=>`<button class="qnum ${answers[x.id]!=null?'answered':''} ${i===qi?'current':''}" onclick="qi=${i};reviewMode=false;render(${JSON.stringify(p)},${JSON.stringify(s)})">${i+1}</button>`).join('')}</div>
        <p class="muted small" style="margin-top:20px">Answered: ${Object.keys(answers).length}/${questions.length}</p>
      </div>
    </div>
  </div>`);
}

function renderReview(p,s){
  const answered=Object.keys(answers).length;
  $('#app').innerHTML=layout(`<div class="top">
    <div class="actions" style="justify-content:space-between">
      <div><span class="badge">ROUND 1 • REVIEW</span><h2>Review Your Answers</h2></div>
      <div class="timer" id="timer">${fmt(s.remainingMs)}</div>
    </div>
    <div class="card">
      <div class="notice"><strong>${answered}/${questions.length} answered.</strong> Review your selections before submitting. You can edit any answer.</div>
      <div class="review-list">
        ${questions.map((q,i)=>{
          const a=answers[q.id];
          return `<div class="review-item">
            <div><strong>Q${i+1}. ${escapeHtml(q.text)}</strong>
            <div class="muted small" style="margin-top:7px">${a==null?'Not answered':`Your answer: ${String.fromCharCode(65+a)}. ${escapeHtml(q.options[a])}`}</div></div>
            <button class="btn alt" onclick="editQuestion(${i})">EDIT ANSWER</button>
          </div>`;
        }).join('')}
      </div>
      <div class="actions" style="margin-top:20px">
        <button class="btn alt" onclick="backToQuiz()">BACK TO QUIZ</button>
        <button class="btn danger" onclick="submitR1(false)">SUBMIT QUIZ</button>
      </div>
    </div>
  </div>`);
}

function showReview(){reviewMode=true;initRender()}
function backToQuiz(){reviewMode=false;qi=questions.length-1;initRender()}
function editQuestion(i){qi=i;reviewMode=false;initRender()}
function pick(qid,i){
  answers[qid]=i;
  api('/api/answer',{method:'POST',body:JSON.stringify({questionId:qid,answer:i})}).catch(e=>toast(e.message));
  render({id:'',name:''},{remainingMs:document.querySelector('#timer')?parseTime(document.querySelector('#timer').textContent):0});
}
function parseTime(x){const [m,s]=x.split(':').map(Number);return (m*60+s)*1000}
function nextQ(){qi=Math.min(questions.length-1,qi+1);initRender()}
function prevQ(){qi=Math.max(0,qi-1);initRender()}
async function initRender(){
  const d=await api('/api/me');
  if(d.participant?.round1Submitted){location.href='/participant.html';return}
  render(d.participant,d.state);
}
async function submitR1(auto=false){
  if(!auto && !confirm('Submit Round 1? You cannot change answers afterwards.'))return;
  try{
    await api('/api/submit-round1',{method:'POST',body:'{}'});
    clearInterval(timerId);
    location.href='/participant.html';
  }catch(e){toast(e.message)}
}
function startTimer(ms,done){
  clearInterval(timerId);
  let end=Date.now()+ms;
  timerId=setInterval(()=>{
    const left=Math.max(0,end-Date.now());
    const el=$('#timer'); if(el)el.textContent=fmt(left);
    if(left<=0){clearInterval(timerId);done();}
  },500);
}
init();
