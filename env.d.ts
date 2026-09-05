/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// Fontsource ships a package whose entry point is a stylesheet, so the bare
// specifier carries no type declarations. TypeScript 6 checks side-effect
// imports by default (`noUncheckedSideEffectImports`), so declare it as the
// export-less module it is.
declare module '@fontsource-variable/red-hat-display' {}
