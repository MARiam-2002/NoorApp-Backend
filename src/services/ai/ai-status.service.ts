import type { AIConfig } from '../../config';
import { hasAIProviderImplementation } from '../../lib/ai/provider';

export type AIStatus = {
  enabled: boolean;
  provider: string;
  /** True only when a provider implementation exists and all model tiers are set. */
  configured: boolean;
  features: {
    chat: boolean;
    streaming: boolean;
    quranDiscovery: boolean;
    conversations: boolean;
  };
  limits: {
    maxMessageLength: number;
    dailyMessageLimit: number;
    maxStreamSeconds: number;
  };
};

export function isAIConfigured(config: AIConfig): boolean {
  return (
    hasAIProviderImplementation(config.provider) &&
    config.fastModel.length > 0 &&
    config.reasoningModel.length > 0 &&
    config.embeddingModel.length > 0
  );
}

/** Public, secret-free view of the AI configuration. Model ids are intentionally omitted. */
export function getAIStatus(config: AIConfig): AIStatus {
  return {
    enabled: config.enabled,
    provider: config.provider,
    configured: isAIConfigured(config),
    features: {
      chat: false,
      streaming: false,
      // Deterministic (no provider needed), so it is available whenever AI is enabled.
      quranDiscovery: config.enabled,
      conversations: false,
    },
    limits: {
      maxMessageLength: config.maxMessageLength,
      dailyMessageLimit: config.dailyMessageLimit,
      maxStreamSeconds: config.maxStreamSeconds,
    },
  };
}
