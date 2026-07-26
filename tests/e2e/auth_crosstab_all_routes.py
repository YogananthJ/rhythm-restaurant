"""
E2E: cross-tab SIGNED_OUT propagates correctly across every route in the app.

For each route we:
  1. Sign in fresh (auto-confirm signUp) on `/`.
  2. Navigate to the target route and confirm the signed-in surface renders.
  3. Simulate another tab's signOut() -> supabase-js cross-tab sync fires an
     unintentional SIGNED_OUT here.
  4. Assert the correct reactive outcome:
       - "banner" routes (landing): the signed-in banner disappears from the
         header immediately via the reactive re-render.
       - "public" routes without a signed-in banner: the root listener still
         processes the event -> session is null and AUTH_EXPIRED is logged.
       - "protected" routes: router.invalidate() from the root listener + the
         _authenticated gate redirect us to /auth.

Run:
  python tests/e2e/auth_crosstab_all_routes.py
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots" / "crosstab_all_routes"
SHOTS.mkdir(parents=True, exist_ok=True)

# (path, kind)
ROUTES = [
    ("/",                              "banner"),
    ("/auth",                          "public"),
    ("/health",                        "public"),
    ("/book",                          "public"),
    ("/_authenticated/dashboard",      "protected"),
    ("/_authenticated/kds",            "protected"),
    ("/_authenticated/host",           "protected"),
    ("/_authenticated/menu",           "protected"),
    ("/_authenticated/tables",         "protected"),
    ("/_authenticated/ops",            "protected"),
    ("/_authenticated/intel",          "protected"),
    ("/_authenticated/autopilot",      "protected"),
    ("/_authenticated/reports",        "protected"),
]


def real_path(p: str) -> str:
    return p.replace("/_authenticated", "", 1) or "/"


async def read_auth_log(page):
    return await page.evaluate("() => window.__authLog || []")


async def has_session(page) -> bool:
    return await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            const { data } = await mod.supabase.auth.getSession();
            return !!data.session;
        }"""
    )


async def wait_for_kind_after(page, kind, after_ts, timeout_ms=8000):
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < deadline:
        log = await read_auth_log(page)
        if any(e["kind"] == kind and e["at"] >= after_ts for e in log):
            return
        await page.wait_for_timeout(150)
    raise AssertionError(
        f"auth log never received {kind} after {after_ts}. Recent: "
        f"{[(e['kind'], e['at']) for e in (await read_auth_log(page))[:5]]}"
    )


async def sign_in_fresh(page):
    await page.goto(f"{BASE}/?debug=auth", wait_until="domcontentloaded")
    now = await page.evaluate("() => Date.now()")
    result = await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            try { await mod.supabase.auth.signOut(); } catch (_) {}
            const rand = Math.random().toString(36).slice(2, 10);
            const email = `e2e_${rand}@occupancy.demo`;
            const password = `E2E!${rand}${Math.random().toString(36).slice(2, 8)}`;
            const { data, error } = await mod.supabase.auth.signUp({ email, password });
            return { ok: !error && !!data.session, error: error?.message ?? null };
        }"""
    )
    assert result["ok"], f"signUp failed: {result}"
    await wait_for_kind_after(page, "SIGNED_IN", now)


async def cross_tab_signout(page):
    await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            await mod.supabase.auth.signOut();
        }"""
    )


async def verify_route(page, path, kind, idx):
    label = path.strip("/").replace("/", "_") or "root"
    print(f"\n--- [{idx}] {path} ({kind}) ---")

    await sign_in_fresh(page)

    target = real_path(path)
    await page.goto(f"{BASE}{target}", wait_until="domcontentloaded")

    if kind == "banner":
        await expect(page.get_by_text("Signed in as")).to_be_visible(timeout=8_000)
    elif kind == "protected":
        # Should NOT bounce to /auth while signed in.
        await page.wait_for_timeout(500)
        assert "/auth" not in page.url, f"protected route bounced while signed in: {page.url}"
    else:  # public
        assert await has_session(page), "expected active session on public route pre-signout"

    await page.screenshot(path=str(SHOTS / f"{idx:02d}_{label}_signed_in.png"))

    signout_ts = await page.evaluate("() => Date.now()")
    await cross_tab_signout(page)

    if kind == "banner":
        await expect(page.get_by_text("Signed in as")).to_have_count(0, timeout=6_000)
    elif kind == "protected":
        await page.wait_for_url("**/auth**", timeout=8_000)
    else:  # public
        # Root listener ran (AUTH_EXPIRED) and session is cleared.
        await wait_for_kind_after(page, "AUTH_EXPIRED", signout_ts)
        assert not await has_session(page), "session should be null after cross-tab signout"

    if kind in ("banner", "protected"):
        await wait_for_kind_after(page, "AUTH_EXPIRED", signout_ts)

    await page.screenshot(path=str(SHOTS / f"{idx:02d}_{label}_after_signout.png"))
    print(f"PASS: {path}")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        results = []
        for i, (path, kind) in enumerate(ROUTES, start=1):
            try:
                await verify_route(page, path, kind, i)
                results.append((path, "PASS", None))
            except Exception as e:
                results.append((path, "FAIL", str(e)))
                print(f"FAIL: {path} -> {e}")

        print("\n=== Summary ===")
        for path, status, err in results:
            extra = f"  ({err.splitlines()[0]})" if err else ""
            print(f"  {status}  {path}{extra}")
        failed = [r for r in results if r[1] == "FAIL"]
        print(f"\n{len(results) - len(failed)}/{len(results)} routes passed.")

        log = await read_auth_log(page)
        print("Final auth log (most recent first, first 8):")
        print(json.dumps(log[:8], indent=2))

        await browser.close()

        if failed:
            raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
