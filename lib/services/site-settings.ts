import { BaseCrudService } from "@/lib/services/base-crud";
import { DEFAULT_PUBLIC_SITE_SETTINGS, normalizePublicSiteSettings, PUBLIC_SITE_SETTINGS_ID } from "@/lib/site-settings";
import { siteSettingsRepository } from "@/lib/storage/repositories";
import type { SiteSettingsRecord } from "@/types/models";

class SiteSettingsService extends BaseCrudService<SiteSettingsRecord> {
  constructor() {
    super(siteSettingsRepository);
  }

  async getPublicSettings() {
    const settings = await this.findById(PUBLIC_SITE_SETTINGS_ID);
    return normalizePublicSiteSettings(settings);
  }

  async ensurePublicSettings() {
    const settings = await this.findById(PUBLIC_SITE_SETTINGS_ID);
    if (settings) return normalizePublicSiteSettings(settings);
    return this.create({
      id: PUBLIC_SITE_SETTINGS_ID,
      ...DEFAULT_PUBLIC_SITE_SETTINGS,
    });
  }
}

export const siteSettingsService = new SiteSettingsService();
