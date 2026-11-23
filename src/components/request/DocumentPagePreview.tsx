import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

const frameClass = "mx-4 mb-4 h-[75svh] min-h-80 rounded-lg border bg-muted sm:mx-6";

export function DocumentPagePreview({ url, filename }: { url: string; filename: string }) {
  if (!/\.pdf(?:[?#]|$)/i.test(filename)) {
    return <iframe className={`${frameClass} w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)]`} src={url} title="Предпросмотр документа" />;
  }
  return <PdfPagePreview key={url} url={url} />;
}

function PdfPagePreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let loading: PDFDocumentLoadingTask | undefined;
    void Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(async ([pdfjs, worker]) => {
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      loading = pdfjs.getDocument({ url, isEvalSupported: false });
      const document = await loading.promise;
      if (active) setPdf(document);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; void loading?.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    const element = canvas.current;
    let active = true;
    let rendering: RenderTask | undefined;
    setReady(false);
    setFailed(false);
    void pdf.getPage(pageNumber).then(async page => {
      if (!active) return;
      const size = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1800 / Math.max(size.width, size.height) });
      element.width = Math.ceil(viewport.width);
      element.height = Math.ceil(viewport.height);
      rendering = page.render({ canvas: element, viewport, background: "white" });
      await rendering.promise;
      if (active) setReady(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; rendering?.cancel(); };
  }, [pdf, pageNumber]);

  return (
    <section className={`${frameClass} flex min-w-0 flex-col overflow-hidden`} aria-label="Предпросмотр документа">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <canvas ref={canvas} role="img" aria-label={`Страница ${pageNumber} PDF`}
          className={`block h-auto max-h-full w-auto max-w-full bg-white object-contain shadow ${ready ? "" : "invisible"}`} />
        {!ready && <p className="absolute inset-x-3 text-center text-sm text-muted-foreground" role={failed ? "alert" : "status"}>
          {failed ? "Не удалось показать PDF. Документ доступен по кнопке «Открыть файл»." : "Загружаем страницу PDF…"}
        </p>}
      </div>
      {pdf && pdf.numPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t bg-card p-2">
          <Button size="sm" variant="outline" disabled={pageNumber <= 1} onClick={() => setPageNumber(pageNumber - 1)}>Назад</Button>
          <span className="text-sm tabular-nums" aria-live="polite">{pageNumber} / {pdf.numPages}</span>
          <Button size="sm" variant="outline" disabled={pageNumber >= pdf.numPages} onClick={() => setPageNumber(pageNumber + 1)}>Далее</Button>
        </div>
      )}
    </section>
  );
}
