const KEY = "seneca:userName";

export function saveUserName(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    // ignore
  }
}

export function getUserName(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}
