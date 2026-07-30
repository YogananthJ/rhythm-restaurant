"""Visual regression: navbar dropdowns + mobile drawer across breakpoints.

Run:  python3 tests/e2e/visual_nav_regression.py
Baselines land in tests/e2e/__screenshots__/ on first run; later runs diff
against them and fail loudly when pixels drift beyond the tolerance.
"""

import asyncio
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "__screenshots__"
DIFFS = Path(__file__).parent / "__diffs__"
SHOTS.mkdir(parents=True, exist_ok=True)
DIFFS.mkdir(parents=True, exist_ok=True)

BREAKPOINTS = [
    ("mobile", 390, 844),
    ("tablet", 768, 1024),
    ("desktop", 1440, 900),
]
TOLERANCE = 0.005  # 0.5% of pixels may differ (font AA / live data)


def compare(name: str, current: Path) -> str | None:
    baseline = SHOTS / f"{name}.png"
    if not baseline.exists():
        current.replace(baseline)
        return None
    a = Image.open(baseline).convert("RGB")
    b = Image.open(current).convert("RGB")
    if a.size != b.size:
        return f"{name}: size changed {a.size} -> {b.size}"
    diff = ImageChops.difference(a, b)
    changed = sum(1 for px in diff.getdata() if px != (0, 0, 0))
    ratio = changed / (a.size[0] * a.size[1])
    if ratio > TOLERANCE:
        diff.save(DIFFS / f"{name}.diff.png")
        b.save(DIFFS / f"{name}.actual.png")
        return f"{name}: {ratio:.2%} of pixels differ (limit {TOLERANCE:.2%})"
    return None


async def shoot(page, name: str, tmp: Path) -> str | None:
    out = tmp / f"{name}.png"
    await page.screenshot(path=str(out))
    return compare(name, out)


async def main() -> int:
    tmp = Path("/tmp/browser/visual-nav")
    tmp.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for label, w, h in BREAKPOINTS:
            ctx = await browser.new_context(
                viewport={"width": w, "height": h},
                reduced_motion="reduce",
                device_scale_factor=1,
            )
            page = await ctx.new_page()
            await page.goto(BASE, wait_until="networkidle")
            await page.wait_for_timeout(600)

            failures.append(await shoot(page, f"nav_closed_{label}", tmp))

            if w < 1024:
                trigger = page.get_by_role("button", name="Open navigation menu")
                if await trigger.count():
                    await trigger.first.click()
                    await page.wait_for_timeout(500)
                    failures.append(await shoot(page, f"nav_drawer_{label}", tmp))
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(300)
            else:
                for menu in ["Operations", "Intelligence", "Guest"]:
                    btn = page.get_by_role("button", name=menu)
                    if await btn.count():
                        await btn.first.click()
                        await page.wait_for_timeout(400)
                        failures.append(await shoot(page, f"nav_dropdown_{menu.lower()}_{label}", tmp))
                        await page.keyboard.press("Escape")
                        await page.wait_for_timeout(200)

                # focus ring styling on the first nav control
                await page.keyboard.press("Tab")
                await page.keyboard.press("Tab")
                await page.wait_for_timeout(200)
                failures.append(await shoot(page, f"nav_focus_ring_{label}", tmp))

            await ctx.close()
        await browser.close()

    real = [f for f in failures if f]
    if real:
        print("VISUAL REGRESSIONS:")
        for f in real:
            print(" -", f)
        print(f"diffs written to {DIFFS}")
        return 1
    print("visual nav regression: all snapshots match")
    return 0


sys.exit(asyncio.run(main()))
