import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { EMBEDDING_MODEL } from "../../config/env.js";
import type { EmbeddingProvider } from "./types.js";

export const LOCAL_EMBEDDING_MODEL = EMBEDDING_MODEL;
export const LOCAL_EMBEDDING_DIMENSIONS = 512;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

export const getLocalEmbeddingPipeline = async (): Promise<FeatureExtractionPipeline> => {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", LOCAL_EMBEDDING_MODEL);
  }
  return pipelinePromise;
};

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = LOCAL_EMBEDDING_MODEL;
  readonly dimensions = LOCAL_EMBEDDING_DIMENSIONS;

  async generateEmbedding(text: string): Promise<number[]> {
    const extractor = await getLocalEmbeddingPipeline();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const extractor = await getLocalEmbeddingPipeline();
    const output = await extractor(texts, { pooling: "mean", normalize: true });

    const batchSize = texts.length;
    const dim = this.dimensions;
    const vectors: number[][] = [];

    for (let i = 0; i < batchSize; i++) {
      vectors.push(Array.from(output.data.slice(i * dim, (i + 1) * dim)));
    }

    return vectors;
  }
}

export const localEmbeddingProvider = new LocalEmbeddingProvider();

export const generateEmbedding = (text: string): Promise<number[]> =>
  localEmbeddingProvider.generateEmbedding(text);

export const generateEmbeddings = (texts: string[]): Promise<number[][]> =>
  localEmbeddingProvider.generateEmbeddings(texts);
