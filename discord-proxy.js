const http = require('http');
const net = require('net');
const { URL } = require('url');

function isDiscordHost(host) {
  const h = String(host || '').toLowerCase().split(':')[0];
  return (
    h === 'discord.com' || h.endsWith('.discord.com') ||
    h === 'discord.gg' || h.endsWith('.discord.gg') ||
    h === 'discordapp.com' || h.endsWith('.discordapp.com') ||
    h === 'discordapp.net' || h.endsWith('.discordapp.net') ||
    h === 'discord.media' || h.endsWith('.discord.media') ||
    h === 'discordapp.io' || h.endsWith('.discordapp.io')
  );
}

function startDiscordProxy(opts) {
  const gapMs = (opts && opts.gapMs) || 2000;
  let lastDiscord = 0;
  let chain = Promise.resolve();

  function waitDiscordSlot() {
    return new Promise((resolve) => {
      const wait = Math.max(0, gapMs - (Date.now() - lastDiscord));
      setTimeout(() => {
        lastDiscord = Date.now();
        resolve();
      }, wait);
    });
  }

  const server = http.createServer((req, res) => {
    let dest;
    try { dest = new URL(req.url); } catch (e) {
      res.writeHead(400);
      res.end();
      return;
    }
    const pReq = http.request({
      hostname: dest.hostname,
      port: dest.port || 80,
      method: req.method,
      path: dest.pathname + dest.search,
      headers: req.headers
    }, (pRes) => {
      res.writeHead(pRes.statusCode, pRes.headers);
      pRes.pipe(res);
    });
    pReq.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(pReq);
  });

  server.on('connect', (req, clientSocket, head) => {
    const [host, portStr] = String(req.url || '').split(':');
    const port = parseInt(portStr, 10) || 443;
    if (!host) {
      try { clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (e) {}
      clientSocket.destroy();
      return;
    }
    const go = () => {
      const upstream = net.connect(port, host, () => {
        try { clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); } catch (e) {}
        if (head && head.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.on('error', () => {
        try { clientSocket.destroy(); } catch (e) {}
      });
      clientSocket.on('error', () => {
        try { upstream.destroy(); } catch (e) {}
      });
    };
    if (isDiscordHost(host)) {
      chain = chain.then(waitDiscordSlot).then(go).catch(() => go());
    } else {
      go();
    }
  });

  server.on('clientError', (err, socket) => {
    try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (e) {}
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        url: 'http://127.0.0.1:' + addr.port
      });
    });
  });
}

module.exports = { startDiscordProxy, isDiscordHost };
