/**
 * Provider-neutral contract for Noor AI.
 *
 * Business logic asks for a model *tier* ("fast" | "reasoning"); the concrete
 * model id is resolved from env (`AI_FAST_MODEL`, `AI_REASONING_MODEL`,
 * `AI_EMBEDDING_MODEL`) inside a provider implementation. No vendor SDK types
 * may appear in this file.
 */

export type AIModelTier = 'fast' | 'reasoning';

export type AIMessageRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIGenerateRequest {
  tier: AIModelTier;
  messages: readonly AIMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
  /** Aborts the upstream request when the client disconnects or a deadline passes. */
  signal?: AbortSignal;
}

export interface AITokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export type AIFinishReason = 'stop' | 'length' | 'content_filter' | 'error';

export interface AIGenerateResult {
  text: string;
  /** Resolved model id actually used (for usage accounting, never for logic). */
  model: string;
  usage: AITokenUsage;
  finishReason: AIFinishReason;
}

export type AIStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; result: AIGenerateResult };

export interface AIEmbedRequest {
  inputs: readonly string[];
  dimensions?: number;
  signal?: AbortSignal;
}

export interface AIEmbedResult {
  vectors: number[][];
  model: string;
  usage: Pick<AITokenUsage, 'inputTokens'>;
}

export interface AIProvider {
  readonly name: string;
  generate(request: AIGenerateRequest): Promise<AIGenerateResult>;
  stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent>;
  embed(request: AIEmbedRequest): Promise<AIEmbedResult>;
}

export interface AIProviderSettings {
  provider: string;
  fastModel: string;
  reasoningModel: string;
  embeddingModel: string;
}

export type AIProviderFactory = (settings: AIProviderSettings) => AIProvider;

/** Empty until a provider is implemented in a later phase. */
const providerFactories: ReadonlyMap<string, AIProviderFactory> = new Map();

export function hasAIProviderImplementation(provider: string): boolean {
  return providerFactories.has(provider);
}
