import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { resourcePolicies, resourceServices } from "@/lib/services/resources";
import { serializeList, serializeRecord } from "@/lib/serializers";
import type { ResourceName } from "@/types/models";

type RouteContext = { params: Promise<{ resource: string }> };

function parseResource(resource: string): ResourceName | null {
  return Object.prototype.hasOwnProperty.call(resourceServices, resource)
    ? (resource as ResourceName)
    : null;
}

async function authorize(resource: ResourceName, mode: "read" | "write") {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!resourcePolicies[resource][mode].includes(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request, context: RouteContext) {
  const { resource: raw } = await context.params;
  const resource = parseResource(raw);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorize(resource, "read");
  if ("error" in auth) return auth.error;

  const rows = await resourceServices[resource].loadAll();
  const url = new URL(request.url);
  const filtered = rows.filter((row: any) => {
    const date = url.searchParams.get("date");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const locationId = url.searchParams.get("locationId");
    if (date && "date" in row && row.date !== date) return false;
    if (startDate && "date" in row && row.date < startDate) return false;
    if (endDate && "date" in row && row.date > endDate) return false;
    if (locationId && "locationId" in row && row.locationId !== locationId) return false;
    return true;
  });
  return NextResponse.json({ data: serializeList(resource, filtered) });
}

export async function POST(request: Request, context: RouteContext) {
  const { resource: raw } = await context.params;
  const resource = parseResource(raw);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorize(resource, "write");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const created = await resourceServices[resource].create(body);
  return NextResponse.json({ data: serializeRecord(resource, created) }, { status: 201 });
}
