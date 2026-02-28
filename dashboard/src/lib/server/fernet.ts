import crypto from "crypto";

const FERNET_VERSION = 0x80;

function toBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return normalized + padding;
}

function fromBase64(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeFernetKey(): { signingKey: Buffer; encryptionKey: Buffer } {
  const key = process.env.IAA_ENCRYPTION_KEY ?? "";
  const raw = Buffer.from(toBase64(key), "base64");
  if (raw.length !== 32) {
    throw new Error("IAA_ENCRYPTION_KEY must be a valid Fernet key");
  }
  return {
    signingKey: raw.subarray(0, 16),
    encryptionKey: raw.subarray(16, 32),
  };
}

function timestampBytes(seconds: number): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(BigInt(seconds), 0);
  return out;
}

export function encryptWithFernet(plaintext: string): string {
  const { signingKey, encryptionKey } = decodeFernetKey();
  const issuedAt = Math.floor(Date.now() / 1000);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-128-cbc", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf-8")), cipher.final()]);

  const tokenWithoutSig = Buffer.concat([
    Buffer.from([FERNET_VERSION]),
    timestampBytes(issuedAt),
    iv,
    ciphertext,
  ]);

  const sig = crypto.createHmac("sha256", signingKey).update(tokenWithoutSig).digest();
  return fromBase64(Buffer.concat([tokenWithoutSig, sig]).toString("base64"));
}

export function decryptWithFernet(token: string): string {
  const { signingKey, encryptionKey } = decodeFernetKey();
  const raw = Buffer.from(toBase64(token), "base64");

  if (raw.length < 1 + 8 + 16 + 32) {
    throw new Error("Invalid fernet token");
  }
  if (raw[0] !== FERNET_VERSION) {
    throw new Error("Unsupported fernet token version");
  }

  const body = raw.subarray(0, raw.length - 32);
  const sig = raw.subarray(raw.length - 32);
  const expected = crypto.createHmac("sha256", signingKey).update(body).digest();
  if (!crypto.timingSafeEqual(sig, expected)) {
    throw new Error("Invalid fernet token signature");
  }

  const iv = body.subarray(1 + 8, 1 + 8 + 16);
  const ciphertext = body.subarray(1 + 8 + 16);

  const decipher = crypto.createDecipheriv("aes-128-cbc", encryptionKey, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}
