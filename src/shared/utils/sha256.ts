export function sha256(str: string): string {
  const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const sigma0 = (x: number) => (x >>> 2 | x << 30) ^ (x >>> 13 | x << 19) ^ (x >>> 22 | x << 10);
  const sigma1 = (x: number) => (x >>> 6 | x << 26) ^ (x >>> 11 | x << 21) ^ (x >>> 25 | x << 7);
  const gamma0 = (x: number) => (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3 | 0);
  const gamma1 = (x: number) => (x >>> 17 | x << 15) ^ (x >>> 19 | x << 13) ^ (x >>> 10 | 0);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  // Encode string to UTF-8 array
  const words: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      words.push(code);
    } else if (code < 0x800) {
      words.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      words.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      const nextCode = str.charCodeAt(i);
      const fullCode = 0x10000 + (((code & 0x3ff) << 10) | (nextCode & 0x3ff));
      words.push(
        0xf0 | (fullCode >> 18),
        0x80 | ((fullCode >> 12) & 0x3f),
        0x80 | ((fullCode >> 6) & 0x3f),
        0x80 | (fullCode & 0x3f)
      );
    }
  }

  const bitLength = words.length * 8;
  words.push(0x80);
  while ((words.length + 8) % 64 !== 0) {
    words.push(0x00);
  }

  // Append bitLength as 64-bit big-endian integer
  words.push(0, 0, 0, 0); // High 32 bits
  words.push(
    (bitLength >> 24) & 0xff,
    (bitLength >> 16) & 0xff,
    (bitLength >> 8) & 0xff,
    bitLength & 0xff
  );

  const blockCount = words.length / 64;
  const W = new Int32Array(64);

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
    const offset = blockIndex * 64;
    for (let t = 0; t < 16; t++) {
      W[t] = (words[offset + t * 4] << 24) |
             (words[offset + t * 4 + 1] << 16) |
             (words[offset + t * 4 + 2] << 8) |
             (words[offset + t * 4 + 3]);
    }
    for (let t = 16; t < 64; t++) {
      W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) | 0;
      const T2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) | 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  const toHex = (n: number) => {
    let hex = (n >>> 0).toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex;
  };

  return H.map(toHex).join('');
}
