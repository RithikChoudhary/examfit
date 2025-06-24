# .github/scripts/seo_reviewer.py
import anthropic, os, subprocess, json
from datetime import datetime

# STEP 1: Gather HTML/JS/TS/MD content

def get_site_files():
    allowed = [".md", ".js", ".ts", ".html"]
    file_texts = []
    for root, _, files in os.walk("."):
        for f in files:
            if any(f.endswith(ext) for ext in allowed):
                path = os.path.join(root, f)
                if "node_modules" not in path and ".git" not in path:
                    with open(path, "r", encoding="utf-8", errors="ignore") as file:
                        content = file.read()
                        file_texts.append(f"\n\nFILE: {path}\n{content}")
    return "\n".join(file_texts)[:150000]

site_code = get_site_files()

# STEP 2: Prompt Claude
prompt = f"""
You're an expert SEO + content optimization AI.
Read the following website source code and make improvements:

1. Add/update missing meta tags (title, description, og, canonical)
2. Fix outdated questions and improve keyword targeting
3. Return JSON instructions: {{"edits": [{{"file": path, "content": "new content"}}]}}

CODEBASE:
{site_code}
"""

client = anthropic.Anthropic(api_key=os.environ["CLAUDE_API_KEY"])
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=2000,
    temperature=0.3,
    messages=[{"role": "user", "content": prompt}]
)

print("\n🔍 Claude SEO Fix Plan:\n")
print(response.content)

# STEP 3: Parse and apply fixes
try:
    data = json.loads(response.content)
    for item in data.get("edits", []):
        with open(item["file"], "w") as f:
            f.write(item["content"])
        print(f"✅ Updated {item['file']}")
except Exception as e:
    print("❌ Failed to apply changes:", e)

# STEP 4: Git commit and PR
branch_name = f"claude-seo-fix-{datetime.now().strftime('%Y%m%d')}"
subprocess.run(["git", "checkout", "-b", branch_name])
subprocess.run(["git", "add", "."])
subprocess.run(["git", "commit", "-m", "chore: SEO & question content updates by Claude AI"])
subprocess.run(["git", "push", "origin", branch_name])

# Create PR message for Claude to write
pr_prompt = f"""
Summarize this PR which includes:
- SEO tag improvements
- Keyword enhancements
- Outdated content fixes
Write it as a clean PR description.
"""
pr_summary = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=400,
    temperature=0.3,
    messages=[{"role": "user", "content": pr_prompt}]
)

print("\n📦 Claude PR Summary:\n")
print(pr_summary.content)

# NOTE: You can auto-create PR via GitHub CLI or API here
