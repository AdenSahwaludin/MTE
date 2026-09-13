/*
 * print-bridge.js — jembatan cetak lokal (HTTP -> Bluetooth LE langsung).
 *
 * Web app (localhost/Vercel) POST struk base64 ke sini; bridge memanggil
 * mte-print-bt yang bicara BLE langsung ke printer tanpa lewat BlueZ D-Bus.
 * Keuntungan: Bluetooth laptop tetap dual-mode — headset musik tetap jalan.
 *
 * Jalankan:  bun print-bridge.js   (atau via systemd user service)
 * Uji:       curl http://127.0.0.1:9211/ping
 */
const PORT = Number(process.env.MTE_BRIDGE_PORT || 9211);
const PRINTER_ADDR = process.env.MTE_PRINTER_ADDR || '5A:4A:66:AC:33:62';
const PRINTER_TYPE = process.env.MTE_PRINTER_TYPE || '1'; // 1=public (printer ini), 2=random
import { fileURLToPath } from 'node:url';
const BIN = fileURLToPath(new URL('./mte-print-bt', import.meta.url));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Private-Network': 'true',
};

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/ping') {
      return new Response(
        JSON.stringify({ ok: true, service: 'mte-print-bridge', printer: PRINTER_ADDR }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/print' && req.method === 'POST') {
      try {
        const body = await req.text();
        const bytes = Buffer.from(body, 'base64');
        if (bytes.length === 0) {
          return new Response(JSON.stringify({ ok: false, error: 'Payload kosong' }), {
            status: 400,
            headers: { ...CORS, 'Content-Type': 'application/json' },
          });
        }

        const tmp = `/tmp/mte-print-${Date.now()}.bin`;
        await Bun.write(tmp, bytes);

        const proc = Bun.spawn([BIN, '--addr', PRINTER_ADDR, '--type', PRINTER_TYPE, tmp], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const [stderr, exitCode] = await Promise.all([
          new Response(proc.stderr).text(),
          proc.exited,
        ]);

        return new Response(
          JSON.stringify({ ok: exitCode === 0, exitCode, log: stderr.trim() }),
          { status: exitCode === 0 ? 200 : 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
          status: 500,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
      status: 404,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
});

console.log(`mte-print-bridge: http://127.0.0.1:${PORT} -> printer ${PRINTER_ADDR}`);
