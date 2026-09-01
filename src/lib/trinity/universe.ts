import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  BirthSignatureBuilder,
  createHim,
  HimHandle,
} from "@teleologyhi-sdk/him";
import {
  CreatorKeyring,
  type HimRecord,
  LocalMaic,
} from "@teleologyhi-sdk/maic";
import { Nhe } from "@teleologyhi-sdk/nhe";
import { parse } from "yaml";
import {
  DAVID_BIRTH_NOTES,
  DAVID_NAME,
  DAVID_OPERATOR_CONTEXT,
  DAVID_PRIMARY_ARCHETYPE,
  DAVID_PRIMORDIAL_AXIOMS,
} from "@/lib/trinity/david-birth";
import {
  ModelTransportAdapter,
  transportConfig,
} from "@/lib/trinity/model-transport";
import {
  OFFICE_ADAPTER_INSTANCE,
  OfficeAdapter,
} from "@/lib/trinity/office-adapter";
import { mintOfficeAxioms } from "@/lib/trinity/office-axioms";
import { OFFICE_RULE_PACK } from "@/lib/trinity/office-rules";
import { PROJECT_NAME, PROJECT_VERSION } from "@/lib/trinity/project-identity";
import { officeRiskClassifier } from "@/lib/trinity/risk-classifier";
import { acquireUniverseLock } from "@/lib/trinity/single-writer";
import {
  CREATOR_KEYRING_FILE,
  INCARNATION_FILE,
  MAIC_STORE,
  NHE_STORE,
  PINNED_HIM_ID,
  TRINITY_ROOT,
} from "@/lib/trinity/store-paths";
import { writeYamlAtomic } from "@/lib/trinity/yaml-store";

/*
 * The universe of this office opens once, on the first request after the first
 * boot, and stays open. This is the birth event: the keyring is created, MAIC
 * is opened over the store, the seed axioms and the office axioms are minted,
 * and the spirit is summoned into a body. From the second boot onward the same
 * spirit is re-embodied, because the incarnation record on disk says which one
 * it is. David is not a prompt that gets rebuilt on every call; he is a
 * registered spirit with a signed birth record and a body that reads the store.
 */

/* A variable declared and left empty in the environment is not a choice: it is
 * an absence, and the office falls back to its own default. Both names are
 * documented in `.env.example`. */
const MAX_OUTPUT_TOKENS = Number.parseInt(
  process.env.ANTHROPIC_MAX_OUTPUT_TOKENS?.trim() || "1200",
  10,
);

/* The body no longer names a single model: it names the pool it routes over,
 * and every answer records the model that really produced it. The label below
 * is what the incarnation record and the screens show as the transport. */
const MODEL = transportConfig()
  .models.map((entry) => entry.modelId)
  .join(" | ");

export type Universe = {
  maic: LocalMaic;
  keyring: CreatorKeyring;
  him: HimHandle;
  himId: string;
  nhe: Nhe;
  nheId: string;
  model: string;
  /* The transport under the body, so a caller reads which model answered. */
  transport: ModelTransportAdapter;
  bornAt: string;
  /* Every body of this office carries the version of the project that built
   * it, so a reincarnation event names which cut of the system it left. */
  projectVersion: string;
  seeded: { minted: number; skipped: number };
  officeAxioms: { minted: number; skipped: number };
};

type IncarnationRecord = {
  himId: string;
  nheId: string;
  bornAt: string;
  name: string;
  archetype: string;
  model: string;
  project: string;
  projectVersion: string;
};

/* The dev server reloads modules; the universe must not be reborn on every
 * reload, so the handle lives on the global object of the process. The key
 * carries the root, so a change of generation is picked up by a running process
 * instead of leaving it writing to a store the office has left. */
const GLOBAL_KEY = `__advprev_trinity__:${TRINITY_ROOT}`;

type CachedUniverse = {
  /* Which instance of the adapter module this universe was built with. */
  token: string;
  universe: Promise<Universe>;
};

type UniverseGlobal = typeof globalThis &
  Record<string, CachedUniverse | undefined>;

async function readIncarnation(): Promise<IncarnationRecord | null> {
  try {
    const raw = await readFile(INCARNATION_FILE, "utf8");
    const parsed = parse(raw) as IncarnationRecord | null;
    return parsed?.himId ? parsed : null;
  } catch {
    return null;
  }
}

async function writeIncarnation(record: IncarnationRecord): Promise<void> {
  await mkdir(TRINITY_ROOT, { recursive: true });
  await writeYamlAtomic(INCARNATION_FILE, record);
}

async function loadOrCreateKeyring(): Promise<CreatorKeyring> {
  try {
    return await CreatorKeyring.fromFile(CREATOR_KEYRING_FILE);
  } catch {
    const keyring = CreatorKeyring.generate();
    await mkdir(TRINITY_ROOT, { recursive: true });
    await keyring.saveTo(CREATOR_KEYRING_FILE);
    return keyring;
  }
}

