"use client";

import { BookOpenText } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import type { SecondReading } from "@/lib/trinity/second-reading";
import { requestSecondReading } from "@/lib/trinity/second-reading-actions";

/*
 * The Administration asks for a second reading of the last delivered answer
 * and sees the result in place. The card is explicit about what the reading
 * is: an advisory review of the form of the answer, produced by a model on an
 * independent path, judged by deterministic evaluators, combined into a
 * consensus. It never verifies facts against the records and never decides.
 */

const OUTCOME_LABEL: Record<string, string> = {
  pass: "aprovada",
  fail: "reprovada",
  inconclusive: "inconclusiva",
};

const CONSENSUS_LABEL: Record<string, string> = {
  high: "resposta adequada",
  low: "resposta a rever",
};

const VARIANT_LABEL: Record<string, string> = {
  "concise-rubric": "rubrica enxuta",
  "detailed-rubric": "rubrica detalhada",
};

function percent(value: number): string {
  return `${Math.round(value * 100)} por cento`;
}

export function SecondReadingCard() {
  const [reading, setReading] = useState<SecondReading | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      setReading(await requestSecondReading());
    });
  };

  return (
    <section
      aria-label="Segunda leitura da última resposta"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-start gap-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-ink">
          <BookOpenText size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">
            Segunda leitura da última resposta
          </h2>
          <p className="text-sm text-ink-soft">
            Um segundo modelo, por um caminho independente, avalia a forma da
            última resposta entregue: clareza, fundamentação declarada e cuidado
            jurídico. A leitura não confere os registros do escritório e não
            decide nada; ela é registrada no livro de consumo como qualquer
            troca.
          </p>
        </div>
      </header>

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-card transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Leitura em andamento..." : "Pedir segunda leitura"}
      </button>

      {reading !== null && !reading.ok ? (
        <p className="rounded-md bg-inset px-4 py-3 text-sm text-ink">
          {reading.reason}
        </p>
      ) : null}

      {reading?.ok ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-soft">
            {`Leitura produzida por ${reading.reviewerModel ?? "modelo não identificado"}, ${reading.tokensIn.toLocaleString("pt-BR")} tokens de entrada e ${reading.tokensOut.toLocaleString("pt-BR")} de saída, sobre a resposta entregue em ${reading.reviewedAnswerAt ?? "data não registrada"}.`}
          </p>

          {reading.reviewText !== null ? (
            <p className="rounded-md bg-inset px-4 py-3 text-sm whitespace-pre-wrap text-ink">
              {reading.reviewText}
            </p>
          ) : null}

          <ul className="flex flex-col divide-y divide-line">
            {reading.grades.length > 0 ? (
              <li className="flex flex-col gap-0.5 py-2.5">
                <p className="text-xs font-bold text-ink">Notas do revisor</p>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {reading.grades
                    .map((grade) => `${grade.label}: ${grade.value} de 10`)
                    .join("; ")}
                  {reading.overall !== null
                    ? `; leitura geral ${reading.overall}`
                    : ""}
                  .
                </p>
              </li>
            ) : null}
            {reading.tribunal !== null ? (
              <li className="flex flex-col gap-0.5 py-2.5">
                <p className="text-xs font-bold text-ink">
                  Avaliação determinística da leitura
                </p>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {`A leitura foi ${OUTCOME_LABEL[reading.tribunal.outcome] ?? reading.tribunal.outcome} pelos avaliadores, com pontuação de ${percent(reading.tribunal.score)} e ${reading.tribunal.findings === 1 ? "1 apontamento" : `${reading.tribunal.findings} apontamentos`}.`}
                </p>
              </li>
            ) : null}
            {reading.consensus !== null ? (
              <li className="flex flex-col gap-0.5 py-2.5">
                <p className="text-xs font-bold text-ink">
                  Consenso dos avaliadores
                </p>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {`${reading.consensus.agreement > 0.5 ? (CONSENSUS_LABEL[reading.consensus.label] ?? reading.consensus.label) : "Sem consenso, os avaliadores divergiram"}, com concordância de ${percent(reading.consensus.agreement)} entre ${reading.consensus.votes} ${reading.consensus.votes === 1 ? "avaliador" : "avaliadores"}${reading.raterAgreementMeasured ? "; o modelo de confiabilidade dos avaliadores já convergiu sobre as leituras acumuladas" : ""}.`}
                </p>
              </li>
            ) : null}
            {reading.experiment !== null ? (
              <li className="flex flex-col gap-0.5 py-2.5">
                <p className="text-xs font-bold text-ink">
                  Experimento de rubrica
                </p>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {`Esta leitura usou a ${VARIANT_LABEL[reading.experiment.variant] ?? reading.experiment.variant}. ${reading.experiment.report
                    .map((entry) =>
                      entry.trials === 0
                        ? `${VARIANT_LABEL[entry.variant] ?? entry.variant}: ainda sem uso`
                        : `${VARIANT_LABEL[entry.variant] ?? entry.variant}: ${entry.trials} ${entry.trials === 1 ? "uso" : "usos"}, taxa esperada de leitura analisável de ${percent(entry.mean)}`,
                    )
                    .join("; ")}.`}
                </p>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-ink-soft">
        O revisor recebe apenas a pergunta e a resposta, nunca os registros, e o
        mesmo teto de consumo das perguntas governa a leitura. Conteúdo
        assistido pela Inteligência Massiva (IM) e sujeito à revisão do advogado
        humano.
      </p>
    </section>
  );
}
