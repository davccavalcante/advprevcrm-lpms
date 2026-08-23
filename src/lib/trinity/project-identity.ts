import { readFileSync } from "node:fs";
import path from "node:path";

/*
 * The identity of this project has exactly one source, the manifest, and this
 * module is the only place that reads it. A version written a second time
 * anywhere in the code is a version that will disagree with the manifest on the
 * day someone changes one and forgets the other.
 *
 * The manifest is read rather than imported because a JSON import needs an
 * import attribute that the bundler and plain Node disagree about, and this
 * module has to work identically under `next dev`, under `next start` and under
 * the offline harness that exercises the entity.
 *
 * If the manifest cannot be read, the stamp says so. It never falls back to a
 * version number written by hand: an invented version is worse than a declared
 * absence, because it would travel into the records of the office as if it were
 * a fact.
 */

type Manifest = { name?: unknown; version?: unknown };

function readManifest(): { name: string; version: string } {
  try {
    const raw = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as Manifest;
    const name = typeof parsed.name === "string" ? parsed.name : "";
    const version = typeof parsed.version === "string" ? parsed.version : "";
    if (name.length > 0 && version.length > 0) {
      return { name, version };
    }
  } catch {
    /* falls through to the declared absence below */
  }
  return { name: "advprevcrm", version: "versão não declarada no manifesto" };
}

const manifest = readManifest();

export const PROJECT_NAME: string = manifest.name;

/* Every artefact this project writes carries this version: the body of the
 * entity, the incarnation record and every turn of every conversation. */
export const PROJECT_VERSION: string = manifest.version;
