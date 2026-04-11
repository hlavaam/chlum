import { HomepageAboutAdmin } from "@/components/homepage-about-admin";
import { SiteSettingsAdmin } from "@/components/site-settings-admin";
import { requireRoles } from "@/lib/auth/rbac";
import { homepageSectionsService } from "@/lib/services/homepage-sections";
import { siteSettingsService } from "@/lib/services/site-settings";
import { adminPaths } from "@/lib/paths";

export default async function AdminWebPage() {
  await requireRoles(["manager", "admin"], {
    loginPath: adminPaths.login,
    fallbackPath: adminPaths.root,
  });

  const [aboutSection, siteSettings] = await Promise.all([
    homepageSectionsService.ensureAboutSection(),
    siteSettingsService.ensurePublicSettings(),
  ]);

  return (
    <main className="app-shell">
      <section className="panel stack admin-dashboard-hero">
        <p className="eyebrow">Restaurace Vyskeř / Admin</p>
        <h1>Obsah webu</h1>
        <p className="subtle">Tady upravíš veřejné sekce homepage bez zásahu do kódu. První hotová část je sekce O nás.</p>
      </section>

      <HomepageAboutAdmin initialSection={aboutSection} />
      <SiteSettingsAdmin initialSettings={siteSettings} />
    </main>
  );
}
