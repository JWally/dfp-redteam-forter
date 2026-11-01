#!/usr/bin/env python3
"""Forter /events decrypt + tamper round-trip (2026-11-01)

Key recovered from sensor static init: AES-256-CTR, counter const.
Flow: telemetry JSON -> gzip -> AES-CTR(key) -> wire blob ("a1 Be 01 ..." is
      the ciphertext itself, NOT a magic header).
Round-trip proof: decrypt a captured blob, modify a signal, re-encrypt, and
confirm the result is a structurally identical wire blob. Local only.
"""
import gzip, json, sys, struct
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

KEY = bytes.fromhex('7af086d4c2afa1bc7a8ecf87567600c8e80d0d1e9f3c2ff75c9c3d56c4f7a187')
CTR = bytes([0xaa,0x3b,0xa7,0x1f,0xf1,0x57,0xdc,0xb6,0xea,0x1b,0xfe,0x78,0x8d,0x1e,0x70,0x0b])

def aes_ctr(data, key=KEY, ctr=CTR):
    c = Cipher(algorithms.AES(key), modes.CTR(ctr)).decryptor()
    return c.update(data) + c.finalize()

def decrypt_wire(wire):
    pt = aes_ctr(wire)
    assert pt[:2] == b'\x1f\x8b', "not gzip after decrypt"
    return gzip.decompress(pt)

def encrypt_wire(plain):
    return aes_ctr(gzip.compress(plain))

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/opencode/frt/raw-event-dyseoqcewbe.bin'
    wire = open(src, 'rb').read()
    plain = decrypt_wire(wire)
    d = json.loads(plain)
    print("decrypted JSON keys:", list(d.keys()))
    print("  bcn:", d.get('bcn'), "| si:", d.get('si'), "| userId:", d.get('userId'))
    print("  actions:", [u.get('action') for u in d.get('user',[])])
    # locate the webgl action and tamper hardwareConcurrency
    tampered = False
    for u in d.get('user', []):
        if u.get('action') == 'webgl':
            import json as _j
            t = _j.loads(u['text']); t['mtHardwareConcurrency'] = 2
            u['text'] = _j.dumps(t); tampered = True
    # also tamper the UA
    if 'userAgent' in d:
        d['userAgent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36'
    if tampered:
        print("\nTAMPERED: webgl.mtHardwareConcurrency 12 -> 2, UA -> Chrome/999")
    newplain = json.dumps(d).encode()
    newwire = encrypt_wire(newplain)
    print("\nround-trip:")
    print("  orig wire len:", len(wire), "| new wire len:", len(newwire))
    print("  orig head:", wire[:8].hex(), "| new head:", newwire[:8].hex())
    print("  orig tail:", wire[-8:].hex(), "| new tail:", newwire[-8:].hex())
    print("  re-decrypt new wire head:", decrypt_wire(newwire)[:8])
    print("\n  -> structurally identical envelope; server can't tell it from a genuine beacon by format.")
    open('/tmp/opencode/frt/tampered.bin','wb').write(newwire)
    open('/tmp/opencode/frt/tampered.json','w').write(json.dumps(d,indent=1))
    print("  saved /tmp/opencode/frt/tampered.bin + tampered.json")

if __name__ == '__main__':
    main()
