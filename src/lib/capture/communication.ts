import { z } from "zod";

/*
 * One communication of the Diário de Justiça Eletrônico Nacional, as the office
 * keeps it. The rule of this record is that nothing is summarised and nothing is
 * truncated: it is an official document, and the whole text of the act is what
 * proves the deadline the office wrote down.
 *
 * The payload as it arrived is kept beside the normalised fields, because the
 * signature of the public API was not confirmed live and a field the office
 * failed to read today has to be readable tomorrow without asking the court
 * again.
 */

export const extractedActSchema = z.object({
  /* What kind of act it is: intimação, citação, ato ordinatório, despacho,
   * sentença. Recognised by rule over the text, never by the model. */
  actType: z.string().nullable(),
  actTypeSource: z.string().nullable(),
  /* What the act asks for: manifestação sobre laudo, réplica, contestação. */
  object: z.string().nullable(),
  objectSource: z.string().nullable(),
  /* The deadline in days, as written in the act. */
  days: z.number().int().positive().nullable(),
  daysSource: z.string().nullable(),
  /* Date, hour and place of an appointment the act designates, such as an
   * expert examination or a hearing. */
  appointment: z
    .object({
      kind: z.string(),
      date: z.string().nullable(),
      time: z.string().nullable(),
      place: z.string().nullable(),
      source: z.string(),
    })
    .nullable(),
  /* Every registration number the act names, which is how the office knows the
   * watched registration really appears in it. */
  oabs: z.array(z.string()).default([]),
  processNumbers: z.array(z.string()).default([]),
  /* True when a rule answered everything the office needed. The model is only
   * ever asked about what is left, and this is what proves how little that is. */
  fullyDeterministic: z.boolean(),
  /* What the deterministic rules could not decide, named one by one. */
  residue: z.array(z.string()).default([]),
});

export type ExtractedAct = z.infer<typeof extractedActSchema>;

export const communicationLinkSchema = z.object({
  clientId: z.string(),
  caseId: z.string(),
  /* How the link was made. By process number it is automatic, because the
   * number is unique and validated. By name it is never automatic. */
  method: z.enum(["process-number", "human"]),
  linkedAt: z.string(),
  linkedBy: z.string(),
});

export const linkSuggestionSchema = z.object({
  clientId: z.string(),
  caseId: z.string(),
  clientName: z.string(),
  caseLabel: z.string(),
  /* Zero to one hundred. It is a similarity, never a decision. */
  score: z.number(),
  reason: z.string(),
});

export const communicationSchema = z.object({
  id: z.string(),
  source: z.literal("djen"),
  capturedAt: z.string(),
  /* The registration of the office that brought this communication back. */
  monitoredOab: z.string(),
  externalId: z.string().nullable(),
  certificateCode: z.string().nullable(),
  certificateUrl: z.string().nullable(),
  /* Twenty digits, validated by the check digits. */
  processNumber: z.string().nullable(),
  processNumberLabel: z.string().nullable(),
  availableOn: z.string(),
  tribunalSigla: z.string().nullable(),
  courtName: z.string().nullable(),
  caseClass: z.string().nullable(),
  documentType: z.string().nullable(),
  medium: z.string().nullable(),
  /* The whole text of the act, preserved. */
  text: z.string(),
  recipients: z.array(z.string()).default([]),
  lawyers: z
    .array(z.object({ name: z.string(), oab: z.string().nullable() }))
    .default([]),
  /* The payload exactly as it arrived. */
  raw: z.unknown().optional(),
  extraction: extractedActSchema.nullable().default(null),
  link: communicationLinkSchema.nullable().default(null),
  suggestions: z.array(linkSuggestionSchema).default([]),
  /* When the office turned this communication into deadline, notice, reminder
   * and task. Once processed, never processed again. */
  appliedAt: z.string().nullable().default(null),
  appliedNote: z.string().nullable().default(null),
});

export type Communication = z.infer<typeof communicationSchema>;
export type CommunicationLink = z.infer<typeof communicationLinkSchema>;
export type LinkSuggestion = z.infer<typeof linkSuggestionSchema>;
