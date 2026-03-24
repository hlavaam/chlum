import type { UserRecord } from "@/types/models";

export function getUserPhotoSrc(user: Pick<UserRecord, "id" | "photoDataUrl" | "photoKey">) {
  if (user.photoKey) return `/api/users/${user.id}/photo`;
  if (user.photoDataUrl) return user.photoDataUrl;
  return null;
}
