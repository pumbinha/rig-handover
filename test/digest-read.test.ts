import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into 5 jobs and counts 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night!.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(night!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file, and no rows for an empty one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toBeNull();
    expect(readNight(dir, '../etc/passwd')).toBeNull();
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts lines that are JSON but not run lines as bad', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '[]\n{"at":"x","job":"a","status":"maybe","owner":null}\n{"at":"x","job":"a","status":"ok","owner":null}\n');
    const night = readNight(dir, '2026-01-01')!;
    expect(night.badLines).toBe(2);
    expect(night.rows).toHaveLength(1);
  });
});
