#!/usr/bin/env python3
import re
import sys

files = [
    "artifacts/mobile/package.json",
    "pnpm-lock.yaml",
]

pattern = re.compile(r"<<<<<<<.*?=======(.*?)>>>>>>>.*?\n", re.S)

for fname in files:
    try:
        with open(fname, "r", encoding="utf-8") as f:
            s = f.read()
    except FileNotFoundError:
        print(f"Skipping missing: {fname}")
        continue
    if "<<<<<<<" not in s:
        print(f"No conflict markers in {fname}")
        continue
    new = pattern.sub(lambda m: m.group(1), s)
    with open(fname, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"Resolved conflicts in {fname}")
