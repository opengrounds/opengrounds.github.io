/*
 * scripts.js
 * open:grounds — main interactive behaviours
 *
 * What this file handles:
 *   1. Custom cursor that follows the mouse
 *   2. Positioning house nodes on the stage
 *   3. Drawing dashed connection lines between nodes
 *   4. About overlay open / close
 *   5. Parallax — stage grid + nodes drift toward the cursor
 *   6. Idle bob animation per node
 *   7. Ambient floating particles drifting across the stage
 */


/* ─────────────────────────────────────────────
   1. CUSTOM CURSOR
   Moves a small circle element around to
   replace the default OS cursor on the stage.
───────────────────────────────────────────── */

var cursor = document.querySelector('#cursor');

document.addEventListener('mousemove', function(e) {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top  = e.clientY + 'px';
});

/* Grow the cursor ring when hovering a node, shrink it on leave.
   Also handle click and keyboard activation for each node. */
var nodes = document.querySelectorAll('.node');

nodes.forEach(function(node) {

  node.addEventListener('mouseenter', function() {
    cursor.classList.add('over');
  });

  node.addEventListener('mouseleave', function() {
    cursor.classList.remove('over');
  });

  /* clicking opens the project URL in a new tab */
  node.addEventListener('click', function() {
    var url = node.dataset.url;
    if (url && url !== '#') {
      window.open(url, '_blank');
    }
  });

  /* keyboard users can activate nodes with Enter or Space */
  node.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      var url = node.dataset.url;
      if (url && url !== '#') {
        window.open(url, '_blank');
      }
    }
  });

});


/* ─────────────────────────────────────────────
   2. NODE POSITIONING
   Each node stores its ideal position as
   percentage values in data-xl / data-yl.
   This converts them to pixel positions so
   the layout responds correctly on resize.
───────────────────────────────────────────── */

function positionNodes() {
  var stage = document.querySelector('#stage');
  if (!stage || stage.offsetWidth === 0) return;

  var W = stage.offsetWidth;
  var H = stage.offsetHeight;

  nodes.forEach(function(node) {
    var px = parseFloat(node.dataset.xl) / 100;
    var py = parseFloat(node.dataset.yl) / 100;
    node.style.left = (W * px) + 'px';
    node.style.top  = (H * py) + 'px';
  });

  drawConnections();
}

window.addEventListener('load', positionNodes);
window.addEventListener('resize', positionNodes);

/* small safety timeout in case layout hasn't settled yet at load time */
setTimeout(positionNodes, 80);


/* ─────────────────────────────────────────────
   3. CONNECTION LINES
   Draws dashed SVG lines between related
   nodes to show how the projects link up.
───────────────────────────────────────────── */

/* each pair is [source-id, target-id] */
var PAIRS = [
  ['n-davis', 'n-zw'],
  ['n-davis', 'n-print'],
  ['n-zw',    'n-bay'],
  ['n-print', 'n-bay'],
  ['n-davis', 'n-bay'],
];

/* returns the centre point of an element relative to the stage */
function getCentre(el) {
  var stageRect = document.querySelector('#stage').getBoundingClientRect();
  var elRect    = el.getBoundingClientRect();
  return {
    x: elRect.left + elRect.width  / 2 - stageRect.left,
    y: elRect.top  + elRect.height / 2 - stageRect.top
  };
}

function drawConnections() {
  var svg = document.querySelector('#conn-svg');
  svg.innerHTML = '';

  PAIRS.forEach(function(pair) {
    var aId = pair[0];
    var bId = pair[1];
    var a = document.querySelector('#' + aId);
    var b = document.querySelector('#' + bId);
    if (!a || !b) return;

    var ca = getCentre(a);
    var cb = getCentre(b);

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', ca.x);
    line.setAttribute('y1', ca.y);
    line.setAttribute('x2', cb.x);
    line.setAttribute('y2', cb.y);
    line.setAttribute('stroke', '#15130F');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '4 7');
    line.setAttribute('opacity', '0.15');

    svg.appendChild(line);
  });
}


/* ─────────────────────────────────────────────
   4. ABOUT OVERLAY
   Simple open / close with keyboard support.
───────────────────────────────────────────── */

var aboutOverlay     = document.querySelector('#about-overlay');
var aboutOpenBtn     = document.querySelector('#about-open');
var aboutOpenMobile  = document.querySelector('#about-open-mobile');
var aboutCloseBtn    = document.querySelector('#about-close');

function openAbout() {
  aboutOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAbout() {
  aboutOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

aboutOpenBtn.addEventListener('click', openAbout);

/* the mobile tab bar has its own about trigger */
if (aboutOpenMobile) {
  aboutOpenMobile.addEventListener('click', openAbout);
}

aboutCloseBtn.addEventListener('click', closeAbout);

/* clicking the backdrop (not the panel itself) closes the overlay */
aboutOverlay.addEventListener('click', function(e) {
  if (e.target === aboutOverlay) {
    closeAbout();
  }
});

/* Escape key closes the overlay */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeAbout();
  }
});


/* ─────────────────────────────────────────────
   5. PARALLAX
   Two effects triggered by mouse position:
     a) the stage grid shifts slightly opposite
        the cursor (background parallax)
     b) each node is gently pulled toward the
        cursor when it's within 320px
───────────────────────────────────────────── */

