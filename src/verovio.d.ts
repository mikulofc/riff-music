declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<any>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: any);
    setOptions(options: Record<string, any>): void;
    loadData(data: string): boolean;
    loadZipDataBuffer(data: ArrayBuffer): boolean;
    getPageCount(): number;
    renderToSVG(page?: number, xmlDeclaration?: boolean): string;
    getElementAttr(xmlId: string): Record<string, string>;
    getMEI(options?: Record<string, any>): string;
    renderToMIDI(): string;
    getTimeForElement(xmlId: string): number;
    getElementsAtTime(millisec: number): { notes: string[]; page: number };
    destroy(): void;
  }
}
