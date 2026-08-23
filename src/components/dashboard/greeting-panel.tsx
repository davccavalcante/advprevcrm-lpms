import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { officeProfile } from "@/lib/office-profile";
import { deadlineOverview } from "@/lib/persona";

const DONUT_SIZE = 240;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_STROKE = 16;
const DONUT_RADIUS = 84;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

type DonutSegment = {
  id: string;
  label: string;
  value: number;
  colorVar: string;
};

/*
 * The active case count is passed in, never read from the fixture, because it
 * has to be the same number the Casos screen lists. Everything else on this
 * panel is demonstration data and says so.
 */
export async function GreetingPanel({
  activeCaseCount,
}: {
  activeCaseCount: number;
}) {
  const profile = await officeProfile();
  const segments: DonutSegment[] = [
    {
      id: "confirmed",
      label: "Confirmados",
      value: deadlineOverview.confirmed,
      colorVar: "var(--brand)",
    },
    {
      id: "calculated",
      label: "Calculados",
      value: deadlineOverview.calculated,
      colorVar: "var(--brand-muted)",
    },
    {
      id: "critical",
      label: "Críticos",
      value: deadlineOverview.critical,
      colorVar: "var(--text-inverse)",
    },
  ];
  const total = deadlineOverview.total;
  const confirmedShare = Math.round((deadlineOverview.confirmed / total) * 100);

  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = (segment.value / total) * DONUT_CIRCUMFERENCE;
    const arc = { ...segment, length, offset };
    offset += length;
    return arc;
  });

  return (
    <section
      aria-label="Resumo do advogado"
      className="flex h-fit flex-col gap-8 rounded-xl bg-panel p-8 text-ink-inverse shadow-panel"
    >
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl leading-tight font-bold">
          Olá, {profile.firstName}!
          <span className="block font-light text-ink-inverse-soft">
            Acompanhe seus prazos
          </span>
        </h1>
        <p className="text-sm leading-relaxed text-ink-inverse-soft">
          Triagem, extração e alertas assistidos pela Inteligência Massiva (IM),
          sempre sob a sua revisão e aprovação registrada.
        </p>
      </div>

      <Link
        href="/agenda"
        aria-label={`Prazos da semana, ${deadlineOverview.confirmed} confirmados, ${deadlineOverview.calculated} calculados e ${deadlineOverview.critical} críticos, abrir na Agenda`}
        className="-m-2 cursor-pointer rounded-lg p-2 transition-colors duration-(--motion-fast) hover:bg-ink-inverse/10"
      >
        <figure className="flex flex-col items-center gap-6">
          <div className="relative w-full max-w-80">
            <svg
              role="img"
              aria-label={`Prazos da semana: ${deadlineOverview.confirmed} confirmados, ${deadlineOverview.calculated} calculados e ${deadlineOverview.critical} críticos, em um total de ${total}`}
              viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
              className="block h-auto w-full"
            >
              <title>Distribuição dos prazos da semana</title>
              <circle
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
                fill="none"
                stroke="var(--text-inverse)"
                strokeOpacity="0.16"
                strokeWidth={DONUT_STROKE}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.id}
                  cx={DONUT_CENTER}
                  cy={DONUT_CENTER}
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={arc.colorVar}
                  strokeWidth={DONUT_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${arc.length} ${DONUT_CIRCUMFERENCE - arc.length}`}
                  strokeDashoffset={-arc.offset}
                  transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}
                />
              ))}
            </svg>
            {/* Kept outside the SVG so the ring scales with the panel while the
            type stays exactly on the token scale instead of scaling with the
            viewBox. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1"
            >
              <p className="text-3xl font-bold text-ink-inverse">
                {confirmedShare}%
              </p>
              <p className="text-xs font-medium text-ink-inverse-soft">
                {deadlineOverview.confirmed} de {total} confirmados
              </p>
            </div>
          </div>
          <figcaption className="w-full">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {segments.map((segment) => (
                <div key={segment.id} className="flex flex-col gap-1">
                  <dt className="inline-flex items-center justify-center gap-1.5 text-xs text-ink-inverse-soft">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: segment.colorVar }}
                    />
                    {segment.label}
                  </dt>
                  <dd className="text-xl font-bold">{segment.value}</dd>
                </div>
              ))}
            </dl>
          </figcaption>
        </figure>
      </Link>

      <div className="flex items-end justify-between border-t border-ink-inverse-soft/30 pt-6">
        <Link
          href="/clientes"
          aria-label={`Casos ativos, ${activeCaseCount} casos, abrir em Clientes`}
          className="-m-2 cursor-pointer rounded-lg p-2 transition-colors duration-(--motion-fast) hover:bg-ink-inverse/10"
        >
          <p className="text-xs font-semibold tracking-wide text-ink-inverse-soft uppercase">
            Casos ativos
          </p>
          <p className="text-5xl leading-none font-bold">
            {activeCaseCount}
            <span className="ml-2 text-base font-medium text-ink-inverse-soft">
              casos
            </span>
          </p>
        </Link>
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-3 border-t border-ink-inverse-soft/30 pt-6">
        <Avatar
          name={profile.fullName}
          photoSrc={profile.avatarSrc}
          size="lg"
        />
        <div className="min-w-0 flex-1 basis-48">
          <p className="font-semibold">{profile.fullName}</p>
          <p className="text-sm break-words text-ink-inverse-soft">
            {profile.email}
          </p>
        </div>
      </footer>
    </section>
  );
}
