import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { resourcePolicies, resourceServices } from "@/lib/services/resources";
import { serializeRecord } from "@/lib/serializers";
import type { ResourceName } from "@/types/models";

type RouteContext = { params: Promise<{ resource: string; id: string }> };

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

export async function GET(_request: Request, context: RouteContext) {
  const { resource: raw, id } = await context.params;
  const resource = parseResource(raw);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorize(resource, "read");
  if ("error" in auth) return auth.error;

  const row = await resourceServices[resource].findById(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: serializeRecord(resource, row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { resource: raw, id } = await context.params;
  const resource = parseResource(raw);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorize(resource, "write");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const row = await resourceServices[resource].update(id, body);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: serializeRecord(resource, row) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { resource: raw, id } = await context.params;
  const resource = parseResource(raw);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorize(resource, "write");
  if ("error" in auth) return auth.error;

  const ok = await resourceServices[resource].delete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
