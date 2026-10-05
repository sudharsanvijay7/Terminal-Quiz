/* =========================================================
   TERMINAL QUIZ — HOME PAGE JAVASCRIPT
   ========================================================= */


/* =========================================================
   MAIN HOME PAGE HTML
   ========================================================= */

document.getElementById('app').innerHTML = layout(`

<main class="home">

  <section class="zoom" id="zoom">

    <div class="stage" id="stage">

      <div class="zoom-glow"></div>

      <div class="zoom-hero" id="zhero">
        <div class="zt">

          <p class="h-eyebrow" id="eyebrow">
            / welcome to the
          </p>

          <h1 class="h-title">
            <span class="glitch" data-t="Terminal">Terminal</span>

            <span class="o">
              <i class="q" id="q">Q</i>
              <b class="bl" id="bl"></b>
              uiz
            </span>
          </h1>

          <p class="h-type">
            <em>&gt;</em>
            <span id="tw"></span>
            <i class="h-caret"></i>
          </p>

        </div>
      </div>


      <aside class="h-pane" id="pane">

        <div class="h-bar">
          <b></b>
          <b></b>
          <b></b>
          <span>rounds.sh</span>
        </div>

        <div class="h-boot" id="boot"></div>


        <div class="h-row">
          <span class="h-n">01</span>

          <div>
            <h3>Technical Quiz</h3>
            <p>20 questions · 20 minutes · 20 marks</p>
          </div>
        </div>


        <div class="h-row">
          <span class="h-n">02</span>

          <div>
            <h3>Terminal Quiz</h3>
            <p>5 challenges · 30 minutes · command-line investigation</p>
          </div>
        </div>

      </aside>

    </div>

  </section>


  <p class="h-sec">$ cat how_it_works.txt</p>


  <ol class="h-steps" id="steps">

    <li>
      <b>01</b>
      <span>Join with your participant ID.</span>
    </li>

    <li>
      <b>02</b>
      <span>Complete the timed technical quiz.</span>
    </li>

    <li>
      <b>03</b>
      <span>Solve five terminal challenges.</span>
    </li>

    <li>
      <b>04</b>
      <span>View the final leaderboard when published.</span>
    </li>

  </ol>


  <div class="h-btns big">

    <a class="h-btn" href="/participant-login.html">
      ENTER EVENT →
    </a>

    <a class="h-btn ghost" href="/admin-login.html">
      ADMIN CONTROL
    </a>

  </div>

</main>
`);


/* =========================================================
   REMOVE "COLLEGE SYMPOSIUM • LAN EVENT"
   ========================================================= */

document.querySelectorAll('#app *').forEach((element) => {

  if (
    !element.children.length &&
    /symposium/i.test(element.textContent)
  ) {
    element.remove();
  }

});


/* =========================================================
   LOOPING TYPEWRITER
   ========================================================= */

(function () {

  const el = document.getElementById('tw');

  if (!el) return;


  const words = [
    'Operating Systems.',
    'Linux fundamentals.',
    'Terminal problem solving.',
    'Think. Type. Solve.'
  ];


  let wordIndex = 0;
  let charIndex = 0;
  let deleting = false;


  function tick() {

    const text = words[wordIndex];

    el.textContent = text.slice(0, charIndex);


    if (!deleting && charIndex === text.length) {

      deleting = true;

      return setTimeout(tick, 1400);

    }


    if (deleting && charIndex === 0) {

      deleting = false;

      wordIndex = (wordIndex + 1) % words.length;

      return setTimeout(tick, 350);

    }


    charIndex += deleting ? -1 : 1;

    setTimeout(
      tick,
      deleting ? 35 : 70
    );

  }


  tick();

})();


/* =========================================================
   MATRIX RAIN BACKGROUND
   ========================================================= */

