# Forter /events payload — full decrypt (2026-11-01)

**The `/events` telemetry is AES-256-CTR encrypted with a HARDCODED key in the
sensor, then gzip.** The "Be magic" from the first pass was NOT an envelope
header — it's just the first ciphertext bytes. With the key recovered from the
sensor's static init, every payload decrypts to readable JSON.

## The crypto (recovered from the sensor)

- `n9M = new Uint32Array([-U_O,-k6b,-S$q,-i8j,F9G,-J27,H0g,-R1P])` — a static
  32-byte AES-256 key, imported as `raw` via `crypto.subtle.importKey`.
- Counter (16 bytes, also static): `aa 3b a7 1f f1 57 dc b6 ea 1b fe 78 8d 1e 70 0b`.
- Flow: **telemetry JSON → gzip → AES-256-CTR → wire blob**. No per-request
  random IV, no asymmetric wrapping for the events channel.
- Confirmed live by hooking `crypto.subtle.importKey`/`encrypt` on the real
  sensor — the runtime key bytes match the static init exactly.

Key (hex): `7af086d4c2afa1bc7a8ecf87567600c8e80d0d1e9f3c2ff75c9c3d56c4f7a187`

## What's in the plaintext

```json
{
  "user": [ ...19 action records... ],
  "bcn": "10913773-011f-43f0-b867-d1857d93e8ce",
  "si": "9b7afadc4f9b",
  "powt": "GEBme0ihiCI=-4096-v2",
  "userId": "b1382e45317640ad8042a326de331dc3",
  "userAgent": "Mozilla/5.0 ...",
  "url": "https://www.wish.com/",
  "refer": ""
}
```

Signal surface: `language, time, browser, plugins, load, cfp` (canvas
fingerprint incl. font metrics), `hdls` (plugins/handlers/feature policies),
`ipfi` (IP?), `mcon` (network: effectiveType/rtt/downlink), `opd` (opacity?),
`rndrtl`, `scr` (screen dims/dpr), `wgp` (WebGPU), `jsm` (JS memory),
`stm` (storage/timing), `webgl` (hardwareConcurrency, worker exec time),
`wrtc` (WebRTC device enum), `imm`, `pow` (the token challenge:
`{"challenge":"GEBme0ihiCI=","num":4096,"v":"2"}`).

## Tamper round-trip (proven locally)

`decrypt -> modify (webgl hardwareConcurrency 12->2, UA->Chrome/999) ->
re-encrypt` produces a structurally identical wire blob (same format, valid
gzip inside). The server cannot distinguish the forged beacon from a genuine
one by format alone.

## Script

`scripts/ftr-decrypt.py` — decrypt a captured blob, dump the JSON, tamper,
re-encrypt. Usage: `python3 scripts/ftr-decrypt.py <blob.bin>`.

## Honest caveats

- We did NOT ship the tampered blob to a live endpoint (read-only pass); the
  round-trip is proven locally. Whether the server *accepts* tampered signals
  for scoring is untested — but the transport layer provides zero protection:
  the key ships in the client.
- The `pow`/`powt` token is a server-issued challenge (num=4096 PoW); not
  minted. It's a cost gate on beacon issuance, not payload integrity.
