/**
 * @typedef {Object} SignOutOptions
 * @property {boolean} livePreview
 * @property {boolean} [hasBearer] Retained for callers describing their session.
 * @property {() => Promise<unknown>} requestSignOut
 * @property {() => void} clearToken
 * @property {number} [timeoutMs] Override for tests; deployed requests get a longer bound.
 */

/** @param {SignOutOptions} options */
async function endSession(options) {
  const timeoutMs = options.timeoutMs ?? (options.livePreview ? 1500 : 15000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid sign-out timeout");
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  try {
    // Start while the bearer is still available to the request hook.
    const request = Promise.resolve().then(options.requestSignOut).then((result) => {
      if (result && typeof result === "object" && "error" in result && result.error) {
        const error = result.error;
        throw new Error(typeof error === "object" && "message" in error
          ? String(error.message) : "Sign-out failed");
      }
    });
    await Promise.race([
      request,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Sign-out timed out. Please retry.")), timeoutMs);
      }),
    ]);
  } catch (error) {
    // Cookie sessions need server confirmation; preview can clear its local bearer.
    if (!options.livePreview) throw error;
  } finally {
    clearTimeout(timer);
    options.clearToken();
  }
}

/** @param {SignOutOptions} options */
export async function runPreSignInSignOut(options) {
  await endSession(options);
}

/** @param {SignOutOptions & {redirect: () => void}} options */
export async function runSignOut(options) {
  await endSession(options);
  options.redirect();
}
