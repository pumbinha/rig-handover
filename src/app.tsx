import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/read.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestNotFound, DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const name = c.req.param('night');
    const night = readNight(config.runsDir, name);
    if (!night) {
      return c.html(
        <Layout title="not found" lane={lane()}>
          <DigestNotFound night={name} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${name}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = readNight(config.runsDir, night);
    if (!data) return c.json({ error: 'no such night', night }, 404);
    return c.json(data);
  });

  return app;
}
