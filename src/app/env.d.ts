/// <reference types="vite-plus/test/globals" />
declare module "*.css";

interface Window {
  webkitAudioContext?: typeof AudioContext;
}