var stageEl    = document.querySelector('#stage');
var rafPending = false;
var lastX      = 0.5; /* normalised 0–1 cursor position */
var lastY      = 0.5;

/* stores the current parallax offset for each node */
var houseState = new Map();

function applyParallax() {
  rafPending = false;

  var W = stageEl.offsetWidth;
  var H = stageEl.offsetHeight;
  if (!W || !H) return;

  /* shift the grid background in the opposite direction to the cursor */
  var bgShiftX = (lastX - 0.5) * -14;
  var bgShiftY = (lastY - 0.5) * -14;
  stageEl.style.backgroundPosition =
    'calc(50% + ' + bgShiftX + 'px) calc(50% + ' + bgShiftY + 'px)';

  /* pull each node slightly toward the cursor based on distance */
  nodes.forEach(function(node) {
    var baseX = parseFloat(node.dataset.xl) / 100 * W;
    var baseY = parseFloat(node.dataset.yl) / 100 * H;

    var dx = (lastX * W) - baseX;
    var dy = (lastY * H) - baseY;
    var dist    = Math.sqrt(dx * dx + dy * dy);
    var maxDist = 320;
    var pull    = Math.max(0, 1 - dist / maxDist) * 6;
    var angle   = Math.atan2(dy, dx);

    houseState.set(node.id, {
      px: Math.cos(angle) * pull,
      py: Math.sin(angle) * pull
    });
  });
}

stageEl.addEventListener('mousemove', function(e) {
  var r = stageEl.getBoundingClientRect();
  lastX = (e.clientX - r.left) / r.width;
  lastY = (e.clientY - r.top)  / r.height;

  /* batch updates into a single rAF so we don't thrash the layout */
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(applyParallax);
  }
});

/* reset to centre when the cursor leaves the stage */
stageEl.addEventListener('mouseleave', function() {
  lastX = 0.5;
  lastY = 0.5;
  requestAnimationFrame(applyParallax);
});


/* ─────────────────────────────────────────────
   6. IDLE BOB ANIMATION
   Each house gently floats up and down and
   rocks slightly. The parallax offset from
   section 5 is folded into the same transform
   so we only write to the DOM once per frame.
───────────────────────────────────────────── */

var bobT = 0; /* ever-increasing time counter */

function idleBob() {
  bobT += 0.018;

  nodes.forEach(function(node, i) {
    var house = node.querySelector('.node-house-wrap');
    if (!house) return;

    /* sine waves with different phases per node give organic movement */
    var bobY = Math.sin(bobT + i * 1.7) * 5;
    var rot  = Math.sin(bobT * 0.7 + i * 2.1) * 1.3;

    /* blend in the parallax pull so both effects share one transform */
    var par = houseState.get(node.id) || { px: 0, py: 0 };
    house.style.transform =
      'translate(' + par.px + 'px, ' + (par.py + bobY) + 'px) rotate(' + rot + 'deg)';
  });

  requestAnimationFrame(idleBob);
}

/* check once — no need to re-query inside the loop */
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {
  requestAnimationFrame(idleBob);
}


/* ─────────────────────────────────────────────
   7. AMBIENT PARTICLES
   Small coloured dots (leaves / dust of the
   commons) drift down across the stage.
───────────────────────────────────────────── */

var particleColors = [
  'var(--flame)',
  'var(--sky)',
  'var(--grass)',
  'var(--sun)',
  'var(--pink)'
];

function spawnParticle() {
  /* bail out if the stage isn't ready or the user wants less motion */
  if (reduceMotion || !stageEl || stageEl.offsetWidth === 0) return;

  var p        = document.createElement('div');
  var size     = 4 + Math.random() * 5;
  var startX   = Math.random() * stageEl.offsetWidth;
  var duration = 9 + Math.random() * 6;
  var drift    = (Math.random() - 0.5) * 120;
  var color    = particleColors[Math.floor(Math.random() * particleColors.length)];

  /* position and style the particle */
  p.style.position     = 'absolute';
  p.style.left         = startX + 'px';
  p.style.top          = '-10px';
  p.style.width        = size + 'px';
  p.style.height       = size + 'px';
  p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
  p.style.background   = color;
  p.style.opacity      = '0.22';
  p.style.pointerEvents = 'none';
  p.style.zIndex       = '2';
  p.style.transition   =
    'transform ' + duration + 's linear, opacity ' + duration + 's ease-in';

  stageEl.appendChild(p);

  /* start the CSS transition on the next frame so the browser registers
     the starting position first */
  requestAnimationFrame(function() {
    p.style.transform =
      'translate(' + drift + 'px, ' + (stageEl.offsetHeight + 30) + 'px) ' +
      'rotate(' + (Math.random() * 360) + 'deg)';
    p.style.opacity = '0';
  });

  /* remove from the DOM once the animation is done */
  setTimeout(function() {
    p.remove();
  }, duration * 1000 + 200);
}

if (!reduceMotion) {
  /* spawn one particle every 1.4 seconds */
  setInterval(spawnParticle, 1400);

  /* kick off a few particles immediately so the stage isn't empty at load */
  for (var i = 0; i < 4; i++) {
    setTimeout(spawnParticle, i * 350);
  }
}