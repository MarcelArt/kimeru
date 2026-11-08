import type { ImageAttachment } from "#/lib/domain";

export async function prepareImage(file: File): Promise<ImageAttachment> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > 16 * 1024 * 1024)
    throw new Error("Choose an image smaller than 16 MB.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
    let width = Math.round(bitmap.width * scale),
      height = Math.round(bitmap.height * scale);
    if (Math.min(width, height) < 280) {
      const grow = 280 / Math.min(width, height);
      width = Math.round(width * grow);
      height = Math.round(height * grow);
      if (Math.max(width, height) > 1568)
        throw new Error(
          "This image is too panoramic. Crop it so both sides can fit between 280 and 1568 pixels.",
        );
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    if (dataUrl.length > 5.3 * 1024 * 1024)
      throw new Error(
        "The prepared image exceeds 4 MB. Choose a smaller image.",
      );
    return {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ".jpg"),
      mime: "image/jpeg",
      dataUrl,
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}
