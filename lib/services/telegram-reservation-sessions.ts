import { BaseCrudService } from "@/lib/services/base-crud";
import { telegramReservationSessionsRepository } from "@/lib/storage/repositories";
import type { TelegramReservationMode, TelegramReservationSessionRecord, TelegramReservationStep } from "@/types/models";

class TelegramReservationSessionsService extends BaseCrudService<TelegramReservationSessionRecord> {
  constructor() {
    super(telegramReservationSessionsRepository);
  }

  async findByChatId(chatId: string) {
    return this.findById(chatId);
  }

  async start(chatId: string, userId: string, mode: TelegramReservationMode, step: TelegramReservationStep) {
    const existing = await this.findByChatId(chatId);
    if (existing) {
      return this.update(chatId, {
        userId,
        mode,
        step,
        locationId: undefined,
        date: undefined,
        time: undefined,
        partySize: undefined,
        name: undefined,
        notes: undefined,
        reservationIds: undefined,
        selectedReservationId: undefined,
      });
    }

    return this.create({
      id: chatId,
      chatId,
      userId,
      mode,
      step,
    });
  }

  async clear(chatId: string) {
    return this.delete(chatId);
  }
}

export const telegramReservationSessionsService = new TelegramReservationSessionsService();
