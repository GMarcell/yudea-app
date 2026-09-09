import Link from "next/link";
import { ArrowLeft, Church, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-border/50" />
      </div>

      <section
        aria-labelledby="not-found-title"
        className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-300"
      >
        <div className="rounded-[2rem] border border-border/70 bg-card/90 p-6 text-center shadow-2xl shadow-primary/10 backdrop-blur sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Church className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="mx-auto mt-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/20 text-4xl font-bold tracking-tight text-accent-foreground">
            404
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            GPIB Yudea
          </p>
          <h1
            id="not-found-title"
            className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Halaman tidak ditemukan
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
            Halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau
            alamatnya tidak tepat.
          </p>

          <Button asChild className="mt-8 h-11 gap-2 px-5">
            <Link href="/public/login">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali ke login
            </Link>
          </Button>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pastikan alamat halaman sudah benar</span>
          </div>
        </div>
      </section>
    </main>
  );
}
