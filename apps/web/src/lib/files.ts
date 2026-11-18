/** Browser helpers for generated files. */
let fontCache: Promise<{ regular: Uint8Array; bold: Uint8Array }> | undefined;

export function loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  fontCache ??= Promise.all(
    ['/fonts/AtkinsonHyperlegible-Regular.ttf', '/fonts/AtkinsonHyperlegible-Bold.ttf'].map(
      async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load ${url}`);
        return new Uint8Array(await res.arrayBuffer());
      },
    ),
  )
    .then(([regular, bold]) => ({ regular: regular!, bold: bold! }))
    .catch((error: unknown) => {
      fontCache = undefined;
      throw error;
    });
  return fontCache;
}

export function downloadBlob(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}
