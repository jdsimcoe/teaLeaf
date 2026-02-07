// TeaLeaf Generator - p5.js version
// Replicates the logic from generateTeaLeaf.c using Bluestein's algorithm for FFT

const NUM_PIXELS = 420;  // Must match C code exactly
const FREQUENCY_CUTOFF = 5;
const THRESHOLD = (NUM_PIXELS * NUM_PIXELS) / 2;  // 88200

// Seeded random number generator (standard LCG matching C's rand())
// C's rand() uses: seed = seed * 1103515245 + 12345, returns (seed / 65536) % 32768
function createLCG(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state * 1103515245 + 12345) >>> 0;
    return (state >> 16) & 0x7fff;
  };
}

// Check if a frequency position should be masked
// C code: returns true if position should be zeroed out
// masked(row, col) = (5 <= row <= 415) || (5 <= col <= 415)
function masked(row, column) {
  return (FREQUENCY_CUTOFF <= row && row <= NUM_PIXELS - FREQUENCY_CUTOFF) ||
         (FREQUENCY_CUTOFF <= column && column <= NUM_PIXELS - FREQUENCY_CUTOFF);
}

// Generate the tea leaf pattern using exact C algorithm
function generateTeaLeaf(seed) {
  const rand = createLCG(seed);

  // Initialize input with random binary values (0 or 1)
  // C code: in[i][0] = (double) (rand() % 2);
  const input = [];
  for (let i = 0; i < NUM_PIXELS; i++) {
    const row = [];
    for (let j = 0; j < NUM_PIXELS; j++) {
      row.push(new Complex(rand() % 2, 0));
    }
    input.push(row);
  }

  // Forward 2D FFT
  const middle = fft2d(input, false);

  // Apply frequency mask (zero out high frequencies)
  // C code zeros out the middle frequencies
  for (let i = 0; i < NUM_PIXELS; i++) {
    for (let j = 0; j < NUM_PIXELS; j++) {
      if (masked(i, j)) {
        middle[i][j] = new Complex(0, 0);
      }
    }
  }

  // Inverse 2D FFT (FFTW-style, NOT normalized)
  const output = fft2d(middle, true);

  return output;
}

// Extract query string from URL and compute seed
function getSeedFromQueryString() {
  const queryString = window.location.search;
  let query = '';
  if (queryString.startsWith('?')) {
    query = queryString.substring(1);
  }

  // Prepend "tealeaf::" as in the C code
  const seedString = 'tealeaf::' + query;

  // Sum ASCII values to get seed (matching C code behavior exactly)
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = seed + seedString.charCodeAt(i);
  }

  return seed >>> 0;  // Convert to unsigned 32-bit
}

let teaLeafImage;

function setup() {
  const canvas = createCanvas(NUM_PIXELS, NUM_PIXELS);
  canvas.parent('canvas-container');
  noLoop();

  const seed = getSeedFromQueryString();
  console.log('Seed:', seed);
  console.log('Query:', window.location.search);

  const teaLeaf = generateTeaLeaf(seed);

  // Create image from the generated data
  teaLeafImage = createImage(NUM_PIXELS, NUM_PIXELS);
  teaLeafImage.loadPixels();

  let idx = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let y = 0; y < NUM_PIXELS; y++) {
    for (let x = 0; x < NUM_PIXELS; x++) {
      // Get the real component of the inverse FFT result
      // C code stores data row by row: row = i / NUM_PIXELS, col = i % NUM_PIXELS
      const value = teaLeaf[y][x].real;

      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;

      // Color based on threshold (matching C code exactly)
      // C code: if (teaLeaf[i][0] > NUM_PIXELS * NUM_PIXELS / 2)
      if (value > THRESHOLD) {
        // #5466f9 - blue color for "blobs"
        // C code: blue = 0xf9, green = 0x66, red = 0x54, alpha = 255
        teaLeafImage.pixels[idx] = 0x54;     // R (84)
        teaLeafImage.pixels[idx + 1] = 0x66; // G (102)
        teaLeafImage.pixels[idx + 2] = 0xf9; // B (249)
        teaLeafImage.pixels[idx + 3] = 255;  // A (opaque)
      } else {
        // White/transparent background
        teaLeafImage.pixels[idx] = 255;      // R
        teaLeafImage.pixels[idx + 1] = 255;  // G
        teaLeafImage.pixels[idx + 2] = 255;  // B
        teaLeafImage.pixels[idx + 3] = 0;    // A (transparent)
      }
      idx += 4;
    }
  }

  console.log('Value range:', minVal, 'to', maxVal);
  console.log('Threshold:', THRESHOLD);

  teaLeafImage.updatePixels();
}

function draw() {
  background(255);
  image(teaLeafImage, 0, 0);
}
