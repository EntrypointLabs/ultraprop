import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const appDirectory = new URL("../", import.meta.url);

test("the document canvas matches the light mobile theme color", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("layout.tsx", appDirectory), "utf8"),
    readFile(new URL("globals.css", appDirectory), "utf8"),
  ]);

  const themeColor = layout.match(
    /const PAGE_BACKGROUND = "([^"]+)"/,
  )?.[1];
  const pageBackground = styles.match(
    /--page-background:\s*([^;]+);/,
  )?.[1];

  assert.ok(themeColor, "layout must define a mobile theme color");
  assert.ok(pageBackground, "global styles must define the page background");
  assert.equal(pageBackground.trim(), themeColor);
  assert.match(layout, /themeColor:\s*PAGE_BACKGROUND/);
  assert.doesNotMatch(layout, /<body className="[^"]*\bbg-bg\b/);
  assert.match(
    layout,
    /<html[\s\S]*style=\{\{[^}]*backgroundColor:\s*PAGE_BACKGROUND/,
  );
  assert.match(
    layout,
    /<body[\s\S]*style=\{\{[^}]*backgroundColor:\s*PAGE_BACKGROUND/,
  );
  assert.match(
    styles,
    /html\s*\{[^}]*background-color:\s*var\(--page-background\)/s,
  );
  assert.match(
    styles,
    /body\s*\{[^}]*background-color:\s*var\(--page-background\)/s,
  );
});
