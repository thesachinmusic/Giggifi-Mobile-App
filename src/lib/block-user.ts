import { Alert } from "react-native";
import { ApiError, blockUser, type BlockTarget } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { BLOCK_CONFIRM_BODY, BLOCK_CONFIRM_TITLE, BLOCK_DONE_TITLE, BLOCK_ERROR_TEXT, BLOCK_LOGIN_TEXT } from "@/lib/block-copy";

// Asks first, then blocks. `target` says who: an artist profile id, a booking (the other person on it) or a user id.
export function confirmAndBlock(target: BlockTarget, onDone?: () => void) {
  Alert.alert(BLOCK_CONFIRM_TITLE, BLOCK_CONFIRM_BODY, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Block",
      style: "destructive",
      onPress: () => {
        blockUser(target)
          .then(() => {
            Alert.alert(BLOCK_DONE_TITLE);
            onDone?.();
          })
          .catch((err) => {
            captureError(err, "block-user");
            Alert.alert(err instanceof ApiError && err.status === 401 ? BLOCK_LOGIN_TEXT : BLOCK_ERROR_TEXT);
          });
      },
    },
  ]);
}
