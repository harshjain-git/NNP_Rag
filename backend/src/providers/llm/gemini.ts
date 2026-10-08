import { GEMINI_API_KEY, GEMINI_MODEL } from "../../config/env.js";
import type { GenerateOptions, LLMProvider } from "./types.js";

export class GeminiLLMProvider implements LLMProvider {
  readonly providerName = "gemini";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(
    modelName: string = GEMINI_MODEL,
    apiKey: string = GEMINI_API_KEY
  ) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.1,
        maxOutputTokens: options?.maxTokens ?? 1024,
      },
    };

    if (options?.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API request failed [${response.status}]: ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("Gemini API returned an empty or invalid response");
    }

    return content.trim();
  }
}

export const geminiLLMProvider = new GeminiLLMProvider();
