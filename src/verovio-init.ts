import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

let toolkitPromise: Promise<VerovioToolkit> | undefined;

export function getToolkit(): Promise<VerovioToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = createVerovioModule().then((VerovioModule: any) => {
      const tk = new VerovioToolkit(VerovioModule);
      tk.setOptions({
        scale: 40,
        adjustPageWidth: true,
        pageHeight: 60000,
        pageMarginTop: 50,
        svgAdditionalAttribute: [
          'note@pname',
          'note@oct',
          'note@accid',
          'note@accid.ges',
          'accid@accid',
          'accid@accid.ges',
        ],
      });
      return tk;
    });
  }
  return toolkitPromise;
}
