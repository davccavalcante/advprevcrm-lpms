import type { Metadata } from "next";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseTrack } from "@/components/tasks/case-track";
import { WorkBoard } from "@/components/tasks/work-board";
import { GovernanceNote } from "@/components/ui/governance-note";
import { buildTasksBoard } from "@/lib/tasks-board";

export const metadata: Metadata = {
  title: "Tarefas, Advprev CRM",
};

export const dynamic = "force-dynamic";

/*
 * The Tarefas screen: the whole situation of the logged lawyer read as two
 * boards. It is a reading surface, never a manager: no state changes here, and
 * every card leads to the screen that owns the record, where the decision
 * happens and is audited.
 */
export default async function TasksPage() {
  const board = await buildTasksBoard();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="tasks" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Tarefas
            </h1>
            <p className="text-sm text-ink-soft">
              A situação inteira dos seus casos em um quadro de leitura: o que
              chegou, o que só você decide, o que está aberto, em andamento,
              aguardando terceiros e concluído, mais a trilha de cada caso. Nada
              aqui é editável: cada cartão leva à tela responsável, onde a ação
              acontece e é registrada.
            </p>
          </header>
        </MotionReveal>

        <MotionReveal order={1}>
          <WorkBoard columns={board.workColumns} />
        </MotionReveal>

        <MotionReveal order={2}>
          <CaseTrack columns={board.trackColumns} caseTotal={board.caseTotal} />
        </MotionReveal>
      </main>
      <GovernanceNote>
        Quadro de leitura, sem edição: confirmar prazo, validar documento,
        vincular processo e concluir tarefa são atos do advogado, feitos na tela
        responsável e registrados em auditoria. A triagem e os alertas são
        assistidos pela Inteligência Massiva (IM) e a palavra final é sempre
        sua.
      </GovernanceNote>
    </div>
  );
}
