import { BaseCrudService } from "@/lib/services/base-crud";
import { eventsRepository } from "@/lib/storage/repositories";
import { shiftsService } from "@/lib/services/shifts";
import type { EventRecord } from "@/types/models";

class EventsService extends BaseCrudService<EventRecord> {
  async create(input: Partial<EventRecord>): Promise<EventRecord> {
    const event = await super.create(input);
    const existingShift = (await shiftsService.loadAll()).find(
      (shift) => shift.date === event.date && shift.locationId === event.locationId,
    );
    const shiftPayload = {
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      locationId: event.locationId,
      type: event.type,
      requiredRoles: event.requiredRoles ?? [],
      minimumPeople: event.minimumPeople ?? 0,
      requiresApproval: true,
      notes: event.notes,
      eventId: event.id,
    };
    const shift = existingShift
      ? ((await shiftsService.update(existingShift.id, shiftPayload)) ?? existingShift)
      : await shiftsService.create(shiftPayload);
    const updated = await super.update(event.id, { shiftId: shift.id });
    return updated ?? event;
  }

  async update(id: string, patch: Partial<EventRecord>): Promise<EventRecord | null> {
    const updated = await super.update(id, patch);
    if (!updated) return null;
    if (updated.shiftId) {
      await shiftsService.update(updated.shiftId, {
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
        locationId: updated.locationId,
        type: updated.type,
        requiredRoles: updated.requiredRoles,
        minimumPeople: updated.minimumPeople,
        notes: updated.notes,
        eventId: updated.id,
      });
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const event = await this.findById(id);
    const deleted = await super.delete(id);
    if (deleted && event?.shiftId) {
      await shiftsService.deleteCascade(event.shiftId);
    }
    return deleted;
  }
}

export const eventsService = new EventsService(eventsRepository);
