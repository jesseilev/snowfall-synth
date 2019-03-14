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
const TEMPO = Math.random() * 0.25 + 0.25;
const CHORD = choose([
  [ 1,   5/3, 15/6 ],
  [ 5/4, 3/2, 10/4 ],
  [ 1,   3/2, 10/4 ]
]);
const TONAL_FLOOR = 3 + Math.random() * 1;
const TONAL_RANGE = 6 + Math.random() * 3;
const TONAL_BOOST = 1;
const rhythmFrequencies = [4,6,8,10,12,16];
const TRACK_DURATION = 12;


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

  const modulators = [
    oscWithGain({ key: 'panner', destination: 'pan' }, { 
      gain: Math.random() * 1.5,
      frequency: Math.random() * -8 + 16,
      // choose(rhythmFrequencies) ** choose([-1]) * TEMPO,
      type: choose(['sine', 'square', 'sawtooth', 'triangle'])
    }),

    oscWithGain({ key: 'gain', destination: 'gain' }, {
      gain: gain * Math.random() * 0.2,
      frequency: Math.random() * 4,
      //choose(rhythmFrequencies) ** choose([-1]) * TEMPO,
      type: choose(['sine', 'triangle'])
    }),

    oscWithGain({key: 'filter', destination: 'Q' }, {
      gain: 2 ** (Math.random() * TONAL_RANGE + TONAL_FLOOR - 4),
      frequency: Math.random() * -8 + 16,
      //choose(rhythmFrequencies) ** choose([-1]) * TEMPO,
      type: choose(['sawtooth', 'triangle', 'square'])
    })
  ];

  return {
    // 'compressor': VG.dynamicsCompressor('output', {
    //   threshold: -50,
    //   knee: 40,
    //   ratio: 20,
    //   attack: 0.0,
    //   release: TEMPO * 0.25
    // }),

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

    'modulator': choose(modulators)
  }
});


const snowSynth = VG.createNode(({
  partials,
  gainPattern
}) => {


  const container = {
    'outputNozzle': VG.gain('output', {
      gain: gainPattern
    }),
    'inputNozzle': VG.gain(
      R.range(0, partials.length), // a list of all the snowflake keys
      { gain: 1 }, 
      'input'
    )
  };

  const snowflakes = R.map(
    partial => snowflake('outputNozzle', partial), 
    partials
  );

  return Object.assign(container, snowflakes);
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


const generateValueCurve = length => (
  R.map( () => choose([0.1, 4]), R.range(0, length) )
);

offlineGraph.update({
  'masterPan': VG.stereoPanner('output', { pan: 0.1 } ),

  'compressor': VG.dynamicsCompressor('masterPan', {
    threshold: -60,
    knee: 40,
    ratio: 20,
    attack: 0.0,
    release: TEMPO * 0.25
  }),

  'masterGain': VG.gain('compressor', { gain: 1 }),

  'ss1': snowSynth('masterGain', {
    partials: createPartials({ rootFrequency: ROOT_FREQUENCY * CHORD[0], nPartials: N_PARTIALS}),
    gainPattern: [ 
      'setValueCurveAtTime', 
      generateValueCurve(choose([8,16])), 
      currentTime, 
      TRACK_DURATION,
    ]
  }),

  'ss2': snowSynth('masterGain', {
    partials: createPartials({ rootFrequency: ROOT_FREQUENCY * CHORD[1], nPartials: N_PARTIALS}),
    gainPattern: [ 
      'setValueCurveAtTime', 
      generateValueCurve(choose([12,24])), 
      currentTime, 
      TRACK_DURATION
    ]
  }),

  'ss3': snowSynth('masterGain', {
    partials: createPartials({ rootFrequency: ROOT_FREQUENCY * CHORD[2], nPartials: N_PARTIALS}),
    gainPattern: [ 
      'setValueCurveAtTime', 
      generateValueCurve(choose([12,16])), 
      currentTime, 
      TRACK_DURATION,    
    ]
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


