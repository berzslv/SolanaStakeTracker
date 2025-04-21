// Buffer polyfill adapted for browser usage - handles Buffer references properly in the browser
import { Buffer as BufferPolyfill } from 'buffer';

// Make Buffer available globally
// This approach allows it to work correctly with Vite
if (typeof window !== 'undefined') {
  (window as any).Buffer = BufferPolyfill;
  (globalThis as any).Buffer = BufferPolyfill;
}

export {};