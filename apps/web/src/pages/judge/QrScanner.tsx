import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ID = "judge-qr-scanner";

/** Parses either a bare table number ("7") or a prefixed QR payload
 * ("TASTEOFBLOOM-TABLE-7") into a table number. */
export const parseTableQr = (text: string): number | null => {
  const match = text.trim().match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
};

export function QrScanner({ onResult, onClose }: { onResult: (tableNumber: number) => void; onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          const table = parseTableQr(decodedText);
          if (table && !stopped) {
            stopped = true;
            scanner
              .stop()
              .catch(() => {})
              .finally(() => onResult(table));
          }
        },
        () => {
          // ignore per-frame decode misses
        }
      )
      .catch(() => {
        onClose();
      });

    return () => {
      if (!stopped) {
        scanner.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div id={SCANNER_ID} className="w-full overflow-hidden rounded-2xl border" />
      <p className="text-xs text-muted-foreground">Point your camera at the table's QR code.</p>
    </div>
  );
}
