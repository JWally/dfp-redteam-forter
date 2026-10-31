# Forter — sensor pass (Wish.com deployment) (2026-10-31)

**Subject:** Forter's fraud sensor as deployed on **wish.com** (ContextLogic) —
payload capture + structure.
**Method:** public-site analysis + clean-launch real Chrome, full network +
`sendBeacon` boundary capture. No account data.

> **TL;DR — payload captured at the `sendBeacon` boundary; the Forter events
> body is ENCRYPTED (opaque Blob, `Be` magic), while companion config/timing
> endpoints are plaintext.** The `forterToken` cookie format is decoded, the
> sensor is control-flow-obfuscated (switch-flattened, not a VM), and the
> signal surface (navigator/webgl/canvas/localStorage/mouse) matches the
> classic client-fingerprint pattern — but the fingerprint itself ships
> encrypted, so it's not plaintext-readable on the wire.

---

## 1. The sensor flow (Wish)

```
wish.com → <acct>.cdn4.forter.com/sn/<acct>/script.js     (sensor, 593 KB)
        → cdn123.forter.com/?u=<site>&v=2                  (config probe)
        → cdn0.forter.com/<acct>/<site>/prop.json          (config, encrypted c:)
        → POST cdn3.forter.com/events                      (fingerprint — sendBeacon Blob)
        → POST cdn0.forter.com/.../wpt.json                 (timing — plaintext JSON)
        → sets forterToken cookie                           (site-scoped)
```

| Endpoint | Body | Readable? |
|---|---|---|
| `cdn3.forter.com/events` | Blob (sendBeacon) | **encrypted** (`Be` magic) |
| `…/wpt.json` | `{"wpt":37.1,"sct":46.1,"dlt":11.5}` | ✅ plaintext |
| `…/prop.json` | `{"c":"uw/4wdd6bG4=","d":3,"v":"2"}` | config (encrypted `c`) |
| `cdn123.forter.com/?u=&v=2` | tiny | response |

## 2. forterToken format (decoded)

```
<site_id>_<ts>__<b64:16B>_-<chk>-v2
982040fa913644daaa16c69b9b02ed9a_1793466144173__UDF43-m4_24ck_PmSTt4T0S1s=-6158-v2
```
- site id (32-hex), unix ms, a **16-byte base64 payload** (high-entropy —
  a key/token, `503178de6e36e1c90f9924ede13d12d6`), a checksum, `-v2`.
- The fingerprint does NOT ride in the cookie — it's the `/events` body.

## 3. The sensor (script.js, 593 KB)

- **Obfuscation:** control-flow flattening (`for(;i1r!==9;){switch(i1r){case 5:…}}`)
  + string encoding — cheaper than Kasada's VM, same class as SEON/Castle.
- **Signal surface (counted):** navigator (222), localStorage (44), userAgent
  (40), webgl (18 + UNMASKED_*), canvas/toDataURL, screen, hardwareConcurrency,
  deviceMemory, plugins, mouse/touch/keyboard, performance, btoa/atob + XOR
  (`encrypt:3`) — the classic device fingerprint, assembled client-side.

## 4. What it means

- **Payload NOT plaintext on the wire** — the events Blob is encrypted before
  the beacon (server-decides from the encrypted token). This is the
  "client-readable-assembly, encrypted-shipping" pattern — stronger than the
  SDK batch (Stytch etc. shipped readable payloads), weaker than hCaptcha
  (no challenge).
- The plaintext *fragments* we have: wpt timing, forterToken cookie
  structure, config response — plus the full signal surface from the sensor
  source.
- The token/body encryption key presumably derives from `prop.json`'s `c` +
  sensor internals — not extracted in this pass.

## 5. Honest boundaries

- Beacons captured at the sendBeacon boundary (the only place the body is
  visible); the Blob is encrypted, not decrypted in this pass.
- The Wish API token test (`/api/order` with forterToken variants) returned
  403 for all (auth-gated), so no server-acceptance conclusion drawn.
- No account data touched.

## 6. Artifacts

| File | What |
|---|---|
| `scripts/ftr-*.mjs` | capture probes (flow, events, blob-hook) |
| `artifacts/forter-payload.json` | the encrypted `/events` Blob bodies |
| `artifacts/forter-token.json` | decoded forterToken |
| `artifacts/events-capture.json` | wpt/config POSTs |
| `artifacts/forter-sensor.js` | the 593 KB sensor (from cdn4) |
