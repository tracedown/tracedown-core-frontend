/**
 * Handing the browser a file to save.
 *
 * The one place the app builds an object URL and clicks it, so the URL is
 * revoked in exactly one place too — an object URL that is never revoked pins
 * its blob in memory for the life of the document, which for a response body
 * can be tens of megabytes.
 */

/** Saves `blob` as `filename`, then releases the object URL behind it. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Saves `content` as a UTF-8 text file. */
export function downloadText(content: string, filename: string, mediaType = 'text/plain'): void {
  downloadBlob(new Blob([content], { type: `${mediaType};charset=utf-8` }), filename);
}
