$('#app').innerHTML=layout(`
<main class="home">
  <section class="h-main">
    <div class="h-left">
      <p class="h-eyebrow">/ welcome to the</p>
      <h1 class="h-title"><span>Terminal</span><span class="o">Quiz</span></h1>
      <p class="h-type"><em>&gt;</em> <span id="tw"></span><i class="h-caret"></i></p>
      <div class="h-btns">
        <a class="h-btn" href="/participant-login.html">ENTER EVENT →</a>
        <a class="h-btn ghost" href="/admin-login.html">ADMIN CONTROL</a>
      </div>
    </div>

    <aside class="h-pane">
      <div class="h-bar"><b></b><b></b><b></b><span>rounds.sh</span></div>
      <div class="h-row"><span class="h-n">01</span><div><h3>Technical Quiz</h3><p>20 questions · 20 minutes · 20 marks</p></div></div>
      <div class="h-row"><span class="h-n">02</span><div><h3>Terminal Quiz</h3><p>5 challenges · 30 minutes · command-line investigation</p></div></div>
    </aside>
  </section>

  <p class="h-sec">$ cat how_it_works.txt</p>
  <ol class="h-steps">
    <li><b>01</b><span>Join with your participant ID.</span></li>
    <li><b>02</b><span>Complete the timed technical quiz.</span></li>
    <li><b>03</b><span>Solve five terminal challenges.</span></li>
    <li><b>04</b><span>View the final leaderboard when published.</span></li>
  </ol>

  <div class="h-status"><span>NORMAL</span><span>terminal-quiz · ready</span></div>
</main>`);

/* remove the "COLLEGE SYMPOSIUM • LAN EVENT" text from the top bar (homepage only) */
document.querySelectorAll('#app *').forEach(e=>{
  if(!e.children.length && /symposium/i.test(e.textContent)) e.remove();
});

/* looping typewriter */
(function(){
  const el=document.getElementById('tw'); if(!el) return;
  const words=['Operating Systems.','Linux fundamentals.','Terminal problem solving.','Think. Type. Solve.'];
  let w=0,i=0,del=false;
  (function tick(){
    const t=words[w];
    el.textContent=t.slice(0,i);
    if(!del&&i===t.length){del=true;return setTimeout(tick,1400)}
    if(del&&i===0){del=false;w=(w+1)%words.length;return setTimeout(tick,350)}
    i+=del?-1:1;
    setTimeout(tick,del?35:70);
  })();
})();
