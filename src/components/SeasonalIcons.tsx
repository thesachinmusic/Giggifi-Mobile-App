import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

// Original line-art designed for Home's Seasonal Picks rail — one per
// occasion, white stroke on the card's dark background, same slot the
// emoji glyph used to sit in. Matched against a pick's title by keyword
// (see getSeasonalIcon below) rather than an exact string, since the
// website appends " Special" to any dated (non-evergreen)
// FestivalCalendarEntry — e.g. "Ganpati Special" — while an evergreen
// entry's title is just its bare name (e.g. "Wedding Season").
function GanpatiIcon() {
  return (
    <Svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3c-4 4.5-6 7.5-6 10.5a6 6 0 0 0 12 0C18 10.5 16 7.5 12 3z" />
      <Path d="M8.5 12.5h7M8.5 15.5h7" />
      <Circle cx={12} cy={9.5} r={1} />
    </Svg>
  );
}

function DiwaliIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Ellipse cx={12} cy={17} rx={7} ry={2.2} />
      <Path d="M7 17c0-2 2-3 5-3s5 1 5 3" />
      <Path d="M12 14c-1-2.5-1-4 0-6.5 1 2.5 1 4 0 6.5z" />
      <Path d="M12 7.5c.6-1 .6-2 0-3" />
    </Svg>
  );
}

function WeddingIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6}>
      <Circle cx={9} cy={14} r={5.5} />
      <Circle cx={15} cy={14} r={5.5} />
    </Svg>
  );
}

function CorporateIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={5} width={14} height={16} rx={1} />
      <Line x1={8} y1={9} x2={8} y2={9.01} />
      <Line x1={12} y1={9} x2={12} y2={9.01} />
      <Line x1={16} y1={9} x2={16} y2={9.01} />
      <Line x1={8} y1={13} x2={8} y2={13.01} />
      <Line x1={12} y1={13} x2={12} y2={13.01} />
      <Line x1={16} y1={13} x2={16} y2={13.01} />
      <Path d="M10 21v-4h4v4" />
    </Svg>
  );
}

function BhajanSufiIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={9} y={2} width={6} height={10} rx={3} />
      <Path d="M6 11a6 6 0 0 0 12 0" />
      <Line x1={12} y1={17} x2={12} y2={21} />
      <Line x1={9} y1={21} x2={15} y2={21} />
    </Svg>
  );
}

// Keyword, not exact-title, match — see the file comment above for why.
const ICON_MATCHERS: { keywords: string[]; Icon: () => React.JSX.Element }[] = [
  { keywords: ["ganpati", "ganesh"], Icon: GanpatiIcon },
  { keywords: ["diwali", "deepavali"], Icon: DiwaliIcon },
  { keywords: ["wedding"], Icon: WeddingIcon },
  { keywords: ["corporate"], Icon: CorporateIcon },
  { keywords: ["bhajan", "sufi"], Icon: BhajanSufiIcon },
];

// Returns null for any occasion not covered above (there is no line-art
// for it yet) — the caller falls back to the admin-configured emoji glyph
// in that case rather than showing nothing.
export function getSeasonalIcon(title: string): (() => React.JSX.Element) | null {
  const lower = title.toLowerCase();
  return ICON_MATCHERS.find((m) => m.keywords.some((k) => lower.includes(k)))?.Icon ?? null;
}
