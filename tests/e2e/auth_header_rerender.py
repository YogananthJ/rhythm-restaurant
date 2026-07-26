"""
E2E: header re-renders on cross-tab SIGNED_OUT and token-expiry SIGNED_OUT.

Prereqs (both provided by the running Lovable sandbox):
  - dev server on http://localhost:8080
  - seeded demo user demo@occupancy.app / demo1234

Run:
  python tests/e2e/auth_header_rerender.py
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


async def get_supabase_storage_key(page) -> str:
    return await page.evaluate(
        """() => Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))"""
    )


async def read_auth_log(page):
    return await page.evaluate("() => window.__authLog || []")


async def wait_for_kind(page, kind, timeout_ms=5000):
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < deadline:
        log = await read_auth_log(page)
        if any(e["kind"] == kind for e in log):
            return log
        await page.wait_for_timeout(150)
    raise AssertionError(f"auth log never received {kind}. Got: {await read_auth_log(page)}")


async def sign_in_demo(page):
    """Bypass the auth UI: create a fresh user directly via the supabase
    client. Auto-confirm is enabled on this project so signUp yields a session."""
    await page.goto(f"{BASE}/?debug=auth", wait_until="domcontentloaded")
    result = await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            const rand = Math.random().toString(36).slice(2, 10);
            const email = `e2e_${rand}@occupancy.demo`;
            const password = `E2E!${rand}${Math.random().toString(36).slice(2, 8)}`;
            const { data, error } = await mod.supabase.auth.signUp({ email, password });
            return { ok: !error && !!data.session, error: error?.message ?? null, email };
        }"""
    )
    assert result["ok"], f"signUp failed: {result}"
    await wait_for_kind(page, "SIGNED_IN")


async def assert_banner_visible(page):
    await expect(page.get_by_text("Signed in as")).to_be_visible(timeout=5_000)


async def assert_banner_gone(page):
    await expect(page.get_by_text("Signed in as")).to_have_count(0, timeout=5_000)


async def cross_tab_signout(page, storage_key):
    """Simulate another tab clearing the Supabase session.

    supabase-js subscribes to the `storage` event and emits SIGNED_OUT when its
    storage key is cleared from another tab.
    """
    await page.evaluate(
        """(key) => {
            const old = localStorage.getItem(key);
            localStorage.removeItem(key);
            window.dispatchEvent(new StorageEvent('storage', {
                key, oldValue: old, newValue: null, storageArea: localStorage,
            }));
        }""",
        storage_key,
    )


async def expire_token_and_refresh(page, storage_key):
    """Overwrite the persisted session so refresh fails with an expired token,
    then force supabase-js to attempt a refresh -> SIGNED_OUT."""
    await page.evaluate(
        """(key) => {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const s = JSON.parse(raw);
            s.expires_at = Math.floor(Date.now() / 1000) - 60;
            s.expires_in = -60;
            s.refresh_token = 'expired-refresh-token-forced-by-e2e';
            localStorage.setItem(key, JSON.stringify(s));
        }""",
        storage_key,
    )
    # Trigger a refresh attempt; the bad refresh token -> AuthApiError -> SIGNED_OUT.
    await page.evaluate(
        """async () => {
            const mod = await import('/src/integrations/supabase/client.ts');
            try { await mod.supabase.auth.refreshSession(); } catch (_) {}
        }"""
    )


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # ---- Phase 1: cross-tab SIGNED_OUT ----
        await sign_in_demo(page)
        await page.goto(f"{BASE}/?debug=auth", wait_until="domcontentloaded")
        await assert_banner_visible(page)
        await page.screenshot(path=str(SHOTS / "1_signed_in.png"))

        key = await get_supabase_storage_key(page)
        assert key, "expected a supabase auth-token key in localStorage"
        await cross_tab_signout(page, key)

        await assert_banner_gone(page)
        await expect(page.get_by_role("link", name="Sign in")).to_be_visible()
        await wait_for_kind(page, "AUTH_EXPIRED")
        await page.screenshot(path=str(SHOTS / "2_after_crosstab_signout.png"))
        print("PASS: cross-tab SIGNED_OUT re-rendered the header")

        # ---- Phase 2: token-expiry SIGNED_OUT ----
        await sign_in_demo(page)
        await page.goto(f"{BASE}/?debug=auth", wait_until="domcontentloaded")
        await assert_banner_visible(page)

        key = await get_supabase_storage_key(page)
        await expire_token_and_refresh(page, key)

        await assert_banner_gone(page)
        await expect(page.get_by_role("link", name="Sign in")).to_be_visible()
        await wait_for_kind(page, "AUTH_EXPIRED")
        await page.screenshot(path=str(SHOTS / "3_after_expiry_signout.png"))
        print("PASS: token-expiry SIGNED_OUT re-rendered the header")

        log = await read_auth_log(page)
        print("Final auth log (most recent first):")
        print(json.dumps(log[:12], indent=2))

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
