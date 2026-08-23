import { Gauge } from "@phosphor-icons/react/dist/ssr";
import {
  conversationTokenCeiling,
  costOf,
  dailyTokenCeiling,
  formatMoney,
  officeDay,
  priceTable,
  readDay,
  recentDays,
  type SpendEntry,
  usageByLawyer,
  usageOf,
} from "@/lib/trinity/spend-ledger";

/*
 * Where the office sees what the reasoning layer costs. Everything on this
 * screen is read from the ledger written at each exchange; nothing here is
 * projected, averaged or estimated. When the price per token is not configured,
 * the panel says so and shows tokens, because an invented price would be an
 * invented number on screen.
 */

const DAYS_ON_PANEL = 7;

function tokens(value: number): string {
  return value.toLocaleString("pt-BR");
}

/* One question is one question. Grammar on a screen a lawyer reads every day is
 * not a detail. */
function questionsLabel(count: number): string {
  return `${count} ${count === 1 ? "pergunta" : "perguntas"}`;
}

function dayLabel(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

function Bar({ used, ceiling }: { used: number; ceiling: number }) {
  const share = ceiling > 0 ? Math.min(1, used / ceiling) : 0;
  const percent = Math.round(share * 100);
  const tone =
    share >= 1 ? "bg-critical" : share >= 0.8 ? "bg-attention" : "bg-brand";
  return (
    <div className="flex flex-col gap-1.5">
      <div
        aria-label={`Consumo de hoje em relação ao teto diário, ${percent} por cento`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-full bg-inset"
        role="progressbar"
      >
        <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-ink-soft">
        {tokens(used)} de {tokens(ceiling)} tokens no teto diário, {percent} por
        cento.
      </p>
    </div>
  );
}

export async function SpendCard() {
  const days = recentDays(DAYS_ON_PANEL);
  const perDay: { day: string; entries: SpendEntry[] }[] = [];
  for (const day of days) {
    perDay.push({ day, entries: await readDay(day) });
  }

  const today = officeDay();
  const todayEntries =
    perDay.find((entry) => entry.day === today)?.entries ?? [];
  const usage = usageOf(todayEntries);
  const byLawyer = usageByLawyer(todayEntries);
  const price = priceTable();
  const dailyCeiling = dailyTokenCeiling();
  const conversationCeiling = conversationTokenCeiling();

  return (
    <section
      aria-label="Consumo da Inteligência Massiva"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Gauge aria-hidden size={18} weight="bold" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Consumo da Inteligência Massiva
          </h2>
          <p className="text-sm text-ink-soft">
            Medido a cada pergunta respondida, com teto por conversa e por dia
            aplicado antes de o modelo ser acionado.
          </p>
        </div>
      </header>

      <Bar ceiling={dailyCeiling} used={usage.tokens} />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-soft">Perguntas hoje</dt>
          <dd className="text-sm font-bold text-ink">{usage.questions}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Enviadas ao modelo</dt>
          <dd className="text-sm font-bold text-ink">{usage.modelCalls}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Reaproveitadas</dt>
          <dd className="text-sm font-bold text-ink">
            {usage.cacheHits}, poupando {tokens(usage.tokensSaved)} tokens
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Tokens de entrada</dt>
          <dd className="text-sm font-bold text-ink">
            {tokens(usage.tokensIn)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Tokens de saída</dt>
          <dd className="text-sm font-bold text-ink">
            {tokens(usage.tokensOut)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Barradas pelo teto</dt>
          <dd className="text-sm font-bold text-ink">
            {usage.blockedByCeiling}
          </dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-ink-soft">
        {price === null
          ? "O preço por token não está configurado nesta instalação, portanto o consumo aparece em tokens e nenhum valor em dinheiro é apresentado. Nada aqui é estimado."
          : `Gasto de hoje: ${formatMoney(usage.cost ?? 0)}, pelo preço configurado para o modelo em uso.`}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-ink">
          Consumo por advogado hoje
        </h3>
        {byLawyer.length === 0 ? (
          <p className="text-xs text-ink-soft">
            Nenhuma pergunta foi feita hoje.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {byLawyer.map((entry) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0"
                key={entry.lawyerId}
              >
                <span className="min-w-0 flex-1 basis-40 text-sm text-ink">
                  {entry.lawyerName}
                </span>
                <span className="text-xs text-ink-soft">
                  {questionsLabel(entry.questions)}, {tokens(entry.tokens)}{" "}
                  tokens
                  {entry.cost === null ? "" : `, ${formatMoney(entry.cost)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-ink">Últimos sete dias</h3>
        <ul className="flex flex-col divide-y divide-line">
          {perDay.map(({ day, entries }) => {
            const dayUsage = usageOf(entries);
            return (
              <li
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0"
                key={day}
              >
                <span className="text-sm text-ink">{dayLabel(day)}</span>
                <span className="text-xs text-ink-soft">
                  {questionsLabel(dayUsage.questions)},{" "}
                  {tokens(dayUsage.tokens)} tokens
                  {dayUsage.cost === null
                    ? ""
                    : `, ${formatMoney(dayUsage.cost)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        Tetos em vigor: {tokens(conversationCeiling)} tokens por conversa e{" "}
        {tokens(dailyCeiling)} tokens por dia, no fuso do escritório. Atingido o
        teto, a pergunta não é enviada ao modelo e o advogado recebe o aviso na
        tela. Resposta já registrada e reaproveitada não consome token e não é
        barrada.
        {price === null
          ? ""
          : ` Preço configurado: ${formatMoney(costOf(1_000_000, 0) ?? 0)} por milhão de tokens de entrada e ${formatMoney(costOf(0, 1_000_000) ?? 0)} por milhão de tokens de saída.`}
      </p>
    </section>
  );
}
