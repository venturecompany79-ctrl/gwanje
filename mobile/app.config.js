const fs = require("fs");
const path = require("path");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return env;

      const separator = trimmed.indexOf("=");
      if (separator === -1) return env;

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return env;
    }, {});
}

module.exports = ({ config }) => {
  const projectRoot = __dirname;
  const repoRoot = path.resolve(projectRoot, "..");
  const env = {
    ...readEnvFile(path.join(repoRoot, ".env.local")),
    ...readEnvFile(path.join(projectRoot, ".env")),
    ...readEnvFile(path.join(projectRoot, ".env.local")),
    ...process.env,
  };
  const webApiBaseUrl =
    env.EXPO_PUBLIC_WEB_API_BASE_URL ??
    env.WEB_API_BASE_URL ??
    (env.VERCEL ? "" : "http://localhost:3000");

  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl:
        env.EXPO_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      supabasePublishableKey:
        env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "",
      webApiBaseUrl,
    },
  };
};
