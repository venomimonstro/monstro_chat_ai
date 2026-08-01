export function dedupeMessages<T extends { id?: string; role: string; content: string; createdAt?: string }>(
  messages: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const msg of messages) {
    const key = msg.id ?? `${msg.role}:${msg.content}:${msg.createdAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(msg);
  }
  return result;
}
