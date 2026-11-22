const serverless = require("serverless-http");
const app = require("../../src/app");

const FUNCTION_PREFIX = "/.netlify/functions/api";


 // Netlify bisa mengirim path dalam beberapa bentuk:
 // - /.netlify/functions/api/auth/login   (redirect /api/v1/*)
 // - /api/v1/auth/login                   (path asli masih terbawa)
 // - /.netlify/functions/api/v1/health    (splat sudah berisi v1)
 // 
 // Semua dinormalkan ke /api/v1/... supaya route Express tetap cocok.
 
function normalizePath(rawUrl) {
  const value = String(rawUrl || "/");
  const queryIndex = value.indexOf("?");
  const pathname = queryIndex === -1 ? value : value.slice(0, queryIndex);
  const search = queryIndex === -1 ? "" : value.slice(queryIndex);

  let path = pathname || "/";

  if (path === FUNCTION_PREFIX) {
    path = "/";
  } else if (path.startsWith(`${FUNCTION_PREFIX}/`)) {
    path = path.slice(FUNCTION_PREFIX.length) || "/";
  }

  const isApiV1 = path === "/api/v1" || path.startsWith("/api/v1/");

  if (!isApiV1) {
    if (path === "/api") {
      path = "/api/v1";
    } else if (path.startsWith("/api/")) {
      path = `/api/v1/${path.slice("/api/".length)}`;
    } else if (path === "/v1" || path.startsWith("/v1/")) {
      path = `/api${path}`;
    } else {
      path = `/api/v1${path === "/" ? "" : path}`;
    }
  }

  return `${path}${search}`;
}

const serverlessHandler = serverless(app, {
  request(request) {
    request.url = normalizePath(request.url);
    return request;
  },
});

module.exports.handler = async (event, context) => {
  // Jangan biarkan pool MySQL membuat Lambda menunggu koneksi idle.
  if (context && typeof context === "object") {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  return serverlessHandler(event, context);
};
