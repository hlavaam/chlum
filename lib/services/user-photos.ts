import { getCloudflareR2Bucket } from "@/lib/storage/storage-backend";

export async function uploadUserPhoto(params: {
  userId: string;
  bytes: ArrayBuffer;
  contentType: string;
}) {
  const bucket = await getCloudflareR2Bucket();
  if (!bucket) return null;

  const key = `users/${params.userId}/profile`;
  await bucket.put(key, params.bytes, {
    httpMetadata: {
      contentType: params.contentType,
      cacheControl: "public, max-age=3600",
    },
  });
  return { key, contentType: params.contentType };
}

export async function getUserPhotoObject(key: string) {
  const bucket = await getCloudflareR2Bucket();
  if (!bucket) return null;
  return bucket.get(key);
}
