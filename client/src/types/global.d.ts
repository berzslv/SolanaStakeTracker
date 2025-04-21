// Add global type declarations to enable use of Buffer in TypeScript
interface Window {
  Buffer: typeof Buffer;
  global: Window;
  process: {
    env: Record<string, string>;
  };
}

// Helps with modules that expect Node.js environment
declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        NODE_ENV: 'development' | 'production';
      }
    }
  }
  export const env: NodeJS.ProcessEnv;
}