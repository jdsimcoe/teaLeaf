const NUM_PIXELS = 512;
const FREQUENCY_CUTOFF = 5;

class Complex {
    constructor(re, im) {
        this.re = re;
        this.im = im;
    }

    add(c) {
        return new Complex(this.re + c.re, this.im + c.im);
    }

    subtract(c) {
        return new Complex(this.re - c.re, this.im - c.im);
    }

    multiply(c) {
        return new Complex(
            this.re * c.re - this.im * c.im,
            this.re * c.im + this.im * c.re
        );
    }

    scale(s) {
        return new Complex(this.re * s, this.im * s);
    }
}

function mulberry32(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function fft2d(data, width, height, inverse = false) {
    const result = data.map(row => [...row]);
    
    for (let row = 0; row < height; row++) {
        result[row] = fft1d(result[row], inverse);
    }
    
    for (let col = 0; col < width; col++) {
        let column = [];
        for (let row = 0; row < height; row++) {
            column.push(result[row][col]);
        }
        column = fft1d(column, inverse);
        for (let row = 0; row < height; row++) {
            result[row][col] = column[row];
        }
    }
    
    if (inverse) {
        const scale = 1.0 / (width * height);
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                result[row][col] = result[row][col].scale(scale);
            }
        }
    }
    
    return result;
}

function fft1d(x, inverse = false) {
    const N = x.length;
    
    if (N <= 1) return x;
    
    if ((N & (N - 1)) !== 0) {
        throw new Error('FFT size must be a power of 2');
    }
    
    const even = fft1d(x.filter((_, i) => i % 2 === 0), inverse);
    const odd = fft1d(x.filter((_, i) => i % 2 === 1), inverse);
    
    const result = new Array(N);
    const direction = inverse ? 1 : -1;
    
    for (let k = 0; k < N / 2; k++) {
        const angle = direction * 2 * Math.PI * k / N;
        const w = new Complex(Math.cos(angle), Math.sin(angle));
        const t = w.multiply(odd[k]);
        
        result[k] = even[k].add(t);
        result[k + N / 2] = even[k].subtract(t);
    }
    
    return result;
}

function masked(row, column) {
    return (FREQUENCY_CUTOFF <= row && row <= NUM_PIXELS - FREQUENCY_CUTOFF)
        || (FREQUENCY_CUTOFF <= column && column <= NUM_PIXELS - FREQUENCY_CUTOFF);
}

function generateTeaLeaf(seed) {
    const rng = mulberry32(seed);
    
    const inputData = [];
    for (let row = 0; row < NUM_PIXELS; row++) {
        inputData[row] = [];
        for (let col = 0; col < NUM_PIXELS; col++) {
            const randVal = rng() < 0.5 ? 0 : 1;
            inputData[row][col] = new Complex(randVal, 0);
        }
    }
    
    const freqData = fft2d(inputData, NUM_PIXELS, NUM_PIXELS, false);
    
    for (let row = 0; row < NUM_PIXELS; row++) {
        for (let col = 0; col < NUM_PIXELS; col++) {
            if (masked(row, col)) {
                freqData[row][col] = new Complex(0, 0);
            }
        }
    }
    
    const spatialData = fft2d(freqData, NUM_PIXELS, NUM_PIXELS, true);
    
    const threshold = NUM_PIXELS * NUM_PIXELS / 2;
    const result = [];
    for (let row = 0; row < NUM_PIXELS; row++) {
        for (let col = 0; col < NUM_PIXELS; col++) {
            result.push(spatialData[row][col].re > threshold);
        }
    }
    
    return result;
}

function setup() {
    const canvas = createCanvas(NUM_PIXELS, NUM_PIXELS);
    canvas.parent('sketch-container');
    noLoop();
    
    const queryString = window.location.search.substring(1);
    const seedString = 'tealeaf::' + queryString;
    
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
        seed += seedString.charCodeAt(i);
    }
    
    console.log('Query string:', queryString);
    console.log('Seed string:', seedString);
    console.log('Seed value:', seed);
    
    const teaLeafData = generateTeaLeaf(seed);
    
    loadPixels();
    for (let i = 0; i < NUM_PIXELS * NUM_PIXELS; i++) {
        const pixelIndex = i * 4;
        if (teaLeafData[i]) {
            pixels[pixelIndex] = 0x54;
            pixels[pixelIndex + 1] = 0x66;
            pixels[pixelIndex + 2] = 0xf9;
            pixels[pixelIndex + 3] = 255;
        } else {
            pixels[pixelIndex] = 255;
            pixels[pixelIndex + 1] = 255;
            pixels[pixelIndex + 2] = 255;
            pixels[pixelIndex + 3] = 0;
        }
    }
    updatePixels();
}

function draw() {
}
