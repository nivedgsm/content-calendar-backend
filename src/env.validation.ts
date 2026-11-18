type Environment = Record<string, unknown>;

function requireDatabaseUrl(config: Environment, key: string): void {
  const value = config[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid PostgreSQL connection URL`);
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${key} must use the postgresql:// or postgres:// scheme`);
  }
  if (!url.hostname || url.pathname.length < 2) {
    throw new Error(`${key} must include a database host and database name`);
  }
}

export function validateEnvironment(config: Environment): Environment {
  requireDatabaseUrl(config, 'DATABASE_URL');
  requireDatabaseUrl(config, 'DIRECT_URL');

  const accessSecret = config.JWT_ACCESS_SECRET;
  if (typeof accessSecret !== 'string' || Buffer.byteLength(accessSecret, 'utf8') < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set to at least 32 UTF-8 bytes');
  }

  if (config.PORT !== undefined && (!/^\d+$/.test(String(config.PORT)) || Number(config.PORT) < 1 || Number(config.PORT) > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return config;
}
