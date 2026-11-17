// Keep compression entirely in the browser. Never resize the OCR source in place.
export async function prepareModelImage(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  let edge = Math.max(
    720,
    Math.min(1800, Math.max(image.naturalWidth, image.naturalHeight)),
  );
  while (edge >= 720) {
    const scale = Math.min(
      1,
      edge / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法准备照片，请更换浏览器。");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      const encoded = data.split(",")[1];
      const size =
        (encoded.length * 3) / 4 -
        (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
      if (data.startsWith("data:image/jpeg;") && size <= 512000) return data;
    }
    edge = Math.floor(edge * 0.8);
  }
  throw new Error("照片压缩后仍过大，请裁剪到单道题后重试。");
}
