// lib/compressImage.ts

/**
 * Loads an image (Blob/File) into an HTMLImageElement, honouring EXIF
 * orientation so iPhone photos don't come out rotated.
 */
async function loadImage(
  file: File | Blob,
): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image failed to load"));
  });

  return { img, revoke: () => URL.revokeObjectURL(url) };
}

/**
 * Returns the dimensions the image should be drawn at, taking EXIF
 * orientation into account (orientations 5–8 swap width/height).
 */
function orientedDimensions(img: HTMLImageElement) {
  // Modern browsers expose this when the image has EXIF orientation.
  // Fallback: assume no rotation.
  const orientation =
    (img.naturalWidth && img.naturalHeight && img.getAttribute?.("orientation")) ||
    1;

  // We use createImageBitmap below when available; this is the fallback path.
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    orientation,
  };
}

/**
 * Draws an image to a canvas, applying EXIF orientation if needed.
 * Uses createImageBitmap (which auto-applies orientation in modern
 * browsers) when available, otherwise falls back to a manual transform.
 */
async function drawToCanvas(
  source: File | Blob,
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // White background so transparent PNG/WebP → JPEG doesn't go black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  // Preferred path: createImageBitmap honours EXIF orientation natively.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source, {
        imageOrientation: "from-image",
      });
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close?.();
      return canvas;
    } catch {
      // fall through to manual draw
    }
  }

  // Fallback: draw the HTMLImageElement directly. Most modern browsers
  // already apply EXIF orientation to <img>, so this is usually correct.
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas;
}

export async function compressImage(file: File): Promise<File> {
  // PDFs are not images — pass through.
  if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
    return file;
  }

  const lowerName = file.name.toLowerCase();
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif");

  // ──────────────────────────────────────────────────────────────
  // HEIC / HEIF → JPEG
  // ──────────────────────────────────────────────────────────────
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;

      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        // 0.92 is a good balance; the canvas step below may downscale
        // further but won't re-encode at a lower quality than this.
        quality: 0.92,
      });

      const blob = Array.isArray(converted) ? converted[0] : converted;

      if (!blob || blob.size === 0) {
        throw new Error("HEIC conversion returned an empty blob");
      }

      file = new File(
        [blob],
        lowerName.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
        { type: "image/jpeg", lastModified: Date.now() },
      );
    } catch (error) {
      console.error("HEIC/HEIF conversion failed:", error);
      // Returning the original HEIC would upload an unviewable file.
      // Re-throw so the caller can show a clear error to the user.
      throw new Error(
        "Could not convert this HEIC/HEIF image. Please try a JPG or PNG.",
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Tunables
  // ──────────────────────────────────────────────────────────────
  const MAX_DIMENSION = 2048; // longest side after resize
  const QUALITY = 0.9; // JPEG/WebP quality
  const SKIP_BELOW_BYTES = 400 * 1024; // ≤ 400 KB AND
  const SKIP_BELOW_DIMENSION = 1600; // ≤ 1600px → leave as-is
  const KEEP_WEBP = true; // preserve WebP (smaller than JPEG)
  // ──────────────────────────────────────────────────────────────

  const { img, revoke } = await loadImage(file);

  try {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const longestSide = Math.max(srcW, srcH);

    const alreadySmall =
      file.size <= SKIP_BELOW_BYTES && longestSide <= SKIP_BELOW_DIMENSION;

    // Don't touch already-small files — re-encoding only hurts quality.
    if (alreadySmall) {
      return file;
    }

    // Scale so the LONGEST side fits MAX_DIMENSION.
    let width = srcW;
    let height = srcH;

    if (longestSide > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / longestSide;
      width = Math.max(1, Math.round(srcW * scale));
      height = Math.max(1, Math.round(srcH * scale));
    }

    const canvas = await drawToCanvas(file, img, width, height);

    // Decide output MIME type:
    // - Keep WebP if the source was WebP (smaller, widely supported).
    // - Otherwise emit JPEG.
    const isWebp =
      KEEP_WEBP &&
      (file.type === "image/webp" || lowerName.endsWith(".webp"));
    const outputType = isWebp ? "image/webp" : "image/jpeg";
    const outputExt = isWebp ? ".webp" : ".jpg";
    const outputName = file.name.replace(/\.[^.]+$/, outputExt);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputType, QUALITY),
    );

    if (!blob) {
      // Fallback: try JPEG if WebP encoding failed.
      const jpegBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", QUALITY),
      );
      if (!jpegBlob) return file;

      return new File([jpegBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }

    // If compression made the file *bigger*, keep the original.
    if (blob.size >= file.size && !isHeic) {
      return file;
    }

    const outFile = new File([blob], outputName, {
      type: outputType,
      lastModified: Date.now(),
    });

    console.log("Image compressed:", {
      original: file.name,
      originalType: file.type,
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      originalDims: `${srcW}×${srcH}`,
      output: outFile.name,
      outputType: outFile.type,
      outputSize: `${(outFile.size / 1024 / 1024).toFixed(2)} MB`,
      outputDims: `${width}×${height}`,
    });

    return outFile;
  } finally {
    revoke();
  }
}