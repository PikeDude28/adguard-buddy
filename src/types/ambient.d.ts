/**
 * Minimal ambient typings for dependencies that ship no declarations.
 * Only the surface AdGuard Buddy actually uses is declared.
 */

declare module 'marked' {
  export interface MarkedOptions {
    /** Deprecated in marked 5; disabling it silences a per-parse warning. */
    mangle?: boolean;
    /** Deprecated in marked 5; disabling it silences a per-parse warning. */
    headerIds?: boolean;
    gfm?: boolean;
    breaks?: boolean;
  }

  export function parse(src: string, options?: MarkedOptions): string;
  export function setOptions(options: MarkedOptions): void;
}

declare module 'dompurify' {
  const DOMPurify: {
    sanitize(dirty: string): string;
  };
  export default DOMPurify;
}
