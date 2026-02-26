import { httpGet } from '../utils/http-client.js';
import { parseHtml, extractJsonLd } from '../utils/html-parser.js';
import { logger } from '../utils/logger.js';
import type { SchemaExtraction, ExtractedSchema, SchemaValidation } from '../types/schema-types.js';

export async function extractSchema(url: string, validateGoogle: boolean = true): Promise<SchemaExtraction> {
  const response = await httpGet(url);
  const $ = parseHtml(response.body);

  const schemas: ExtractedSchema[] = [];

  // Extract JSON-LD
  const jsonLdSchemas = extractJsonLd($);
  for (const raw of jsonLdSchemas) {
    if (raw['@graph'] && Array.isArray(raw['@graph'])) {
      // Handle @graph pattern
      for (const entity of raw['@graph'] as Record<string, unknown>[]) {
        const type = String(entity['@type'] || 'Unknown');
        schemas.push({
          format: 'json-ld',
          type,
          raw: entity,
          validation: validateSchema(entity, type, validateGoogle),
        });
      }
    } else {
      const type = String(raw['@type'] || 'Unknown');
      schemas.push({
        format: 'json-ld',
        type,
        raw,
        validation: validateSchema(raw, type, validateGoogle),
      });
    }
  }

  // Extract Microdata (basic detection)
  $('[itemscope]').each((_, el) => {
    const type = $(el).attr('itemtype') || '';
    const typeName = type.split('/').pop() || 'Unknown';
    const properties: Record<string, unknown> = {};

    $(el).find('[itemprop]').each((_, prop) => {
      const name = $(prop).attr('itemprop');
      const value = $(prop).attr('content') || $(prop).text().trim();
      if (name) properties[name] = value;
    });

    if (Object.keys(properties).length > 0) {
      schemas.push({
        format: 'microdata',
        type: typeName,
        raw: { '@type': typeName, ...properties },
        validation: validateSchema({ '@type': typeName, ...properties }, typeName, validateGoogle),
      });
    }
  });

  const types = schemas.map((s) => s.type);
  const googleEligibleCount = schemas.filter((s) => s.validation.googleEligible).length;
  const errorCount = schemas.reduce((sum, s) => sum + s.validation.errors.length, 0);
  const warningCount = schemas.reduce((sum, s) => sum + s.validation.warnings.length, 0);

  return {
    schemas,
    summary: {
      totalSchemas: schemas.length,
      types: [...new Set(types)],
      googleEligibleCount,
      errorCount,
      warningCount,
    },
  };
}

// Google-supported types and their required properties
const GOOGLE_TYPES: Record<string, { required: string[]; recommended: string[]; richResult: string }> = {
  Article: {
    required: ['headline', 'image', 'author', 'datePublished'],
    recommended: ['dateModified', 'publisher', 'mainEntityOfPage', 'description'],
    richResult: 'Article',
  },
  BlogPosting: {
    required: ['headline', 'image', 'author', 'datePublished'],
    recommended: ['dateModified', 'publisher', 'mainEntityOfPage'],
    richResult: 'Article',
  },
  NewsArticle: {
    required: ['headline', 'image', 'author', 'datePublished'],
    recommended: ['dateModified', 'publisher'],
    richResult: 'Article',
  },
  Product: {
    required: ['name', 'image'],
    recommended: ['description', 'offers', 'aggregateRating', 'review', 'brand'],
    richResult: 'Product',
  },
  FAQPage: {
    required: ['mainEntity'],
    recommended: [],
    richResult: 'FAQ',
  },
  HowTo: {
    required: ['name', 'step'],
    recommended: ['image', 'totalTime', 'estimatedCost', 'supply', 'tool'],
    richResult: 'HowTo',
  },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHoursSpecification', 'geo', 'image', 'priceRange', 'aggregateRating'],
    richResult: 'LocalBusiness',
  },
  Organization: {
    required: ['name', 'url'],
    recommended: ['logo', 'sameAs', 'contactPoint', 'description'],
    richResult: 'Organization',
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: [],
    richResult: 'Breadcrumb',
  },
  WebSite: {
    required: ['name', 'url'],
    recommended: ['potentialAction'],
    richResult: 'Sitelinks Search',
  },
  Event: {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'image', 'description', 'offers', 'performer', 'organizer'],
    richResult: 'Event',
  },
  Recipe: {
    required: ['name', 'image'],
    recommended: ['author', 'prepTime', 'cookTime', 'totalTime', 'recipeIngredient', 'recipeInstructions', 'nutrition'],
    richResult: 'Recipe',
  },
  VideoObject: {
    required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'duration', 'embedUrl'],
    richResult: 'Video',
  },
  Course: {
    required: ['name', 'description', 'provider'],
    recommended: ['hasCourseInstance', 'offers'],
    richResult: 'Course',
  },
  SoftwareApplication: {
    required: ['name'],
    recommended: ['offers', 'aggregateRating', 'operatingSystem', 'applicationCategory'],
    richResult: 'Software App',
  },
  Review: {
    required: ['itemReviewed', 'author'],
    recommended: ['reviewRating', 'datePublished', 'reviewBody'],
    richResult: 'Review',
  },
  JobPosting: {
    required: ['title', 'description', 'datePosted', 'hiringOrganization'],
    recommended: ['baseSalary', 'jobLocation', 'employmentType', 'validThrough'],
    richResult: 'Job Posting',
  },
};

function validateSchema(schema: Record<string, unknown>, type: string, validateGoogle: boolean): SchemaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let googleEligible = false;
  let richResultType: string | null = null;

  if (!schema['@type']) {
    errors.push('Missing @type property');
  }

  if (validateGoogle && GOOGLE_TYPES[type]) {
    const config = GOOGLE_TYPES[type];
    richResultType = config.richResult;

    // Check required properties
    for (const prop of config.required) {
      if (!(prop in schema) || schema[prop] === null || schema[prop] === undefined) {
        errors.push(`Missing required property: ${prop}`);
      }
    }

    // Check recommended properties
    for (const prop of config.recommended) {
      if (!(prop in schema)) {
        warnings.push(`Missing recommended property: ${prop}`);
      }
    }

    googleEligible = errors.length === 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    googleEligible,
    richResultType,
  };
}
