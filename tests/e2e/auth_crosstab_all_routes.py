"""
E2E: cross-tab SIGNED_OUT re-renders the header / redirects protected routes
across every route in the app.

For each route we:
  1. Sign the user in fresh (auto-confirm signUp).
  2. Navigate to the target route and confirm the signed-in surface renders
     (banner on public routes, protected content on gated routes).
  3. Simulate another tab's signOut() -> supabase-js cross-tab sync fires an
     unintentional SIGNED_OUT here.
  4. Assert the correct reactive outcome:
       - Public routes: signed-in banner is gone; if the surface exposes a
         "Sign in" affordance, it becomes visible.
       - Protected (_authenticated) routes: router.invalidate() from the root
         listener + the gate's redirect land us on /auth.
     In both cases the auth log records AUTH_EXPIRED.

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

# (path, kind, ready_selector_type, ready_selector_value)
# kind: "public" -> banner-driven; "protected" -> redirects to /auth
ROUTES = [
    ("/",                              "public",    "text",  "Signed in as"),
    ("/auth",                          "public",    "text",  "Signed in as"),
    ("/health",                        "public",    "text",  "Signed in as"),
    ("/book",                          "public",    "text",  "Signed in as"),
    ("/_authenticated/dashboard",      "protected", "url",   "/dashboard"),
    ("/_authenticated/kds",            "protected", "url",   "/kds"),
    ("/_authenticated/host",           "protected", "url",   "/host"),
    ("/_authenticated/menu",           "protected", "url",   "/menu"),
    ("/_authenticated/tables",         "protected", "url",   "/tables"),
    ("/_authenticated/ops",            "protected", "url",   "/ops"),
    ("/_authenticated/intel",          "protected", "url",   "/intel"),
    ("/_authenticated/autopilot",      "protected", "url",   "/autopilot"),
    ("/_authenticated/reports",        "protected", "url",   "/reports"),
]


def real_path(p: str) -> str:
    # `_authenticated` is a pathless layout; strip it for navigation.
    return p.replace("/_authenticated", "", 1) or "/"


async def read_auth_log(page):
    return await page.evaluate("() => window.__authLog || []")


async def wait_for_kind(page, kind, timeout_ms=6000):
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < deadline:
        log = await read_auth_log(page)
        if any(e["kind"] == kind for e in log):
            return log
        await page.wait_for_timeout(150)
    raise AssertionError(f"auth log never received {kind}. Got: {await read_auth_log(page)}")


async def sign_in_fresh(page):
    """Create a fresh auto-confirmed user via supabase client. Reliable and
    isolated from any prior test session."""
    await page.goto(f"{BASE}/?debug=auth", wait_until="domcontentloaded")
    result = await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            // Ensure a clean slate in this tab before signing in.
            try { await mod.supabase.auth.signOut(); } catch (_) {}
            const rand = Math.random().toString(36).slice(2, 10);
            const email = `e2e_${rand}@occupancy.demo`;
            const password = `E2E!${rand}${Math.random().toString(36).slice(2, 8)}`;
            const { data, error } = await mod.supabase.auth.signUp({ email, password });
            return { ok: !error && !!data.session, error: error?.message ?? null, email };
        }"""
    )
    assert result["ok"], f"signUp failed: {result}"
    # Confirm the root listener processed SIGNED_IN before we navigate away.
    await wait_for_kind(page, "SIGNED_IN")


async def cross_tab_signout(page):
    await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            await mod.supabase.auth.signOut();
        }"""
    )


async def verify_route(page, path, kind, sel_type, sel_value, idx):
    label = path.replace("/", "_") or "root"
    print(f"\n--- [{idx}] {path} ({kind}) ---")

    await sign_in_fresh(page)

    target = real_path(path)
    await page.goto(f"{BASE}{target}", wait_until="domcontentloaded")

    # Confirm the signed-in surface is up before we cross-tab sign out.
    if kind == "public":
        await expect(page.get_by_text("Signed in as")).to_be_visible(timeout=8_000)
    else:
        # Protected: URL should settle on the requested path (no redirect to /auth).
        await page.wait_for_url(f"**{sel_value}", timeout=8_000)

    await page.screenshot(path=str(SHOTS / f"{idx:02d}_{label}_signed_in.png"))

    await cross_tab_signout(page)

    if kind == "public":
        # Header banner must disappear immediately from the reactive re-render.
        await expect(page.get_by_text("Signed in as")).to_have_count(0, timeout=6_000)
    else:
        # Root listener must navigate protected routes to /auth.
        await page.wait_for_url("**/auth**", timeout=8_000)

    await wait_for_kind(page, "AUTH_EXPIRED")
    await page.screenshot(path=str(SHOTS / f"{idx:02d}_{label}_after_signout.png"))
    print(f"PASS: {path}")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        results = []
        for i, (path, kind, sel_type, sel_value) in enumerate(ROUTES, start=1):
            try:
                await verify_route(page, path, kind, sel_type, sel_value, i)
                results.append((path, "PASS", None))
            except Exception as e:
                results.append((path, "FAIL", str(e)))
                print(f"FAIL: {path} -> {e}")

        print("\n=== Summary ===")
        for path, status, err in results:
            print(f"  {status}  {path}" + (f"  ({err.splitlines()[0]})" if err else ""))

        failed = [r for r in results if r[1] == "FAIL"]
        print(f"\n{len(results) - len(failed)}/{len(results)} routes passed.")

        log = await read_auth_log(page)
        print("Final auth log (most recent first, first 12):")
        print(json.dumps(log[:12], indent=2))

        await browser.close()

        if failed:
            raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
