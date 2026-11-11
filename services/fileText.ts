/**
 * Turns an uploaded statement into plain text on the device, so a text-only model can read it.
 * Supports PDF (incl. password-protected CAS), CSV/TXT and Excel. Images are not supported.
 */
import * as pdfjsLib from 'pdfjs-dist';
// Bundle the PDF worker with the app (works offline inside the APK, no CDN download).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export class FileTextError extends Error {
    constructor(public code: 'PASSWORD_REQUIRED' | 'UNSUPPORTED_IMAGE' | 'UNSUPPORTED' | 'EMPTY', message: string) {
        super(message); this.name = 'FileTextError';
    }
}

const ext = (f: File) => (f.name.split('.').pop() || '').toLowerCase();
export const isPdfFile = (f: File) => f.type === 'application/pdf' || ext(f) === 'pdf';
export const isImageFile = (f: File) => f.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif'].includes(ext(f));
const isExcelFile = (f: File) => ['xlsx', 'xls'].includes(ext(f)) || /spreadsheetml|ms-excel/.test(f.type);
const isTextFile = (f: File) => ['csv', 'txt', 'tsv'].includes(ext(f)) || f.type.startsWith('text/');

export const extractTextFromPdf = async (file: File, password?: string): Promise<string> => {
    const data = await file.arrayBuffer();
    try {
        const pdf = await pdfjsLib.getDocument({ data, password, disableFontFace: true, isEvalSupported: false }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((it: any) => it.str || '').join(' ') + '\n';
        }
        return text;
    } catch (err: any) {
        if (err?.name === 'PasswordException' || err?.code === 1 || /password/i.test(err?.message || '')) {
            throw new FileTextError('PASSWORD_REQUIRED', 'This PDF needs a password.');
        }
        throw err;
    }
};

export const extractTextFromFile = async (file: File, password?: string): Promise<string> => {
    let text = '';
    if (isPdfFile(file)) text = await extractTextFromPdf(file, password);
    else if (isExcelFile(file)) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        text = wb.SheetNames.map(n => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n');
    } else if (isTextFile(file)) text = await file.text();
    else if (isImageFile(file)) {
        throw new FileTextError('UNSUPPORTED_IMAGE', 'Photos and screenshots are not supported. Please upload the PDF, CSV or Excel statement instead.');
    } else {
        throw new FileTextError('UNSUPPORTED', 'Unsupported file type. Please upload a PDF, CSV or Excel statement.');
    }
    if (!text.trim()) {
        throw new FileTextError('EMPTY', 'No readable text was found in this file. If it is a scanned PDF, download the original statement from your bank instead.');
    }
    return text;
};
