// IMPORTANT: This buffer polyfill must be imported before any other imports in your application
// It should be the very first import in your entry point (main.tsx)

// Use a more robust approach to ensure Buffer is available everywhere
import * as buffer from 'buffer';

// Ensure Buffer is available globally
if (typeof window !== 'undefined') {
  // Make Buffer accessible globally
  window.Buffer = buffer.Buffer;
  
  // These are necessary for some libraries that expect Node.js globals
  (window as any).global = window;
  (window as any).process = { env: {} };
}

export {};