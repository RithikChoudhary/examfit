# .github/scripts/seo_reviewer.py
import anthropic, os, subprocess, json, re
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
raw_content = response.content[0].text if isinstance(response.content, list) else response.content

# 🔧 Try to extract JSON block from markdown or inline response
match = re.search(r"```json\s*(\{.*?\})\s*```", raw_content, re.DOTALL)
if not match:
    match = re.search(r"(\{\s*\"edits\"\s*:\s*\[.*?\]\s*\})", raw_content, re.DOTALL)

if match:
    raw_content = match.group(1).strip()
else:
    print("⚠️ No valid JSON block found in Claude's response.")
    raw_content = "{}"

try:
    data = json.loads(raw_content)
    for item in data.get("edits", []):
        with open(item["file"], "w") as f:
            f.write(item["content"])
        print(f"✅ Updated {item['file']}")
except Exception as e:
    print("❌ Failed to apply changes:", e)
    data = {"edits": []}  # fallback so PR prompt still works

# STEP 4: Git config, commit, and push — only if changes exist
if data.get("edits"):
    subprocess.run(["git", "config", "--global", "user.email", "bot@examfit.in"])
    subprocess.run(["git", "config", "--global", "user.name", "Claude AI Bot"])

    branch_name = f"claude-seo-fix-{datetime.now().strftime('%Y%m%d')}"
    subprocess.run(["git", "checkout", "-b", branch_name])
    subprocess.run(["git", "add", "."])
    subprocess.run(["git", "commit", "-m", "chore: SEO & question content updates by Claude AI"])
    subprocess.run(["git", "push", "--force-with-lease", "origin", branch_name])

    # STEP 5: Create PR summary from Claude
    pr_prompt = f"""
    You are a GitHub pull request assistant. Here's a list of SEO and content changes made by Claude AI:

    {json.dumps(data.get('edits', []), indent=2)}

    Write a detailed PR summary with bullet points.
    """
    pr_summary = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        temperature=0.3,
        messages=[{"role": "user", "content": pr_prompt}]
    )

    print("\n📦 Claude PR Summary:\n")
    print(pr_summary.content)
else:
    print("🟡 No edits returned by Claude — skipping git commit and PR generation.")
