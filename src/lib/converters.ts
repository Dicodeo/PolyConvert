import JSZip from 'jszip';

export type FileStatus = 'pending' | 'converting' | 'completed' | 'error';

export interface FileItem {
  id: string;
  file: File;
  targetFormat: string;
  status: FileStatus;
  resultBlob?: Blob;
  resultName?: string;
  progress: number;
  error?: string;
}

export const SUPPORTED_CONVERSIONS: Record<string, string[]> = {
  'application/java-archive': ['zip'],
  'application/x-java-archive': ['zip'],
  'image/png': ['jpg', 'webp'],
  'image/jpeg': ['png', 'webp'],
  'image/webp': ['png', 'jpg'],
  'text/plain': ['pdf'], // Sample, keep it simple
};

export const getTargetFormats = (mimeType: string): string[] => {
  // If it's a .jar but unknown mime, treat as jar
  if (mimeType === '' || !SUPPORTED_CONVERSIONS[mimeType]) {
    return ['zip', 'png', 'jpg', 'webp']; // Generic fallback
  }
  return SUPPORTED_CONVERSIONS[mimeType] || [];
};

export async function convertFile(item: FileItem): Promise<{ blob: Blob; name: string }> {
  const { file, targetFormat } = item;
  const fileName = file.name.substring(0, file.name.lastIndexOf('.'));

  // JAR to ZIP
  if (file.name.endsWith('.jar') || file.type.includes('java-archive')) {
    if (targetFormat === 'zip') {
      // Since jar is zip, we just repackage or rename. 
      // To be "safe" and act like a real converter, let's repackage using jszip
      const zip = new JSZip();
      const content = await file.arrayBuffer();
      const sourceZip = await JSZip.loadAsync(content);
      
      // Copy all files
      for (const [path, fileData] of Object.entries(sourceZip.files)) {
        if (!fileData.dir) {
          zip.file(path, await fileData.async('uint8array'));
        } else {
          zip.folder(path);
        }
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      return { blob, name: `${fileName}.zip` };
    }
  }

  // Image Conversion
  if (file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Failed to get canvas context');
          ctx.drawImage(img, 0, 0);
          
          let mime = 'image/png';
          if (targetFormat === 'jpg' || targetFormat === 'jpeg') mime = 'image/jpeg';
          if (targetFormat === 'webp') mime = 'image/webp';

          canvas.toBlob((blob) => {
            if (blob) {
              resolve({ blob, name: `${fileName}.${targetFormat}` });
            } else {
              reject('Conversion failed');
            }
          }, mime, 0.9);
        };
        img.onerror = () => reject('Failed to load image');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject('Failed to read file');
      reader.readAsDataURL(file);
    });
  }

  throw new Error(`Conversão de ${file.type} para ${targetFormat} não suportada.`);
}
