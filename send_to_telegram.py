#!/usr/bin/env python3
"""
UP Police Directory - Automated Telegram Backup Sender
Sends police_directory_backup.zip directly to your Telegram chat.
"""

import sys
import os
import subprocess
import urllib.request
import urllib.parse
import json

def get_zip_path():
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "police_directory_backup.zip"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "police_directory_backup.zip"),
        r"C:\Users\hp\Documents\cctns caller\police_directory_backup.zip",
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None

def send_via_curl(bot_token, chat_id, zip_path, caption):
    cmd = [
        "curl.exe",
        "-s",
        "-X", "POST",
        f"https://api.telegram.org/bot{bot_token}/sendDocument",
        "-F", f"chat_id={chat_id}",
        "-F", f"caption={caption}",
        "-F", f"document=@{zip_path}"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        if data.get("ok"):
            return True, "Delivered successfully via curl!"
        return False, data.get("description", "Unknown error")
    except Exception as e:
        return False, str(e)

def send_via_python(bot_token, chat_id, zip_path, caption):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    url = f"https://api.telegram.org/bot{bot_token}/sendDocument"

    with open(zip_path, "rb") as f:
        file_bytes = f.read()

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="chat_id"\r\n\r\n')
    body.extend(f"{chat_id}\r\n".encode())

    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="caption"\r\n\r\n')
    body.extend(f"{caption}\r\n".encode())

    filename = os.path.basename(zip_path)
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'.encode())
    body.extend(b"Content-Type: application/zip\r\n\r\n")
    body.extend(file_bytes)
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            res_data = json.loads(response.read().decode())
            if res_data.get("ok"):
                return True, "Delivered successfully via Python HTTP!"
            return False, res_data.get("description", "Unknown error")
    except Exception as e:
        return False, str(e)

def main():
    print("=" * 65)
    print("  UP POLICE DIRECTORY - TELEGRAM BACKUP SENDER")
    print("=" * 65)
    print()

    zip_path = get_zip_path()
    if not zip_path or not os.path.isfile(zip_path):
        print(f"[ERROR] Backup zip not found. Please run the backup creation first.")
        sys.exit(1)

    file_size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"[FILE READY] Backup Archive: {zip_path}")
    print(f"             Size: {file_size_mb:.2f} MB")
    print()

    bot_token = sys.argv[1] if len(sys.argv) > 1 else ""
    chat_id = sys.argv[2] if len(sys.argv) > 2 else ""

    if not bot_token:
        print("Telegram Bot Token (from @BotFather):")
        bot_token = input("Enter BOT_TOKEN: ").strip()

    if not chat_id:
        print("\nTelegram Chat ID (your numeric ID or channel username e.g. 123456789):")
        chat_id = input("Enter CHAT_ID: ").strip()

    if not bot_token or not chat_id:
        print("[ERROR] Bot Token and Chat ID are required to send the backup.")
        sys.exit(1)

    caption = "🛡️ UP Police Portal - Full Project Backup (With Live D1 Database & 1-Click Setup)"

    print(f"\n[SENDING] Uploading {file_size_mb:.2f} MB to Telegram chat ID: {chat_id}...")

    success, msg = send_via_curl(bot_token, chat_id, zip_path, caption)
    if not success:
        print(f"[INFO] Retrying with Python HTTP client ({msg})...")
        success, msg = send_via_python(bot_token, chat_id, zip_path, caption)

    print()
    if success:
        print("=" * 65)
        print(" [SUCCESS] Project backup sent to your Telegram successfully!")
        print("=" * 65)
    else:
        print("=" * 65)
        print(f" [FAILED] Could not send to Telegram: {msg}")
        print(" Please check your Bot Token and Chat ID.")
        print("=" * 65)

if __name__ == "__main__":
    main()
