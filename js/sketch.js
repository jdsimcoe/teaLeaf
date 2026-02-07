// TeaLeaf Generator - p5.js version
// Replicates the logic from generateTeaLeaf.c

const NUM_PIXELS = 420;  // Must match C code
const FFT_SIZE = 512;    // Nearest power of 2 >= NUM_PIXELS for FFT
const FREQUENCY_CUTOFF = 5;
const THRESHOLD = (NUM_PIXELS * NUM_PIXELS) / 2;  // 88200

// Mulberry32 PRNG - seedable random number generator
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Complex number operations
class Complex {
  constructor(real = 0, imag = 0) {
    this.real = real;
    this.imag = imag;
  }

  add(other) {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  sub(other) {
    return new Complex(this.real - other.real, this.imag - other.imag);
  }

  mul(other) {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    );
  }
}

// 1D FFT (Cooley-Tukey algorithm)
// FFTW-style: forward is standard, backward is NOT normalized
function fft1d(input, inverse = false) {
  const n = input.length;
  if (n <= 1) return input.map(x => new Complex(x.real, x.imag));

  // Bit reversal permutation
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    let j = 0;
    let bit = n >> 1;
    let x = i;
    while (bit > 0) {
      j = (j << 1) | (x & 1);
      x >>= 1;
      bit >>= 1;
    }
    result[i] = new Complex(input[j].real, input[j].imag);
  }

  // Butterfly operations
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (2 * Math.PI / len) * sign;
    const wlen = new Complex(Math.cos(angle), Math.sin(angle));
    for (let i = 0; i < n; i += len) {
      let w = new Complex(1, 0);
      for (let j = 0; j < len / 2; j++) {
        const u = result[i + j];
        const v = result[i + j + len / 2].mul(w);
        result[i + j] = u.add(v);
        result[i + j + len / 2] = u.sub(v);
        w = w.mul(wlen);
      }
    }
  }

  // FFTW-style: NO normalization for inverse (like FFTW's FFTW_BACKWARD)
  // The values will be N times larger than normalized FFT

  return result;
}

// 2D FFT
function fft2d(matrix, inverse = false) {
  const n = matrix.length;

  // FFT on rows
  const rowTransformed = [];
  for (let i = 0; i < n; i++) {
    rowTransformed.push(fft1d(matrix[i], inverse));
  }

  // FFT on columns
  const result = Array(n).fill(null).map(() => Array(n).fill(null));
  for (let j = 0; j < n; j++) {
    const column = [];
    for (let i = 0; i < n; i++) {
      column.push(rowTransformed[i][j]);
    }
    const transformedColumn = fft1d(column, inverse);
    for (let i = 0; i < n; i++) {
      result[i][j] = transformedColumn[i];
    }
  }

  return result;
}

// Check if a frequency position should be masked (low-pass filter)
// Only keep low frequencies (near the corners after FFT shift)
function masked(row, column, n) {
  return (FREQUENCY_CUTOFF <= row && row < n - FREQUENCY_CUTOFF) ||
         (FREQUENCY_CUTOFF <= column && column < n - FREQUENCY_CUTOFF);
}

// Generate the tea leaf pattern
function generateTeaLeaf(seed) {
  const rand = mulberry32(seed);

  // Initialize input with random binary values (0 or 1), matching C's rand() % 2
  // Pad to FFT_SIZE (power of 2) for the FFT algorithm
  const input = [];
  for (let i = 0; i < FFT_SIZE; i++) {
    const row = [];
    for (let j = 0; j < FFT_SIZE; j++) {
      if (i < NUM_PIXELS && j < NUM_PIXELS) {
        row.push(new Complex(Math.floor(rand() * 2), 0));
      } else {
        row.push(new Complex(0, 0));  // Zero padding
      }
    }
    input.push(row);
  }

  // Forward FFT
  const middle = fft2d(input, false);

  // Apply low-pass filter (zero out high frequencies)
  for (let i = 0; i < FFT_SIZE; i++) {
    for (let j = 0; j < FFT_SIZE; j++) {
      if (masked(i, j, FFT_SIZE)) {
        middle[i][j] = new Complex(0, 0);
      }
    }
  }

  // Inverse FFT (FFTW-style, not normalized)
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
      const value = teaLeaf[y][x].real;

      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;

      // Color based on threshold (matching C code exactly)
      if (value > THRESHOLD) {
        // #5466f9 - blue color for "blobs" (C code uses 0x54, 0x66, 0xf9 for R,G,B)
        teaLeafImage.pixels[idx] = 0x54;     // R
        teaLeafImage.pixels[idx + 1] = 0x66; // G
        teaLeafImage.pixels[idx + 2] = 0xf9; // B
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
