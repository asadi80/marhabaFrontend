export async function compressImage(file: File): Promise<File> {
  // PDFs don't need image compression/conversion
  if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
    return file;
  }

  const fileName = file.name.toLowerCase();

  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif");

  /**
   * Convert HEIC / HEIF → JPEG first.
   * Use quality 1.0 here so we don't double-compress:
   * the canvas step below will do the single quality pass.
   */
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;

      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 1.0, // lossless hand-off to canvas step
      });

      const blob = Array.isArray(convertedBlob)
        ? convertedBlob[0]
        : convertedBlob;

      file = new File(
        [blob],
        file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
        { type: "image/jpeg", lastModified: Date.now() },
      );
    } catch (error) {
      console.error("HEIC/HEIF conversion failed:", error);
      return file;
    }
  }

  // ---- Tunables ----------------------------------------------------------
  const MAX_DIMENSION = 2560;   // longest side cap (up from 2400 width-only)
  const QUALITY = 0.95;         // JPEG quality (up from 0.92)
  const SKIP_BELOW_BYTES = 300 * 1024; // re-encode only if > 300 KB
  const SKIP_BELOW_DIMENSION = 1920;   // and only if larger than this
  // ------------------------------------------------------------------------

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const { width: srcW, height: srcH } = img;

      const longestSide = Math.max(srcW, srcH);

      const alreadySmall =
        file.size <= SKIP_BELOW_BYTES && longestSide <= SKIP_BELOW_DIMENSION;

      // Don't touch already-small files — re-encoding only hurts quality.
      if (alreadySmall) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      // Scale so the LONGEST side fits MAX_DIMENSION (handles portrait too).
      let width = srcW;
      let height = srcH;

      if (longestSide > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / longestSide;
        width = Math.round(srcW * scale);
        height = Math.round(srcH * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      // High-quality downscaling — avoids the aliasing/moiré the default
      // drawImage produces when shrinking significantly.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // White background so transparent PNG/WebP doesn't go black in JPEG.
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

          const newName = file.name.replace(/\.[^.]+$/, ".jpg");

          const compressedFile = new File([blob], newName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          console.log("Image converted/compressed:", {
            original: file.name,
            originalType: file.type,
            originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            originalDims: `${srcW}×${srcH}`,
            output: compressedFile.name,
            outputType: compressedFile.type,
            outputSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
            outputDims: `${width}×${height}`,
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.error("Could not load image:", file.name);
      resolve(file);
    };

    img.src = url;
  });
}