import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48_000;
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECORDING_BACKED_ASSETS = new Set([
  'arrival/sequence.wav',
  'bunker/alarm.wav',
  'bunker/ambience.wav',
  'bunker/door.wav',
  'tournament/gong.wav',
]);

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createBuffer(duration) {
  const length = Math.ceil(duration * SAMPLE_RATE);
  return { left: new Float64Array(length), right: new Float64Array(length) };
}

function envelope(position, attack = 0.02, release = 0.2, curve = 1.6) {
  const up = Math.min(1, position / Math.max(attack, 0.0001));
  const down = Math.min(1, (1 - position) / Math.max(release, 0.0001));
  return Math.pow(Math.max(0, Math.min(up, down)), curve);
}

function panGains(pan) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function addTone(buffer, { start = 0, duration, frequency, endFrequency = frequency, gain = 0.2, pan = 0, attack = 0.02, release = 0.25, curve = 1.6, phase = 0 }) {
  const from = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const count = Math.min(buffer.left.length - from, Math.floor(duration * SAMPLE_RATE));
  const [leftGain, rightGain] = panGains(pan);
  let angle = phase;
  for (let index = 0; index < count; index += 1) {
    const progress = index / Math.max(1, count - 1);
    const hz = frequency * Math.pow(endFrequency / frequency, progress);
    angle += (Math.PI * 2 * hz) / SAMPLE_RATE;
    const sample = Math.sin(angle) * gain * envelope(progress, attack, release, curve);
    buffer.left[from + index] += sample * leftGain;
    buffer.right[from + index] += sample * rightGain;
  }
}

function addNoise(buffer, { start = 0, duration, gain = 0.15, pan = 0, attack = 0.03, release = 0.3, lowpass = 8_000, highpass = 0, seed = 1 }) {
  const random = rng(seed);
  const from = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const count = Math.min(buffer.left.length - from, Math.floor(duration * SAMPLE_RATE));
  const [leftGain, rightGain] = panGains(pan);
  const lpAlpha = Math.min(1, (Math.PI * 2 * lowpass) / SAMPLE_RATE);
  const hpAlpha = highpass > 0 ? Math.exp((-Math.PI * 2 * highpass) / SAMPLE_RATE) : 0;
  let low = 0;
  let previousLow = 0;
  for (let index = 0; index < count; index += 1) {
    const white = random() * 2 - 1;
    low += lpAlpha * (white - low);
    const filtered = highpass > 0 ? hpAlpha * (previousLow + low - white) : low;
    previousLow = filtered;
    const progress = index / Math.max(1, count - 1);
    const sample = filtered * gain * envelope(progress, attack, release, 1.25);
    buffer.left[from + index] += sample * leftGain;
    buffer.right[from + index] += sample * rightGain;
  }
}

function addEcho(buffer, delays) {
  for (const [seconds, gain, pan] of delays) {
    const offset = Math.floor(seconds * SAMPLE_RATE);
    const [leftGain, rightGain] = panGains(pan);
    for (let index = buffer.left.length - 1; index >= offset; index -= 1) {
      buffer.left[index] += buffer.left[index - offset] * gain * leftGain;
      buffer.right[index] += buffer.right[index - offset] * gain * rightGain;
    }
  }
}

function addClack(buffer, time, gain, pan, seed) {
  addNoise(buffer, { start: time, duration: 0.09, gain, pan, attack: 0.002, release: 0.85, lowpass: 5_500, highpass: 900, seed });
  addTone(buffer, { start: time, duration: 0.13, frequency: 170, endFrequency: 115, gain: gain * 0.75, pan, attack: 0.002, release: 0.9 });
}

function normalize(buffer, peak = 0.88) {
  let maximum = 0;
  for (let index = 0; index < buffer.left.length; index += 1) {
    buffer.left[index] = Math.tanh(buffer.left[index]);
    buffer.right[index] = Math.tanh(buffer.right[index]);
    maximum = Math.max(maximum, Math.abs(buffer.left[index]), Math.abs(buffer.right[index]));
  }
  const scale = maximum > 0 ? peak / maximum : 1;
  for (let index = 0; index < buffer.left.length; index += 1) {
    buffer.left[index] *= scale;
    buffer.right[index] *= scale;
  }
}

function toWav(buffer) {
  const bytesPerSample = 2;
  const channels = 2;
  const dataLength = buffer.left.length * channels * bytesPerSample;
  const output = Buffer.alloc(44 + dataLength);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + dataLength, 4);
  output.write('WAVE', 8);
  output.write('fmt ', 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(channels, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * channels * bytesPerSample, 28);
  output.writeUInt16LE(channels * bytesPerSample, 32);
  output.writeUInt16LE(bytesPerSample * 8, 34);
  output.write('data', 36);
  output.writeUInt32LE(dataLength, 40);
  let offset = 44;
  for (let index = 0; index < buffer.left.length; index += 1) {
    output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buffer.left[index])) * 32_767), offset);
    output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buffer.right[index])) * 32_767), offset + 2);
    offset += 4;
  }
  return output;
}

async function render(relativePath, duration, compose, peak = 0.88) {
  if (RECORDING_BACKED_ASSETS.has(relativePath)) {
    throw new Error(`Refusing to overwrite licensed recording-backed asset: ${relativePath}`);
  }
  const buffer = createBuffer(duration);
  compose(buffer);
  normalize(buffer, peak);
  const destination = join(projectRoot, 'public', 'audio', relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, toWav(buffer));
  return relativePath;
}

