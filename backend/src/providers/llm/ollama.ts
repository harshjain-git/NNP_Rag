import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "../../config/env.js";
import { iterateLines } from "../../utils/stream.js";
import type {
  GenerateOptions,
  LLMProvider,
  StreamGenerateOptions,
  TokenCallback,
} from "./types.js";

export class OllamaLLMProvider implements LLMProvider {
  readonly providerName = "ollama";
  readonly modelName: string;
  private readonly baseUrl: string;

  constructor(modelName: string = OLLAMA_MODEL, baseUrl: string = OLLAMA_BASE_URL) {
    this.modelName = modelName;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.generateStream(prompt, () => {}, options);
  }

  async generateStream(
    prompt: string,
    onToken: TokenCallback,
    options?: StreamGenerateOptions
  ): Promise<string> {
    const messages = options?.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, { role: "user", content: prompt }]
      : [{ role: "user", content: prompt }];

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        stream: true,
        think: false,
        options: {
          temperature: options?.temperature ?? 0.1,
          num_predict: options?.maxTokens ?? 1024,
          repeat_penalty: 1.15,
        },
      }),
      signal: options?.signal ?? null,
    });

    if (!response.ok) {
      throw new Error(`Ollama API request failed [${response.status}]: ${await response.text()}`);
    }

    if (!response.body) {
      throw new Error("Ollama API returned an empty response body");
    }

    let fullText = "";
    for await (const line of iterateLines(response.body)) {
      if (options?.signal?.aborted) break;
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed) as {
          message?: { content?: string };
          done?: boolean;
        };
        const token = parsed.message?.content;
        if (token) {
          fullText += token;
          await onToken(token);
        }
        if (parsed.done) break;
      } catch {}
    }

    fullText = fullText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!fullText) {
      throw new Error("Ollama API returned an empty or invalid response");
    }

    return fullText;
  }
}

export const ollamaLLMProvider = new OllamaLLMProvider();
