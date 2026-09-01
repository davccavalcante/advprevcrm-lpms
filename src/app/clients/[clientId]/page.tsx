import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { StoredClientRecord } from "@/components/records/stored-client-record";
import { GovernanceNote } from "@/components/ui/governance-note";
import { listCasesOfClient, readClient } from "@/lib/records-store";

export async function generateMetadata({
  params,
}: PageProps<"/clients/[clientId]">): Promise<Metadata> {
  const { clientId } = await params;
  const stored = await readClient(clientId);
  return {
    title: stored ? `${stored.fullName}, Advprev CRM` : "Cliente, Advprev CRM",
  };
}

/*
 * A client of this office and nothing else. There is one source, the record the
 * office registered; an identifier that matches no record is not found, and no
 * example is served in its place.
 */
export default async function ClientRecordPage({
  params,
}: PageProps<"/clients/[clientId]">) {
  const { clientId } = await params;
  const stored = await readClient(clientId);
  if (!stored) {
    notFound();
  }
  const cases = await listCasesOfClient(clientId);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="clients" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <StoredClientRecord client={stored} cases={cases} />
      </main>
      <GovernanceNote>
        Dois pedidos distintos do mesmo cliente nunca se misturam: cada
        benefício ou ação é um caso independente, com prazos, documentos e
        financeiro próprios.
      </GovernanceNote>
    </div>
  );
}
