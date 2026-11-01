#!/usr/bin/env python3
"""
UP Police Directory - Automated Host Sync & Telegram Backup
1. Exports fresh database from Cloudflare D1 host (database_backup.sql & local_database.sqlite)
2. Compresses the updated project into police_directory_backup.zip
3. Sends the backup to Telegram with Indian Date/Time format and concise Update Subject.
"""

import sys
import os
import subprocess
import urllib.request
import urllib.parse
import json
import sqlite3
import zipfile
from datetime import datetime, timezone, timedelta

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Configured Telegram Bot Credentials
BOT_TOKEN = "8988345891:AAEl6FXgqQhil6oz4X3ABRiZbuyInwGLFw8"
CHAT_ID = "25624148"

BASE_DIR = r"C:\Users\hp\Documents\cctns caller"
PROJECT_DIR = os.path.join(BASE_DIR, "police-directory-app")
ZIP_PATH = os.path.join(BASE_DIR, "police_directory_backup.zip")
SQL_PATH = os.path.join(PROJECT_DIR, "database_backup.sql")
SQLITE_PATH = os.path.join(PROJECT_DIR, "local_database.sqlite")
UPDATE_FILE = os.path.join(BASE_DIR, "LAST_UPDATE.txt")

def get_indian_time():
    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist)
    return now.strftime("%d-%m-%Y, %I:%M:%S %p IST")

def export_host_database():
    print("[1/4] Syncing fresh data from Cloudflare D1 Host...")
    api_dir = os.path.join(PROJECT_DIR, "apps", "api")
    cmd = [
        "npx.cmd", "wrangler", "d1", "export", "police_directory_prod",
        "--remote", f"--output={SQL_PATH}"
    ]
    try:
        res = subprocess.run(cmd, cwd=api_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        print("      [OK] Cloudflare D1 data exported to database_backup.sql")
    except Exception as e:
        print(f"      [NOTICE] Host export note: {e}")
        if not os.path.isfile(SQL_PATH):
            print("      [ERROR] database_backup.sql not found.")
            return False

    # Generate or refresh local SQLite database
    try:
        if os.path.isfile(SQLITE_PATH):
            os.remove(SQLITE_PATH)
        con = sqlite3.connect(SQLITE_PATH)
        with open(SQL_PATH, "r", encoding="utf-8") as f:
            sql = f.read()
        con.executescript(sql)
        con.close()
        print("      [OK] local_database.sqlite updated with fresh host data.")
    except Exception as e:
        print(f"      [WARN] SQLite generation error: {e}")
    return True

def create_backup_zip():
    print("[2/4] Packaging complete project into zip archive...")
    exclude_dirs = {'node_modules', '.git', 'dist', '.tools', '.wrangler', '.gemini', 'cache'}
    exclude_exts = {'.log'}

    total_files = 0
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Include root helper files
        root_files = [
            '1-CLICK-SETUP-AND-START.bat',
            'README_BACKUP_AND_SETUP.md',
            'sync-and-backup-to-telegram.bat',
            'auto_sync_and_backup.py',
            'send-backup-to-telegram.bat',
            'send_to_telegram.py',
            'deploy-to-cloudflare.bat',
            'push-to-github.bat'
        ]
        for rf in root_files:
            rf_path = os.path.join(BASE_DIR, rf)
            if os.path.isfile(rf_path):
                zipf.write(rf_path, rf)
                total_files += 1

        for root, dirs, files in os.walk(PROJECT_DIR):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in exclude_exts:
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, BASE_DIR)
                zipf.write(full_path, rel_path)
                total_files += 1

    size_mb = os.path.getsize(ZIP_PATH) / (1024 * 1024)
    print(f"      [OK] Created {ZIP_PATH} ({total_files} files, {size_mb:.2f} MB)")
    return size_mb

def send_telegram_backup(update_subject, size_mb):
    print("[3/4] Preparing Telegram dispatch with Indian timestamp...")
    time_str = get_indian_time()

    caption = (
        f"🚔 CCTNS Caller - Final Project Backup\n"
        f"📅 दिनांक व समय: {time_str}\n"
        f"📌 अद्यतन विषय: {update_subject}\n"
        f"📦 फ़ाइल आकार: {size_mb:.2f} MB (डेटाबेस व 1-क्लिक रनर सहित)"
    )

    print(f"[4/4] Uploading backup to Telegram (Chat ID: {CHAT_ID})...")
    cmd = [
        "curl.exe", "-s", "-X", "POST",
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument",
        "-F", f"chat_id={CHAT_ID}",
        "-F", f"caption={caption}",
        "-F", f"document=@{ZIP_PATH}"
    ]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        data = json.loads(res.stdout)
        if data.get("ok"):
            print("      [SUCCESS] Project backup sent to Telegram successfully!")
            return True, caption
        else:
            print(f"      [ERROR] Telegram API Error: {data.get('description')}")
            return False, data.get("description")
    except Exception as e:
        print(f"      [ERROR] Upload failed: {e}")
        return False, str(e)

def main():
    print("=" * 70)
    print("  UP POLICE DIRECTORY - AUTOMATED HOST SYNC & TELEGRAM BACKUP")
    print("=" * 70)

    # Determine update subject
    if len(sys.argv) > 1:
        subject = " ".join(sys.argv[1:])
    elif os.path.isfile(UPDATE_FILE):
        with open(UPDATE_FILE, "r", encoding="utf-8") as f:
            subject = f.read().strip()
    else:
        subject = "नया अद्यतन: थाना/कार्यालय नंबर एडिट, नया ऑफिस निर्माण, गाइड हटाया, डेटा सिंक"

    # Save to LAST_UPDATE.txt
    with open(UPDATE_FILE, "w", encoding="utf-8") as f:
        f.write(subject)

    # 1. Export host database
    export_host_database()

    # 2. Create backup zip
    size_mb = create_backup_zip()

    # 3. Send to Telegram
    success, caption = send_telegram_backup(subject, size_mb)

    print()
    if success:
        print("=" * 70)
        print(" [COMPLETED] Final backup synced and delivered to your Telegram!")
        print(f" Caption Delivered:\n{caption}")
        print("=" * 70)
    else:
        print("=" * 70)
        print(" [WARNING] Backup was created locally but Telegram delivery failed.")
        print("=" * 70)

if __name__ == "__main__":
    main()
