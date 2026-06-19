// Ambient declarations for non-code imports (Vite's vite/client used to provide
// these; Next needs them for tsc). Webpack/Next handle the actual bundling.
declare module '*.css';
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.wav' {
  const src: string;
  export default src;
}
declare module '*.ogg' {
  const src: string;
  export default src;
}
