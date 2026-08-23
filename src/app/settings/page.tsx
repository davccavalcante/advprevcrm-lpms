import { Lock } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { DashboardFilterProvider } from "@/components/dashboard/dashboard-filter";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { IntelligenceCard } from "@/components/settings/intelligence-card";
import { PanelSectionsCard } from "@/components/settings/panel-sections-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { SecondReadingCard } from "@/components/settings/second-reading-card";
import { SpendCard } from "@/components/settings/spend-card";
import { TransportCard } from "@/components/settings/transport-card";
import { GovernanceNote } from "@/components/ui/governance-note";
import { officeProfile, PASSWORD_MIN_CHARS } from "@/lib/office-profile";
import { currentSession } from "@/lib/trinity/nhe-actions";

export const metadata: Metadata = {
  title: "Configurações, Advprev CRM",
};

/* The consumption panel reads the ledger on disk at every request, so this
 * screen is never a snapshot taken at build time. */
export const dynamic = "force-dynamic";

/*
 * Only what the interface really governs today appears as a control. Everything
 * that depends on the database, on authentication or on the director's pending
 * decisions is stated as text, never as a switch that does nothing.
 */
const pendingSettings = [
  {
    id: "users",
    label: "Usuários, times e permissões",
    detail:
      "A regra de acesso vive no banco, com row level security, e a interface apenas a reflete. A gestão pertence à Administração e depende do módulo de autenticação.",
  },
  {
    id: "catalogs",
    label: "Catálogos e parâmetros",
    detail:
      "Calendário de feriados por tribunal, tabelas de prazo, limites de alçada e percentuais de honorários são registros com fonte e data, nunca valores fixos no código.",
  },
  {
    id: "channels",
    label: "Canais de comunicação e notificação",
    detail:
      "A integração oficial de mensageria e o canal de entrada de documentos do cliente final são decisões ainda pendentes da direção.",
  },
  {
    id: "retention",
    label: "Retenção e descarte de dados",
    detail:
      "Os prazos de retenção e o descarte ao final do prazo legal são política registrada, aplicada no banco e auditada, não uma preferência de tela.",
  },
];

export default async function SettingsPage() {
  const session = await currentSession();
  const profile = await officeProfile();

  return (
    <DashboardFilterProvider>
      <div className="flex min-h-dvh w-full flex-col bg-page">
        <TopNav activeId="settings" />
        <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
          <MotionReveal order={0}>
            <header className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                Configurações
              </h1>
              <p className="text-sm text-ink-soft">
                Preferências individuais desta conta. Nada aqui altera dado de
                caso, permissão ou prazo.
              </p>
            </header>
          </MotionReveal>

          <div className="grid gap-6 xl:grid-cols-2">
            <MotionReveal order={1} className="flex min-w-0 flex-col gap-6">
              <ProfileCard
                initial={profile}
                passwordMinChars={PASSWORD_MIN_CHARS}
              />

              <AppearanceCard />

              {/* Cost is the Administration's business, and only it sees the
               * office's total. A lawyer sees his own consumption in the
               * record of his conversation, never the spend of the others. */}
              {session.role === "admin" ? <SpendCard /> : null}
              {session.role === "admin" ? <TransportCard /> : null}
            </MotionReveal>

            <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
              <PanelSectionsCard />

              {/* The observation of the IM layer and the second reading are
               * the Administration's business, like the spend and the
               * transport. */}
              {session.role === "admin" ? <SecondReadingCard /> : null}
              {session.role === "admin" ? <IntelligenceCard /> : null}

              <section
                aria-label="Configurações que não vivem nesta tela"
                className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
              >
                <header className="flex items-center gap-2.5">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
                    <Lock size={18} weight="bold" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      Fora do alcance desta tela
                    </h2>
                    <p className="text-sm text-ink-soft">
                      Listado aqui de propósito, para que ninguém procure o que
                      não existe.
                    </p>
                  </div>
                </header>
                <ul className="flex flex-col divide-y divide-line">
                  {pendingSettings.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                    >
                      <p className="text-sm font-bold text-ink">
                        {entry.label}
                      </p>
                      <p className="text-xs leading-relaxed text-ink-soft">
                        {entry.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </MotionReveal>
          </div>
        </main>
        <GovernanceNote>
          Preferência de tela é individual e não altera regra de acesso, que é
          aplicada no banco e auditada.
        </GovernanceNote>
      </div>
    </DashboardFilterProvider>
  );
}
