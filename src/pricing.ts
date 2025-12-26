// Model pricing for Claude models (USD per million tokens)
// Based on Anthropic's official pricing as of December 2025

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
}

// Pricing data for Claude models
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 4 models
  "claude-opus-4-20250514": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  "claude-opus-4-5-20251101": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-sonnet-4-5-20241022": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  // Claude 3.5 models
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-3-5-sonnet-20240620": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-3-5-haiku-20241022": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
  // Claude 3 models
  "claude-3-opus-20240229": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  "claude-3-sonnet-20240229": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-3-haiku-20240307": {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    cacheWritePerMillion: 0.3,
    cacheReadPerMillion: 0.03,
  },
};

// Default pricing for unknown models (use Sonnet pricing as default)
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
  cacheWritePerMillion: 3.75,
  cacheReadPerMillion: 0.3,
};

export function getModelPricing(modelId: string): ModelPricing {
  // Try exact match first
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId];
  }

  // Try to match by model family
  const lowerModel = modelId.toLowerCase();

  if (lowerModel.includes("opus-4") || lowerModel.includes("opus4")) {
    return MODEL_PRICING["claude-opus-4-20250514"];
  }
  if (lowerModel.includes("sonnet-4") || lowerModel.includes("sonnet4")) {
    return MODEL_PRICING["claude-sonnet-4-20250514"];
  }
  if (lowerModel.includes("opus")) {
    return MODEL_PRICING["claude-3-opus-20240229"];
  }
  if (lowerModel.includes("haiku") && lowerModel.includes("3-5")) {
    return MODEL_PRICING["claude-3-5-haiku-20241022"];
  }
  if (lowerModel.includes("haiku")) {
    return MODEL_PRICING["claude-3-haiku-20240307"];
  }
  if (lowerModel.includes("sonnet")) {
    return MODEL_PRICING["claude-3-5-sonnet-20241022"];
  }

  return DEFAULT_PRICING;
}

export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  const pricing = getModelPricing(modelId);

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export function calculateTotalCost(
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
    costUSD?: number;
  }>
): number {
  let totalCost = 0;

  for (const [modelId, usage] of Object.entries(modelUsage)) {
    // Use pre-calculated cost if available, otherwise calculate
    if (usage.costUSD && usage.costUSD > 0) {
      totalCost += usage.costUSD;
    } else {
      totalCost += calculateCost(
        modelId,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheCreationInputTokens,
        usage.cacheReadInputTokens
      );
    }
  }

  return totalCost;
}
