import { ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { transportSnapshot } from "@/lib/trinity/model-transport";
import { officeDay, readDay } from "@/lib/trinity/spend-ledger";

/*
 * Where the office sees which models answer for David and how the choice
 * between them is going. Everything here is read from the transport in the
 * running process and from the ledger of the day: the models in the pool, the
 * circuit of each, how many keys each provider holds, and how many answers of
 * today each model produced. No key value is ever shown, and no cost in money
 * is estimated when the office has not configured a price.
 */

const CIRCUIT_LABEL: Record<string, string> = {
  closed: "Em operação",
  "half-open": "Em teste após falhas",
  open: "Suspenso por falhas",
};

const PROVIDER_LABEL = {
  anthropic: "Anthropic",
  gemini: "Google Gemini",
} as const;

function percent(value: number): string {
  return `${Math.round(value * 100)} por cento`;
}

export async function TransportCard() {
  const snapshot = transportSnapshot();
  const today = await readDay(officeDay(new Date()));
  const answersByModel = new Map<string, number>();
  for (const entry of today) {
    if (entry.outcome === "answered") {
      answersByModel.set(
        entry.model,
        (answersByModel.get(entry.model) ?? 0) + 1,
      );
    }
  }

  return (
    <section
      aria-label="Modelos que respondem por David"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-start gap-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-ink">
          <ShareNetwork size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">
            Modelos que respondem por David
          </h2>
          <p className="text-sm text-ink-soft">
            O Gemini responde por padrão e o Claude assume automaticamente
            quando nenhuma chave do Gemini funciona. Cada resposta registra o
            modelo que a produziu, e a qualidade e a latência de cada um são
            medidas de forma calibrada a cada chamada.
          </p>
        </div>
      </header>

      <p className="rounded-md bg-inset px-4 py-3 text-sm text-ink">
        {snapshot.config.reason}
      </p>

      <ul className="flex flex-col divide-y divide-line">
        {snapshot.models.map((model) => {
          const routing = snapshot.routing.find(
            (entry) => entry.model === model.id,
          );
          const answers = answersByModel.get(model.id) ?? 0;
          return (
            <li key={model.id} className="flex flex-col gap-1.5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold text-ink">
                  {model.id}
                  <span className="ml-2 text-xs font-semibold text-ink-soft">
                    {PROVIDER_LABEL[model.provider]}
                  </span>
                </p>
                <span className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-bold text-ink">
                  {CIRCUIT_LABEL[model.circuitState] ?? model.circuitState}
                </span>
              </div>
              <p className="text-xs text-ink-soft">
                {answers === 1
                  ? "1 resposta hoje"
                  : `${answers} respostas hoje`}
                , {snapshot.keys[model.provider]}{" "}
                {snapshot.keys[model.provider] === 1
                  ? "chave no conjunto"
                  : "chaves no conjunto"}
                {routing !== undefined && routing.pulls > 0
                  ? `, qualidade observada de ${percent(routing.quality)} em ${routing.pulls} ${routing.pulls === 1 ? "chamada" : "chamadas"}, latência média de ${Math.round(routing.latencyMs)} ms`
                  : ", ainda sem chamada observada neste processo"}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-soft">
        As chaves de cada provedor são rotacionadas automaticamente; uma chave
        recusada é isolada e uma chave com limite atingido cede a vez, sem que
        nenhuma pergunta se perca. Nenhum valor de chave aparece nesta tela.
      </p>
    </section>
  );
}
