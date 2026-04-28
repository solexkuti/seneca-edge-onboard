import { userKey } from "@/lib/userScopedStorage";

const SUFFIX = "userName";

export function saveUserName(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userKey(SUFFIX), name);
  } catch {
    // ignore
  }
}

export function getUserName(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(userKey(SUFFIX));
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}
