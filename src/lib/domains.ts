export const APP_DOMAIN_SUFFIX = process.env.APPS_HOST || "quark-apps.lexarcai.com";

const RESERVED = new Set([
  "www", "api", "app", "apps", "admin", "root", "mail", "smtp", "ftp", "dev", "test", "staging",
  "quark", "fusion", "atoms", "demo", "static", "cdn", "assets", "help", "docs", "blog", "status",
]);

/** Returns an error message, or null when the subdomain is acceptable. */
export function validateDomainName(name: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(name)) {
    return "域名需为 3-30 位小写字母/数字/中划线,不能以中划线开头或结尾";
  }
  if (RESERVED.has(name)) return "该名称为系统保留,请换一个";
  return null;
}
