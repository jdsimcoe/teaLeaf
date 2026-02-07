/*
  TeaLeaf p5.js port (algorithmic fidelity)
  - Deterministic RNG based on URL query string
  - 2D DFT using row/column 1D DFTs (no normalization)
  - Frequency mask matches C implementation
  - Threshold on real component > (N*N/2)
*/

const NUM_PIXELS = 420;
const FREQUENCY_CUTOFF = 5;

let cosTable;
let sinTable;

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

  precomputeTwiddles(NUM_PIXELS);
  fillRandomBinary(inRe, inIm, seed);

  dft2d(inRe, inIm, midRe, midIm, true);
  applyFrequencyMask(midRe, midIm);
  dft2d(midRe, midIm, outRe, outIm, false);

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
  return `tealeaf::${raw || ""}`;
}

function seedFromString(text) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) {
    seed = (seed + text.charCodeAt(i)) >>> 0;
  }
  return seed >>> 0;
}

function makeRng(seed) {
  // ANSI C-style LCG to approximate C rand() behavior.
  // state is 31-bit, rand() = (state >> 16) & 0x7fff
  let state = (seed >>> 0) & 0x7fffffff;
  return function nextRand() {
    state = (Math.imul(1103515245, state) + 12345) & 0x7fffffff;
    return (state >>> 16) & 0x7fff;
  };
}

function fillRandomBinary(re, im, seed) {
  const rand = makeRng(seed);
  for (let i = 0; i < re.length; i += 1) {
    re[i] = rand() & 1; // 0 or 1, matches rand() % 2
    im[i] = 0.0;
  }
}

function precomputeTwiddles(n) {
  const total = n * n;
  cosTable = new Float64Array(total);
  sinTable = new Float64Array(total);
  const twoPiOverN = (2 * Math.PI) / n;
  for (let k = 0; k < n; k += 1) {
    for (let t = 0; t < n; t += 1) {
      const angle = twoPiOverN * k * t;
      const idx = k * n + t;
      cosTable[idx] = Math.cos(angle);
      sinTable[idx] = Math.sin(angle);
    }
  }
}

function dft2d(inRe, inIm, outRe, outIm, forward) {
  const n = NUM_PIXELS;
  const total = n * n;
  const tempRe = new Float64Array(total);
  const tempIm = new Float64Array(total);

  // Row-wise DFT
  for (let row = 0; row < n; row += 1) {
    for (let k = 0; k < n; k += 1) {
      let sumRe = 0.0;
      let sumIm = 0.0;
      const twiddleRow = k * n;
      for (let t = 0; t < n; t += 1) {
        const idx = row * n + t;
        const aRe = inRe[idx];
        const aIm = inIm[idx];
        const cosv = cosTable[twiddleRow + t];
        const sinv = sinTable[twiddleRow + t];
        if (forward) {
          // (aRe + i aIm) * (cos - i sin)
          sumRe += aRe * cosv + aIm * sinv;
          sumIm += aIm * cosv - aRe * sinv;
        } else {
          // (aRe + i aIm) * (cos + i sin)
          sumRe += aRe * cosv - aIm * sinv;
          sumIm += aRe * sinv + aIm * cosv;
        }
      }
      const outIdx = row * n + k;
      tempRe[outIdx] = sumRe;
      tempIm[outIdx] = sumIm;
    }
  }

  // Column-wise DFT
  for (let col = 0; col < n; col += 1) {
    for (let k = 0; k < n; k += 1) {
      let sumRe = 0.0;
      let sumIm = 0.0;
      const twiddleRow = k * n;
      for (let t = 0; t < n; t += 1) {
        const idx = t * n + col;
        const aRe = tempRe[idx];
        const aIm = tempIm[idx];
        const cosv = cosTable[twiddleRow + t];
        const sinv = sinTable[twiddleRow + t];
        if (forward) {
          sumRe += aRe * cosv + aIm * sinv;
          sumIm += aIm * cosv - aRe * sinv;
        } else {
          sumRe += aRe * cosv - aIm * sinv;
          sumIm += aRe * sinv + aIm * cosv;
        }
      }
      const outIdx = k * n + col;
      outRe[outIdx] = sumRe;
      outIm[outIdx] = sumIm;
    }
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
    const idx = i * 4;
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
    while (x < n) {
      const idx = y * n + x;
      if (outRe[idx] > threshold) {
        let run = 1;
        while (x + run < n && outRe[y * n + x + run] > threshold) {
          run += 1;
        }
        // Rectangle as a subpath: M x y h run v 1 h -run Z
        path += `M ${x} ${y} h ${run} v 1 h ${-run} Z `;
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
