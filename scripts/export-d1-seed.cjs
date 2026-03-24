const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_FILE = path.join(ROOT, "cloudflare", "d1", "seed.sql");
const RESOURCE_FILES = [
  ["users", "users.json"],
  ["locations", "locations.json"],
  ["events", "events.json"],
  ["shifts", "shifts.json"],
  ["shift_presets", "shift-presets.json"],
  ["assignments", "assignments.json"],
  ["invites", "invites.json"],
  ["calendar_connections", "calendar-connections.json"],
  ["calendar_syncs", "calendar-syncs.json"],
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function loadResourceRows() {
  const rows = [];

  for (const [resource, filename] of RESOURCE_FILES) {
    const filePath = path.join(DATA_DIR, filename);
    const items = readJson(filePath);
    for (const item of items) {
      rows.push({ resource, id: item.id, payload: item });
    }
  }

  const dailyMenuPath = path.join(DATA_DIR, "daily-menu.json");
  if (fs.existsSync(dailyMenuPath)) {
    const store = readJson(dailyMenuPath);
    for (const [date, menu] of Object.entries(store.days ?? {})) {
      const updatedAt = typeof menu.updatedAt === "string" ? menu.updatedAt : new Date().toISOString();
      rows.push({
        resource: "daily_menu",
        id: `daily-menu:${date}`,
        payload: {
          id: `daily-menu:${date}`,
          date,
          title: menu.title ?? "Denní menu",
          note: menu.note ?? "",
          items: Array.isArray(menu.items) ? menu.items : [],
          createdAt: updatedAt,
          updatedAt,
        },
      });
    }
  }

  return rows;
}

function buildSql(rows) {
  const resources = [...new Set(rows.map((row) => row.resource))];
  const lines = [
    `delete from app_records where resource in (${resources.map(sqlString).join(", ")});`,
  ];

  if (rows.length > 0) {
    lines.push("insert into app_records (resource, id, payload) values");
    lines.push(rows.map((row) => {
      const payload = JSON.stringify(row.payload);
      return `  (${sqlString(row.resource)}, ${sqlString(row.id)}, ${sqlString(payload)})`;
    }).join(",\n") + ";");
  }

  lines.push("");
  return lines.join("\n");
}

function main() {
  const rows = loadResourceRows();
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, buildSql(rows), "utf8");
  console.log(`[d1:seed] wrote ${rows.length} rows to ${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();