(function () {

  if (
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
  ) {
    return;
  }


  const canvas = document.createElement('canvas');

  canvas.id = 'rain';

  document.body.prepend(canvas);


  const ctx = canvas.getContext('2d');


  const chars =
    '01$#>_/\\|{}[]<>=+*ABCDEF'.split('');


  const fontSize = 16;


  let columns;
  let drops;


  function resize() {

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    columns =
      Math.ceil(canvas.width / fontSize);


    drops = Array.from(
      { length: columns },
      () => Math.random() * -50
    );

  }


  resize();


  window.addEventListener(
    'resize',
    resize
  );


  setInterval(() => {

    if (
      document.body.classList.contains(
        'scrolling'
      )
    ) {
      return;
    }


    ctx.fillStyle =
      'rgba(3,8,5,.12)';

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    ctx.font =
      fontSize + 'px monospace';


    drops.forEach((y, index) => {

      ctx.fillStyle =
        Math.random() > 0.97
          ? '#d6ffe8'
          : '#27b86a';


      ctx.fillText(
        chars[
          Math.floor(
            Math.random() * chars.length
          )
        ],
        index * fontSize,
        y * fontSize
      );


      drops[index] =
        (
          y * fontSize > canvas.height &&
          Math.random() > 0.975
        )
          ? 0
          : y + 1;

    });

  }, 50);

})();


/* =========================================================
   BOOT LOG TYPING
   ========================================================= */

(function () {

  const el =
    document.getElementById('boot');


  if (!el) return;


  const lines = [

    '[<span class="ok"> OK </span>] mounting /dev/quiz',

    '[<span class="ok"> OK </span>] LAN server online',

    '[<span class="ok"> OK </span>] rounds loaded: 2',

    '[<span class="ok"> OK </span>] awaiting participants_'

  ];


  let index = 0;


  function next() {

    if (index >= lines.length) {
      return;
    }


    el.insertAdjacentHTML(
      'beforeend',
      lines[index++] + '<br>'
    );


    setTimeout(next, 450);

  }


  next();

})();


/* =========================================================
   LIVE CLOCK
   ========================================================= */

(function () {

  const clock =
    document.getElementById('clk');


  function updateClock() {

    if (clock) {

      clock.textContent =
        new Date().toLocaleTimeString('en-GB');

    }

  }


  updateClock();

  setInterval(
    updateClock,
    1000
  );

})();


/* =========================================================
   CURSOR SPOTLIGHT
   ========================================================= */

(function () {

  const pane =
    document.getElementById('pane');


  if (!pane) return;


  pane.addEventListener(
    'pointermove',
    (event) => {

      const rect =
        pane.getBoundingClientRect();


      pane.style.setProperty(
        '--mx',
        (event.clientX - rect.left) + 'px'
      );


      pane.style.setProperty(
        '--my',
        (event.clientY - rect.top) + 'px'
      );

    }
  );

})();


/* =========================================================
   PRESS ENTER TO JOIN
   ========================================================= */

window.addEventListener(
  'keydown',
  (event) => {

    const active =
      document.activeElement;


    if (
      event.key === 'Enter' &&
      active &&
      !/INPUT|TEXTAREA|A|BUTTON/.test(
        active.tagName
      )
    ) {

      window.location.href =
        '/participant-login.html';

    }

  }
);


/* =========================================================
   STEPS — REVEAL ONE BY ONE
   ========================================================= */

(function () {

  const box =
    document.getElementById('steps');


  if (!box) return;


  const items =
    [...box.children].map((li) => {

      const span =
        li.querySelector('span');


      const text =
        span.textContent;


      span.textContent = '';


      return {
        li,
        span,
        text
      };

    });


  let started = false;


  box.classList.add('seq');


  function run(index) {

    if (index >= items.length) {
      return;
    }


    const {
      li,
      span,
      text
    } = items[index];


    li.classList.add('on');


    let charIndex = 0;


    function type() {

      span.textContent =
        text.slice(
          0,
          ++charIndex
        );


      if (charIndex < text.length) {

        setTimeout(
          type,
          28
        );

      } else {

        setTimeout(
          () => run(index + 1),
          350
        );

      }

    }


    type();

  }


  const observer =
    new IntersectionObserver(
      (entries, observer) => {

        if (
          entries[0].isIntersecting &&
          !started
        ) {

          started = true;

          observer.disconnect();

          run(0);

        }

      },
      {
        threshold: 0.35
      }
    );


  observer.observe(box);

})();


/* =========================================================
   CYBER LAYER
   ========================================================= */

document.body.insertAdjacentHTML(
  'beforeend',
  `
  <div class="floor"></div>

  <div class="hud tl">
    SYS // <b>ONLINE</b>
  </div>

  <div class="hud tr">
    DEPTH <b id="depth">000</b>%
  </div>

  <div class="hud bl">
    NET // LAN · <b>${location.host}</b>
  </div>

  <div class="hud br">
    TERMINAL-QUIZ // v1.0
  </div>

  <div class="hud-line">
    <i id="hprog"></i>
  </div>
  `
);


