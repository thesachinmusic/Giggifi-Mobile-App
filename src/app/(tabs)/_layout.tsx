import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { hapticSelect } from "@/lib/haptics";
import { fonts, mock } from "@/theme";

// Height for border + tab item, excluding the bottom padding. Each tab item
// needs ~52pt: the navigator's own 5+5pt button padding (not overridable via
// tabBarItemStyle, which styles the outer wrapper) around the 28pt icon box
// and the ~14pt label. The earlier paddingTop 8 inside a 54 bar left 45, so
// the label was clipped (measured 7pt tall instead of ~14); paddingTop is 0
// now and the items' own padding supplies the top gap. Total height is
// unchanged (54 + bottom inset); ~88 on an iPhone with a 34pt inset.
const TAB_BAR_CONTENT_HEIGHT = 54;
const TAB_ICON_SIZE = 22;
// Devices with no home-indicator inset (web, many Androids) still get a bit
// of breathing room under the labels.
const MIN_BOTTOM_PADDING = 8;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, MIN_BOTTOM_PADDING);

  return (
    <Tabs
      screenListeners={{ tabPress: () => hapticSelect() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mock.tabActive,
        tabBarInactiveTintColor: mock.tabInactive,
        tabBarHideOnKeyboard: Platform.OS === "android",
        tabBarStyle: {
          backgroundColor: mock.tabBarBg,
          borderTopColor: mock.tabBarBorder,
          borderTopWidth: 1,
          height: TAB_BAR_CONTENT_HEIGHT + bottomPad,
          paddingTop: 0,
          paddingBottom: bottomPad,
        },
        // Mock: regular label when idle, bold in the active colour. The
        // font family can't change with focus via tabBarLabelStyle alone, so
        // the semibold face is used for every label (the colour carries
        // active/inactive); existing max weight is 600.
        tabBarLabelStyle: {
          fontFamily: fonts.bodySemiBold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color }) => <Feather name="search" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: "Reels",
          tabBarIcon: ({ color }) => <Feather name="film" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color }) => <Feather name="calendar" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: "Business",
          // Feather has no literal "building" glyph — briefcase is the
          // closest standard "business" icon in the set this app uses.
          tabBarIcon: ({ color }) => <Feather name="briefcase" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Feather name="user" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
