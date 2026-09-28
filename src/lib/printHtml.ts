/**
 * Print an HTML document via a hidden iframe (no pop-up, so browsers don't block it).
 * Pass a full HTML document string WITHOUT any auto-print script.
 */
export function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  const run = () => {
    try {
      const win = iframe.contentWindow!;
      win.addEventListener("afterprint", cleanup, { once: true });
      win.focus();
      win.print();
    } catch (e) {
      console.error("print failed", e);
    }
    setTimeout(() => iframe.remove(), 60_000);
  };
  // Wait for fonts/layout
  setTimeout(run, 300);
  return true;
}
