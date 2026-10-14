export interface GenerateOptions {
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  systemPrompt?: string | undefined;
}

export type TokenCallback = (token: string) => void | Promise<void>;

export interface StreamGenerateOptions extends GenerateOptions {
  signal?: AbortSignal | null | undefined;
}

export interface LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  generateStream?(
    prompt: string,
    onToken: TokenCallback,
    options?: StreamGenerateOptions
  ): Promise<string>;
}

