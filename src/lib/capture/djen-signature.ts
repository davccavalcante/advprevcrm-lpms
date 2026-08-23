/*
 * THE SIGNATURE OF THE DJEN PUBLIC API, IN ONE PLACE.
 *
 * The Diário de Justiça Eletrônico Nacional is the source of the publications
 * and the service notices of this office, and the only one of the two public
 * APIs that searches by the registration number of a lawyer. It is where the
 * deadline is born. The DataJud never is.
 *
 * CONFIRMED AGAINST THE RUNNING SERVICE on 2026-08-12, from the office server in
 * Brazil, with every name below measured and not assumed. What the measurement
 * showed, in full, because a contract confirmed without evidence is a contract
 * nobody can check later:
 *
 * - `numeroOab` with `ufOab` filters. Asking for 289870 of São Paulo between
 *   2026-07-01 and 2026-08-12 answered 200 with `count` 52, and every act came
 *   back carrying that registration among its lawyers.
 * - The control request, with no parameter at all, answered 200 with `count`
 *   10000 and a hundred acts of Rio Grande do Sul, Santa Catarina and Minas
 *   Gerais, none of them of this office. So the filter is really applied and the
 *   answer above is not a coincidence.
 * - `dataDisponibilizacaoInicio` and `dataDisponibilizacaoFim` filter. Written as
 *   `dataInicio` and `dataFim` they are silently ignored: the same query then
 *   answered `count` 365 with acts of May, outside the window asked for.
 * - `pagina` and `itensPorPagina` paginate. Two items per page returned five
 *   distinct identifiers on page one and five other identifiers on page two,
 *   with the same total.
 * - `siglaTribunal` filters. TRF3 answered `count` 199 with every act of TRF3;
 *   TJSP answered `count` 132 with every act of TJSP.
 * - `numeroProcesso` accepts the number written with punctuation and written as
 *   twenty digits, and both answered exactly the same bytes.
 * - The whole name set written in snake case, `numero_oab`, `uf_oab`,
 *   `data_disponibilizacao_inicio` and `data_disponibilizacao_fim`, is IGNORED:
 *   the answer was byte for byte the unfiltered one. The API does not fail on an
 *   unknown parameter, it discards it, which is exactly why the control request
 *   had to exist.
 * - The certificate by code answered 200 with `application/pdf` and 60,527
 *   bytes, and the code is the field `hash` of the item.
 *
 * The response fields were read from a real act of this office, the one of
 * process 5002628-75.2026.4.03.6326 available on 2026-08-05, and they match the
 * certificate in `assets/document.pdf` down to the number of the certificate,
 * 17148, and its code.
 *
 * Everything that depends on the exact spelling of a parameter lives here, and
 * only here. The client that reads the response stays tolerant of the other
 * spellings on purpose: the council may change the shape, and a reader that
 * fails on the first byte is a reader nobody can diagnose.
 */

export const DJEN_SIGNATURE = {
  /* Confirmed against the running service. The interface reads this. */
  verifiedLive: true,
  verifiedAt: "2026-08-12",
  verificationEvidence:
    "Confirmada em 2026-08-12 contra o serviço em execução, a partir do servidor do escritório no Brasil: status 200 em todas as chamadas, count 52 para a OAB 289870 da UF SP entre 2026-07-01 e 2026-08-12, contra count 10000 e nenhum ato do escritório na chamada de controle sem parâmetros, o que prova que o filtro é aplicado de fato.",

  /* Path of the search resource, appended to DJEN_BASE_URL. */
  resource: "comunicacao",

  /* Path of the certificate of one communication, by its code. The certificate
   * is the official document of the act and its link is preserved whole. */
  certificatePath(code: string): string {
    return `comunicacao/${encodeURIComponent(code)}/certidao`;
  },

  /* Query parameters of the search, every one of them measured. */
  params: {
    oabNumber: "numeroOab",
    oabUf: "ufOab",
    availableFrom: "dataDisponibilizacaoInicio",
    availableTo: "dataDisponibilizacaoFim",
    processNumber: "numeroProcesso",
    tribunal: "siglaTribunal",
    page: "pagina",
    pageSize: "itensPorPagina",
  },

  /* The list of communications sits in `items` and the total in `count`. The
   * other names stay as a fallback for a future change of the council. */
  itemKeys: ["items", "content", "data", "comunicacoes", "results"],
  totalKeys: ["count", "total", "totalElements", "totalRegistros"],

  /* Field names of one communication, in order of preference. The first of each
   * list is the one the service really returns today. */
  fields: {
    id: ["id", "idComunicacao", "codigoComunicacao"],
    certificateCode: ["hash", "codigoCertidao", "codigo"],
    processNumber: [
      "numero_processo",
      "numeroProcesso",
      "numeroprocessocommascara",
    ],
    availableOn: ["data_disponibilizacao", "dataDisponibilizacao"],
    tribunal: ["siglaTribunal", "sigla_tribunal", "tribunal"],
    court: ["nomeOrgao", "nome_orgao", "orgao", "orgaoJulgador"],
    caseClass: ["nomeClasse", "nome_classe", "classe"],
    documentType: ["tipoDocumento", "tipo_documento", "tipoComunicacao"],
    /* `meio` is the letter D; `meiocompleto` is the readable name, which is what
     * a lawyer reads on screen. */
    medium: ["meiocompleto", "meio", "tipoComunicacao"],
    text: ["texto", "textoComunicacao", "teor", "conteudo"],
    link: ["link", "certidao", "url"],
    recipients: ["destinatarios", "destinatario"],
    lawyers: ["destinatarioadvogados", "advogados", "destinatarioAdvogados"],
  },
} as const;

export type DjenSignature = typeof DJEN_SIGNATURE;

/*
 * The date format the office sends, confirmed: the calendar date, which is also
 * the shape the service returns in `data_disponibilizacao`.
 */
export function djenDate(date: string): string {
  return date.slice(0, 10);
}