/* =========================================================
   TEXT SCRAMBLE EFFECT
   ========================================================= */

function scramble(
  element,
  text,
  duration = 900
) {

  const characters =
    '!<>-_\\/[]{}=+*^?#01';


  const frames =
    Math.ceil(duration / 30);


  let frame = 0;


  const interval =
    setInterval(() => {

      element.textContent =
        text
          .split('')
          .map((character, index) => {

            if (character === ' ') {
              return ' ';
            }


            return (
              index <
              text.length * frame / frames
            )
              ? character
              : characters[
                  Math.floor(
                    Math.random() *
                    characters.length
                  )
                ];

          })
          .join('');


      frame++;


      if (frame > frames) {

        clearInterval(interval);

        element.textContent = text;

      }

    }, 30);

}


/* =========================================================
   SCRAMBLE EVENTS
   ========================================================= */

(function () {

  const eyebrow =
    document.getElementById('eyebrow');


  if (eyebrow) {

    setTimeout(
      () =>
        scramble(
          eyebrow,
          '/ welcome to the'
        ),
      1700
    );


    setInterval(
      () =>
        scramble(
          eyebrow,
          '/ welcome to the',
          700
        ),
      8000
    );

  }


  const section =
    document.querySelector('.h-sec');


  if (section) {

    const text =
      section.textContent;


    const observer =
      new IntersectionObserver(
        (entries, observer) => {

          if (
            entries[0].isIntersecting
          ) {

            observer.disconnect();

            scramble(
              section,
              text,
              800
            );

          }

        },
        {
          threshold: 0.6
        }
      );


    observer.observe(section);

  }


  document
    .querySelectorAll('.h-btn')
    .forEach((button) => {

      const text =
        button.textContent;


      button.addEventListener(
        'mouseenter',
        () =>
          scramble(
            button,
            text,
            350
          )
      );

    });

})();


/* =========================================================
   BOOT SCREEN
   ========================================================= */

(function () {

  const home =
    document.querySelector('.home');


  if (
    sessionStorage.getItem('tqboot') ||
    !home
  ) {
    return;
  }


  sessionStorage.setItem(
    'tqboot',
    '1'
  );


  home.classList.add('booting');


  const overlay =
    document.createElement('div');


  overlay.className =
    'bootscr';


  document.body.appendChild(
    overlay
  );


  const lines = [

    '> connecting to ' +
      location.host +
      ' ...',

    '> handshake ........ OK',

    '> loading terminal_quiz ...',

    '> ACCESS GRANTED'

  ];


  let index = 0;


  function next() {

    if (index < lines.length) {

      overlay.insertAdjacentHTML(
        'beforeend',
        '<div>' +
          lines[index++] +
        '</div>'
      );


      setTimeout(
        next,
        380
      );


    } else {

      setTimeout(() => {

        overlay.classList.add(
          'out'
        );


        home.classList.remove(
          'booting'
        );


        setTimeout(
          () => overlay.remove(),
          600
        );

      }, 450);

    }

  }


  next();

})();


/* =========================================================
   NORMAL SCROLLING
   HUD DEPTH METER
   ========================================================= */

(function () {

  const depth =
    document.getElementById('depth');


  const progress =
    document.getElementById('hprog');


  let ticking = false;

  let scrollTimeout;


  function update() {

    ticking = false;


    const max =
      Math.max(
        1,
        document.documentElement
          .scrollHeight -
        window.innerHeight
      );


    const percentage =
      Math.min(
        1,
        Math.max(
          0,
          window.scrollY / max
        )
      );


    if (depth) {

      depth.textContent =
        String(
          Math.round(
            percentage * 100
          )
        ).padStart(3, '0');

    }


    if (progress) {

      progress.style.transform =
        'scaleY(' +
        percentage +
        ')';

    }

  }


  window.addEventListener(
    'scroll',
    () => {

      document.body.classList.add(
        'scrolling'
      );


      clearTimeout(
        scrollTimeout
      );


      scrollTimeout =
        setTimeout(() => {

          document.body.classList.remove(
            'scrolling'
          );

        }, 140);


      if (!ticking) {

        ticking = true;

        requestAnimationFrame(
          update
        );

      }

    },
    {
      passive: true
    }
  );


  window.addEventListener(
    'resize',
    update
  );


  update();

})();