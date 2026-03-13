/* eslint-disable no-console */

const base = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";
const apiKey = process.env.API_KEY ?? "";

async function check(path: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }
  try {
    JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON payload`);
  }
  console.log(`PASS ${path}`);
}

async function main(): Promise<void> {
  await check("/health/live");
  await check("/health/ready");
  await check("/api/status");
  await check("/api/supply");
  await check("/api/holders");
  console.log("Smoke tests passed");
}

main().catch((err) => {
  console.error(`Smoke test failed: ${err.message}`);
  process.exit(1);
});
