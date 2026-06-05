import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sanitizeIncomingMessages,
  MAX_CLIENT_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
} from "../../src/lib/member-ai-memory.ts";

describe("sanitizeIncomingMessages", () => {
  it("returns an empty array if input is not an array", () => {
    assert.deepEqual(sanitizeIncomingMessages(null), []);
    assert.deepEqual(sanitizeIncomingMessages(undefined), []);
    assert.deepEqual(sanitizeIncomingMessages({}), []);
    assert.deepEqual(sanitizeIncomingMessages("string"), []);
    assert.deepEqual(sanitizeIncomingMessages(123), []);
  });

  it("returns an empty array if input is an empty array", () => {
    assert.deepEqual(sanitizeIncomingMessages([]), []);
  });

  it("keeps valid messages with 'user' or 'assistant' role", () => {
    const input = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    assert.deepEqual(sanitizeIncomingMessages(input), input);
  });

  it("filters out invalid entries (null, non-object, missing role, invalid role, non-string content)", () => {
    const input = [
      null,
      undefined,
      "string",
      123,
      { role: "user" }, // missing content
      { content: "Hello" }, // missing role
      { role: "system", content: "Invalid role" },
      { role: "user", content: 123 }, // invalid content type
      { role: "user", content: "Valid message" },
      {}, // empty object
    ];
    const expected = [{ role: "user", content: "Valid message" }];
    assert.deepEqual(sanitizeIncomingMessages(input), expected);
  });

  it("trims whitespace from content", () => {
    const input = [
      { role: "user", content: "   Hello   \n" },
    ];
    const expected = [{ role: "user", content: "Hello" }];
    assert.deepEqual(sanitizeIncomingMessages(input), expected);
  });

  it("drops messages with whitespace-only content after trim", () => {
    const input = [
      { role: "user", content: "   " },
      { role: "user", content: "\n\t\r" },
      { role: "assistant", content: "Valid" },
    ];
    const expected = [{ role: "assistant", content: "Valid" }];
    assert.deepEqual(sanitizeIncomingMessages(input), expected);
  });

  it("truncates content to MAX_MESSAGE_CHARS", () => {
    const longString = "A".repeat(MAX_MESSAGE_CHARS + 100);
    const input = [
      { role: "user", content: longString },
    ];
    const result = sanitizeIncomingMessages(input);
    assert.equal(result.length, 1);
    assert.equal(result[0].content, "A".repeat(MAX_MESSAGE_CHARS));
  });

  it("truncates after trimming", () => {
    const longString = "  " + "A".repeat(MAX_MESSAGE_CHARS) + "  ";
    const input = [
      { role: "user", content: longString },
    ];
    const result = sanitizeIncomingMessages(input);
    assert.equal(result.length, 1);
    assert.equal(result[0].content, "A".repeat(MAX_MESSAGE_CHARS));
  });

  it("limits history to the last MAX_CLIENT_HISTORY_MESSAGES after filtering", () => {
    const input = [];

    // Add 10 invalid messages at the start
    for (let i = 0; i < 10; i++) {
      input.push({ role: "invalid", content: `msg ${i}` });
    }

    // Add MAX_CLIENT_HISTORY_MESSAGES + 5 valid messages
    const validMessagesCount = MAX_CLIENT_HISTORY_MESSAGES + 5;
    for (let i = 0; i < validMessagesCount; i++) {
      input.push({ role: i % 2 === 0 ? "user" : "assistant", content: `msg ${i}` });
    }

    // Add 5 invalid messages at the end
    for (let i = 0; i < 5; i++) {
      input.push({ role: "invalid", content: `end msg ${i}` });
    }

    const result = sanitizeIncomingMessages(input);

    // Should have exactly MAX_CLIENT_HISTORY_MESSAGES
    assert.equal(result.length, MAX_CLIENT_HISTORY_MESSAGES);

    // Should contain the LAST MAX_CLIENT_HISTORY_MESSAGES valid messages
    // The valid messages started from index 0 to validMessagesCount - 1
    // So the last MAX_CLIENT_HISTORY_MESSAGES should be from index 5 to validMessagesCount - 1
    const expectedFirstValid = { role: 5 % 2 === 0 ? "user" : "assistant", content: "msg 5" };
    assert.deepEqual(result[0], expectedFirstValid);

    const expectedLastValid = {
      role: (validMessagesCount - 1) % 2 === 0 ? "user" : "assistant",
      content: `msg ${validMessagesCount - 1}`
    };
    assert.deepEqual(result[result.length - 1], expectedLastValid);
  });
});
