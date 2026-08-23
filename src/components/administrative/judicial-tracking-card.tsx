import { Gavel } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { judicialTrackedCases } from "@/lib/persona";

export function JudicialTrackingCard() {
  return (
    <section
      id="acompanhamento-fase-judicial"
      aria-label="Acompanhamento da fase judicial"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Gavel size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Acompanhamento da fase judicial
          </h2>
          <p className="text-sm text-ink-soft">
            Leitura de contexto dos casos que migraram, sem duplicar a operação
            judicial.
          </p>
        </div>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {judicialTrackedCases.map((tracked) => (
          <li
            key={tracked.id}
            className="relative flex flex-wrap items-center gap-3 rounded-md border border-line bg-inset p-3.5 transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
          >
            <Avatar
              name={tracked.client}
              photoSrc={tracked.clientAvatarSrc}
              size="sm"
            />
            <div className="min-w-0 flex-1 basis-52">
              <p className="text-sm font-bold text-ink">
                <Link
                  href={tracked.href}
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                >
                  {tracked.client}
                  <span className="sr-only">
                    , abrir o {tracked.caseRef} em Judicial
                  </span>
                </Link>
              </p>
              <p className="text-xs text-ink-soft">
                {tracked.benefit}, {tracked.caseRef}
              </p>
              <p className="text-xs text-ink-soft">
                Processo {tracked.lawsuitNumber}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-ink">
                {tracked.phaseLabel}
              </span>
              <p className="text-xs text-ink-soft">
                {tracked.openDeadlines === 1
                  ? "1 prazo aberto"
                  : `${tracked.openDeadlines} prazos abertos`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
