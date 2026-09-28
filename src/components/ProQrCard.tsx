import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publicProUrl } from "@/lib/pro-card";

/** QR code pointant uniquement vers l'adresse publique /professionnels/[slug]. */
export function ProQrCard({ slug, name, published }: { slug: string; name: string; published: boolean }) {
  const url = publicProUrl(slug);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    void QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" }).then(setDataUrl);
  }, [url]);

  const download = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${slug}.png`;
    a.click();
  };

  const print = () => {
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { toast.error("Autorisez les fenêtres pour imprimer."); return; }
    w.document.write(`<!doctype html><html lang="fr"><head><title>Carte ${name}</title>
      <style>body{font-family:Georgia,serif;display:flex;justify-content:center;padding:24px}
      .card{border:2px solid #6b1d2a;border-radius:16px;padding:24px;text-align:center;width:320px}
      h1{font-size:20px;margin:0 0 4px}p{font-size:12px;color:#333;margin:4px 0}img{width:220px;height:220px}</style></head>
      <body><div class="card"><p>La Voix du Chien — carte professionnelle</p><h1>${name.replace(/</g, "&lt;")}</h1>
      <img src="${dataUrl}" alt="QR code"/><p>${url}</p></div>
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="panel flex flex-col items-center gap-3 p-5 text-center">
      {dataUrl ? (
        <img src={dataUrl} alt={`QR code vers la carte publique de ${name}`} className="size-48 rounded-md bg-card" />
      ) : (
        <div className="size-48 animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      <p className="break-all text-xs text-muted-foreground">{url}</p>
      {!published ? (
        <p className="text-xs text-destructive">
          La carte n'est pas encore publiée : le QR code affichera « Carte introuvable » tant que le Bureau ne l'a pas validée.
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Adresse copiée."))}>
          <Copy className="size-4" aria-hidden /> Copier l'adresse
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={download} disabled={!dataUrl}>
          <Download className="size-4" aria-hidden /> Télécharger
        </Button>
        <Button size="sm" className="gap-2" onClick={print} disabled={!dataUrl}>
          <Printer className="size-4" aria-hidden /> Imprimer
        </Button>
      </div>
    </div>
  );
}
