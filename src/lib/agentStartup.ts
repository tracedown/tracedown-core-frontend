/**
 * Everything printed next to a fresh agent bootstrap token: the container
 * command and the bare environment file are both generated from one list of
 * variables, so the two can never disagree.
 *
 * Variable names follow the agent's own settings (`PROBE_AGENT_*`).
 */

import type { BodyStoreKind, BodyStoreLocation } from '@/data/bodyStores/BodyStoreDto';

/**
 * Where the agent writes response bodies, and so which variables the command
 * carries and what it mounts.
 *
 * - `filesystem`: the agent writes under `dir`; the Docker command mounts
 *   `source` (a volume name or host path) there.
 * - `s3`: `store` is the configured store the bucket settings come from, or
 *   null for the default store, whose settings stay placeholders.
 */
export type AgentBodyTarget =
  | { backend: 'filesystem'; source: string; dir: string }
  | { backend: 's3'; store: BodyStoreLocation | null };

export interface AgentStartupInput {
  slug: string;
  token: string;
  /** Base URL the agent enrols against, or null when the gateway has none configured. */
  schedulerUrl: string | null;
  bodies: AgentBodyTarget;
}

/** The published agent image (`docker pull tracedown/tracedown-probe-agent`). */
export const AGENT_IMAGE = 'tracedown/tracedown-probe-agent';

/**
 * Where the shipped Docker stack's gateway is reached from an agent on the
 * same Compose network. Used only when the gateway has no public URL
 * configured, which is exactly the shipped-stack case.
 */
export const COMPOSE_SCHEDULER_URL = 'http://tracedown-gateway:20714';
export const COMPOSE_NETWORK = 'tracedown_tracedown-net';
export const COMPOSE_BODIES_VOLUME = 'tracedown_tracedown-bodies';

/** Container-side body directory; the volume or bind mount lands here. */
export const BODIES_DIR = '/data/bodies';

/**
 * The default store's bucket settings are the operator's to fill in where the
 * agent starts — nothing about that storage is typed into the dashboard, so its
 * S3 template is exactly that: a template with placeholders. `auto` is a real
 * region value (R2; MinIO ignores it) and the one AWS S3 wants replaced.
 */
export const S3_PLACEHOLDERS: [string, string][] = [
  ['PROBE_AGENT_S3_ENDPOINT_URL', '<endpoint-url>'],
  ['PROBE_AGENT_S3_ACCESS_KEY_ID', '<access-key-id>'],
  ['PROBE_AGENT_S3_SECRET_ACCESS_KEY', '<secret-access-key>'],
  ['PROBE_AGENT_S3_BUCKET', '<bucket>'],
  ['PROBE_AGENT_S3_REGION', 'auto'],
];

/**
 * A configured store's credentials are the platform's and are never printed:
 * the agent gets a key of its own, and needs only write access.
 */
export const STORE_KEY_PLACEHOLDERS: [string, string][] = [
  ['PROBE_AGENT_S3_ACCESS_KEY_ID', '<access-key-id with write access>'],
  ['PROBE_AGENT_S3_SECRET_ACCESS_KEY', '<secret with write access>'],
];

/**
 * The body target for an agent enrolled onto `store` (null = the default
 * store, described only by its kind).
 *
 * A directory store is mounted at its own root path: the agent reports
 * `file://` paths as it sees them, and the platform accepts only paths under
 * the store's root, so the agent must see the directory where the platform
 * does.
 */
export function agentBodyTarget(
  store: BodyStoreLocation | null,
  defaultKind: BodyStoreKind,
): AgentBodyTarget {
  if (store === null) {
    return defaultKind === 's3'
      ? { backend: 's3', store: null }
      : { backend: 'filesystem', source: COMPOSE_BODIES_VOLUME, dir: BODIES_DIR };
  }
  if (store.kind === 'filesystem') {
    const root = store.rootPath ?? BODIES_DIR;
    return { backend: 'filesystem', source: root, dir: root };
  }
  return { backend: 's3', store };
}

function s3Variables(store: BodyStoreLocation | null): [string, string][] {
  if (store === null) return S3_PLACEHOLDERS;
  const vars: [string, string][] = [
    ['PROBE_AGENT_S3_ENDPOINT_URL', store.endpoint ?? '<endpoint-url>'],
    ...STORE_KEY_PLACEHOLDERS,
    ['PROBE_AGENT_S3_BUCKET', store.bucket ?? '<bucket>'],
    ['PROBE_AGENT_S3_REGION', store.region || 'auto'],
  ];
  if (store.prefix) vars.push(['PROBE_AGENT_S3_PREFIX', store.prefix]);
  return vars;
}

/** `[name, value]` pairs in the order they are printed. */
export function agentEnvironment(input: AgentStartupInput): [string, string][] {
  const vars: [string, string][] = [
    ['PROBE_AGENT_BOOTSTRAP_TOKEN', input.token],
    ['PROBE_AGENT_SCHEDULER_URL', input.schedulerUrl ?? COMPOSE_SCHEDULER_URL],
    ['PROBE_AGENT_PORT', '8443'],
    ['PROBE_AGENT_STORAGE_BACKEND', input.bodies.backend],
  ];
  if (input.bodies.backend === 'filesystem') {
    vars.push(['PROBE_AGENT_STORAGE_DIR', input.bodies.dir]);
  } else {
    vars.push(...s3Variables(input.bodies.store));
  }
  return vars;
}

/** Full startup command for the published container image. */
export function agentDockerCommand(input: AgentStartupInput): string {
  const lines = [
    'docker run -d \\',
    `  --name tracedown-agent-${input.slug} \\`,
    // The hostname MUST be the slug. The agent registers itself as
    // https://<its own FQDN>:<port>, and the certificate it is issued carries
    // the slug as its SAN — which the scheduler pins. Without this the
    // container's FQDN is its container id, and every dispatch fails against a
    // name the certificate does not carry.
    `  --hostname ${input.slug} \\`,
  ];
  // The Compose network only exists on the shipped stack, which is the one
  // case the gateway has no public URL for; elsewhere the line would make
  // `docker run` fail on a network that does not exist.
  if (input.schedulerUrl === null) lines.push(`  --network ${COMPOSE_NETWORK} \\`);
  if (input.bodies.backend === 'filesystem') {
    lines.push(`  -v ${input.bodies.source}:${input.bodies.dir} \\`);
  }
  lines.push(
    ...agentEnvironment(input).map(([key, value]) => `  -e ${key}="${value}" \\`),
    `  ${AGENT_IMAGE}`,
  );
  return lines.join('\n');
}

/**
 * The same settings as plain `KEY=value` lines, for an agent started by
 * anything other than Docker (systemd `EnvironmentFile`, a VM image, a
 * `pip install`). The hostname is not a variable — it is the machine's own.
 */
export function agentEnvFile(input: AgentStartupInput): string {
  return agentEnvironment(input).map(([key, value]) => `${key}=${value}`).join('\n');
}
