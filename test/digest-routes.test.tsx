import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const JOBS = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];
const GOOD = '{"at":"2026-10-27T23:00:02+01:00","job":"alpha/one","status":"ok","owner":"rook"}\n';

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  copyFileSync('runs/2026-10-28.jsonl', join(runsDir, '2026-10-28.jsonl'));
  writeFileSync(join(runsDir, '2026-10-20.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-27.jsonl'), `${GOOD}this is not json\n`);
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const json = async (night: string) => (await app.request(`/api/digest/${night}`)).json() as Promise<Night>;

describe('digest routes', () => {
  describe('a night with a file', () => {
    it('page: 200 with every job and the lane banner', async () => {
      const res = await app.request('/digest/2026-10-28');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('TEST-MARKER');
      for (const job of JOBS) expect(html).toContain(job);
    });

    it('json: 200 with 5 rows and 1 bad line', async () => {
      const res = await app.request('/api/digest/2026-10-28');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Night;
      expect(body.night).toBe('2026-10-28');
      expect(body.rows).toHaveLength(5);
      expect(body.badLines).toBe(1);
    });
  });

  describe('a night with no file', () => {
    it('page: 404', async () => {
      expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    });
    it('json: 404', async () => {
      expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
    });
  });

  describe('the empty night', () => {
    it('page: says nothing ran', async () => {
      const res = await app.request('/digest/2026-10-20');
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('nothing ran');
    });
    it('json: no rows', async () => {
      const res = await app.request('/api/digest/2026-10-20');
      expect(res.status).toBe(200);
      expect((await res.json() as Night).rows).toEqual([]);
    });
  });

  describe('a night with a bad line', () => {
    it('page: still 200 and renders the good rows', async () => {
      const res = await app.request('/digest/2026-10-27');
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('alpha/one');
    });
    it('json: still 200, counts the bad line', async () => {
      const res = await app.request('/api/digest/2026-10-27');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Night;
      expect(body.badLines).toBeGreaterThanOrEqual(1);
      expect(body.rows.map((r) => r.job)).toEqual(['alpha/one']);
    });
  });

  it('page and json agree on jobs and order', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    const jobs = (await json('2026-10-28')).rows.map((r) => r.job);
    expect(jobs).toEqual(JOBS);
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
