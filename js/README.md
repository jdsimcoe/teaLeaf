# TeaLeaf Generator - Client-Side p5.js Version

This is a browser-based implementation of the TeaLeaf generator that runs entirely in the browser using p5.js.

## Features

- **Deterministic generation**: Same query string always produces the same image
- **Client-side processing**: All computation happens in the browser using JavaScript
- **2D FFT implementation**: Pure JavaScript FFT/IFFT for frequency-domain filtering
- **Seedable PRNG**: Mulberry32 algorithm for deterministic random number generation

## Usage

1. Open `index.html` in a web browser
2. Add a query string to the URL to generate different patterns:
   - `index.html?hello`
   - `index.html?foo=bar`
   - `index.html?test123`

Each unique query string will produce a unique, deterministic "tea leaf" pattern.

## Algorithm

1. Extract query string from URL
2. Prepend `tealeaf::` to match the C implementation
3. Generate numeric seed by summing ASCII values of all characters
4. Initialize 512×512 array with random binary values (0 or 1) using seeded PRNG
5. Perform forward 2D FFT
6. Apply low-pass filter (zero out high frequencies beyond cutoff of 5)
7. Perform inverse 2D FFT
8. Threshold: pixels with value > (512² / 2) become #5466f9, else transparent white

## Implementation Details

- **Size**: 512×512 pixels (vs 420×420 in C version)
- **Color**: `#5466f9` (RGB: 84, 102, 249) for "blobs", transparent white for background
- **FFT**: Cooley-Tukey radix-2 decimation-in-time algorithm
- **PRNG**: Mulberry32 32-bit state pseudo-random number generator

## Compatibility

The implementation uses:
- p5.js 1.7.0 (loaded from CDN)
- Modern JavaScript (ES6+)
- HTML5 Canvas

Works in all modern browsers that support ES6 and Canvas API.
