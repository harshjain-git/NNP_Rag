import { GROQ_API_KEY, GROQ_MODEL } from "../../config/env.js";
import { iterateLines } from "../../utils/stream.js";
import type {
  GenerateOptions,
  LLMProvider,
  StreamGenerateOptions,
  TokenCallback,
} from "./types.js";

export class GroqLLMProvider implements LLMProvider {
  readonly providerName = "groq";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(modelName: string = GROQ_MODEL, apiKey: string = GROQ_API_KEY) {
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
      throw new Error("GROQ_API_KEY is not defined in environment variables");
    }

    const messages = options?.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, { role: "user", content: prompt }]
      : [{ role: "user", content: prompt }];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
      }),
      signal: options?.signal ?? null,
    });

    if (!response.ok) {
      throw new Error(`Groq API request failed [${response.status}]: ${await response.text()}`);
    }

    if (!response.body) {
      throw new Error("Groq API returned an empty response body");
    }

    let fullText = "";
    for await (const line of iterateLines(response.body)) {
      if (options?.signal?.aborted) break;
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataStr = trimmed.slice(5).trim();
      if (dataStr === "[DONE]") break;

      try {
        const parsed = JSON.parse(dataStr) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          fullText += token;
          await onToken(token);
        }
      } catch {}
    }

    if (!fullText) {
      throw new Error("Groq API returned an empty or invalid response");
    }

    return fullText.trim();
  }
}

export const groqLLMProvider = new GroqLLMProvider();
