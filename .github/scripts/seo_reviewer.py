# .github/scripts/seo_reviewer.py
import anthropic, os

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
    return "\n".join(file_texts)[:150000]  # truncate for token limit

site_code = get_site_files()

prompt = f"""
You're an expert SEO analyst and AI web content manager.
You are reviewing the source code and content of a website.

Give me a report:
1. Suggest any missing SEO tags (title, meta, og)
2. Suggest keyword improvements for questions/pages
3. Point out any outdated questions or stale content
4. Suggest canonical URLs, structured data or schema fixes

CODEBASE:
{site_code}
"""

client = anthropic.Anthropic(api_key=os.environ["CLAUDE_API_KEY"])

response = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1000,
    temperature=0.4,
    messages=[
        {"role": "user", "content": prompt}
    ]
)

print("\n🔍 Claude SEO Audit:\n")
print(response.content)
