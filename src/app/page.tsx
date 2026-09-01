import { ActivityChart } from "@/components/dashboard/activity-chart";
import { BenefitBreakdown } from "@/components/dashboard/benefit-breakdown";
import { CaptureHealth } from "@/components/dashboard/capture-health";
import { CriticalDeadlines } from "@/components/dashboard/critical-deadlines";
import {
  DashboardFilterProvider,
  DashboardGroup,
  DashboardSection,
} from "@/components/dashboard/dashboard-filter";
import { FinanceCard } from "@/components/dashboard/finance-card";
import { GrantRates } from "@/components/dashboard/grant-rates";
import { GreetingPanel } from "@/components/dashboard/greeting-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PhaseBreakdown } from "@/components/dashboard/phase-breakdown";
import { RiskAlerts } from "@/components/dashboard/risk-alerts";
import { TasksCard } from "@/components/dashboard/tasks-card";
import { TopNav } from "@/components/dashboard/top-nav";
import { WeeklyAgenda } from "@/components/dashboard/weekly-agenda";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { GovernanceNote } from "@/components/ui/governance-note";
import { dailyPublications } from "@/lib/capture/board-data";
import {
  activeCases,
  deadlineSummary,
  listUnifiedCases,
} from "@/lib/case-views";
import { kpis } from "@/lib/persona";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cases = await listUnifiedCases();
  const activeCaseCount = activeCases(cases).length;
  const deadlines = deadlineSummary(cases);
  const activity = await dailyPublications(14);

  return (
    <DashboardFilterProvider>
      <div className="flex min-h-dvh w-full flex-col bg-page">
        <TopNav />
        <main className="grid w-full flex-1 gap-6 px-6 pb-8 lg:grid-cols-(--layout-panel-columns) lg:px-10">
          <MotionReveal order={0} className="h-full min-w-0">
            <GreetingPanel
              activeCaseCount={activeCaseCount}
              deadlines={deadlines}
            />
          </MotionReveal>
          <div className="flex min-w-0 flex-col gap-6">
            <DashboardSection id="kpis">
              <MotionReveal order={1}>
                <section
                  aria-labelledby="kpis-heading"
                  className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <h2 className="sr-only" id="kpis-heading">
                    Indicadores da semana
                  </h2>
                  {kpis.map((entry) => (
                    <KpiCard key={entry.id} entry={entry} />
                  ))}
                </section>
              </MotionReveal>
            </DashboardSection>
            <DashboardSection id="activity">
              <MotionReveal order={2}>
                <ActivityChart activity={activity} />
              </MotionReveal>
            </DashboardSection>
            <DashboardGroup ids={["phases", "criticalDeadlines"]}>
              <MotionReveal order={3}>
                <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
                  <DashboardSection id="phases">
                    <PhaseBreakdown />
                  </DashboardSection>
                  <DashboardSection id="criticalDeadlines">
                    <CriticalDeadlines />
                  </DashboardSection>
                </div>
              </MotionReveal>
            </DashboardGroup>
            <DashboardGroup ids={["benefits", "risks"]}>
              <MotionReveal order={4}>
                <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
                  <DashboardSection id="benefits">
                    <BenefitBreakdown />
                  </DashboardSection>
                  <DashboardSection id="risks">
                    <RiskAlerts />
                  </DashboardSection>
                </div>
              </MotionReveal>
            </DashboardGroup>
            <DashboardGroup ids={["grantRates", "capture"]}>
              <MotionReveal order={5}>
                <div className="grid gap-6 xl:grid-cols-2">
                  <DashboardSection id="grantRates">
                    <GrantRates />
                  </DashboardSection>
                  <DashboardSection id="capture">
                    <CaptureHealth />
                  </DashboardSection>
                </div>
              </MotionReveal>
            </DashboardGroup>
            <DashboardGroup ids={["agenda", "tasks", "finance"]}>
              <MotionReveal order={6}>
                <div className="grid gap-6 xl:grid-cols-3">
                  <DashboardSection id="agenda">
                    <WeeklyAgenda />
                  </DashboardSection>
                  <DashboardSection id="tasks">
                    <TasksCard />
                  </DashboardSection>
                  <DashboardSection id="finance">
                    <FinanceCard />
                  </DashboardSection>
                </div>
              </MotionReveal>
            </DashboardGroup>
          </div>
        </main>
        <GovernanceNote />
      </div>
    </DashboardFilterProvider>
  );
}
