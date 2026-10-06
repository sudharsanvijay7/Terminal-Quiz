/* time taken to finish a round: 754000 -> '12m 34s'; '—' if the participant did not finish it */
const taken = ms => { if (ms == null) return '—'; const t = Math.round(ms / 1000); return Math.floor(t / 60) + 'm ' + String(t % 60).padStart(2, '0') + 's' };

async function init() {
    try {
        const s = await api('/api/state');
        if (!s.leaderboardPublished) { location.href = '/participant.html'; return }
        const a = await api('/api/leaderboard');
        const max = Math.max(1, a[0]?.total || 1);

        /* podium: visual order is 2nd, 1st, 3rd */
        const pod = (x, cls, label) => x ? `<div class="lb-pod ${cls}">
        <div class="lb-who">${cls === 'p1' ? '<span class="lb-crown">♛</span>' : ''}<span class="lb-medal">${label}</span>
          <h3>${escapeHtml(x.name)}</h3>
          <div class="lb-score"><b data-n="${x.total}">0</b><small>pts</small></div>
          <p>R1 ${x.round1} (${taken(x.round1TimeMs)}) · R2 ${x.round2} (${taken(x.round2TimeMs)})</p></div>
        <div class="lb-ped"><span>#${x.rank}</span></div></div>` : '<div class="lb-pod empty"></div>';
        const podium = a.length ? `<div class="lb-podium">${pod(a[1], 'p2', '2ND')}${pod(a[0], 'p1', 'CHAMPION')}${pod(a[2], 'p3', '3RD')}</div>` : '';

        const rest = a.slice(3);
        const table = rest.length ? `<section class="lb-pane">
      <div class="lb-bar"><b></b><b></b><b></b><span>ranks_4_and_below.log</span></div>
      <div style="overflow:auto"><table class="lb-table"><thead><tr><th>Rank</th><th>Participant</th><th>R1</th><th>R1 Time</th><th>R2</th><th>R2 Time</th><th>Total</th></tr></thead><tbody>
      ${rest.map((x, i) => `<tr style="--d:${(2.9 + i * .09).toFixed(2)}s;--w:${Math.round(x.total / max * 100)}%"><td><b>#${x.rank}</b></td><td>${escapeHtml(x.name)}</td><td>${x.round1}</td><td>${taken(x.round1TimeMs)}</td><td>${x.round2}</td><td>${taken(x.round2TimeMs)}</td><td><b>${x.total}</b></td></tr>`).join('')}
      </tbody></table></div></section>`: '';

        $('#app').innerHTML = layout(`
    <main class="lb">
      <span class="lb-badge"><i></i>EVENT COMPLETE</span>
      <h1 class="lb-title"><span class="lb-t1">FINAL</span><span class="lb-t2">LEADERBOARD</span></h1>
      <p class="lb-sub"><em>&gt;</em> congratulations to all participants<i class="lb-caret"></i></p>
      ${a.length ? podium + table : '<p class="lb-empty">No scores to show yet.</p>'}
      <div class="lb-actions"><a class="lb-btn" href="/index.html">← BACK TO HOME</a></div>
    </main>`);

        document.querySelectorAll('#app *').forEach(e => { if (!e.children.length && /symposium/i.test(e.textContent)) e.remove(); });
        fx();
        /* count-ups sync with each podium reveal */
        const delays = { p3: 600, p2: 1300, p1: 2200 };
        document.querySelectorAll('.lb-pod').forEach(p => {
            const n = p.querySelector('[data-n]'); if (!n) return;
            const d = delays[['p1', 'p2', 'p3'].find(c => p.classList.contains(c))] || 0;
            setTimeout(() => countUp(n, +n.dataset.n), d + 500);
        });
        setTimeout(confetti, 2300);
    } catch (e) { toast(e.message) }
}

function countUp(el, end) { let v = 0; const step = Math.max(1, Math.ceil(end / 40)); const id = setInterval(() => { v = Math.min(end, v + step); el.textContent = v; if (v >= end) clearInterval(id) }, 30) }

/* faint matrix rain */
function fx() {
    if (document.getElementById('lbrain') || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const c = document.createElement('canvas'); c.id = 'lbrain'; document.body.prepend(c);
    const x = c.getContext('2d'), ch = '01$#>_/\\|{}[]<>=+*'.split(''), fs = 16; let drops;
    const size = () => { c.width = innerWidth; c.height = innerHeight; drops = Array.from({ length: Math.ceil(c.width / fs) }, () => Math.random() * -50) };
    size(); addEventListener('resize', size);
    setInterval(() => {
        x.fillStyle = 'rgba(3,8,5,.12)'; x.fillRect(0, 0, c.width, c.height); x.font = fs + 'px monospace';
        drops.forEach((y, i) => { x.fillStyle = Math.random() > .97 ? '#d6ffe8' : '#27b86a'; x.fillText(ch[Math.random() * ch.length | 0], i * fs, y * fs); drops[i] = (y * fs > c.height && Math.random() > .975) ? 0 : y + 1; });
    }, 50);
}

/* one-time confetti burst when the champion appears */
function confetti() {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const c = document.createElement('canvas'); c.id = 'lbconf'; document.body.appendChild(c);
    c.width = innerWidth; c.height = innerHeight; const x = c.getContext('2d');
    const cols = ['#34f58b', '#ffd24a', '#e9fff3', '#27b86a', '#ffffff'];
    const ps = Array.from({ length: 170 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 300, y: innerHeight * .4, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }));
    let t = 0;
    (function frame() {
        x.clearRect(0, 0, c.width, c.height);
        ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore() });
        if (++t < 260) requestAnimationFrame(frame); else c.remove();
    })();
}
init();