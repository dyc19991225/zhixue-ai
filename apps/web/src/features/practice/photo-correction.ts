export function rotatedSize(width: number, height: number, degrees: number) {
  if (
    ![width, height, degrees].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    Math.abs(degrees) > 15
  )
    throw new Error("微调角度或图片尺寸无效。");
  const angle = (degrees * Math.PI) / 180;
  return {
    width: Math.ceil(
      Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)),
    ),
    height: Math.ceil(
      Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)),
    ),
  };
}

export function enhanceText(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const grey =
      0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    const value = Math.round((grey - 128) * 1.35 + 128);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
  }
}

export async function correctPhoto(
  source: string,
  degrees: number,
  enhance: boolean,
) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const bounds = rotatedSize(image.naturalWidth, image.naturalHeight, degrees);
  const scale = Math.min(1, 1800 / Math.max(bounds.width, bounds.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(bounds.width * scale));
  canvas.height = Math.max(1, Math.ceil(bounds.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法处理照片。");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  if (enhance) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    enhanceText(pixels.data);
    ctx.putImageData(pixels, 0, 0);
  }
  return canvas.toDataURL("image/jpeg", 0.95);
}
