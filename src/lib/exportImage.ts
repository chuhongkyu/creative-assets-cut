import { computeDrawRect, type FitMode, type Focus } from "./crop";

/**
 * 이미지를 한 규격으로 그려 jpg로 만든다.
 *
 * contain일 때 남는 자리는 단색 띠 대신 원본을 흐리게 깔아 채운다.
 * 띠는 광고에서 눈에 거슬리고, 흐린 배경은 원본 색감을 이어받아 자연스럽다.
 */
export async function renderImage(
  source: HTMLImageElement | HTMLVideoElement,
  sourceSize: { width: number; height: number },
  targetWidth: number,
  targetHeight: number,
  mode: FitMode,
  focus: Focus
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

  if (mode === "contain") {
    const fill = computeDrawRect(sourceSize, targetWidth, targetHeight, "cover", "center");
    ctx.filter = "blur(24px)";
    ctx.drawImage(source, fill.sx, fill.sy, fill.sw, fill.sh, -24, -24, targetWidth + 48, targetHeight + 48);
    ctx.filter = "none";
  }

  const rect = computeDrawRect(sourceSize, targetWidth, targetHeight, mode, focus);
  ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했습니다."))),
      "image/jpeg",
      0.92
    );
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
