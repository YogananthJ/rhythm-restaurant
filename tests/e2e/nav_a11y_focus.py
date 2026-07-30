"""
Keyboard + screen-reader regression checks for the Occupancy navbar.

Verifies focus is never lost when:
  1. A desktop nav dropdown is opened with the keyboard and closed with Escape
     (focus must return to the trigger).
  2. Arrow keys move focus INSIDE the open dropdown (focus trap intact).
  3. The mobile drawer opens, traps Tab focus inside the dialog, and returns
     focus to its trigger on Escape.
  4. Required ARIA wiring exists: aria-expanded on triggers, role="menu" /
     role="dialog", accessible names on icon-only buttons, aria-current on the
     active link.

Run:  python3 tests/e2e/nav_a11y_focus.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(name)


async def restore_session(context, page) -> bool:
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
        return True
    return False


async def active_element(page) -> dict:
    return await page.evaluate(
        """() => {
            const el = document.activeElement;
            if (!el) return {tag: null};
            return {
              tag: el.tagName,
              text: (el.textContent || '').trim().slice(0, 40),
              label: el.getAttribute('aria-label'),
              role: el.getAttribute('role'),
              inDialog: !!el.closest('[role="dialog"]'),
              inMenu: !!el.closest('[role="menu"]'),
            };
        }"""
    )


async def desktop_dropdown_checks(page):
    await page.set_viewport_size({"width": 1280, "height": 900})
    await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)

    trigger = page.get_by_role("button", name="Operations").first
    if await trigger.count() == 0:
        check("desktop: Operations trigger present", False, "not signed in?")
        return
    check("desktop: Operations trigger present", True)

    await trigger.focus()
    check(
        "desktop: trigger reports aria-expanded=false when closed",
        (await trigger.get_attribute("aria-expanded")) == "false",
    )

    await page.keyboard.press("Enter")
    await page.wait_for_timeout(400)
    menu = page.locator('[role="menu"]').first
    check("desktop: dropdown exposes role=menu", await menu.is_visible())
    check(
        "desktop: trigger reports aria-expanded=true when open",
        (await trigger.get_attribute("aria-expanded")) == "true",
    )

    await page.keyboard.press("ArrowDown")
    await page.wait_for_timeout(200)
    act = await active_element(page)
    check("desktop: ArrowDown moves focus inside the menu", act.get("inMenu") is True, str(act))

    await page.screenshot(path=str(SHOTS / "nav_a11y_dropdown_open.png"))

    await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)
    act = await active_element(page)
    check(
        "desktop: Escape returns focus to the trigger (focus not lost)",
        "Operations" in (act.get("text") or ""),
        str(act),
    )


async def mobile_drawer_checks(page):
    await page.set_viewport_size({"width": 420, "height": 860})
    await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)

    opener = page.get_by_role("button", name="Open navigation menu").first
    check("mobile: drawer trigger has an accessible name", await opener.count() >= 1)
    if await opener.count() == 0:
        return

    await opener.focus()
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(600)

    dialog = page.locator('[role="dialog"]').first
    check("mobile: drawer exposes role=dialog", await dialog.is_visible())
    check(
        "mobile: drawer is labelled for screen readers",
        bool(await dialog.get_attribute("aria-label") or await dialog.get_attribute("aria-labelledby")),
    )
    check(
        "mobile: drawer has a screen-reader description",
        bool(await dialog.get_attribute("aria-describedby")),
    )

    inside = True
    for _ in range(14):
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(60)
        act = await active_element(page)
        if not act.get("inDialog"):
            inside = False
            break
    check("mobile: Tab focus stays trapped inside the drawer", inside)

    await page.screenshot(path=str(SHOTS / "nav_a11y_drawer_open.png"))

    await page.keyboard.press("Escape")
    await page.wait_for_timeout(400)
    act = await active_element(page)
    check(
        "mobile: Escape returns focus to the drawer trigger",
        (act.get("label") == "Open navigation menu"),
        str(act),
    )


async def landmark_checks(page):
    await page.set_viewport_size({"width": 1280, "height": 900})
    await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    check(
        "aria: main navigation landmark present",
        await page.locator('nav[aria-label="Main navigation"]').count() == 1,
    )
    check(
        "aria: active nav link marked with aria-current",
        await page.locator('[aria-current="page"]').count() >= 1,
    )
    unnamed = await page.evaluate(
        """() => Array.from(document.querySelectorAll('header button'))
             .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length"""
    )
    check("aria: no unnamed icon-only buttons in the header", unnamed == 0, f"{unnamed} unnamed")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        signed_in = await restore_session(context, page)
        if not signed_in:
            print("no injected session — falling back to one-tap demo login")
            await page.goto(f"{BASE}/auth", wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)  # let the island hydrate before clicking
            await page.get_by_role("button", name="One-tap demo login").click()
            await page.wait_for_timeout(9000)
            print("after demo login:", page.url)

        await desktop_dropdown_checks(page)
        await mobile_drawer_checks(page)
        await landmark_checks(page)

        await browser.close()

    print("\n" + ("ALL CHECKS PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
    sys.exit(1 if failures else 0)


asyncio.run(main())
