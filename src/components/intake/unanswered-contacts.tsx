import { ClockCountdown } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { unansweredContacts } from "@/lib/persona";

export function UnansweredContacts() {
  return (
    <section
      id="contatos-sem-retorno"
      aria-label="Contatos sem retorno"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-attention-soft text-ink">
          <ClockCountdown size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Contatos sem retorno</h2>
          <p className="text-sm text-ink-soft">Priorize antes do fim do dia.</p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {unansweredContacts.map((contact) => (
          <li
            key={contact.id}
            className="flex items-center gap-2.5 py-3 first:pt-0 last:pb-0"
          >
            <Avatar
              name={contact.name}
              size="sm"
              {...(contact.avatarSrc ? { photoSrc: contact.avatarSrc } : {})}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{contact.name}</p>
              <p className="text-xs text-ink-soft">
                Por {contact.channelLabel}, {contact.waitingLabel}.
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-3 text-xs text-ink-soft">
        Todo contato realizado é registrado com canal, conteúdo e responsável.
      </p>
    </section>
  );
}
