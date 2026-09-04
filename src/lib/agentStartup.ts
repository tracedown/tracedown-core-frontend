/**
 * Everything printed next to a fresh agent bootstrap token: the container
 * command and the bare environment file are both generated from one list of
 * variables, so the two can never disagree.
 *
 * Variable names follow the agent's own settings (`PROBE_AGENT_*`).
 */

export type AgentStorageBackend = 'filesystem' | 's3';

export interface AgentStartupInput {
  slug: string;
  token: string;
  /** Base URL the agent enrols against, or null when the gateway has none configured. */
  schedulerUrl: string | null;
  storage: AgentStorageBackend;
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
 * The bucket settings are the operator's to fill in where the agent starts —
 * nothing about their storage is typed into the dashboard, so the S3 template
 * is exactly that: a template with placeholders. `auto` is a real region value
 * (R2; MinIO ignores it) and the one AWS S3 wants replaced.
 */
export const S3_PLACEHOLDERS: [string, string][] = [
  ['PROBE_AGENT_S3_ENDPOINT_URL', '<endpoint-url>'],
  ['PROBE_AGENT_S3_ACCESS_KEY_ID', '<access-key-id>'],
  ['PROBE_AGENT_S3_SECRET_ACCESS_KEY', '<secret-access-key>'],
  ['PROBE_AGENT_S3_BUCKET', '<bucket>'],
  ['PROBE_AGENT_S3_REGION', 'auto'],
];

/** `[name, value]` pairs in the order they are printed. */
export function agentEnvironment(input: AgentStartupInput): [string, string][] {
  const vars: [string, string][] = [
    ['PROBE_AGENT_BOOTSTRAP_TOKEN', input.token],
    ['PROBE_AGENT_SCHEDULER_URL', input.schedulerUrl ?? COMPOSE_SCHEDULER_URL],
    ['PROBE_AGENT_PORT', '8443'],
    ['PROBE_AGENT_STORAGE_BACKEND', input.storage],
  ];
  if (input.storage === 'filesystem') {
    vars.push(['PROBE_AGENT_STORAGE_DIR', BODIES_DIR]);
  } else {
    vars.push(...S3_PLACEHOLDERS);
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
  if (input.storage === 'filesystem') lines.push(`  -v ${COMPOSE_BODIES_VOLUME}:${BODIES_DIR} \\`);
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
