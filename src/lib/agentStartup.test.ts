import { describe, expect, it } from 'vitest';
import {
  AGENT_IMAGE, BODIES_DIR, COMPOSE_BODIES_VOLUME, COMPOSE_NETWORK, COMPOSE_SCHEDULER_URL,
  agentBodyTarget, agentDockerCommand, agentEnvFile, agentEnvironment,
} from '@/lib/agentStartup';
import type { AgentStartupInput } from '@/lib/agentStartup';
import type { BodyStoreLocation } from '@/data/bodyStores/BodyStoreDto';

const S3_STORE: BodyStoreLocation = {
  kind: 's3',
  endpoint: 'https://s3.eu-central-1.amazonaws.com',
  region: 'eu-central-1',
  bucket: 'probe-bodies',
  prefix: 'eu/agents',
  rootPath: null,
};

const FS_STORE: BodyStoreLocation = {
  kind: 'filesystem',
  endpoint: null,
  region: null,
  bucket: null,
  prefix: null,
  rootPath: '/srv/tracedown/bodies',
};

function input(store: BodyStoreLocation | null, defaultKind: 's3' | 'filesystem' = 'filesystem'): AgentStartupInput {
  return {
    slug: 'eu-west-1',
    token: 'tok_123',
    schedulerUrl: 'https://gw.example.com',
    bodies: agentBodyTarget(store, defaultKind),
  };
}

function env(i: AgentStartupInput): Record<string, string> {
  return Object.fromEntries(agentEnvironment(i));
}

describe('default store', () => {
  it('filesystem default mounts the shipped bodies volume, as before', () => {
    const i = input(null, 'filesystem');
    expect(env(i)).toMatchObject({
      PROBE_AGENT_STORAGE_BACKEND: 'filesystem',
      PROBE_AGENT_STORAGE_DIR: BODIES_DIR,
    });
    expect(agentDockerCommand(i)).toContain(`-v ${COMPOSE_BODIES_VOLUME}:${BODIES_DIR} \\`);
  });

  it('s3 default prints the placeholder template and mounts nothing', () => {
    const i = input(null, 's3');
    expect(env(i)).toEqual({
      PROBE_AGENT_BOOTSTRAP_TOKEN: 'tok_123',
      PROBE_AGENT_SCHEDULER_URL: 'https://gw.example.com',
      PROBE_AGENT_PORT: '8443',
      PROBE_AGENT_STORAGE_BACKEND: 's3',
      PROBE_AGENT_S3_ENDPOINT_URL: '<endpoint-url>',
      PROBE_AGENT_S3_ACCESS_KEY_ID: '<access-key-id>',
      PROBE_AGENT_S3_SECRET_ACCESS_KEY: '<secret-access-key>',
      PROBE_AGENT_S3_BUCKET: '<bucket>',
      PROBE_AGENT_S3_REGION: 'auto',
    });
    expect(agentDockerCommand(i)).not.toContain(' -v ');
  });

  it('falls back to the compose scheduler address and network when none is configured', () => {
    const i = { ...input(null), schedulerUrl: null };
    expect(env(i).PROBE_AGENT_SCHEDULER_URL).toBe(COMPOSE_SCHEDULER_URL);
    expect(agentDockerCommand(i)).toContain(`--network ${COMPOSE_NETWORK} \\`);
  });
});

describe('s3 store', () => {
  it('prints the store location with write-access key placeholders', () => {
    const i = input(S3_STORE);
    expect(env(i)).toEqual({
      PROBE_AGENT_BOOTSTRAP_TOKEN: 'tok_123',
      PROBE_AGENT_SCHEDULER_URL: 'https://gw.example.com',
      PROBE_AGENT_PORT: '8443',
      PROBE_AGENT_STORAGE_BACKEND: 's3',
      PROBE_AGENT_S3_ENDPOINT_URL: 'https://s3.eu-central-1.amazonaws.com',
      PROBE_AGENT_S3_ACCESS_KEY_ID: '<access-key-id with write access>',
      PROBE_AGENT_S3_SECRET_ACCESS_KEY: '<secret with write access>',
      PROBE_AGENT_S3_BUCKET: 'probe-bodies',
      PROBE_AGENT_S3_REGION: 'eu-central-1',
      PROBE_AGENT_S3_PREFIX: 'eu/agents',
    });
    expect(agentDockerCommand(i)).not.toContain(' -v ');
  });

  it('defaults the region to auto and omits an empty prefix', () => {
    const vars = env(input({ ...S3_STORE, region: null, prefix: '' }));
    expect(vars.PROBE_AGENT_S3_REGION).toBe('auto');
    expect(vars).not.toHaveProperty('PROBE_AGENT_S3_PREFIX');
  });
});

describe('filesystem store', () => {
  it('mounts the root path at the same path and writes into it', () => {
    const i = input(FS_STORE);
    expect(env(i)).toMatchObject({
      PROBE_AGENT_STORAGE_BACKEND: 'filesystem',
      PROBE_AGENT_STORAGE_DIR: '/srv/tracedown/bodies',
    });
    const command = agentDockerCommand(i);
    expect(command).toContain('-v /srv/tracedown/bodies:/srv/tracedown/bodies \\');
    expect(command).not.toContain(COMPOSE_BODIES_VOLUME);
    expect(Object.keys(env(i)).some(key => key.startsWith('PROBE_AGENT_S3_'))).toBe(false);
  });
});

describe('renderings agree', () => {
  it.each([null, S3_STORE, FS_STORE])('env file and docker command carry the same variables (%#)', (store) => {
    const i = input(store);
    const command = agentDockerCommand(i);
    for (const line of agentEnvFile(i).split('\n')) {
      const [key, ...rest] = line.split('=');
      expect(command).toContain(`-e ${key}="${rest.join('=')}" \\`);
    }
    expect(command.endsWith(`  ${AGENT_IMAGE}`)).toBe(true);
    expect(command).toContain('--hostname eu-west-1 \\');
  });
});
