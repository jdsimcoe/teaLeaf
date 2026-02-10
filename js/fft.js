// FFT implementation using Bluestein's algorithm for arbitrary sizes
// Supports non-power-of-2 sizes like 420

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

  div(scalar) {
    return new Complex(this.real / scalar, this.imag / scalar);
  }

  conj() {
    return new Complex(this.real, -this.imag);
  }
}

// Find next power of 2
function nextPowerOf2(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// Standard Cooley-Tukey FFT for power-of-2 sizes
// FFTW-style: forward is standard, backward is NOT normalized
function fftPow2(input, inverse = false) {
  const n = input.length;
  if (n <= 1) return input.map(x => new Complex(x.real, x.imag));

  // Bit reversal permutation
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    let j = 0;
    let bits = Math.log2(n);
    for (let k = 0; k < bits; k++) {
      j = (j << 1) | ((i >> k) & 1);
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

  // FFTW-style: NO normalization for inverse
  return result;
}

// Bluestein's algorithm for arbitrary-size FFT
// Converts DFT of size N to convolution of size M (power of 2, M >= 2N-1)
function bluesteinFFT(input, inverse = false) {
  const N = input.length;
  
  // For power of 2, use standard FFT
  if ((N & (N - 1)) === 0) {
    return fftPow2(input, inverse);
  }
  
  // Convolution size: next power of 2 >= 2N - 1
  const M = nextPowerOf2(2 * N - 1);
  
  // Bluestein's algorithm:
  // X[k] = sum_{n=0}^{N-1} x[n] * exp(-2*pi*i*k*n/N)
  // 
  // Using identity: -2*k*n = (k-n)^2 - k^2 - n^2
  // So: X[k] = exp(-pi*i*k^2/N) * sum_{n=0}^{N-1} (x[n] * exp(-pi*i*n^2/N)) * exp(pi*i*(k-n)^2/N)
  // 
  // This is a convolution with a chirp signal
  
  const sign = inverse ? 1 : -1;  // +1 for inverse, -1 for forward
  
  // Chirp factors: a[n] = exp(sign * i * pi * n^2 / N)
  // For forward FFT: sign = -1, so a[n] = exp(-i * pi * n^2 / N)
  // For inverse FFT: sign = +1, so a[n] = exp(+i * pi * n^2 / N)
  const chirp = new Array(N);
  for (let n = 0; n < N; n++) {
    const angle = (sign * Math.PI * n * n) / N;
    chirp[n] = new Complex(Math.cos(angle), Math.sin(angle));
  }
  
  // A[n] = x[n] * a[n] = x[n] * exp(sign * i * pi * n^2 / N)
  const A = new Array(M);
  for (let n = 0; n < M; n++) {
    if (n < N) {
      A[n] = input[n].mul(chirp[n]);
    } else {
      A[n] = new Complex(0, 0);
    }
  }
  
  // B is the impulse response: b[n] = exp(-sign * i * pi * n^2 / N)
  // for n = -(N-1) to (N-1), mapped to indices 0 to M-1
  // B[0] = b[0] = 1
  // B[1..N-1] = b[1..N-1]
  // B[M-(N-1)..M-1] = b[-(N-1)..-1] = b[N-1..1] (symmetric)
  const B = new Array(M).fill(null).map(() => new Complex(0, 0));
  B[0] = new Complex(1, 0);  // b[0] = 1
  for (let n = 1; n < N; n++) {
    const angle = (-sign * Math.PI * n * n) / N;
    const val = new Complex(Math.cos(angle), Math.sin(angle));
    B[n] = val;           // positive n
    B[M - n] = val;       // negative n (circular indexing)
  }
  
  // Convolution via FFT: C = IFFT(FFT(A) * FFT(B))
  const fftA = fftPow2(A, false);
  const fftB = fftPow2(B, false);
  
  const fftC = new Array(M);
  for (let i = 0; i < M; i++) {
    fftC[i] = fftA[i].mul(fftB[i]);
  }
  
  const convResult = fftPow2(fftC, true);
  
  // X[k] = a[k] * conv[k] = exp(sign * i * pi * k^2 / N) * conv[k]
  const result = new Array(N);
  for (let k = 0; k < N; k++) {
    result[k] = chirp[k].mul(convResult[k]);
  }
  
  return result;
}

// 1D FFT for arbitrary size (uses Bluestein's algorithm if not power of 2)
function fft1d(input, inverse = false) {
  return bluesteinFFT(input, inverse);
}

// 2D FFT for arbitrary size
function fft2d(matrix, inverse = false) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  
  // FFT on rows
  const rowTransformed = [];
  for (let i = 0; i < rows; i++) {
    rowTransformed.push(fft1d(matrix[i], inverse));
  }
  
  // FFT on columns
  const result = Array(rows).fill(null).map(() => Array(cols).fill(null));
  for (let j = 0; j < cols; j++) {
    const column = [];
    for (let i = 0; i < rows; i++) {
      column.push(rowTransformed[i][j]);
    }
    const transformedColumn = fft1d(column, inverse);
    for (let i = 0; i < rows; i++) {
      result[i][j] = transformedColumn[i];
    }
  }
  
  return result;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Complex, fft1d, fft2d, fftPow2 };
}
