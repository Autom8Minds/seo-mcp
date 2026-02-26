import { config } from 'dotenv';

config();

export interface ApiKeyConfig {
  pagespeedApiKey?: string;
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  mozAccessId?: string;
  mozSecretKey?: string;
  gscClientId?: string;
  gscClientSecret?: string;
  gscRefreshToken?: string;
}

export function loadApiKeys(): ApiKeyConfig {
  return {
    pagespeedApiKey: process.env.PAGESPEED_API_KEY || undefined,
    dataForSeoLogin: process.env.DATAFORSEO_LOGIN || undefined,
    dataForSeoPassword: process.env.DATAFORSEO_PASSWORD || undefined,
    mozAccessId: process.env.MOZ_ACCESS_ID || undefined,
    mozSecretKey: process.env.MOZ_SECRET_KEY || undefined,
    gscClientId: process.env.GSC_CLIENT_ID || undefined,
    gscClientSecret: process.env.GSC_CLIENT_SECRET || undefined,
    gscRefreshToken: process.env.GSC_REFRESH_TOKEN || undefined,
  };
}

export function hasDataForSeo(keys: ApiKeyConfig): boolean {
  return !!(keys.dataForSeoLogin && keys.dataForSeoPassword);
}

export function hasMoz(keys: ApiKeyConfig): boolean {
  return !!(keys.mozAccessId && keys.mozSecretKey);
}

export function hasGsc(keys: ApiKeyConfig): boolean {
  return !!(keys.gscClientId && keys.gscClientSecret && keys.gscRefreshToken);
}

export function hasBacklinkApi(keys: ApiKeyConfig): boolean {
  return hasDataForSeo(keys) || hasMoz(keys);
}
