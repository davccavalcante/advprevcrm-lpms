import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { ClientForm } from "@/components/records/client-form";
import { GovernanceNote } from "@/components/ui/governance-note";

export const metadata: Metadata = {
  title: "Novo cliente, Advprev CRM",
};

export default function NewClientPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="clients" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <div className="flex flex-col gap-3">
            <Link
              href="/clientes"
              className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
              Voltar para clientes
            </Link>
            <header className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                Novo cliente
              </h1>
              <p className="text-sm text-ink-soft">
                O cadastro é feito pelo advogado ou pela equipe autorizada. O
                cliente não acessa o sistema em momento algum.
              </p>
            </header>
          </div>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-label="Dados civis do cliente"
            className="flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card"
          >
            <ClientForm />
          </section>
        </MotionReveal>
      </main>
      <GovernanceNote>
        Depois de cadastrado o cliente, cada benefício ou ação vira um caso
        independente, com esfera, documentos, prazos e financeiro próprios.
      </GovernanceNote>
    </div>
  );
}
