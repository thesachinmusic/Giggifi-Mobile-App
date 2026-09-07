import { useRef, useState } from "react";
import type { VideoPlayer } from "expo-video";
import { useEvent } from "expo";

// How long a press has to be held before it counts as "hold for 2x" rather
// than a quick tap — matches the ~200ms Instagram/WhatsApp status use for
// the same gesture, short enough that a real tap never accidentally
// triggers it, long enough that a real hold never gets misread as a tap.
const HOLD_THRESHOLD_MS = 200;

// Shared across every screen a video plays on (FullScreenVideoPlayer, the
// Reels tab, video-feed.tsx) — seek-slider state and the press-and-hold-to-
// 2x gesture, the two pieces every one of those screens was missing before
// this. Deliberately does NOT own play/pause state itself: each screen
// already has its own play/pause lifecycle tied to isActive/mount (with
// real Android-touch-reliability fixes documented in their own comments),
// so this only wraps the player directly for what's genuinely new, and
// takes the caller's own "toggle play/pause" as a callback for the
// quick-tap case.
//
// Requires the caller's player to have been constructed with
// `instance.timeUpdateEventInterval` set to a non-zero value (0 is the
// expo-video default and disables the timeUpdate event entirely) — without
// that, currentTime here never updates and the seek bar looks frozen.
export function useVideoPlaybackControls(player: VideoPlayer) {
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const duration = player.duration || 0;

  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const sliderValue = dragging ? dragValue : currentTime;

  function startDrag() {
    setDragging(true);
    setDragValue(currentTime);
  }
  function updateDrag(value: number) {
    setDragValue(value);
  }
  function commitDrag(value: number) {
    player.currentTime = value;
    setDragging(false);
  }

  const [isFastForward, setIsFastForward] = useState(false);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdActiveRef = useRef(false);

  function handleHoldPressIn() {
    holdActiveRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      player.playbackRate = 2;
      setIsFastForward(true);
    }, HOLD_THRESHOLD_MS);
  }

  // onQuickTap only fires when the press released before the hold
  // threshold — a real hold-then-release never also fires the tap action
  // (e.g. play/pause), matching how Instagram/WhatsApp status don't pause
  // when you let go after fast-forwarding.
  function handleHoldPressOut(onQuickTap?: () => void) {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdActiveRef.current) {
      player.playbackRate = 1;
      setIsFastForward(false);
      holdActiveRef.current = false;
    } else {
      onQuickTap?.();
    }
  }

  function cancelHold() {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdActiveRef.current) {
      player.playbackRate = 1;
      holdActiveRef.current = false;
    }
    setIsFastForward(false);
  }

  return {
    currentTime,
    duration,
    sliderValue,
    dragging,
    startDrag,
    updateDrag,
    commitDrag,
    isFastForward,
    handleHoldPressIn,
    handleHoldPressOut,
    cancelHold,
  };
}