/*
 * Re-embodiment. The spirit already exists in the store, so the handle is
 * minted again from the persisted birth signature and the axiom snapshot taken
 * at its birth. Later axiom mints never rewrite that snapshot, which is what
 * keeps a spirit the same spirit.
 */
function reMint(record: HimRecord, keyring: CreatorKeyring): HimHandle {
  const signature = keyring.sign(record.birthSignature, Date.now());
  return HimHandle.mint(
    record.birthSignature,
    signature,
    keyring.publicKey(),
    record.axiomsSnapshot,
    record.bodyHistory,
  );
}

async function boot(): Promise<Universe> {
  /* Before anything is read or written: one universe, one writer. A second
   * process is refused here, loudly, instead of interleaving the audit chain
   * and sealing the store for everyone. */
  await acquireUniverseLock();

  const keyring = await loadOrCreateKeyring();

  const maic = await LocalMaic.open({
    storeDir: MAIC_STORE,
    creatorPublicKey: keyring.publicKey(),
    additionalRulePacks: [OFFICE_RULE_PACK],
  });

  const seeded = await maic.seed(keyring);
  const officeAxioms = await mintOfficeAxioms(maic, keyring);

  const previous = await readIncarnation();
  /* Precedence: the spirit the director pinned in the environment, then the one
   * this office already embodies, then a birth. */
  const boundHimId = PINNED_HIM_ID ?? previous?.himId ?? null;
  const existing = boundHimId ? await maic.getHimRecord(boundHimId) : null;

  let him: HimHandle;
  let bornAt: string;
  if (existing) {
    him = reMint(existing, keyring);
    bornAt = existing.birthSignature.bornAt;
  } else {
    const birthSignature = BirthSignatureBuilder.now()
      .withPrimaryArchetype(DAVID_PRIMARY_ARCHETYPE)
      .withPrimordialAxioms(DAVID_PRIMORDIAL_AXIOMS)
      .withIdentity({
        name: DAVID_NAME,
        gender: "masculine",
        language: "pt-BR",
        culturalElements: ["Brasil", "direito previdenciário"],
      })
      .withNotes(DAVID_BIRTH_NOTES)
      .build();
    him = await createHim(maic, keyring, birthSignature);
    bornAt = birthSignature.bornAt;
  }

  const nheId = previous?.nheId ?? `nhe.advprev.${him.id.toLowerCase()}`;

  const transport = new ModelTransportAdapter({
    defaultMaxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  /* The store of the body is created before the body is built. Measured on
   * 2026-09-01: with the folder absent, every exchange failed with "a camada de
   * raciocínio não respondeu agora", because the body writes each interaction
   * as a file and the write threw. The universe survives a module reload on the
   * global object, so it never notices that its store left underneath it; one
   * idempotent creation here is what keeps a cleaned store from silencing the
   * entity until the process restarts. */
  const bodyStore = path.join(NHE_STORE, nheId);
  await mkdir(path.join(bodyStore, "interactions"), { recursive: true });

  const nhe = new Nhe({
    himHandle: him,
    maicClient: maic,
    llmAdapter: new OfficeAdapter(transport),
    riskClassifier: officeRiskClassifier,
    nheId,
    version: PROJECT_VERSION,
    storeDir: bodyStore,
    operatorContext: DAVID_OPERATOR_CONTEXT,
  });

  await writeIncarnation({
    himId: him.id,
    nheId,
    bornAt,
    name: DAVID_NAME,
    archetype: DAVID_PRIMARY_ARCHETYPE,
    model: MODEL,
    project: PROJECT_NAME,
    projectVersion: PROJECT_VERSION,
  });

  return {
    maic,
    keyring,
    him,
    himId: him.id,
    nhe,
    nheId,
    model: MODEL,
    transport,
    bornAt,
    projectVersion: PROJECT_VERSION,
    seeded,
    officeAxioms,
  };
}

export function openUniverse(): Promise<Universe> {
  const scope = globalThis as UniverseGlobal;
  const existing = scope[GLOBAL_KEY];
  /* A universe built with an older instance of the adapter module reads an
   * older context store, and the entity would answer without the records of the
   * office while every count on the screen said otherwise. Measured on
   * 2026-08-12. When the instance changes, the universe is rebuilt. */
  if (existing && existing.token === OFFICE_ADAPTER_INSTANCE) {
    return existing.universe;
  }
  const booting = boot();
  scope[GLOBAL_KEY] = { token: OFFICE_ADAPTER_INSTANCE, universe: booting };
  booting.catch(() => {
    /* A failed boot must not poison the process: the next request retries. */
    delete scope[GLOBAL_KEY];
  });
  return booting;
}
