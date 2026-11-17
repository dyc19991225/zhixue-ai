export type CropBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export const fullCrop: CropBox = { left: 0, top: 0, right: 100, bottom: 100 };
export function cropRectangle(width: number, height: number, box: CropBox) {
  if (
    ![width, height].every((n) => Number.isInteger(n) && n > 0) ||
    !Object.values(box).every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    ) ||
    box.left >= box.right ||
    box.top >= box.bottom
  )
    throw new Error("裁剪范围无效。");
  const x = Math.floor((width * box.left) / 100),
    y = Math.floor((height * box.top) / 100);
  return {
    x,
    y,
    width: Math.min(width, Math.ceil((width * box.right) / 100)) - x,
    height: Math.min(height, Math.ceil((height * box.bottom) / 100)) - y,
  };
}
