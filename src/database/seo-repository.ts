/**
 * SEO reference data repository.
 *
 * Query methods for accessing the pre-built SEO database.
 * All methods return empty arrays if the database is not available.
 */

import { runQuery, isDbReady } from './database-adapter.js';

export interface SchemaTypeRecord {
  type_name: string;
  parent_type: string | null;
  description: string;
  google_supported: number;
  rich_result_type: string | null;
  documentation_url: string | null;
}

export interface SchemaPropertyRecord {
  property_name: string;
  expected_type: string;
  is_required: number;
  is_google_required: number;
  is_google_recommended: number;
  description: string | null;
  example_value: string | null;
}

export interface SeoIssueRecord {
  issue_code: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  impact: string;
  fix_steps: string;
}

export function getSchemaTypes(googleOnly = false): SchemaTypeRecord[] {
  if (!isDbReady()) return [];
  const sql = googleOnly
    ? 'SELECT * FROM schema_types WHERE google_supported = 1 ORDER BY type_name'
    : 'SELECT * FROM schema_types ORDER BY type_name';
  return runQuery(sql) as SchemaTypeRecord[];
}

export function getSchemaType(typeName: string): SchemaTypeRecord | null {
  if (!isDbReady()) return null;
  const results = runQuery('SELECT * FROM schema_types WHERE type_name = ?', [typeName]);
  return (results[0] as SchemaTypeRecord) || null;
}

export function getSchemaProperties(typeName: string): SchemaPropertyRecord[] {
  if (!isDbReady()) return [];
  return runQuery(
    'SELECT * FROM schema_properties WHERE type_name = ? ORDER BY is_google_required DESC, is_google_recommended DESC, property_name',
    [typeName],
  ) as SchemaPropertyRecord[];
}

export function getGoogleRequiredProperties(typeName: string): SchemaPropertyRecord[] {
  if (!isDbReady()) return [];
  return runQuery(
    'SELECT * FROM schema_properties WHERE type_name = ? AND is_google_required = 1',
    [typeName],
  ) as SchemaPropertyRecord[];
}

export function getSeoIssues(category?: string, severity?: string): SeoIssueRecord[] {
  if (!isDbReady()) return [];
  let sql = 'SELECT * FROM seo_issues WHERE 1=1';
  const params: unknown[] = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (severity) {
    sql += ' AND severity = ?';
    params.push(severity);
  }
  sql += ' ORDER BY CASE severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END';
  return runQuery(sql, params) as SeoIssueRecord[];
}

export function getHttpStatusInfo(code: number): any {
  if (!isDbReady()) return null;
  const results = runQuery('SELECT * FROM http_status_codes WHERE status_code = ?', [code]);
  return results[0] || null;
}

export function getCitationSources(category?: string, country = 'US'): any[] {
  if (!isDbReady()) return [];
  let sql = 'SELECT * FROM citation_sources WHERE country = ?';
  const params: unknown[] = [country];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY authority_score DESC';
  return runQuery(sql, params);
}

export function getCwvThresholds(): any[] {
  if (!isDbReady()) return [];
  return runQuery('SELECT * FROM cwv_thresholds ORDER BY metric_name');
}

export function getBestPractices(category?: string): any[] {
  if (!isDbReady()) return [];
  let sql = 'SELECT * FROM seo_best_practices';
  const params: unknown[] = [];
  if (category) {
    sql += ' WHERE category = ?';
    params.push(category);
  }
  sql += ' ORDER BY CASE severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END';
  return runQuery(sql, params);
}

export function saveAuditResult(
  url: string,
  domain: string,
  auditType: string,
  results: unknown,
  overallScore: number,
  categoryScores: Record<string, number>,
  issuesFound: number,
): void {
  if (!isDbReady()) return;
  runQuery(
    `INSERT INTO audit_history (url, domain, audit_type, results_json, overall_score, category_scores, issues_found)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [url, domain, auditType, JSON.stringify(results), overallScore, JSON.stringify(categoryScores), issuesFound],
  );
}
