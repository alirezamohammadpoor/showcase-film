/* Neutral brand: the fallback when a product has no site or Figma yet. Inter and Inter Display are installed in the cloud container.
   A measured brand (tools/measure-brand.cjs) writes a file of the same shape next to its fonts/. */
window.BRAND = {
  name: 'neutral',
  base: new URL('.', document.currentScript.src).href,     // font paths below are relative to this folder
  colors: { ground: '#FFFFFF', panel: '#FFFFFF', ink: '#111111', mute: '#9C9C9C', line: '#E0E0E0', accent: '#111111', square: '#111111', device: '#0B0B0C' },
  text:  { family: 'Inter', weight: 400 },
  head:  { family: 'Inter Display', weight: 500, tracking: '-0.02em' },
  label: { family: 'Inter', weight: 600, case: 'uppercase', tracking: '0.02em' },
  lineWidth: 2,
  fontFaces: [],                                            // [{ family, weight, style, src: 'fonts/Name-400.woff2' }]
};
