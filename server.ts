import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const distPath = path.join(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const isDevLifecycle =
    process.env.npm_lifecycle_event === 'dev' ||
    process.execArgv.some((arg) => arg.includes('tsx'));
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (!isDevLifecycle && fs.existsSync(distIndexHtml));

  if (isProduction) {
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
      })
    );
    app.use((_req, res) => {
      res.sendFile(distIndexHtml);
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT} (production)`);
    });
    return;
  }

  // Bind port immediately so readiness checks succeed while Vite initializes on cold start
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (development)`);
  });

  const vitePromise = (async () => {
    const { createServer: createViteServer } = await import('vite');
    return createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
  })();

  vitePromise.catch((err) => {
    console.error('Failed to initialize Vite dev middleware:', err);
    process.exit(1);
  });

  app.use(async (req, res, next) => {
    try {
      const vite = await vitePromise;
      vite.middlewares(req, res, next);
    } catch (err) {
      next(err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
