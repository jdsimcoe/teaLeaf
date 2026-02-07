/*
  Bluestein FFT for arbitrary sizes (power-of-two convolution)
  - Provides fft1d/fft2d with unnormalized forward + inverse
*/

(function () {
  function nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  function fftRadix2(re, im, inverse, normalize) {
    const n = re.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i += 1) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
    }

    const sign = inverse ? 1 : -1;
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (2 * Math.PI / len) * sign;
      const wlenRe = Math.cos(ang);
      const wlenIm = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let wRe = 1.0;
        let wIm = 0.0;
        const half = len >> 1;
        for (let j = 0; j < half; j += 1) {
          const uRe = re[i + j];
          const uIm = im[i + j];
          const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
          const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;

          re[i + j] = uRe + vRe;
          im[i + j] = uIm + vIm;
          re[i + j + half] = uRe - vRe;
          im[i + j + half] = uIm - vIm;

          const nextWRe = wRe * wlenRe - wIm * wlenIm;
          const nextWIm = wRe * wlenIm + wIm * wlenRe;
          wRe = nextWRe;
          wIm = nextWIm;
        }
      }
    }

    if (normalize) {
      for (let i = 0; i < n; i += 1) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  }

  function bluestein(re, im, inverse) {
    const n = re.length;
    const m = nextPow2(2 * n - 1);

    const aRe = new Float64Array(m);
    const aIm = new Float64Array(m);
    const bRe = new Float64Array(m);
    const bIm = new Float64Array(m);

    const sign = inverse ? 1 : -1;
    const angBase = Math.PI / n;

    for (let k = 0; k < n; k += 1) {
      const ang = sign * angBase * k * k;
      const cosv = Math.cos(ang);
      const sinv = Math.sin(ang);

      // a[k] = x[k] * exp(-i * ang)
      aRe[k] = re[k] * cosv + im[k] * sinv;
      aIm[k] = im[k] * cosv - re[k] * sinv;

      // b[k] = exp(i * ang)
      bRe[k] = cosv;
      bIm[k] = sinv;
      if (k !== 0) {
        bRe[m - k] = cosv;
        bIm[m - k] = sinv;
      }
    }

    // Convolution via FFT
    fftRadix2(aRe, aIm, false, false);
    fftRadix2(bRe, bIm, false, false);
    for (let i = 0; i < m; i += 1) {
      const r = aRe[i] * bRe[i] - aIm[i] * bIm[i];
      const imv = aRe[i] * bIm[i] + aIm[i] * bRe[i];
      aRe[i] = r;
      aIm[i] = imv;
    }
    // Inverse FFT with normalization to get true convolution
    fftRadix2(aRe, aIm, true, true);

    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);
    for (let k = 0; k < n; k += 1) {
      const ang = sign * angBase * k * k;
      const cosv = Math.cos(ang);
      const sinv = Math.sin(ang);
      // y[k] = c[k] * exp(-i * ang)
      const cRe = aRe[k];
      const cIm = aIm[k];
      outRe[k] = cRe * cosv + cIm * sinv;
      outIm[k] = cIm * cosv - cRe * sinv;
    }
    return { re: outRe, im: outIm };
  }

  function fft1d(inRe, inIm, inverse) {
    return bluestein(inRe, inIm, inverse);
  }

  function fft2d(inRe, inIm, outRe, outIm, inverse) {
    const n = Math.sqrt(inRe.length);
    const total = n * n;
    const tempRe = new Float64Array(total);
    const tempIm = new Float64Array(total);

    // Row-wise
    for (let row = 0; row < n; row += 1) {
      const rowRe = new Float64Array(n);
      const rowIm = new Float64Array(n);
      for (let t = 0; t < n; t += 1) {
        const idx = row * n + t;
        rowRe[t] = inRe[idx];
        rowIm[t] = inIm[idx];
      }
      const rowOut = fft1d(rowRe, rowIm, inverse);
      for (let k = 0; k < n; k += 1) {
        const outIdx = row * n + k;
        tempRe[outIdx] = rowOut.re[k];
        tempIm[outIdx] = rowOut.im[k];
      }
    }

    // Column-wise
    for (let col = 0; col < n; col += 1) {
      const colRe = new Float64Array(n);
      const colIm = new Float64Array(n);
      for (let t = 0; t < n; t += 1) {
        const idx = t * n + col;
        colRe[t] = tempRe[idx];
        colIm[t] = tempIm[idx];
      }
      const colOut = fft1d(colRe, colIm, inverse);
      for (let k = 0; k < n; k += 1) {
        const outIdx = k * n + col;
        outRe[outIdx] = colOut.re[k];
        outIm[outIdx] = colOut.im[k];
      }
    }
  }

  window.tealeafFft2d = fft2d;
})();
