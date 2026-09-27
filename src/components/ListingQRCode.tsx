// src/components/ListingQRCode.tsx
import { SetStateAction, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface ListingQRCodeProps {
  /** The URL encoded into the QR. */
  url: string;
  /** Displayed size in CSS pixels (QR is rendered @2x for retina). */
  size?: number;
  /** Optional filename when the user downloads it. */
  filename?: string;
  isAr?: boolean;
}

export default function ListingQRCode({
  url,
  size = 140,
  filename = "listing-qr.png",
  isAr = false,
}: ListingQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 2, // 2× for retina screens
      color: {
        dark: "#1a1a2e",   // match your dark navy
        light: "#ffffff",
      },
    })
      .then((data: SetStateAction<string>) => {
        if (cancelled) return;
        setDataUrl(data);

        // Also paint to the canvas so users can right-click → Save Image
        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, url, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: size * 2,
            color: { dark: "#1a1a2e", light: "#ffffff" },
          }).catch(() => {
            /* canvas fallback failed — dataUrl is still available */
          });
        }
      })
      .catch((err: any) => {
        console.error("QR generation failed:", err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert(isAr ? "تم نسخ الرابط" : "Link copied");
    } catch {
      // clipboard might be blocked — fall back to prompt
      window.prompt(isAr ? "انسخ الرابط:" : "Copy the link:", url);
    }
  };

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-black/10 bg-[#fafaf8] text-[11px] text-[#999]"
        style={{ width: size, height: size }}
      >
        {isAr ? "تعذر إنشاء رمز QR" : "Could not generate QR"}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="bg-white p-2 rounded-xl border border-black/10 shadow-sm"
        style={{ width: size + 16, height: size + 16 }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={isAr ? "رمز QR للقائمة" : "Listing QR code"}
            width={size}
            height={size}
            className="block rounded-md"
          />
        ) : (
          <div
            className="animate-pulse bg-[#f1f1ee] rounded-md"
            style={{ width: size, height: size }}
          />
        )}
        {/* Hidden canvas is kept for right-click → Save Image */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!dataUrl}
          className="text-[10px] text-[#555] bg-transparent border border-black/10 rounded-md px-2 py-1 cursor-pointer hover:border-black/30 disabled:opacity-50"
        >
          ⬇ {isAr ? "تنزيل" : "Download"}
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="text-[10px] text-[#555] bg-transparent border border-black/10 rounded-md px-2 py-1 cursor-pointer hover:border-black/30"
        >
          🔗 {isAr ? "نسخ الرابط" : "Copy link"}
        </button>
      </div>
    </div>
  );
}