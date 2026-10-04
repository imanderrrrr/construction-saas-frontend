// @vitest-environment node
import { describe, expect, it } from 'vitest';
import vercel from '../../../vercel.json';
import vite from '../../../vite.config';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';

describe('platform deployment routing', () => {
  it('Vercel separates the platform API before the tenant proxy and SPA fallback', () => {
    expect(vercel.rewrites.map((r) => r.source)).toEqual([
      '/api/platform/:path*', '/api/:path*', '/(.*)',
    ]);
    const platform = vercel.rewrites[0];
    const tenant = vercel.rewrites[1];
    expect(platform.destination).toBe(tenant.destination.replace('/api/:path*', '/platform/:path*'));
    for (const route of ['/platform/login', '/platform/overview', '/platform/tenants/7']) {
      expect(route.startsWith('/api/')).toBe(false);
      expect(vercel.rewrites[vercel.rewrites.length - 1]?.destination).toBe('/index.html');
    }
  });

  it('Vite forwards only the dedicated API namespace to the backend platform path', () => {
    const proxies = vite.server!.proxy!;
    expect(Object.keys(proxies)).toEqual(['/api/platform', '/api']);
    const platform = proxies['/api/platform'];
    if (typeof platform === 'string') throw new Error('Expected a rewriting proxy');
    expect(platform.target).toBe((proxies['/api'] as { target: string }).target);
    expect(platform.rewrite!('/api/platform/auth/login')).toBe('/platform/auth/login');
    expect(platform.rewrite!('/api/platform/tenants?page=2')).toBe('/platform/tenants?page=2');
    expect(platform.rewrite!('/platform/login')).toBe('/platform/login');
  });
});

it('the development proxy forwards platform and tenant requests without claiming SPA pages', async () => {
  const received: string[] = [];
  const backend = createHttpServer((req, res) => {
    received.push(`${req.method} ${req.url} ${req.headers.authorization ?? ''}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
  const address = backend.address();
  if (!address || typeof address === 'string') throw new Error('Expected a local backend port');
  const target = `http://127.0.0.1:${address.port}`;
  const proxy = Object.fromEntries(Object.entries(vite.server!.proxy!).map(([prefix, value]) => [
    prefix, { ...(typeof value === 'string' ? {} : value), target },
  ]));
  const server = await createViteServer({
    ...vite, configFile: false, logLevel: 'silent',
    server: { ...vite.server, host: '127.0.0.1', port: 0, strictPort: false, proxy },
  });
  try {
    await server.listen();
    const origin = server.resolvedUrls!.local[0];
    const platform = await fetch(`${origin}api/platform/tenants?page=2`, {
      method: 'POST', headers: { Authorization: 'Bearer local-test-token' },
    });
    expect(await platform.json()).toEqual({ ok: true });
    await fetch(`${origin}api/v1/auth/me`);
    const page = await fetch(`${origin}platform/login`);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('<div id="root">');
    expect(received).toEqual([
      'POST /platform/tenants?page=2 Bearer local-test-token', 'GET /api/v1/auth/me ',
    ]);
  } finally {
    await server.close();
    await new Promise<void>((resolve, reject) => backend.close(err => err ? reject(err) : resolve()));
  }
}, 15_000);
