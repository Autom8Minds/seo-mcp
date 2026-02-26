/** Schema.org and structured data types */

export interface SchemaExtraction {
  schemas: ExtractedSchema[];
  summary: {
    totalSchemas: number;
    types: string[];
    googleEligibleCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface ExtractedSchema {
  format: 'json-ld' | 'microdata' | 'rdfa';
  type: string;
  raw: Record<string, unknown>;
  validation: SchemaValidation;
}

export interface SchemaValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  googleEligible: boolean;
  richResultType: string | null;
}

export interface SchemaGenerationResult {
  jsonLd: Record<string, unknown>;
  htmlSnippet: string;
  validation: SchemaValidation;
}

export interface SchemaTypeInfo {
  typeName: string;
  parentType: string | null;
  description: string;
  googleSupported: boolean;
  richResultType: string | null;
  documentationUrl: string | null;
}

export interface SchemaPropertyInfo {
  propertyName: string;
  typeName: string;
  expectedType: string;
  isRequired: boolean;
  isGoogleRequired: boolean;
  isGoogleRecommended: boolean;
  description: string | null;
  constraints: Record<string, unknown> | null;
  exampleValue: string | null;
}
