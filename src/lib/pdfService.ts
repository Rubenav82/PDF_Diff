import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configurar el worker localmente
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Calcula el hash SHA-512 de un archivo para verificar integridad.
 * @param file El archivo a hashear.
 * @returns Una promesa que resuelve en el hash hexadecimal.
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-512', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Obtiene el número de página de un archivo PDF.
 * @param file El archivo PDF a procesar.
 * @returns Una promesa que resuelve en el número de páginas.
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
 * Extrae el contenido de textual de cada página de un PDF.
 * @param file El archivo PDF a procesar.
 * @returns Una promesa que resuelve en un array de strings, donde cada string es el texto de una página.
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
          // Filtrar y unir el texto de los items
          const pageText = (textContent.items as { str?: string }[])
            .map((item) => item.str || '')
            .join(' ');
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
 * Renderiza un página específica de un PDF para obtener el elemento canvas determinado.
 * @param file El archivo PDF.
 * @param pageNum El número de página a renderizar.
 * @param canvas El elemento canvas sobre el que dibujar.
 * @returns Un objeto con una promesa que resuelve cuando el renderizado se ha completado y una función lo cancela.
 */
export function renderPageToCanvas(
  file: File,
  pageNum: number,
  canvas: HTMLCanvasElement
): RenderTask {
  let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
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
      } catch (error: unknown) {
        // Ignorar el error de cancelación ya que es un comportamiento esperado
        if (error instanceof Error && error.name !== 'RenderingCancelledException') {
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
