import * as pdfjsLib from 'pdfjs-dist';

// Vite-native worker resolution: this exact pattern (new URL + import.meta.url)
// is what Vite's static analyzer looks for to bundle the worker as a local
// asset instead of letting pdfjs-dist fall back to its hardcoded CDN URL.
const workerUrl = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export const extractImagesFromPDF = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    images.push(canvas.toDataURL('image/jpeg'));
  }

  return images;
};