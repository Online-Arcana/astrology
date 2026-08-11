declare const __ASTRAL_UI_BUILD_SHA__: string | undefined;

/**
 * Browser presentation release. This is intentionally independent from the
 * calculation/recovery compatibility version in browser/runtime.ts.
 */
export const browserUiVersion = "0.22.0";

const injectedBuild = typeof __ASTRAL_UI_BUILD_SHA__ === "string"
  ? __ASTRAL_UI_BUILD_SHA__.trim()
  : "";

export const browserUiBuild = /^[a-f0-9]{7,40}$/iu.test(injectedBuild)
  ? injectedBuild.slice(0, 7)
  : "local";

export const browserUiLabel = `Browser UI ${browserUiVersion} · ${browserUiBuild}`;

const runtimeBadge = document.querySelector<HTMLElement>("#runtimeBadge");
if (runtimeBadge !== null) {
  let updating = false;
  const render = (): void => {
    if (updating) return;
    const current = runtimeBadge.textContent?.trim() ?? "";
    const status = current.length > 0
      && current !== "Loading browser runtime"
      && !current.startsWith("Browser runtime ")
      && !current.startsWith("Browser UI ")
      ? current
      : "";
    const next = status.length === 0 ? browserUiLabel : `${browserUiLabel} · ${status}`;
    if (current === next) return;
    updating = true;
    runtimeBadge.textContent = next;
    updating = false;
  };

  render();
  new MutationObserver(render).observe(runtimeBadge, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}
