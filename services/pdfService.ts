// This is required to find the worker script from the CDN.
// It's a global variable that pdf.js looks for.
(window as any).pdfjsWorker = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// Get the pdf.js global object
const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];

/**
 * Gets the number of pages in a PDF file.
 * @param file The PDF file to process.
 * @returns A promise that resolves to the number of pages.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error('Error al leer el archivo.'));
      }
      try {
        const loadingTask = pdfjsLib.getDocument({ data: event.target.result });
        const pdf = await loadingTask.promise;
        resolve(pdf.numPages);
      } catch (error) {
        reject(error);
      }
    };
    fileReader.onerror = (error) => reject(error);
    fileReader.readAsArrayBuffer(file);
  });
}


/**
 * Extracts text content from each page of a PDF file.
 * @param file The PDF file to process.
 * @returns A promise that resolves to an array of strings, where each string is the text of a page.
 */
export async function extractTextFromPdf(file: File): Promise<string[]> {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error('Error al leer el archivo.'));
      }
      try {
        const loadingTask = pdfjsLib.getDocument({ data: event.target.result });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        const pageTexts: string[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          pageTexts.push(pageText);
        }
        resolve(pageTexts);
      } catch (error) {
        reject(error);
      }
    };
    fileReader.onerror = (error) => reject(error);
    fileReader.readAsArrayBuffer(file);
  });
}

interface RenderTask {
  promise: Promise<{ width: number; height: number; }>;
  cancel: () => void;
}

/**
 * Renders a specific page of a PDF to a given canvas element.
 * @param file The PDF file.
 * @param pageNum The 1-based page number to render.
 * @param canvas The canvas element to draw on.
 * @returns An object with a promise that resolves when rendering is complete and a function to cancel it.
 */
export function renderPageToCanvas(
  file: File,
  pageNum: number,
  canvas: HTMLCanvasElement
): RenderTask {
  let renderTask: any | null = null;
  const fileReader = new FileReader();

  const promise = new Promise<{ width: number; height: number; }>((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error('Error al leer el archivo.'));
      }
      try {
        const loadingTask = pdfjsLib.getDocument({ data: event.target.result });
        const pdf = await loadingTask.promise;

        if (pageNum < 1 || pageNum > pdf.numPages) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = 800;
            canvas.height = 100;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "16px Arial";
            ctx.fillStyle = "gray";
            ctx.textAlign = "center";
            ctx.fillText(`Página ${pageNum} no existe en ese documento.`, canvas.width / 2, canvas.height / 2);
          }
          return resolve({ width: 0, height: 0 });
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const context = canvas.getContext('2d');
        if (!context) {
          return reject(new Error('No se pudo obtener contexto del lienzo.'));
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        resolve({ width: viewport.width, height: viewport.height });
      } catch (error: any) {
        // Ignorar el error de cancelación ya que es un comportamiento esperado
        if (error.name !== 'RenderingCancelledException') {
            reject(error);
        }
      }
    };
    fileReader.onerror = (error) => reject(error);
    fileReader.readAsArrayBuffer(file);
  });

  return {
    promise,
    cancel: () => {
      if (renderTask) {
        renderTask.cancel();
      }
      // Detener la lectura del archivo si aún no ha terminado
      if (fileReader.readyState === FileReader.LOADING) {
        fileReader.abort();
      }
    },
  };
}