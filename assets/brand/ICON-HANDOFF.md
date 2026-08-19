# GiggiFi icon set — handoff spec (Option B, full wordmark)

Built 17 Aug 2026 from `assets/images/giggifi-logo-cropped.png`.

**Method:** the master logo is flat silhouette art, so its alpha channel was traced to
vector with `potrace` (6× supersample) and re-rendered at target size. Nothing is a
raster upscale — the source artwork is only 869×324, so a plain resize would have been
visibly soft at 1024. Colours are the exact brand tokens from `src/theme/colors.ts`:
`#a855f7` → `#e0307a` (45%) → `#ff8a3d`, on ink `#0c0710`.

**Mark:** the **full GiggiFi wordmark**, scaled to 90% of the icon width — the largest it
can go before colliding with the platform corner mask. The G monogram version is included
as `icon-monogram-ALTERNATE.png` if you ever want to switch.

**One deliberate exception:** `notification-icon.png` and `favicon.png` use the G monogram,
not the wordmark. Android renders the status-bar glyph at roughly 24dp and the favicon is
48px; at those sizes a 2.68:1 wordmark is an unreadable smear regardless of how it is
drawn. These are separate assets from the app icon, so this does not affect the icon
choice.

## Files and where each goes

| File | Destination | Spec |
|---|---|---|
| `icon.png` | `assets/images/icon.png` | 1024×1024, **RGB, no alpha**, full bleed |
| `android-icon-foreground.png` | `assets/images/android-icon-foreground.png` | 1024×1024 RGBA, transparent, content at 64% |
| `android-icon-background.png` | `assets/images/android-icon-background.png` | 1024×1024, full-bleed gradient |
| `android-icon-monochrome.png` | `assets/images/android-icon-monochrome.png` | 1024×1024 RGBA, transparent silhouette |
| `notification-icon.png` | `assets/images/notification-icon.png` | 96×96 RGBA, white on transparent (G monogram) |
| `splash-icon.png` | `assets/images/splash-icon.png` | 1024×1024 RGBA, wordmark on transparent |
| `favicon.png` | `assets/images/favicon.png` | 48×48 (G monogram) |

Verified: the iOS icon is 1024×1024 RGB with **no alpha channel and no rounded corners**,
gradient running edge to edge — App Store Connect rejects a marketing icon carrying
transparency, and both platforms apply their own corner mask. Android foreground content
spans 64% of the canvas, inside the 66% safe zone the launcher crops to.

## `app.json` changes needed

```jsonc
{
  "expo": {
    // was "automatic" — the app is hard-coded dark, and "automatic" lets the OS
    // render the Android date picker, Razorpay sheet and keyboard in light mode
    "userInterfaceStyle": "dark",

    "icon": "./assets/images/icon.png",

    "ios": {
      // DELETE the "icon": "./assets/expo.icon" line entirely — that directory is
      // Expo's template icon (an expo-symbol on an iOS-blue gradient). Removing the
      // key makes iOS fall back to the top-level icon above.
      "bundleIdentifier": "com.giggifi.app"
    },

    "android": {
      "adaptiveIcon": {
        // was "#E6F4FE" (template pale blue)
        "backgroundColor": "#0c0710",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      }
    },

    "plugins": [
      ["expo-splash-screen", {
        // was "#208AEF" — a blue that flashed before the dark app loaded
        "backgroundColor": "#0c0710",
        "image": "./assets/images/splash-icon.png",
        // was 76, far too small for a wordmark
        "imageWidth": 220
      }],
      ["expo-notifications", {
        "color": "#ec4899",
        "icon": "./assets/images/notification-icon.png"
      }]
    ]
  }
}
```

## Also delete

`assets/expo.icon/` (the whole directory — Expo's template iOS icon), plus the unused
template art `assets/images/expo-logo.png`, `expo-badge.png`, `expo-badge-white.png`,
`tutorial-web.png`. Confirm nothing imports them first — at audit time nothing did.

For context on why this matters: `splash-icon.png` was previously **byte-identical** to
`expo-logo.png` (MD5 `5ee5db91d59518c45ebcc99a2f5afc57`), and `icon.png` and
`android-icon-foreground.png` were both the blue Expo chevron. Every icon slot was
template art.

## After wiring

```
npx expo prebuild --clean
```

Then check the icon on a real device home screen, in Settings, and in the notification
shade before submitting to either store.
