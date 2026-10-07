export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
