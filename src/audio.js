import createVirtualAudioGraph, * as VG from 'virtual-audio-graph';
import * as R from 'ramda';


// UTILS

const choose = items => (
  items[ Math.floor(Math.random() * items.length) ]
);


// CONFIG

const N_PARTIALS = 32
const ROOT_FREQUENCY = choose([80, 100, 120]);
const BASS_BOOST = 0.9;
const TEMPO = Math.random() * 0.15 + 0.25;
const CHORD = choose([
  [ 1,   5/3, 15/6 ],
  [ 5/4, 3/2, 10/4 ],
  [ 1,   3/2, 10/4 ]
]);
const TONAL_FLOOR = 4;
const TONAL_RANGE = 8;
const TONAL_BOOST = 1;
const rhythmFrequencies = [1,1,1,2,2,2,4,4,8,3,3,6,6];
const TRACK_DURATION = TEMPO * 3 * 8;


// AUDIO CONTEXT 

let ctx = new AudioContext();
let offlineCtx = new OfflineAudioContext(2, ctx.sampleRate * TRACK_DURATION, 44100);


let offlineGraph = createVirtualAudioGraph({
  audioContext: offlineCtx,
  output: offlineCtx.destination
});

const { currentTime } = offlineGraph;


// WHITE NOISE BUFFER
const noiseDuration = 3;
const sampleRate = offlineGraph.audioContext.sampleRate;
const bufferSize = 2 * noiseDuration * sampleRate;
let buffer = ctx.createBuffer(noiseDuration, bufferSize, sampleRate);
let bufferOutput = buffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
  bufferOutput[i] = Math.random() * 2 - 1;
}


const oscWithGain = VG.createNode(({
  gain,
  ...rest
}) => ({
  'gain': VG.gain('output', {
    gain: gain 
  }),

  'osc': VG.oscillator('gain', rest)
}));


const snowflake = VG.createNode(({
  frequency,
  gain,
  pan,
  q
}) => {

  return {
    'gain': VG.gain('output', {
      gain: 0.001 * gain * (q ** TONAL_BOOST)
    }),

    'panner': VG.stereoPanner('gain', { 
      pan: pan 
    }),

    'filter': VG.biquadFilter('panner', {
      type: 'bandpass',
      frequency: frequency,
      Q: q
    }, 'input'),

    'panModulator': oscWithGain({ key: 'panner', destination: 'pan' }, { 
      gain: Math.random() * 2,
      frequency: choose(rhythmFrequencies) ** choose([1, -1, -1]) * TEMPO,
      type: choose(['sine', 'square', 'sawtooth', 'triangle'])
    }),

    'gainModulator': oscWithGain({ key: 'gain', destination: 'gain' }, {
      gain: gain * q / (2 ** (Math.random() * 1)),
      frequency: choose(rhythmFrequencies) ** choose([1, -1, -1]) * TEMPO,
      type: choose(['sine', 'square', 'sawtooth', 'triangle'])
    }),

    'qModulator': oscWithGain({key: 'filter', destination: 'Q' }, {
      gain: q / (2 ** (Math.random() * 0.5)),
      frequency: choose(rhythmFrequencies) ** choose([1, -1, -1]) * TEMPO,
      type: choose(['sine', 'square', 'sawtooth', 'triangle'])
    })
  }
});


const snowSynth = VG.createNode(({
  partials
}) => {


  const inputNozzle = {
    'inputNozzle': VG.gain(
      R.range(0, partials.length), 
      { gain: 1 }, 
      'input'
    ),
  };

  const snowflakes = R.map(
    partial => snowflake('output', partial), 
    partials
  );


  return Object.assign(inputNozzle, snowflakes);
});


console.log(ROOT_FREQUENCY);
console.log(CHORD);
console.log(TONAL_FLOOR);

const createPartials = ({
  rootFrequency,
  nPartials
}) => {
  const partial = i => ({
    gain: Math.random() / (i ** (1 + BASS_BOOST)),
    pan: Math.random(),
    frequency: rootFrequency * i,
    q: 2 ** ( Math.random() * TONAL_RANGE + TONAL_FLOOR )
  });

  return R.map(partial, R.range(1, nPartials + 1));
};

offlineGraph.update({
  'masterPan': VG.stereoPanner('output', { pan: 0.1 } ),

  'compressor': VG.dynamicsCompressor('masterPan', {
    threshold: -100,
    knee: 40,
    ratio: 20,
    attack: 0.0,
    release: TEMPO * 0.25
  }),

  'masterGain': VG.gain('compressor', { gain: 0.1 }),

  'ss1': snowSynth('masterGain', {
    partials: createPartials({ rootFrequency: ROOT_FREQUENCY * CHORD[0], nPartials: N_PARTIALS})
  }),

  'ss2': snowSynth('masterGain', {
    partials: createPartials({ rootFrequency: ROOT_FREQUENCY * CHORD[1], nPartials: N_PARTIALS})
  }),

  'ss3': snowSynth('masterGain', {
    partials: createPartials({ rootFrequency: ROOT_FREQUENCY * CHORD[2], nPartials: N_PARTIALS})
  }),

  'noise': VG.bufferSource(['ss1', 'ss2', 'ss3'], {
    buffer: buffer,
    loop: true,
  }),
});

console.log(offlineGraph);

const renderStartTime = currentTime;

let promise = offlineCtx.startRendering().then(renderedBuffer => {
  console.log("Finished rendering! It took this many seconds:");
  console.log( ctx.currentTime - renderStartTime );

  let onlineGraph = createVirtualAudioGraph({
    audioContext: ctx,
    sampleRate: ctx.sampleRate
  });

  onlineGraph.update({
    'masterGain': VG.gain('output', {
      gain: 1
    }),
    'tack': VG.bufferSource('masterGain', {
      buffer: renderedBuffer,
      loop: true
    })
  });
}).catch(error => {
  console.log("error!");
  console.log(error);
});

console.log(promise);


