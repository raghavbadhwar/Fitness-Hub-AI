import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

async function loadAuthenticatedApi() {
  mock.module("react-native", {
    namedExports: {
      Platform: { OS: "web" },
    },
  });

  const moduleUrl = new URL(
    `./authenticated-api.ts?nonce=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  return (await import(moduleUrl.href)) as typeof import("./authenticated-api.ts");
}

afterEach(() => {
  mock.reset();
});

test("authenticatedJsonRequest attaches Clerk bearer token and JSON body", async () => {
  const { authenticatedJsonRequest } = await loadAuthenticatedApi();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ dishName: "Paneer bowl" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await authenticatedJsonRequest<{ dishName: string }>({
    apiBase: "https://api.example.com/",
    path: "/api/ai/analyze-food",
    method: "POST",
    body: { imageBase64: "abc", mimeType: "image/jpeg" },
    getToken: async () => "clerk-token",
    fetchImpl,
  });

  assert.deepEqual(result, { dishName: "Paneer bowl" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.com/api/ai/analyze-food");
  assert.deepEqual(calls[0].init?.headers, {
    Accept: "application/json",
    Authorization: "Bearer clerk-token",
    "Content-Type": "application/json",
  });
  assert.equal(calls[0].init?.body, JSON.stringify({ imageBase64: "abc", mimeType: "image/jpeg" }));
});

test("authenticatedJsonRequest fails before fetch when token is missing", async () => {
  const { AuthenticatedApiError, authenticatedJsonRequest } = await loadAuthenticatedApi();
  let fetchCalled = false;

  await assert.rejects(
    authenticatedJsonRequest({
      apiBase: "https://api.example.com",
      path: "/api/ai/analyze-food",
      method: "POST",
      body: { imageBase64: "abc", mimeType: "image/jpeg" },
      getToken: async () => null,
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response("{}");
      },
    }),
    (error) =>
      error instanceof AuthenticatedApiError &&
      error.status === 401 &&
      /sign in again/i.test(error.message),
  );

  assert.equal(fetchCalled, false);
});

test("authenticatedJsonRequest fails before fetch when API base is missing", async () => {
  const { AuthenticatedApiError, authenticatedJsonRequest } = await loadAuthenticatedApi();
  let fetchCalled = false;

  await assert.rejects(
    authenticatedJsonRequest({
      apiBase: "",
      path: "/api/ai/analyze-food",
      getToken: async () => "clerk-token",
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response("{}");
      },
    }),
    (error) =>
      error instanceof AuthenticatedApiError && /not connected to the API/i.test(error.message),
  );

  assert.equal(fetchCalled, false);
});

test("authenticatedFetch returns the raw response for streaming endpoints", async () => {
  const { authenticatedFetch } = await loadAuthenticatedApi();
  const response = await authenticatedFetch({
    apiBase: "https://api.example.com",
    path: "/api/ai/chat",
    method: "POST",
    body: { messages: [] },
    getToken: async () => "clerk-token",
    fetchImpl: async () =>
      new Response('data: {"text":"hello"}\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
  });

  assert.equal(response.ok, true);
  assert.equal(await response.text(), 'data: {"text":"hello"}\n\n');
});
