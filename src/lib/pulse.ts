import { env } from "cloudflare:workers";

/**
 * Dubai Pulse — the open KHDA datasets, read for anything we do not already
 * carry.
 *
 * WHY THIS NEEDS CREDENTIALS, AND WHAT HAPPENS WITHOUT THEM
 * ---------------------------------------------------------
 * The portal moved from dubaipulse.gov.ae to data.dubai during 2026. Every old
 * dataset URL now 301s to the new portal's home page, browsing is behind a
 * login, and the data API answers 401 to an unregistered caller:
 *
 *   {"Exception":"... Unauthorized application request ...
 *     Service - SDG-DDADS-OpenAPI, Operation - /{entity}/{dataset_name} ..."}
 *
 * So there is no anonymous read any more, and no amount of scraping produces
 * one. The gateway wants an API key and secret — issued per registered
 * application, emailed separately — exchanged for a short-lived bearer token.
 *
 * This module is therefore written to be inert until those exist. `configured()`
 * is false without them and the scanner stops with a message the admin screen
 * can show, rather than half-running or inventing rows. The moment the two
 * secrets are set, the same code path works unchanged.
 */

const AUTH = "https://api.dubaipulse.gov.ae/oauth/client_credential/accesstoken?grant_type=client_credentials";
const BASE = "https://api.dubaipulse.gov.ae/open";

/** The KHDA school datasets worth reading, and what each is for.
 *
 *  Only school-level registers. The training-institute, higher-education and
 *  programme datasets describe bodies this site does not list, so reading them
 *  would produce findings that could never be acted on. */
export const DATASETS = [
  {
    entity: "khda",
    name: "khda_dubai_private_schools-open",
    label: "Dubai private schools (register)",
    why: "Active private schools: curriculum, rating, enrolment and capacity.",
  },
  {
    entity: "khda",
    name: "khda_private_schools_in_dubai-open",
    label: "Private schools in Dubai",
    why: "Contact details, location, inspection rating and curriculum.",
  },
  {
    entity: "khda",
    name: "khda_inspection_grade_range-open",
    label: "Inspection grade range",
    why: "Which grades each inspection judgement actually covers.",
  },
] as const;

const secrets = () => {
  const e = env as unknown as Record<string, string | undefined>;
  return { key: e.PULSE_API_KEY, secret: e.PULSE_API_SECRET };
};

export const configured = () => {
  const { key, secret } = secrets();
  return Boolean(key && secret);
};

/**
 * A bearer token, good for about half an hour.
 *
 * Not cached between requests on purpose. A scan is a rare, long operation, and
 * a token cached in module scope on a Worker that may be torn down between
 * invocations is a cache that mostly misses while still being able to serve one
 * that expired mid-scan.
 */
export async function token(): Promise<string> {
  const { key, secret } = secrets();
  if (!key || !secret) throw new Error("Dubai Pulse credentials are not set.");

  const res = await fetch(AUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: key, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`Pulse auth failed: ${res.status} ${(await res.text()).slice(0, 200)}`);

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Pulse auth returned no access_token.");
  return body.access_token;
}

/**
 * One dataset, paged to the end.
 *
 * Capped at 5,000 rows. There are 232 schools; a register that returns more
 * than that has changed shape, and reading it dry into a Worker's memory would
 * fail in a way much harder to read than this stop.
 */
export async function fetchDataset(
  bearer: string,
  entity: string,
  name: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const size = 500;

  for (let offset = 0; offset < 5000; offset += size) {
    const url = `${BASE}/${entity}/${name}?limit=${size}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 200)}`);

    const body = (await res.json()) as any;
    // The gateway has wrapped its payload differently across versions, so take
    // the first array-shaped thing rather than pinning one key and breaking on
    // the next change.
    const rows: Record<string, unknown>[] = Array.isArray(body)
      ? body
      : body?.result?.records ?? body?.records ?? body?.data ?? body?.result ?? [];
    if (!Array.isArray(rows) || rows.length === 0) break;

    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}
