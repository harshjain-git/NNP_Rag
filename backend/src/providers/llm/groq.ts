import { GROQ_API_KEY, GROQ_MODEL } from "../../config/env.js";
import type { GenerateOptions, LLMProvider } from "./types.js";

export class GroqLLMProvider implements LLMProvider {
  readonly providerName = "groq";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(
    modelName: string = GROQ_MODEL,
    apiKey: string = GROQ_API_KEY
  ) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY is not defined in environment variables");
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API request failed [${response.status}]: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq API returned an empty or invalid response");
    }

    return content.trim();
  }
}

export const groqLLMProvider = new GroqLLMProvider();
