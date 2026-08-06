import { readJSON, writeJSON } from "./local-storage";

const KEY = "giggifi_dismissed_announcements";

export async function getDismissedAnnouncementIds(): Promise<string[]> {
  return readJSON<string[]>(KEY, []);
}

export async function dismissAnnouncement(id: string): Promise<void> {
  const ids = await getDismissedAnnouncementIds();
  if (!ids.includes(id)) await writeJSON(KEY, [...ids, id]);
}
