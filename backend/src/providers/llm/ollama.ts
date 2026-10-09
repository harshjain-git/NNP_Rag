import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "../../config/env.js";
import type { GenerateOptions, LLMProvider } from "./types.js";

export class OllamaLLMProvider implements LLMProvider {
  readonly providerName = "ollama";
  readonly modelName: string;
  private readonly baseUrl: string;

  constructor(
    modelName: string = OLLAMA_MODEL,
    baseUrl: string = OLLAMA_BASE_URL
  ) {
    this.modelName = modelName;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        stream: false,
        think: false,
        options: {
          temperature: options?.temperature ?? 0.1,
          num_predict: options?.maxTokens ?? 1024,
          repeat_penalty: 1.15,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API request failed [${response.status}]: ${errorText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string; thinking?: string };
    };

    // Extract only the final response content (never fall back to thinking tokens)
    let content = data.message?.content?.trim() || "";

    // Strip any lingering reasoning blocks (e.g. <think>...</think>) if present
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    if (!content) {
      throw new Error("Ollama API returned an empty or invalid response");
    }

    return content;
  }
}

export const ollamaLLMProvider = new OllamaLLMProvider();
