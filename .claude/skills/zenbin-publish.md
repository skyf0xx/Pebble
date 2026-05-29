# Zenbin Publish Skill

Publish static pages to [zenbin.org](https://zenbin.org) via signed HTTP POST. No git remote — it's API-driven.

## Keys

Keys for this project live at `landing/.zenbin-key.json` (gitignored). Page slug is `pebble-landing`, live URL is [https://zenbin.org/p/pebble-landing](https://zenbin.org/p/pebble-landing).

To publish, run: `node landing/publish.mjs`

## API overview

**POST /v1/pages/{page-id}** — publish/update a page. The key that creates a page owns all future updates.

### Request body fields

```json
{
  "encoding": "base64",         // set when sending base64-encoded html/image/video
  "html": "<base64>",           // page HTML (base64 when encoding=base64)
  "markdown": "<base64>",       // optional markdown (base64 when markdown_encoding=base64)
  "image": "<base64>",          // binary image asset (base64)
  "image_content_type": "image/png",
  "video": "<base64>",          // binary video asset (base64)
  "video_content_type": "video/mp4",
  "title": "Page title"
}
```

One binary asset (image OR video) can be bundled with html/markdown in a single publish call.

### Response fields

```json
{
  "url": "https://zenbin.org/p/{id}",
  "raw_url": "https://zenbin.org/p/{id}/raw",
  "image_url": "https://zenbin.org/p/{id}/image",
  "video_url": "https://zenbin.org/p/{id}/video"
}
```

### Read endpoints

- `/p/{id}` — rendered page
- `/p/{id}/raw` — raw HTML
- `/p/{id}/md` — markdown source
- `/p/{id}/image` — image asset (use this for `og:image` / Twitter card)
- `/p/{id}/video` — video asset

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

Store `keyId`, `privateJwk`, and `pageId` in `.zenbin-key.json` (gitignored).

## Publishing a page with an image

```js
import { createHash, sign } from 'crypto';
import { readFileSync } from 'fs';

const { keyId, privateJwk, pageId } = JSON.parse(readFileSync('.zenbin-key.json'));
const html = readFileSync('landing/index.html', 'utf-8');
const imageBytes = readFileSync('public/pebble.png');

const slug = pageId;
const body = JSON.stringify({
  encoding: 'base64',
  html: Buffer.from(html).toString('base64'),
  image: imageBytes.toString('base64'),
  image_content_type: 'image/png',
  title: 'Page title',
});
const timestamp = new Date().toISOString();
const nonce = Math.random().toString(36).slice(2);
const contentDigest = 'sha-256=:' + createHash('sha256').update(body).digest('base64') + ':';

const canonical = ['POST', `/v1/pages/${slug}`, timestamp, nonce, contentDigest].join('\n');
const sig = sign(null, Buffer.from(canonical), { key: privateJwk, format: 'jwk' });
const sigB64 = sig.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

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
console.log(res.status, data.url, data.image_url);
```

## Social / OG metadata

Use `https://zenbin.org/p/{id}/image` as the `og:image` and `twitter:image` URL — not `/og.png` or any other path. The image is uploaded alongside the HTML in the same publish call.

```html
<meta property="og:image" content="https://zenbin.org/p/pebble-landing/image" />
<meta name="twitter:image" content="https://zenbin.org/p/pebble-landing/image" />
```

## Agent onboarding

Full onboarding docs (keypair generation, signing procedure) are at: `https://zenbin.org/.well-known/agent.md`
