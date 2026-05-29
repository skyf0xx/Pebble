import { createHash, sign } from 'crypto';
import { readFileSync } from 'fs';

const { keyId, privateJwk, pageId } = JSON.parse(readFileSync(new URL('.zenbin-key.json', import.meta.url)));
const html = readFileSync(new URL('index.html', import.meta.url), 'utf-8');

const slug = pageId;
const body = JSON.stringify({ html, title: 'Pebble — Your agent, in your pocket' });
const timestamp = new Date().toISOString();
const nonce = Math.random().toString(36).slice(2);
const contentDigest = 'sha-256=:' + createHash('sha256').update(body).digest('base64') + ':';

const canonical = ['POST', `/v1/pages/${slug}`, timestamp, nonce, contentDigest].join('\n');
const sig = sign(null, Buffer.from(canonical), { key: privateJwk, format: 'jwk' });
const sigB64 = sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const res = await fetch(`https://zenbin.org/v1/pages/${slug}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Zenbin-Key-Id': keyId,
    'X-Zenbin-Timestamp': timestamp,
    'X-Zenbin-Nonce': nonce,
    'Content-Digest': contentDigest,
    'X-Zenbin-Signature': ':' + sigB64 + ':',
  },
  body,
});

const data = await res.json();
console.log(res.status, JSON.stringify(data, null, 2));
