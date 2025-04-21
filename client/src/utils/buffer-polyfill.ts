// Buffer polyfill for web3.js
import { Buffer } from 'buffer';

window.Buffer = window.Buffer || Buffer;
window.global = window.global || window as any;
window.process = window.process || { env: {} } as any;