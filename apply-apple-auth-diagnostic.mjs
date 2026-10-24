#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const routePath = path.join(
  repoRoot,
  "groovara-app",
  "app",
  "api",
  "apple",
  "developer-token",
  "route.ts",
);

if (!fs.existsSync(routePath)) {
  console.error(
    "Missing Apple developer-token route. Apply the Apple Music export patch first.",
  );
  process.exit(1);
}

let source = fs.readFileSync(routePath, "utf8").replace(/\r\n/g, "\n");

const oldBlock = `    const developerToken = await getAppleDeveloperToken({
      // Apple recommends restricting developer tokens used by web clients
      // to the requesting origin.
      origin: request.nextUrl.origin,
      ttlSeconds: 60 * 60,
    });`;

const newBlock = `    const requestOrigin = request.nextUrl.origin;
    const tokenOrigin =
      requestOrigin.startsWith("https://")
        ? requestOrigin
        : null;

    const developerToken = await getAppleDeveloperToken({
      // Keep the recommended origin restriction for HTTPS production.
      // During local HTTP development, omit the optional origin claim so
      // MusicKit authorization is not rejected because of a local-origin
      // mismatch inside Apple's web authorization flow.
      origin: tokenOrigin,
      ttlSeconds: 60 * 60,
    });`;

if (source.includes(newBlock)) {
  console.log("Local Apple Music origin fallback already applied.");
} else {
  const first = source.indexOf(oldBlock);

  if (first === -1) {
    console.error(
      "Could not find the expected Apple developer-token block. No file was written.",
    );
    process.exit(1);
  }

  if (source.indexOf(oldBlock, first + oldBlock.length) !== -1) {
    console.error(
      "Found multiple developer-token blocks. No file was written.",
    );
    process.exit(1);
  }

  source =
    source.slice(0, first) +
    newBlock +
    source.slice(first + oldBlock.length);

  fs.writeFileSync(routePath, source, "utf8");
  console.log(
    "Updated groovara-app/app/api/apple/developer-token/route.ts",
  );
}

const diagnosticPath = path.join(
  repoRoot,
  "groovara-app",
  "app",
  "api",
  "apple",
  "diagnostic",
  "route.ts",
);

if (!fs.existsSync(diagnosticPath)) {
  console.warn("");
  console.warn(
    "Diagnostic route is missing. Extract this ZIP into the repo root before running the installer.",
  );
  process.exit(1);
}

console.log("");
console.log("Apple auth diagnostic installed.");
console.log("Open /api/apple/diagnostic to test the server-side developer token.");
