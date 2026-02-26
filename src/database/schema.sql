-- seo-mcp SQLite Database Schema
-- Pre-built and shipped with the npm package

-- Schema.org Type Reference
CREATE TABLE IF NOT EXISTS schema_types (
  type_name TEXT PRIMARY KEY,
  parent_type TEXT,
  description TEXT NOT NULL,
  google_supported INTEGER DEFAULT 0,
  rich_result_type TEXT,
  documentation_url TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_name TEXT NOT NULL,
  property_name TEXT NOT NULL,
  expected_type TEXT NOT NULL,
  is_required INTEGER DEFAULT 0,
  is_google_required INTEGER DEFAULT 0,
  is_google_recommended INTEGER DEFAULT 0,
  description TEXT,
  constraints TEXT,
  example_value TEXT,
  UNIQUE(type_name, property_name),
  FOREIGN KEY (type_name) REFERENCES schema_types(type_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schema_props_type ON schema_properties(type_name);
CREATE INDEX IF NOT EXISTS idx_schema_google ON schema_types(google_supported);

-- SEO Best Practices Reference
CREATE TABLE IF NOT EXISTS seo_best_practices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  description TEXT NOT NULL,
  check_logic TEXT,
  fix_guidance TEXT NOT NULL,
  good_example TEXT,
  bad_example TEXT,
  source TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, subcategory, rule_name)
);

CREATE INDEX IF NOT EXISTS idx_practices_category ON seo_best_practices(category);
CREATE INDEX IF NOT EXISTS idx_practices_severity ON seo_best_practices(severity);

-- Common SEO Issues Catalog
CREATE TABLE IF NOT EXISTS seo_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_code TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL,
  detection_method TEXT NOT NULL,
  fix_steps TEXT NOT NULL,
  related_tools TEXT,
  examples TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issues_category ON seo_issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_code ON seo_issues(issue_code);

-- HTTP Status Codes Reference
CREATE TABLE IF NOT EXISTS http_status_codes (
  status_code INTEGER PRIMARY KEY,
  status_text TEXT NOT NULL,
  category TEXT NOT NULL,
  seo_impact TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  is_common INTEGER DEFAULT 0
);

-- Local SEO Citation Sources
CREATE TABLE IF NOT EXISTS citation_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  authority_score INTEGER,
  is_free INTEGER DEFAULT 1,
  country TEXT DEFAULT 'US',
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citations_category ON citation_sources(category);

-- Core Web Vitals Thresholds
CREATE TABLE IF NOT EXISTS cwv_thresholds (
  metric_name TEXT PRIMARY KEY,
  good_threshold REAL NOT NULL,
  needs_improvement_threshold REAL NOT NULL,
  unit TEXT NOT NULL,
  description TEXT NOT NULL,
  optimization_tips TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit History (runtime, not shipped with pre-built DB)
CREATE TABLE IF NOT EXISTS audit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  audit_type TEXT NOT NULL,
  results_json TEXT NOT NULL,
  overall_score INTEGER,
  category_scores TEXT,
  issues_found INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_domain ON audit_history(domain);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_history(created_at);
