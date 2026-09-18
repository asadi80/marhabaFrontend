
export async function compressImage(file: File): Promise<File> {
  // PDFs don't need image compression/conversion
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return file;
  }

  const fileName = file.name.toLowerCase();

  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif");

  const isWebp =
    file.type === "image/webp" ||
    fileName.endsWith(".webp");

  /**
   * Convert HEIC / HEIF → JPEG first.
   * The resulting JPEG is then passed through the normal
   * canvas compression below.
   */
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

      // Convert the resulting JPEG blob into a File so it can
      // continue through the normal compression pipeline.
      file = new File(
        [blob],
        file.name
          .replace(/\.heic$/i, ".jpg")
          .replace(/\.heif$/i, ".jpg"),
        {
          type: "image/jpeg",
          lastModified: Date.now(),
        }
      );
    } catch (error) {
      console.error("HEIC/HEIF conversion failed:", error);

      // Keep original if HEIC conversion fails
      return file;
    }
  }

  /**
   * WebP is supported by modern browsers and can be drawn
   * directly onto a canvas.
   *
   * The canvas output below is ALWAYS image/jpeg, so WebP
   * automatically becomes JPG.
   */
  if (isWebp) {
    console.log("Converting WebP → JPEG:", file.name);
  }

  /**
   * Compress / convert image to JPEG.
   */
  return new Promise<File>((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

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

      // White background prevents transparent PNG/WebP
      // areas from becoming black in the JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // ALWAYS use .jpg
          const newName = file.name.replace(/\.[^.]+$/, ".jpg");

          const compressedFile = new File(
            [blob],
            newName,
            {
              type: "image/jpeg",
              lastModified: Date.now(),
            }
          );

          console.log("Image converted/compressed:", {
            original: file.name,
            originalType: file.type,
            originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            output: compressedFile.name,
            outputType: compressedFile.type,
            outputSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);

      console.error("Could not load image:", file.name);

      // Keep original if browser cannot decode it
      resolve(file);
    };

    img.src = url;
  });
}

