export function extractPrompt(markdown: string): string {
  const match = markdown.match(/## The system prompt[^\n]*\n+```\n([\s\S]*?)\n```/);
  if (!match) throw new Error("No system prompt block found in docs/agent-prompt.md");
  return match[1];
}

export function extractStarterItems(prompt: string): string[] {
  const section = prompt.split("# The starter list")[1]?.split(/\n# /)[0] ?? "";
  return [...section.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1].trim());
}