const rendered = [];

rendered.push(await render('ui/tap.wav', 0.09, (b) => {
  addNoise(b, { duration: 0.07, gain: 0.42, attack: 0.001, release: 0.92, lowpass: 10_000, highpass: 2_000, seed: 11 });
  addTone(b, { duration: 0.08, frequency: 820, endFrequency: 430, gain: 0.16, attack: 0.001, release: 0.92 });
}, 0.56));

rendered.push(await render('ui/select.wav', 0.18, (b) => {
  addTone(b, { duration: 0.15, frequency: 560, endFrequency: 720, gain: 0.26, attack: 0.01, release: 0.7, pan: -0.15 });
  addTone(b, { start: 0.025, duration: 0.14, frequency: 930, endFrequency: 1_080, gain: 0.16, attack: 0.01, release: 0.8, pan: 0.18 });
}));

rendered.push(await render('ui/confirm.wav', 0.42, (b) => {
  [440, 659.25, 880].forEach((frequency, index) => addTone(b, { start: index * 0.055, duration: 0.3, frequency, gain: 0.2 - index * 0.025, attack: 0.01, release: 0.72, pan: (index - 1) * 0.2 }));
  addEcho(b, [[0.09, 0.18, -0.3], [0.16, 0.11, 0.35]]);
}));

rendered.push(await render('ui/success.wav', 0.82, (b) => {
  [523.25, 659.25, 783.99].forEach((frequency, index) => addTone(b, { start: index * 0.12, duration: 0.48, frequency, gain: 0.22, attack: 0.015, release: 0.72, pan: (index - 1) * 0.25 }));
  addEcho(b, [[0.17, 0.2, -0.4], [0.31, 0.12, 0.4]]);
}));

rendered.push(await render('ui/error.wav', 0.52, (b) => {
  [0, 0.22].forEach((start, index) => {
    addTone(b, { start, duration: 0.25, frequency: 155 - index * 20, endFrequency: 102, gain: 0.34, attack: 0.01, release: 0.75, pan: index ? 0.12 : -0.12 });
    addNoise(b, { start, duration: 0.18, gain: 0.13, attack: 0.005, release: 0.8, lowpass: 700, seed: 21 + index });
  });
}, 0.72));

rendered.push(await render('ui/reveal.wav', 0.9, (b) => {
  addNoise(b, { duration: 0.78, gain: 0.19, attack: 0.65, release: 0.24, lowpass: 9_000, highpass: 900, seed: 31 });
  addTone(b, { start: 0.05, duration: 0.72, frequency: 240, endFrequency: 1_260, gain: 0.18, attack: 0.55, release: 0.25, pan: -0.25 });
  addTone(b, { start: 0.12, duration: 0.7, frequency: 330, endFrequency: 1_680, gain: 0.12, attack: 0.6, release: 0.2, pan: 0.3 });
  addEcho(b, [[0.08, 0.16, 0.3]]);
}));

rendered.push(await render('ui/countdown.wav', 0.18, (b) => {
  addNoise(b, { duration: 0.07, gain: 0.24, attack: 0.001, release: 0.92, lowpass: 5_000, highpass: 1_200, seed: 41 });
  addTone(b, { duration: 0.16, frequency: 980, endFrequency: 720, gain: 0.28, attack: 0.002, release: 0.86 });
}));

rendered.push(await render('ui/impact.wav', 1.05, (b) => {
  addTone(b, { duration: 0.95, frequency: 78, endFrequency: 34, gain: 0.62, attack: 0.003, release: 0.82 });
  addTone(b, { duration: 0.55, frequency: 210, endFrequency: 90, gain: 0.28, attack: 0.002, release: 0.88, pan: -0.12 });
  addNoise(b, { duration: 0.42, gain: 0.44, attack: 0.001, release: 0.93, lowpass: 2_200, seed: 51 });
  addEcho(b, [[0.13, 0.16, -0.35], [0.27, 0.08, 0.4]]);
}, 0.92));

rendered.push(await render('arrival/chime.wav', 2.8, (b) => {
  [[0, 523.25], [0.52, 659.25], [1.04, 783.99]].forEach(([start, frequency], index) => {
    addTone(b, { start, duration: 1.35, frequency, gain: 0.26, attack: 0.01, release: 0.86, pan: (index - 1) * 0.22 });
    addTone(b, { start, duration: 0.9, frequency: frequency * 2.01, gain: 0.08, attack: 0.005, release: 0.9, pan: (1 - index) * 0.18 });
  });
  addEcho(b, [[0.2, 0.22, -0.45], [0.39, 0.13, 0.42], [0.67, 0.07, -0.2]]);
}, 0.78));

rendered.push(await render('terminal/key.wav', 0.12, (b) => {
  addNoise(b, { duration: 0.08, gain: 0.38, attack: 0.001, release: 0.94, lowpass: 9_000, highpass: 1_800, seed: 121 });
  addTone(b, { duration: 0.1, frequency: 1_450, endFrequency: 720, gain: 0.18, attack: 0.001, release: 0.9 });
}, 0.62));

console.log(`Rendered ${rendered.length} original project-owned WAV assets:`);
for (const file of rendered) console.log(`- ${file}`);
