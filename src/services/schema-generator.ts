import type { SchemaGenerationResult, SchemaValidation } from '../types/schema-types.js';

export function generateSchema(
  type: string,
  data: Record<string, unknown>,
  validate: boolean = true,
): SchemaGenerationResult {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  // Recursively add @type to nested objects that look like schema entities
  processNestedEntities(jsonLd);

  const htmlSnippet = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;

  let validation: SchemaValidation = {
    valid: true,
    errors: [],
    warnings: [],
    googleEligible: false,
    richResultType: null,
  };

  if (validate) {
    validation = validateGeneratedSchema(jsonLd, type);
  }

  return { jsonLd, htmlSnippet, validation };
}

function processNestedEntities(obj: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      // If it has a @type or looks like an entity, keep it
      if (nested['@type']) {
        processNestedEntities(nested);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          processNestedEntities(item as Record<string, unknown>);
        }
      }
    }
  }
}

const REQUIRED_PROPS: Record<string, string[]> = {
  Article: ['headline', 'image', 'author', 'datePublished'],
  BlogPosting: ['headline', 'image', 'author', 'datePublished'],
  Product: ['name', 'image'],
  FAQPage: ['mainEntity'],
  HowTo: ['name', 'step'],
  LocalBusiness: ['name', 'address'],
  Organization: ['name', 'url'],
  BreadcrumbList: ['itemListElement'],
  WebSite: ['name', 'url'],
  Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'image'],
  VideoObject: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  Course: ['name', 'description', 'provider'],
  SoftwareApplication: ['name'],
  Review: ['itemReviewed', 'author'],
  JobPosting: ['title', 'description', 'datePosted', 'hiringOrganization'],
  Person: ['name'],
};

const RECOMMENDED_PROPS: Record<string, string[]> = {
  Article: ['dateModified', 'publisher', 'mainEntityOfPage', 'description'],
  Product: ['description', 'offers', 'aggregateRating', 'brand'],
  LocalBusiness: ['telephone', 'openingHoursSpecification', 'geo', 'image'],
  Event: ['endDate', 'image', 'description', 'offers'],
  Recipe: ['author', 'prepTime', 'cookTime', 'recipeIngredient', 'recipeInstructions'],
};

const RICH_RESULT_TYPES: Record<string, string> = {
  Article: 'Article',
  BlogPosting: 'Article',
  NewsArticle: 'Article',
  Product: 'Product',
  FAQPage: 'FAQ',
  HowTo: 'HowTo',
  LocalBusiness: 'LocalBusiness',
  Organization: 'Organization',
  BreadcrumbList: 'Breadcrumb',
  WebSite: 'Sitelinks Search',
  Event: 'Event',
  Recipe: 'Recipe',
  VideoObject: 'Video',
  Course: 'Course',
  SoftwareApplication: 'Software App',
  Review: 'Review',
  JobPosting: 'Job Posting',
};

function validateGeneratedSchema(jsonLd: Record<string, unknown>, type: string): SchemaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const required = REQUIRED_PROPS[type] || [];
  for (const prop of required) {
    if (!(prop in jsonLd) || jsonLd[prop] === null || jsonLd[prop] === undefined) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  const recommended = RECOMMENDED_PROPS[type] || [];
  for (const prop of recommended) {
    if (!(prop in jsonLd)) {
      warnings.push(`Missing recommended property: ${prop}`);
    }
  }

  const richResultType = RICH_RESULT_TYPES[type] || null;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    googleEligible: errors.length === 0 && richResultType !== null,
    richResultType,
  };
}
