import { DEFAULT_HOMEPAGE_ABOUT, HOMEPAGE_ABOUT_SECTION_ID, normalizeHomepageAboutSection } from "@/lib/homepage-about";
import { BaseCrudService } from "@/lib/services/base-crud";
import { homepageSectionsRepository } from "@/lib/storage/repositories";
import type { HomepageSectionRecord } from "@/types/models";

class HomepageSectionsService extends BaseCrudService<HomepageSectionRecord> {
  constructor() {
    super(homepageSectionsRepository);
  }

  async getAboutSection() {
    const record = await this.findById(HOMEPAGE_ABOUT_SECTION_ID);
    return normalizeHomepageAboutSection(record);
  }

  async ensureAboutSection() {
    const record = await this.findById(HOMEPAGE_ABOUT_SECTION_ID);
    if (record) return normalizeHomepageAboutSection(record);
    return this.create({
      id: HOMEPAGE_ABOUT_SECTION_ID,
      ...DEFAULT_HOMEPAGE_ABOUT,
    });
  }
}

export const homepageSectionsService = new HomepageSectionsService();
