/*
  TeaLeaf p5.js port (algorithmic fidelity)
  - Deterministic RNG based on URL query string
  - 2D DFT using row/column 1D DFTs (no normalization)
  - Frequency mask matches C implementation
  - Threshold on real component > (N*N/2)
*/

const NUM_PIXELS = 420;
const FREQUENCY_CUTOFF = 5;


function setup() {
  const holder = document.getElementById("sketch-holder");
  if (!holder) return;
  holder.textContent = "";
  const svgHolder = document.getElementById("svg-holder");
  if (svgHolder) svgHolder.textContent = "Rendering SVG...";

  const canvas = createCanvas(NUM_PIXELS, NUM_PIXELS);
  canvas.parent("sketch-holder");
  pixelDensity(1);
  noLoop();

  const seedText = getQuerySeed();
  const seed = seedFromString(seedText);

  const total = NUM_PIXELS * NUM_PIXELS;
  const inRe = new Float64Array(total);
  const inIm = new Float64Array(total);
  const midRe = new Float64Array(total);
  const midIm = new Float64Array(total);
  const outRe = new Float64Array(total);
  const outIm = new Float64Array(total);

  fillRandomBinary(inRe, inIm, seed);

  tealeafFft2d(inRe, inIm, midRe, midIm, false);
  applyFrequencyMask(midRe, midIm);
  tealeafFft2d(midRe, midIm, outRe, outIm, true);

  // Allow the browser a chance to paint before heavy SVG generation.
  renderTeaLeaf(outRe);
  setTimeout(() => {
    renderTeaLeafSvg(outRe);
  }, 0);

  console.log("Seed text:", seedText || "(empty)");
  console.log("Seed value:", seed >>> 0);
}

function getQuerySeed() {
  const raw = window.location.search || "";
  // Match original server behavior: seed uses "tealeaf::" + raw query string.
  // raw query string includes the leading "?" if present.
  if (raw && raw !== "?") {
    return `tealeaf::${raw}`;
  }
  const path = window.location.pathname || "";
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  if (trimmedPath) {
    return `tealeaf::?${trimmedPath}`;
  }
  return "tealeaf::";
}

function seedFromString(text) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) {
    seed = (seed + text.charCodeAt(i)) >>> 0;
  }
  return seed >>> 0;
}

function makeRng(seed) {
  // Park-Miller minimal standard RNG using Schrage method (matches macOS rand()).
  let state = (seed >>> 0) % 2147483647;
  if (state === 0) state = 1;
  return function nextRand() {
    const hi = Math.floor(state / 127773);
    const lo = state - hi * 127773;
    let test = 16807 * lo - 2836 * hi;
    if (test <= 0) test += 2147483647;
    state = test;
    return state;
  };
}

function fillRandomBinary(re, im, seed) {
  const rand = makeRng(seed);
  for (let i = 0; i < re.length; i += 1) {
    re[i] = rand() & 1; // 0 or 1, matches rand() % 2
    im[i] = 0.0;
  }
}


function applyFrequencyMask(re, im) {
  const n = NUM_PIXELS;
  for (let i = 0; i < re.length; i += 1) {
    const row = Math.floor(i / n);
    const col = i % n;
    if (masked(row, col)) {
      re[i] = 0.0;
      im[i] = 0.0;
    }
  }
}

function masked(row, col) {
  return (
    (FREQUENCY_CUTOFF <= row && row <= NUM_PIXELS - FREQUENCY_CUTOFF) ||
    (FREQUENCY_CUTOFF <= col && col <= NUM_PIXELS - FREQUENCY_CUTOFF)
  );
}

function renderTeaLeaf(outRe) {
  const n = NUM_PIXELS;
  const threshold = (n * n) / 2;

  clear();
  loadPixels();
  for (let i = 0; i < outRe.length; i += 1) {
    const row = Math.floor(i / n);
    const col = i % n;
    const flippedRow = n - 1 - row;
    const idx = (flippedRow * n + col) * 4;
    if (outRe[i] > threshold) {
      pixels[idx + 0] = 0x54; // R
      pixels[idx + 1] = 0x66; // G
      pixels[idx + 2] = 0xf9; // B
      pixels[idx + 3] = 255;  // A
    } else {
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = 0;    // transparent
    }
  }
  updatePixels();
}

function renderTeaLeafSvg(outRe) {
  const n = NUM_PIXELS;
  const threshold = (n * n) / 2;
  let path = "";
  for (let y = 0; y < n; y += 1) {
    let x = 0;
    const flippedY = n - 1 - y;
    while (x < n) {
      const idx = y * n + x;
      if (outRe[idx] > threshold) {
        let run = 1;
        while (x + run < n && outRe[y * n + x + run] > threshold) {
          run += 1;
        }
        // Rectangle as a subpath: M x y h run v 1 h -run Z
        path += `M ${x} ${flippedY} h ${run} v 1 h ${-run} Z `;
        x += run;
      } else {
        x += 1;
      }
    }
  }

  let svg = "";
  svg += `<svg width=\"${n}\" height=\"${n}\" viewBox=\"0 0 ${n} ${n}\" xmlns=\"http://www.w3.org/2000/svg\" shape-rendering=\"crispEdges\">`;
  svg += `<rect width=\"${n}\" height=\"${n}\" fill=\"transparent\"/>`;
  svg += `<path d=\"${path.trim()}\" fill=\"#5466f9\"/>`;
  svg += `</svg>`;
  const holder = document.getElementById("svg-holder");
  if (holder) holder.innerHTML = svg;
}
