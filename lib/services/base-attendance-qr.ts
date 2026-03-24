import { createHmac } from "crypto";

import QRCode from "qrcode";

const PREFIX = "base-attendance";

function getSecret() {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}

export function createBaseAttendanceToken(userId: string) {
  const payload = `${PREFIX}:${userId}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex").slice(0, 32);
  return `${payload}:${signature}`;
}

export function resolveBaseAttendanceToken(token: string) {
  const [prefix, userId, signature] = token.split(":");
  if (prefix !== PREFIX || !userId || !signature) return null;
  const expected = createHmac("sha256", getSecret()).update(`${PREFIX}:${userId}`).digest("hex").slice(0, 32);
  return signature === expected ? userId : null;
}

export async function createBaseAttendanceQrDataUrl(userId: string) {
  return QRCode.toDataURL(createBaseAttendanceToken(userId), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: {
      dark: "#17342e",
      light: "#0000",
    },
  });
}
