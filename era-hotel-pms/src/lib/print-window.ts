/** Open a print window the caller still owns. `noopener` drops the handle and the print never starts. */
export function openPrintDocument(html: string): boolean {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

export function escapePrintHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
