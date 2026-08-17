// Unit tests for the server calls, with a stubbed fetch.
//
// The behaviour that matters is the "server is not running" path: it must be
// reported, not thrown, so the app can fall back to working offline.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { Project } from "../domain/types";
import {
  fetchServerTracks,
  fetchServerProject,
  saveServerProject,
} from "./serverStorage";

const validProject: Project = {
  id: "p1",
  title: "Test",
  tracks: [],
  nodes: [],
  edges: [],
};

function stubFetch(implementation: typeof fetch) {
  vi.stubGlobal("fetch", implementation);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchServerTracks", () => {
  it("returns the listed files", async () => {
    const tracks = [{ fileName: "a.mp3", url: "/audio/a.mp3" }];
    stubFetch(async () => jsonResponse({ tracks }));

    expect(await fetchServerTracks()).toEqual({ available: true, value: tracks });
  });

  it("reports unavailable when the server cannot be reached", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await fetchServerTracks()).toEqual({ available: false, value: null });
  });

  it("reports unavailable on an error status", async () => {
    // The Vite proxy answers 500 when nothing is listening behind it, so a
    // failed status is how "no server" actually shows up in development.
    stubFetch(async () => jsonResponse({ error: "proxy" }, 500));

    expect(await fetchServerTracks()).toEqual({ available: false, value: null });
  });
});

describe("fetchServerProject", () => {
  it("returns the saved project", async () => {
    stubFetch(async () => jsonResponse({ project: validProject }));

    const result = await fetchServerProject();
    expect(result.available).toBe(true);
    expect(result.value?.id).toBe("p1");
  });

  it("treats a null project as 'nothing saved yet', not a failure", async () => {
    stubFetch(async () => jsonResponse({ project: null }));

    expect(await fetchServerProject()).toEqual({ available: true, value: null });
  });

  it("treats a saved project of the wrong shape as available but empty", async () => {
    stubFetch(async () => jsonResponse({ project: { id: 1 } }));

    expect(await fetchServerProject()).toEqual({ available: true, value: null });
  });

  it("reports unavailable on an error status", async () => {
    stubFetch(async () => jsonResponse({ error: "boom" }, 500));

    expect(await fetchServerProject()).toEqual({
      available: false,
      value: null,
    });
  });

  it("reports unavailable when the server cannot be reached", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await fetchServerProject()).toEqual({
      available: false,
      value: null,
    });
  });
});

describe("saveServerProject", () => {
  it("PUTs the project and reports success", async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    stubFetch(async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body });
      return jsonResponse({ saved: true });
    });

    expect(await saveServerProject(validProject)).toEqual({
      available: true,
      value: true,
    });
    expect(calls[0].url).toBe("/api/project");
    expect(calls[0].method).toBe("PUT");
    expect(JSON.parse(String(calls[0].body)).id).toBe("p1");
  });

  it("reports a rejected save as available but not written", async () => {
    stubFetch(async () => jsonResponse({ error: "too large" }, 413));

    expect(await saveServerProject(validProject)).toEqual({
      available: true,
      value: null,
    });
  });

  it("reports unavailable when the server cannot be reached", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await saveServerProject(validProject)).toEqual({
      available: false,
      value: null,
    });
  });
});
