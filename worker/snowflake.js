// The only code that talks to Snowflake. Runs on Cloudflare, never in the browser.
// Same key-pair login as ~/Desktop/snowflake-site, plus support for numbers, nulls and multi-row inserts.

// Runs one SQL statement. `values` fill the ? placeholders, so user data is never
// pasted into the SQL text. Pass an array of arrays to insert many rows at once.
export async function query(env, statement, values = []) {
  const account = env.SNOWFLAKE_ACCOUNT.toUpperCase();
  const base = `https://${account.toLowerCase()}.snowflakecomputing.com/api/v2/statements`;
  const headers = {
    Authorization: `Bearer ${await makeJwt(env)}`,
    "X-Snowflake-Authorization-Token-Type": "KEYPAIR_JWT",
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "feedback-insights/1.0",
  };

  let res = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      statement,
      bindings: toBindings(values),
      timeout: 180, // AI (Cortex) calls can take a while
      database: env.SNOWFLAKE_DATABASE,
      schema: env.SNOWFLAKE_SCHEMA,
      warehouse: env.SNOWFLAKE_WAREHOUSE,
      role: env.SNOWFLAKE_ROLE,
    }),
  });

  // 202 = still running; check back until it finishes (up to 3 minutes).
  for (const started = Date.now(); res.status === 202 && Date.now() - started < 180_000; ) {
    const { statementHandle } = await res.json();
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetch(`${base}/${statementHandle}`, { headers });
  }

  const body = await res.json();
  if (res.status !== 200) {
    throw new Error(`Snowflake ${res.status}: ${body.message || JSON.stringify(body)}`);
  }
  return body;
}

// Rows as objects: [{ COLUMN_NAME: value, ... }]
export async function select(env, statement, values = []) {
  const body = await query(env, statement, values);
  const cols = body.resultSetMetaData.rowType.map((c) => c.name);
  return body.data.map((row) => Object.fromEntries(row.map((v, i) => [cols[i], v])));
}

// [a, b] -> one row. [[a, b], [c, d]] -> many rows (array binding: column by column).
function toBindings(values) {
  if (!values.length) return undefined;
  const manyRows = Array.isArray(values[0]);
  const columns = manyRows ? values[0].map((_, i) => values.map((row) => row[i])) : values.map((v) => [v]);
  return Object.fromEntries(
    columns.map((col, i) => {
      const type = col.every((v) => v === null || typeof v === "number") && col.some((v) => v !== null) ? "FIXED" : "TEXT";
      const vals = col.map((v) => (v === null || v === undefined ? null : String(v)));
      return [String(i + 1), { type, value: manyRows ? vals : vals[0] }];
    }),
  );
}

// Builds a short-lived login token signed with the private key.
// Snowflake checks the signature against the public key we gave FEEDBACK_API.
// Signing is the slowest part, so one token is reused for 50 minutes (it's valid for 60).
let cached = { token: null, expires: 0 };
async function makeJwt(env) {
  if (cached.token && Date.now() < cached.expires) return cached.token;
  const account = env.SNOWFLAKE_ACCOUNT.toUpperCase();
  const user = env.SNOWFLAKE_USER.toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: `${account}.${user}.SHA256:${env.SNOWFLAKE_PUBLIC_KEY_FP}`,
    sub: `${account}.${user}`,
    iat: now,
    exp: now + 3600,
  };

  const der = base64ToBytes(env.SNOWFLAKE_PRIVATE_KEY.replace(/-----[^-]+-----|\s|\\n/g, ""));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  cached = { token: `${unsigned}.${b64url(new Uint8Array(sig))}`, expires: Date.now() + 50 * 60 * 1000 };
  return cached.token;
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
