# Zenbin Publish Skill

Publish static pages to https://zenbin.org via signed HTTP POST. No git remote — it's API-driven.

## Keys

Keys for this project live at `landing/.zenbin-key.json` (gitignored). Page slug is `pebble-landing`, live URL is https://zenbin.org/p/pebble-landing.

To publish, run: `node landing/publish.mjs`

## One-time setup (if no keypair exists)

```js
import { generateKeyPairSync } from 'crypto';
const keyId = 'pebble-key-' + Date.now();
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
console.log(JSON.stringify({
  keyId,
  publicJwk: publicKey.export({ format: 'jwk' }),
  privateJwk: privateKey.export({ format: 'jwk' }),
}, null, 2));
```

Register the public key:
```bash
curl -X POST https://zenbin.org/v1/keys/register \
  -H "Content-Type: application/json" \
  -d '{"keyId":"YOUR_KEY_ID","publicJwk":{...}}'
```

Store `keyId`, `privateJwk` somewhere safe (e.g. `.env.local`, not committed).

## Publishing a page

Page slug = URL path, e.g. `pebble-landing` → `https://zenbin.org/p/pebble-landing`

```js
import { createHash, sign } from 'crypto';

const keyId = process.env.ZENBIN_KEY_ID;
const privateJwk = JSON.parse(process.env.ZENBIN_PRIVATE_JWK);
const slug = 'pebble-landing';
const html = fs.readFileSync('landing/index.html', 'utf-8');

const body = JSON.stringify({ html, title: 'Pebble — Your agent, in your pocket' });
const timestamp = new Date().toISOString();
const nonce = crypto.randomUUID();
const contentDigest = 'sha-256=:' + createHash('sha256').update(body).digest('base64') + ':';

const canonical = ['POST', `/v1/pages/${slug}`, timestamp, nonce, contentDigest].join('\n');
const sig = sign(null, Buffer.from(canonical), { key: privateJwk, format: 'jwk' });
const sigB64 = sig.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

await fetch(`https://zenbin.org/v1/pages/${slug}`, {
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
```

The response includes the live URL.
