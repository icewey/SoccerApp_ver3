# -*- coding: utf-8 -*-
"""
Mixamo Animation Downloader - API approach
1. Playwright で Google ログイン → Bearer token を傍受
2. requests で Mixamo REST API を叩いてダウンロード
"""
import asyncio
import os
import re
import sys
import time
import json
import urllib.parse
import threading

import requests
from playwright.async_api import async_playwright, TimeoutError as PWTimeout

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "animations")
CREDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "アカウント情報.txt")

ANIMATIONS = [
    ("Idle",                 "idle.fbx"),
    ("Walking",              "walk.fbx"),
    ("Running",              "run.fbx"),
    ("Standing Soccer Kick", "kick.fbx"),
    ("Sprint Forward",       "sprint.fbx"),
    ("Victory Idle",         "celebrate.fbx"),
]

MIXAMO_API = "https://www.mixamo.com/api/v1"
CHARACTER_ID = "e2a3d4f5-a36f-4a61-aedb-72b3b55a9c20"  # default T-pose character


def load_credentials():
    with open(CREDS_FILE, encoding="utf-8") as f:
        text = f.read()
    email = re.search(r"アカウント[：:]\s*(\S+)", text).group(1)
    pw    = re.search(r"PW[：:]\s*(\S+)", text).group(1)
    return email, pw


