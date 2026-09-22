/** Match SQL migration filenames without including nested opt-in schemas. */
export function isMigrationFile(/** @type {string} */ name) {
  return /^[^/\\]+\.sql$/.test(name);
}

/**
 * Return unapplied top-level migrations in deterministic filename order.
 * Paths may be Vite glob keys or filesystem paths; tracking uses the filename.
 * @param {string[]} paths
 * @param {string[]} applied
 * @returns {{name: string, path: string}[]}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set(applied);
  const names = new Set();
  return paths.flatMap((path) => {
    const normalized = path.replaceAll("\\", "/");
    const name = normalized.split("/").at(-1) ?? "";
    if (!isMigrationFile(name)) return [];
    // Callers supply top-level migration paths; never recurse into auth/.
    const marker = normalized.lastIndexOf("migrations/");
    if (marker >= 0 && normalized.slice(marker + "migrations/".length).includes("/")) return [];
    if (names.has(name)) throw new Error(`Duplicate migration filename: ${name}`);
    names.add(name);
    return done.has(name) ? [] : [{ name, path }];
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
