export interface ClipboardPort {
  writeText(source: string): Promise<void>;
}

export const browserClipboard: ClipboardPort = {
  async writeText(source) {
    if (!globalThis.navigator?.clipboard) {
      throw new Error("Clipboard API unavailable");
    }
    await globalThis.navigator.clipboard.writeText(source);
  },
};
