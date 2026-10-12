// Audio filter presets, applied with player.setFilters(). Each preset replaces all
// active filters; volume is handled separately via setGlobalVolume so it survives.

const bassBands = [0.25, 0.2, 0.15, 0.1, 0.05].map((gain, band) => ({ band, gain }));

export const filterPresets = {
  off: { label: 'Off', filters: {} },
  bassboost: { label: 'Bass boost', filters: { equalizer: bassBands } },
  nightcore: { label: 'Nightcore', filters: { timescale: { speed: 1.2, pitch: 1.2, rate: 1 } } },
  vaporwave: {
    label: 'Vaporwave',
    filters: { timescale: { speed: 0.85, pitch: 0.8, rate: 1 }, equalizer: [{ band: 1, gain: 0.3 }, { band: 0, gain: 0.3 }] },
  },
  '8d': { label: '8D', filters: { rotation: { rotationHz: 0.2 } } },
  karaoke: { label: 'Karaoke', filters: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } } },
  tremolo: { label: 'Tremolo', filters: { tremolo: { frequency: 4, depth: 0.75 } } },
  vibrato: { label: 'Vibrato', filters: { vibrato: { frequency: 4, depth: 0.75 } } },
  soft: { label: 'Soft', filters: { lowPass: { smoothing: 20 } } },
  slowed: { label: 'Slowed', filters: { timescale: { speed: 0.8, pitch: 0.9, rate: 1 } } },
};
