// Project storage: export the current project to a JSON file and import a
// project back from a JSON file. This module is pure data/DOM glue and does
// not depend on React, so the parsing/validation logic can be unit tested on
// its own.
//
// Source of truth: docs/07_project_storage.md

import type { Project } from "../domain/types";

// Serialize a project to a human-readable JSON string (two-space indent).
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

// Parse and validate JSON text into a Project.
//
// Validation is intentionally minimal for the MVP: it only checks that the
// required top-level fields exist and have the right shape. It does not deeply
// validate every nested field. On any problem it throws an Error so callers
// can keep the current project unchanged.
export function parseProject(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  return validateProject(data);
}

// Validate already-parsed data as a Project, throwing on any problem.
//
// Phase 14: split out of parseProject so data that arrives as an object (from
// the local server's JSON response) is checked by exactly the same rules as a
// file the user imports.
export function validateProject(data: unknown): Project {
  if (typeof data !== "object" || data === null) {
    throw new Error("Project JSON must be an object.");
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== "string") {
    throw new Error("Project JSON is missing a string 'id'.");
  }
  if (typeof obj.title !== "string") {
    throw new Error("Project JSON is missing a string 'title'.");
  }
  if (!Array.isArray(obj.tracks)) {
    throw new Error("Project JSON is missing an array 'tracks'.");
  }
  if (!Array.isArray(obj.nodes)) {
    throw new Error("Project JSON is missing an array 'nodes'.");
  }
  if (!Array.isArray(obj.edges)) {
    throw new Error("Project JSON is missing an array 'edges'.");
  }

  // The required fields are present and well-shaped. Trust the rest of the
  // structure for the MVP and return it as a Project.
  return data as Project;
}

// Trigger a browser download of the project as `<title>.json`.
//
// This touches the DOM, so it is kept separate from the pure functions above
// and is not unit tested.
export function downloadProject(project: Project): void {
  const json = serializeProject(project);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.title}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
