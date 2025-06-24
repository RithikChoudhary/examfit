# .github/scripts/summarize_pr.py
import os
import json
import anthropic
from github import Github

with open("pr.json") as f:
    pr = json.load(f)

g = Github(os.environ["GITHUB_TOKEN"])
repo = g.get_repo(pr["base"]["repo"]["full_name"])
pull = repo.get_pull(pr["number"])

diff = pull.diff_url

prompt = f"""
You're an AI code reviewer. Summarize this PR.

Title: {pr['title']}
Body: {pr['body']}

Diff URL: {diff}

Provide:
1. Overview of what it changes
2. Any risks or issues
3. Suggestions for improvements
"""

client = anthropic.Anthropic(api_key=os.environ["CLAUDE_API_KEY"])

response = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=400,
    temperature=0.3,
    messages=[
        {"role": "user", "content": prompt}
    ]
)

print("\u001b[32mClaude Summary:\u001b[0m")
print(response.content)
