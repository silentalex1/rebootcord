'use strict';
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
if (!proxyUrl) return;

const http = require('http');
const https = require('https');
const tls = require('tls');
const { URL } = require('url');
const Module = require('module');

let proxyParsed;
try { proxyParsed = new URL(proxyUrl); } catch (e) { proxyParsed = null; }
if (!proxyParsed) return;

function connectThroughProxy(targetHost, targetPort, callback) {
  const req = http.request({
    host: proxyParsed.hostname,
    port: proxyParsed.port || 80,
    method: 'CONNECT',
    path: targetHost + ':' + targetPort,
    headers: { Host: targetHost + ':' + targetPort }
  });
  req.setTimeout(20000, () => {
    req.destroy();
    callback(new Error('proxy timeout'));
  });
  req.on('connect', (res, socket) => {
    if (res.statusCode !== 200) {
      socket.destroy();
      callback(new Error('proxy connect ' + res.statusCode));
      return;
    }
    callback(null, socket);
  });
  req.on('error', callback);
  req.end();
}

class ProxyHttpsAgent extends https.Agent {
  createConnection(options, callback) {
    const host = options.servername || options.hostname || options.host;
    const port = options.port || 443;
    connectThroughProxy(host, port, (err, socket) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      const tlsSocket = tls.connect({
        socket,
        host,
        servername: host,
        rejectUnauthorized: options.rejectUnauthorized !== false
      }, () => {
        if (callback) callback(null, tlsSocket);
      });
      tlsSocket.on('error', (e) => {
        if (callback) callback(e);
      });
    });
    return undefined;
  }
}

const httpsAgent = new ProxyHttpsAgent({ keepAlive: true, maxSockets: 64 });

const origHttpsRequest = https.request;
https.request = function (options, cb) {
  if (typeof options === 'string' || options instanceof URL) {
    const u = typeof options === 'string' ? new URL(options) : options;
    options = {
      protocol: u.protocol,
      hostname: u.hostname,
      host: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET'
    };
  } else {
    options = Object.assign({}, options);
  }
  if (!options.agent) options.agent = httpsAgent;
  return origHttpsRequest.call(https, options, cb);
};

try {
  const undici = require('undici');
  if (undici.ProxyAgent && undici.setGlobalDispatcher) {
    undici.setGlobalDispatcher(new undici.ProxyAgent(proxyUrl));
  }
} catch (e) {}

function wrapWs(mod) {
  if (!mod || mod.__rcProxied) return mod;
  const Original = typeof mod === 'function' ? mod : mod.WebSocket;
  if (typeof Original !== 'function') return mod;
  function Proxied(address, protocols, options) {
    if (protocols && !Array.isArray(protocols) && typeof protocols === 'object') {
      options = protocols;
      protocols = undefined;
    }
    options = Object.assign({}, options || {});
    if (!options.agent) options.agent = httpsAgent;
    if (protocols === undefined) return new Original(address, options);
    return new Original(address, protocols, options);
  }
  Proxied.prototype = Original.prototype;
  Object.setPrototypeOf(Proxied, Original);
  Object.keys(Original).forEach((k) => {
    try { Proxied[k] = Original[k]; } catch (e) {}
  });
  Proxied.__rcProxied = true;
  if (typeof mod === 'function') return Proxied;
  mod.WebSocket = Proxied;
  mod.__rcProxied = true;
  return mod;
}

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const exp = origLoad.apply(this, arguments);
  if (request === 'ws' || (typeof request === 'string' && /(?:^|[\\/])ws$/.test(request))) {
    return wrapWs(exp);
  }
  return exp;
};
