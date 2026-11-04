import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type EnrichedProductMetadata = {
  source: 'SELLER' | 'CHANNEL3_ENRICHED';
  enrichedAt: string | null;
  materialTags: string[];
  suggestedAttributes: Record<string, string>;
  standardizedCategory: string | null;
  exportReadiness: {
    ready: boolean;
    missingFields: string[];
  };
};

export function channel3Configured(): boolean {
  return Boolean(env.channel3ApiKey);
}

/**
 * Genuine Channel3 product enrichment service.
 * When CHANNEL3_API_KEY is configured, this queries Channel3 API for catalog taxonomy
 * and schema alignment. When not configured, it returns unmodified seller data with
 * clear provenance so that external details are never fabricated.
 */
export async function enrichProductMetadata(input: {
  name: string;
  category: string;
  description: string;
  countryOfOrigin?: string;
  sku?: string;
}): Promise<EnrichedProductMetadata> {
  if (!env.channel3ApiKey) {
    return {
      source: 'SELLER',
      enrichedAt: null,
      materialTags: [],
      suggestedAttributes: {},
      standardizedCategory: null,
      exportReadiness: {
        ready: Boolean(input.name && input.category && input.description),
        missingFields: [
          !input.name && 'name',
          !input.category && 'category',
          !input.description && 'description',
        ].filter(Boolean) as string[],
      },
    };
  }

  try {
    const response = await fetch('https://api.channel3.io/v1/enrich/product', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.channel3ApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: input.name,
        category: input.category,
        description: input.description,
        country: input.countryOfOrigin ?? 'IN',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      logger.warn('channel3_enrichment_unsuccessful', { status: response.status });
      return {
        source: 'SELLER',
        enrichedAt: null,
        materialTags: [],
        suggestedAttributes: {},
        standardizedCategory: null,
        exportReadiness: {
          ready: true,
          missingFields: [],
        },
      };
    }

    const data = (await response.json()) as {
      tags?: string[];
      attributes?: Record<string, string>;
      standardizedCategory?: string;
    };

    return {
      source: 'CHANNEL3_ENRICHED',
      enrichedAt: new Date().toISOString(),
      materialTags: Array.isArray(data.tags) ? data.tags : [],
      suggestedAttributes: data.attributes ?? {},
      standardizedCategory: data.standardizedCategory ?? null,
      exportReadiness: {
        ready: true,
        missingFields: [],
      },
    };
  } catch (error) {
    logger.warn('channel3_service_unavailable', { message: (error as Error).message });
    return {
      source: 'SELLER',
      enrichedAt: null,
      materialTags: [],
      suggestedAttributes: {},
      standardizedCategory: null,
      exportReadiness: {
        ready: true,
        missingFields: [],
      },
    };
  }
}

