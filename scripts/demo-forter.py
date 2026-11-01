#!/usr/bin/env python3
"""demo-forter.py — print the FULL decrypted Forter /events payload.
Decrypts a captured wire blob: AES-256-CTR (static key recovered from the
sensor) -> gzip -> JSON. Shows the complete 19-signal telemetry."""
import sys, gzip, json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

KEY = bytes.fromhex('7af086d4c2afa1bc7a8ecf87567600c8e80d0d1e9f3c2ff75c9c3d56c4f7a187')
CTR = bytes([0xaa,0x3b,0xa7,0x1f,0xf1,0x57,0xdc,0xb6,0xea,0x1b,0xfe,0x78,0x8d,0x1e,0x70,0x0b])

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/opencode/frt/raw-event-dyseoqcewbe.bin'
    wire = open(src, 'rb').read()
    c = Cipher(algorithms.AES(KEY), modes.CTR(CTR)).decryptor()
    pt = c.update(wire) + c.finalize()
    assert pt[:2] == b'\x1f\x8b', 'not gzip'
    plain = gzip.decompress(pt)
    d = json.loads(plain)
    print('=' * 74)
    print('FORTER /events — FULL DECRYPTED PAYLOAD')
    print('key: 7af086d4c2afa1bc7a8ecf87567600c8e80d0d1e9f3c2ff75c9c3d56c4f7a187')
    print('flow: AES-256-CTR (static key) -> gzip -> JSON   wire bytes:', len(wire))
    print('=' * 74)
    print(json.dumps(d, indent=2))
    print('=' * 74)
    print(f'TOP-LEVEL: user[{len(d.get("user", []))}] bcn={d.get("bcn")} si={d.get("si")} '
          f'powt={d.get("powt")} userId={d.get("userId")}')
    acts = [u.get('action') for u in d.get('user', [])]
    print('SIGNALS SHIPPED:', ', '.join(acts))

if __name__ == '__main__':
    main()
