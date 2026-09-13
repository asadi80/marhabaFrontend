export async function compressImage(file: File): Promise<File> {
  // PDFs don't need image compression
  if (file.type === "application/pdf") {
    return file;
  }

  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.type === "application/octet-stream" ||
    file.type === "" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  // Convert HEIC/HEIF → JPEG
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;

      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.95,
      });

      const blob = Array.isArray(convertedBlob)
        ? convertedBlob[0]
        : convertedBlob;

      return new File(
        [blob],
        file.name
          .replace(/\.heic$/i, ".jpg")
          .replace(/\.heif$/i, ".jpg"),
        {
          type: "image/jpeg",
          lastModified: Date.now(),
        },
      );
    } catch (error) {
      console.error("HEIC conversion failed:", error);

      // If conversion fails, keep the original file
      return file;
    }
  }

  // Compress normal images
  return new Promise<File>((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const url = URL.createObjectURL(file);

    if (!ctx) {
      URL.revokeObjectURL(url);
      resolve(file);
      return;
    }

    img.onload = () => {
      const MAX = 2400;

      let { width, height } = img;

      // Resize only if wider than MAX
      if (width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        0.92,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}