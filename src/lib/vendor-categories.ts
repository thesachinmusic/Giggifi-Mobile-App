// Mirrors lib/vendor-categories.ts on the website — keep these two lists in sync.
// Website has subcategories per category too; mobile only needs the top-level list for
// the browse pill row (subcategories surface inside vendor search/filter, not here).
export const VENDOR_CATEGORIES = [
  { label: "Photography & Videography", emoji: "📷" },
  { label: "Decor & Design", emoji: "🎨" },
  { label: "Catering & Food", emoji: "🍽️" },
  { label: "Beauty & Styling", emoji: "💄" },
  { label: "Venues & Spaces", emoji: "🏛️" },
  { label: "Sound & Lights", emoji: "🔊" },
  { label: "Event Production & Technical", emoji: "🎛️" },
  { label: "Planning & Coordination", emoji: "📋" },
  { label: "Invitations & Print", emoji: "✉️" },
  { label: "Transport & Logistics", emoji: "🚗" },
  { label: "Kids & Family Entertainment", emoji: "🎪" },
  { label: "Security & Support Staff", emoji: "🛡️" },
  { label: "Wellness & Extras", emoji: "🧘" },
] as const;
