// Convert locally; the server independently decodes and re-encodes every upload.
export async function prepareSubmissionImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('Choose a JPG, PNG or WebP photo up to 8 MB.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This photo could not be read. Try another JPG, PNG or WebP image.'); });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 24000000)
      throw new Error('Choose a photo under 24 megapixels.');
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process this image.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.82, .7, .55]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot convert photos to WebP. Please use an up-to-date browser.');
      if (blob.size <= 2 * 1024 * 1024) return blob;
    }
    throw new Error('This photo is still too large after compression. Choose a smaller image.');
  } finally { bitmap.close(); }
}
