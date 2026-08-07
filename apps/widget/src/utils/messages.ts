export interface ChatMessageLike {
  id?: string;
  role: string;
  content: string;
  streaming?: boolean;
  createdAt?: string;
}

function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}

export function dedupeMessages<T extends ChatMessageLike>(messages: T[]): T[] {
  const seenIds = new Set<string>();
  const seenUserContent = new Set<string>();
  const result: T[] = [];

  for (const msg of messages) {
    if (msg.streaming) {
      result.push(msg);
      continue;
    }

    if (msg.id && !msg.id.startsWith('local-') && !msg.id.startsWith('__')) {
      if (seenIds.has(msg.id)) continue;
      if (msg.role === 'user' && seenUserContent.has(normalizeContent(msg.content))) {
        continue;
      }
      seenIds.add(msg.id);
      if (msg.role === 'user') {
        seenUserContent.add(normalizeContent(msg.content));
      }
      result.push(msg);
      continue;
    }

    if (msg.role === 'user') {
      const contentKey = normalizeContent(msg.content);
      if (seenUserContent.has(contentKey)) continue;
      seenUserContent.add(contentKey);
    }

    if (msg.id && seenIds.has(msg.id)) continue;
    if (msg.id) seenIds.add(msg.id);

    result.push(msg);
  }

  return result;
}

/** Merge server history with local optimistic messages on reconnect. */
export function mergeChatHistory<T extends ChatMessageLike>(
  local: T[],
  server: T[],
): T[] {
  const serverUserContent = new Set(
    server
      .filter((msg) => msg.role === 'user')
      .map((msg) => normalizeContent(msg.content)),
  );
  const serverIds = new Set(
    server.map((msg) => msg.id).filter((id): id is string => Boolean(id)),
  );

  const localOnly = local.filter((msg) => {
    if (msg.streaming) return false;
    if (msg.id === '__resume_hint__') return false;
    if (msg.id && serverIds.has(msg.id)) return false;
    if (msg.role === 'user' && serverUserContent.has(normalizeContent(msg.content))) {
      return false;
    }
    return true;
  });

  const combined = [...server, ...localOnly].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  return dedupeMessages(combined);
}
