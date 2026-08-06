import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_language_preference";

export type Language = "en" | "hi" | "mr";

// Device-local only — notification_templates only has English rows seeded
// so far (see website repo, Prompt 6), so this doesn't change what content
// looks like yet. It's stored now so the setting exists and sticks once
// hi/mr templates ship, instead of shipping the picker twice.
export function getLanguagePreference(): Promise<Language> {
  return readJSON<Language>(KEY, "en");
}

export function setLanguagePreference(language: Language): Promise<void> {
  return writeJSON(KEY, language);
}
