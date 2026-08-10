import { Type } from "@google/genai";
import { z } from "zod";

/** Gemini responseSchema for the "explain an already-known answer" call - see
 *  explainPromptBuilder.ts. Deliberately just one string field: unlike ADVISOR_SYSTEM_PROMPT's
 *  call, this doesn't compute anything (the frequencies are already known/exact), so there's
 *  nothing structured to return besides the prose explanation. */
export const explainGeminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    explanation: { type: Type.STRING },
  },
  required: ["explanation"],
};

export const explainResponseSchema = z.object({
  explanation: z.string().min(1),
});
