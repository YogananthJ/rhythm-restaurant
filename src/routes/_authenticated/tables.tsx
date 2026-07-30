import { Illustration } from "@/components/Illustration";
import qrIllustration from "@/assets/illus-qr.jpg";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, Printer, QrCode } from "lucide-react";

type Table = {
  id: string;
  label: string;
  seats: number;
  status: string;
  qr_token: string;
};

export const Route = createFileRoute("/_authenticated/tables")({
  head: () => ({
    meta: [
      { title: "Table QR codes — Occupancy" },
      { name: "description", content: "Print-ready QR codes that link guests to your live menu." },
      { property: "og:title", content: "Table QR codes — Occupancy" },
      { property: "og:description", content: "One tap from a table to a live, real-time menu." },
    ],
  }),
  component: TablesPage,
});

function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function load() {
    const { data } = await supabase.from("dining_tables").select("*").order("label");
    if (data) setTables(data as Table[]);
  }

  function urlFor(t: Table) {
    return `${origin}/t/${t.qr_token}`;
  }

  async function copyLink(t: Table) {
    await navigator.clipboard.writeText(urlFor(t));
    toast.success(`Copied link for ${t.label}`);
  }

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />

      <header className="relative z-10 border-b border-white/10 bg-background/70 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Floor</Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <QrCode className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">Table QR codes</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Print & place on each table</div>
              </div>
            </div>
          </div>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="mr-1.5 h-4 w-4" /> Print all
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 print:px-0 print:py-0">
        <Illustration
          src={qrIllustration}
          alt="Illustration of a guest scanning a QR code at a restaurant table"
          width={1024}
          height={768}
          className="mb-8 max-h-64 print:hidden"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4">
          {tables.map((t) => (
            <Card
              key={t.id}
              className="flex flex-col items-center gap-4 border-white/10 bg-card/70 p-6 text-center backdrop-blur print:break-inside-avoid print:border print:border-neutral-200 print:bg-white print:text-black"
            >
              <div className="flex w-full items-center justify-between text-xs text-muted-foreground print:text-neutral-500">
                <Badge variant="outline" className="border-primary/30 text-primary print:border-neutral-300 print:text-neutral-700">
                  {t.label}
                </Badge>
                <span>{t.seats} seats</span>
              </div>
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={urlFor(t)} size={192} level="M" />
              </div>
              <div>
                <div className="text-lg font-semibold">Scan to order</div>
                <div className="text-xs text-muted-foreground print:text-neutral-500">
                  Live menu · pay at the table
                </div>
              </div>
              <div className="flex w-full items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => void copyLink(t)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={urlFor(t)} target="_blank" rel="noreferrer">Open</a>
                </Button>
              </div>
            </Card>
          ))}
          {tables.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">No tables yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