# ── Step 1: Login & capture Bearer token ─────────────────────────────────────
async def get_token_via_browser(email, password):
    token_holder = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=200)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()

        # ネットワークを傍受 → Authorization ヘッダーを抽出
        def on_request(request):
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and "mixamo" in request.url:
                token_holder["token"] = auth.split(" ", 1)[1]

        page.on("request", on_request)

        print("[Auth] Mixamo を開いています...")
        await page.goto("https://www.mixamo.com/#/", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(4000)

        # Adobe / Google ログイン処理
        current = page.url
        print(f"[Auth] URL: {current}")

        if "mixamo.com" in current and "adobe" not in current:
            # Sign In ボタンを探す
            for sel in ["button:has-text('SIGN IN')", "button:has-text('Sign In')",
                        "a:has-text('SIGN IN')", "a:has-text('Sign In')"]:
                try:
                    await page.locator(sel).first.click(timeout=5000)
                    await page.wait_for_timeout(4000)
                    break
                except PWTimeout:
                    continue

        current = page.url
        print(f"[Auth] After sign-in click: {current}")

        # Google OAuth
        if "google.com" in current:
            print("[Auth] Google ログイン中...")
            try:
                await page.locator("input[type='email']").fill(email, timeout=10000)
                await page.locator("#identifierNext button, button:has-text('Next')").first.click()
                await page.wait_for_timeout(3000)
                await page.locator("input[type='password']").fill(password, timeout=10000)
                await page.locator("#passwordNext button, button:has-text('Next')").first.click()
                await page.wait_for_timeout(5000)
            except PWTimeout:
                pass

        # Adobe login
        elif "adobe.com" in current or "adobelogin.com" in current:
            print("[Auth] Adobe ログイン中...")
            try:
                await page.locator("input[type='email'], input[name='email']").first.fill(email, timeout=8000)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(3000)
                # Check for Google redirect
                if "google.com" in page.url:
                    await page.locator("input[type='password']").fill(password, timeout=8000)
                    await page.locator("#passwordNext button").click()
                    await page.wait_for_timeout(5000)
                else:
                    await page.locator("input[type='password']").first.fill(password, timeout=8000)
                    await page.keyboard.press("Enter")
                    await page.wait_for_timeout(5000)
            except PWTimeout:
                pass

        # 追加認証が必要な場合は手動対応
        if "accounts.google.com" in page.url or "challenge" in page.url:
            print("\n[!!] 2段階認証などが必要です。ブラウザで手動で完了してください。")
            print("[!!] 完了したらここで Enter を押してください...")
            await asyncio.get_event_loop().run_in_executor(None, input)

        # Mixamo に戻るまで待つ
        print("[Auth] Mixamo に戻るのを待っています...")
        try:
            await page.wait_for_url("*mixamo.com*", timeout=30000)
        except PWTimeout:
            pass

        await page.wait_for_timeout(5000)

        # トークンがまだ取れていない場合、ページリロードして再キャプチャ
        if not token_holder.get("token"):
            print("[Auth] トークン待機中... API コールをトリガーします")
            await page.reload()
            await page.wait_for_timeout(5000)

        if not token_holder.get("token"):
            print("[Auth] 自動取得に失敗。ブラウザの DevTools > Network で")
            print("       mixamo.com への Request Headers の Authorization: Bearer XXX を確認し、")
            print("       XXX 部分を入力してください:")
            token = await asyncio.get_event_loop().run_in_executor(None, input, "Token: ")
            token_holder["token"] = token.strip()

        await browser.close()

    return token_holder.get("token", "")


# ── Step 2: Mixamo REST API ───────────────────────────────────────────────────
class MixamoAPI:
    def __init__(self, token):
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "X-Api-Key": "mixamo-product-frontend",
            "Accept": "application/json",
            "Origin": "https://www.mixamo.com",
            "Referer": "https://www.mixamo.com/",
        })

    def search(self, query, per_page=10):
        params = {
            "page": 1,
            "per_page": per_page,
            "type": "Motion,MotionPack",
            "query": query,
        }
        resp = self.session.get(f"{MIXAMO_API}/products", params=params)
        resp.raise_for_status()
        return resp.json().get("results", [])

    def export_request(self, product_id, character_id=CHARACTER_ID):
        payload = {
            "gms_hash": {
                "model_id": character_id,
                "motions": [{"motion_id": product_id}],
                "params": {
                    "format": "fbx7_unity",
                    "fps": "30",
                    "skin": "false",       # Without Skin
                    "reducekeyframes": "0",
                },
            },
            "preferences": {"fps": "30"},
            "type": "fbx7_unity",
        }
        resp = self.session.post(f"{MIXAMO_API}/animations/export", json=payload)
        resp.raise_for_status()
        return resp.json()

    def poll_export(self, job_id, timeout=120):
        """エクスポート完了まで polling"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            resp = self.session.get(f"{MIXAMO_API}/animations/export?job_id={job_id}")
            data = resp.json()
            status = data.get("status", "")
            if status == "completed":
                return data.get("job_result", {}).get("url", "")
            if status == "failed":
                raise RuntimeError(f"Export failed: {data}")
            time.sleep(3)
        raise TimeoutError(f"Export timeout for job {job_id}")

    def download(self, url, save_path):
        resp = self.session.get(url, stream=True)
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                f.write(chunk)


# ── Main ─────────────────────────────────────────────────────────────────────
async def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    email, password = load_credentials()

    pending = [
        (term, fname) for term, fname in ANIMATIONS
        if not os.path.exists(os.path.join(OUTPUT_DIR, fname))
    ]
    if not pending:
        print("All animations already downloaded.")
        return

    print(f"[Main] {len(pending)} animations to download\n")

    # Step 1: Token 取得
    token = await get_token_via_browser(email, password)
    if not token:
        print("[Error] Token not obtained. Exiting.")
        return
    print(f"[Auth] Token acquired ({len(token)} chars)\n")

    # Step 2: API でダウンロード
    api = MixamoAPI(token)
    success = 0

    for search_term, filename in pending:
        print(f"--- {filename} ({search_term}) ---")
        try:
            results = api.search(search_term)
            if not results:
                print(f"  [!] No results for '{search_term}'")
                continue

            product = results[0]
            product_id = product.get("id") or product.get("product_id")
            print(f"  Found: {product.get('name', 'unknown')} (id={product_id})")

            export_data = api.export_request(product_id)
            job_id = export_data.get("uuid") or export_data.get("job_id")
            print(f"  Export job: {job_id}")

            dl_url = api.poll_export(job_id)
            save_path = os.path.join(OUTPUT_DIR, filename)
            api.download(dl_url, save_path)
            size = os.path.getsize(save_path) // 1024
            print(f"  Saved: {filename} ({size}KB)")
            success += 1

        except Exception as e:
            print(f"  [Error] {e}")

    print(f"\nDone: {success}/{len(pending)} downloaded to {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
