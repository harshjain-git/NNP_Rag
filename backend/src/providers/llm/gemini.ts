import { GEMINI_API_KEY, GEMINI_MODEL } from "../../config/env.js";
import { iterateLines } from "../../utils/stream.js";
import type {
  GenerateOptions,
  LLMProvider,
  StreamGenerateOptions,
  TokenCallback,
} from "./types.js";

export class GeminiLLMProvider implements LLMProvider {
  readonly providerName = "gemini";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(modelName: string = GEMINI_MODEL, apiKey: string = GEMINI_API_KEY) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.generateStream(prompt, () => {}, options);
  }

  async generateStream(
    prompt: string,
    onToken: TokenCallback,
    options?: StreamGenerateOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.1,
        maxOutputTokens: options?.maxTokens ?? 1024,
      },
      ...(options?.systemPrompt
        ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
        : {}),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal ?? null,
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed [${response.status}]: ${await response.text()}`);
    }

    if (!response.body) {
      throw new Error("Gemini API returned an empty response body");
    }

    let fullText = "";
    for await (const line of iterateLines(response.body)) {
      if (options?.signal?.aborted) break;
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      try {
        const parsed = JSON.parse(trimmed.slice(5).trim()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          fullText += text;
          await onToken(text);
        }
      } catch {}
    }

    if (!fullText) {
      throw new Error("Gemini API returned an empty or invalid response");
    }

    return fullText.trim();
  }
}

export const geminiLLMProvider = new GeminiLLMProvider();
