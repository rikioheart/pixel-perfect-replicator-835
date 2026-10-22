import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Lecteur caméra (caméra arrière). Utilise le détecteur natif si présent, sinon jsQR. S'arrête dès la lecture. */
export function PassScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const finish = (text: string) => {
      if (stopped) return;
      stopped = true;
      try { navigator.vibrate?.(80); } catch { /* vibration indisponible */ }
      onResultRef.current(text);
    };

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Ce navigateur ne permet pas d'utiliser la caméra. Collez ou saisissez le code.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        setError("Caméra refusée ou indisponible. Autorisez la caméra, ou collez/saisissez le code.");
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const native = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth) {
          try {
            if (native) {
              const codes = await native.detect(video);
              if (codes[0]?.rawValue) return finish(codes[0].rawValue);
            } else if (jsQR && ctx) {
              const w = Math.min(640, video.videoWidth);
              const h = Math.round((video.videoHeight / video.videoWidth) * w);
              canvas.width = w; canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const found = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (found?.data) return finish(found.data);
            }
          } catch { /* image suivante */ }
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline aria-label="Aperçu de la caméra" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="size-3/5 rounded-2xl border-4 border-primary/80" />
          </div>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Camera className="size-3" aria-hidden /> {error || "Placez le QR code du pass dans le cadre."}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onClose}><X className="size-4" aria-hidden /> Fermer la caméra</Button>
    </div>
  );
}
