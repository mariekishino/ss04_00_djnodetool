// Unit tests for the local server's pure helpers.

import { describe, it, expect } from "vitest";
import {
  isSafeAudioFileName,
  extensionOf,
  contentTypeFor,
} from "./paths.js";

describe("isSafeAudioFileName", () => {
  it("accepts a plain audio file name", () => {
    expect(isSafeAudioFileName("night-drive.mp3")).toBe(true);
    expect(isSafeAudioFileName("take 1.wav")).toBe(true);
    expect(isSafeAudioFileName("MIX.MP3")).toBe(true);
  });

  it("rejects anything with a path separator", () => {
    expect(isSafeAudioFileName("sub/song.mp3")).toBe(false);
    expect(isSafeAudioFileName("sub\\song.mp3")).toBe(false);
    expect(isSafeAudioFileName("/etc/passwd")).toBe(false);
  });

  it("rejects parent-directory traversal", () => {
    expect(isSafeAudioFileName("../secret.mp3")).toBe(false);
    expect(isSafeAudioFileName("..")).toBe(false);
  });

  it("rejects non-audio and empty names", () => {
    expect(isSafeAudioFileName("notes.txt")).toBe(false);
    expect(isSafeAudioFileName("song")).toBe(false);
    expect(isSafeAudioFileName("")).toBe(false);
  });
});

describe("extensionOf", () => {
  it("returns the lower-cased extension with its dot", () => {
    expect(extensionOf("song.MP3")).toBe(".mp3");
    expect(extensionOf("a.b.wav")).toBe(".wav");
  });

  it("returns an empty string when there is no extension", () => {
    expect(extensionOf("song")).toBe("");
    expect(extensionOf(".hidden")).toBe("");
  });
});

describe("contentTypeFor", () => {
  it("maps known audio extensions", () => {
    expect(contentTypeFor("a.mp3")).toBe("audio/mpeg");
    expect(contentTypeFor("a.wav")).toBe("audio/wav");
  });

  it("falls back to a generic type for anything else", () => {
    expect(contentTypeFor("a.xyz")).toBe("application/octet-stream");
  });
});
