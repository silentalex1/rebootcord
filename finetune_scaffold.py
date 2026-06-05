#!/usr/bin/env python3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "db.json")
OUT_DIR = os.path.join(os.path.dirname(__file__), "training_data")
os.makedirs(OUT_DIR, exist_ok=True)

def load_feedbacks():
    if not os.path.exists(DB_PATH):
        print("No db.json found.")
        return []
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)
    feedbacks = db.get("feedbacks", [])
    print(f"Loaded {len(feedbacks)} feedback entries from db.json")
    return feedbacks

def build_synthetic_dataset(feedbacks, max_examples=120):
    examples = []
    seeds = [
        {"instruction": "How do I start a Paper 1.21 server?", "output": "Create a new Minecraft project, select Paper + 1.21.5 (or closest), start it. The platform downloads the jar for you."},
        {"instruction": "My bot crashed with missing discord module. Screenshot shows the error.", "output": "I see the ModuleNotFoundError. In the bot dashboard use the package install button for discord.py (Python) or discord.js. Then restart."},
        {"instruction": "Is Reboot Cord free?", "output": "Yes all of this is free, but soon it will be paid so enjoy while the free lasts."},
    ]
    examples.extend(seeds)
    for fb in feedbacks[:max_examples]:
        msg = (fb.get("message") or "").strip()
        if len(msg) < 5:
            continue
        out = "Thanks for the feedback! For this: " + msg[:120] + "... check the project files/logs tab and the AI helper for targeted help. Upload a screenshot if you have an error."
        examples.append({"instruction": msg, "output": out})
    out_path = os.path.join(OUT_DIR, f"rebootcord_synthetic_{datetime.now().strftime('%Y%m%d')}.jsonl")
    with open(out_path, "w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps({
                "instruction": ex["instruction"],
                "input": "",
                "output": ex["output"]
            }) + "\n")
    print(f"Wrote {len(examples)} examples to {out_path}")
    return out_path

def main():
    fbs = load_feedbacks()
    j = build_synthetic_dataset(fbs)
    print("Dataset ready at", j)
    print("Use Unsloth or similar for LoRA fine-tune on a vision base, then ollama create from the resulting GGUF.")

if __name__ == "__main__":
    main()
