import { unstable_cache } from "next/cache";

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b));
    const parts = keys.map((key) => `${key}:${stableSerialize(objectValue[key])}`);
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(String(value));
}

type CacheKeyPart<TArgs extends unknown[]> = string | ((...args: TArgs) => string);
type CacheTagResolver<TArgs extends unknown[]> = string | ((...args: TArgs) => string);

type CachedServiceCallOptions<TArgs extends unknown[]> = {
  keyPrefix: string;
  revalidate?: number;
  keyParts?: CacheKeyPart<TArgs>[];
  tags?: CacheTagResolver<TArgs>[];
};

export function cachedServiceCall<TArgs extends unknown[], TResult>(
  fetcher: (...args: TArgs) => Promise<TResult>,
  options: CachedServiceCallOptions<TArgs>,
) {
  return (...args: TArgs): Promise<TResult> => {
    const dynamicKeyParts = (options.keyParts ?? []).map((part) =>
      typeof part === "function" ? part(...args) : part,
    );
    const key = [options.keyPrefix, ...dynamicKeyParts.map((value) => stableSerialize(value))];
    const tags = (options.tags ?? []).map((tag) => (typeof tag === "function" ? tag(...args) : tag));

    return unstable_cache(
      async () => fetcher(...args),
      key,
      {
        revalidate: options.revalidate ?? 60,
        tags,
      },
    )();
  };
}
