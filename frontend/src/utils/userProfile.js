const STORAGE_KEY = "voxidria_user_profile_v1";

function readStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures.
  }
}

function splitName(fullName) {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function defaultProfileFromUser(user) {
  const derived = splitName(user?.name);
  return {
    firstName: user?.given_name || derived.firstName || "",
    lastName: user?.family_name || derived.lastName || "",
    email: user?.email || "",
    phone: user?.phone_number || "",
  };
}

export function getStoredProfile(userId) {
  if (!userId) return null;
  const store = readStore();
  const profile = store[userId];
  return profile && typeof profile === "object" ? profile : null;
}

export function saveStoredProfile(userId, profile) {
  if (!userId) return;
  const store = readStore();
  store[userId] = {
    firstName: String(profile?.firstName || "").trim(),
    lastName: String(profile?.lastName || "").trim(),
    email: String(profile?.email || "").trim(),
    phone: String(profile?.phone || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
}

export function mergedProfileForUser(user) {
  const defaults = defaultProfileFromUser(user);
  const stored = getStoredProfile(user?.sub);
  return stored ? { ...defaults, ...stored } : defaults;
}

export function profileDisplayName(user, profile) {
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || user?.name || user?.nickname || user?.email || "User";
}

export function profileInitials(user, profile) {
  const displayName = profileDisplayName(user, profile);
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  const normalized = (parts[0] || "U").replace(/[^a-zA-Z0-9]/g, "");
  return (normalized.slice(0, 2) || "U").toUpperCase();
}

export function authProviderLabel(user) {
  const providerKey = String(user?.sub || "").split("|")[0];
  const map = {
    "google-oauth2": "Google",
    auth0: "Email + Password",
    github: "GitHub",
    apple: "Apple",
    facebook: "Facebook",
  };
  return map[providerKey] || "Account";
}
