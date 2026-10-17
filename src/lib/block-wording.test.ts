import { describe, expect, it } from "vitest";
import {
  BLOCKED_USERS_EMPTY,
  BLOCKED_USERS_NOTE,
  BLOCK_CONFIRM_BODY,
  BLOCK_CONFIRM_TITLE,
  BLOCK_DONE_TITLE,
  BLOCK_ERROR_TEXT,
  BLOCK_LOGIN_TEXT,
  UNBLOCK_ERROR_TEXT,
} from "./block-copy";

// Words for Block: plain English, no promise, no time limit, no "we will take action".
const COPY = [BLOCK_CONFIRM_TITLE, BLOCK_CONFIRM_BODY, BLOCK_DONE_TITLE, BLOCK_ERROR_TEXT, BLOCK_LOGIN_TEXT, BLOCKED_USERS_EMPTY, BLOCKED_USERS_NOTE, UNBLOCK_ERROR_TEXT];
const BANNED = [/within \d+ ?(hours|days|minutes)/i, /guarantee/i, /we will take action/i, /\bescrow\b/i];

describe("Block wording", () => {
  it("uses the agreed confirm and success text", () => {
    expect(`${BLOCK_CONFIRM_TITLE} ${BLOCK_CONFIRM_BODY}`).toBe("Block this person? You will no longer receive new messages from them.");
    expect(BLOCK_DONE_TITLE).toBe("Blocked.");
  });
  it.each(COPY)("has no promise, time limit or action claim: %s", (text) => {
    for (const re of BANNED) expect(text).not.toMatch(re);
  });
  it("the block files use only the copy file for their text", () => {
    const files = (import.meta as unknown as { glob: (p: string[], o: object) => Record<string, string> }).glob(
      ["./block-user.ts", "../app/blocked-users.tsx"],
      { query: "?raw", import: "default", eager: true },
    );
    for (const src of Object.values(files)) {
      const lines = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
      for (const re of BANNED) expect(lines.join("\n")).not.toMatch(re);
    }
  });
});
