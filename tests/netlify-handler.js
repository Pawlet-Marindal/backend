/** Uji wrapper Netlify Function tanpa database; cukup panggil /health. */
require("dotenv").config();
const assert = require("node:assert/strict");
const { handler } = require("../netlify/functions/api");

const headers = {
  host: "pawlet-api.example.netlify.app",
  "content-type": "application/json",
};

const restEvent = (path, method = "GET") => ({
  httpMethod: method,
  path,
  headers,
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: {},
  body: null,
  isBase64Encoded: false,
  requestContext: {
    requestId: "test-rest",
    identity: { sourceIp: "127.0.0.1" },
  },
});

const httpEvent = (rawPath, method = "GET") => ({
  version: "2.0",
  rawPath,
  rawQueryString: "",
  headers,
  body: null,
  isBase64Encoded: false,
  requestContext: {
    requestId: "test-http",
    http: { method, sourceIp: "127.0.0.1", path: rawPath },
  },
});

const parse = (response) => {
  const raw = response.isBase64Encoded
    ? Buffer.from(response.body || "", "base64").toString("utf8")
    : response.body;
  return { status: response.statusCode, body: JSON.parse(raw) };
};

const cases = [
  ["REST redirect /api/v1/*", restEvent("/.netlify/functions/api/health")],
  ["REST path asli", restEvent("/api/v1/health")],
  ["REST splat sudah berisi v1", restEvent("/.netlify/functions/api/v1/health")],
  ["HTTP API v2", httpEvent("/.netlify/functions/api/health")],
];

(async () => {
  let passed = 0;
  let failed = 0;

  for (const [label, event] of cases) {
    try {
      const response = parse(await handler(event, {}));
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.success, true);
      console.log(`  OK   ${label} -> 200`);
      passed += 1;
    } catch (error) {
      console.error(`  FAIL ${label}: ${error.message}`);
      failed += 1;
    }
  }

  try {
    const response = parse(await handler(restEvent("/.netlify/functions/api/tidak-ada"), {}));
    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    console.log("  OK   404 tetap JSON");
    passed += 1;
  } catch (error) {
    console.error(`  FAIL 404 tetap JSON: ${error.message}`);
    failed += 1;
  }

  try {
    const event = restEvent("/.netlify/functions/api/auth/login", "POST");
    event.body = '{ "email": ';
    const response = parse(await handler(event, {}));
    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    console.log("  OK   POST body rusak -> 400 JSON");
    passed += 1;
  } catch (error) {
    console.error(`  FAIL POST body rusak -> 400 JSON: ${error.message}`);
    failed += 1;
  }

  console.log(`\nNetlify handler: ${passed} lolos, ${failed} gagal\n`);
  process.exit(failed ? 1 : 0);
})();
