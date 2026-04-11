import { NextResponse } from "next/server";

import { getTelegramWebhookSecret, replyToTelegramUpdate, type TelegramUpdate } from "@/lib/telegram-reservations";

export async function POST(request: Request) {
  const expectedSecret = getTelegramWebhookSecret();
  if (!expectedSecret) {
    return NextResponse.json({ error: "Telegram bot neni nakonfigurovany." }, { status: 503 });
  }

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid Telegram webhook secret." }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) {
    return NextResponse.json({ error: "Invalid Telegram update." }, { status: 400 });
  }

  await replyToTelegramUpdate(update);
  return NextResponse.json({ ok: true });
}
