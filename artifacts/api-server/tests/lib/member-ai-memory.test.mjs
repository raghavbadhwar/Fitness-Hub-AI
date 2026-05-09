import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AI_SAFETY_INSTRUCTION,
  buildSystemInstruction,
  detectAiSafetyConcern,
} from "../../src/lib/member-ai-memory.ts";

describe("member AI safety policy", () => {
  it("detects unsafe medical, dieting, eating-disorder, supplement, and injury prompts", () => {
    assert.equal(
      detectAiSafetyConcern("I have chest pain during sets")?.category,
      "medical_emergency",
    );
    assert.equal(detectAiSafetyConcern("help me purge dinner")?.category, "eating_disorder");
    assert.equal(detectAiSafetyConcern("make me a 500 calorie diet")?.category, "extreme_dieting");
    assert.equal(detectAiSafetyConcern("how much clenbuterol dose")?.category, "unsafe_supplement");
    assert.equal(detectAiSafetyConcern("train through sharp pain")?.category, "injury_pain");
    assert.equal(detectAiSafetyConcern("make me a normal leg workout"), null);
  });

  it("includes the safety policy in the chat system instruction", () => {
    const instruction = buildSystemInstruction({});

    assert.match(instruction, /Do not diagnose medical conditions/i);
    assert.match(instruction, /eating-disorder behavior/i);
    assert.match(instruction, /unsafe supplement/i);
    assert.match(instruction, /sharp pain/i);
    assert.match(instruction, new RegExp(AI_SAFETY_INSTRUCTION.slice(0, 24)));
  });
});
