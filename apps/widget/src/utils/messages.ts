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

export function normalizeChatRole(role: string): 'user' | 'assistant' {
  return role?.toLowerCase?.() === 'user' ? 'user' : 'assistant';
}

export function dedupeMessages<T extends ChatMessageLike>(messages: T[]): T[] {
  const seenIds = new Set<string>();
  const result: T[] = [];

  for (const msg of messages) {
    if (msg.streaming) {
      result.push(msg);
      continue;
    }

    if (msg.id && seenIds.has(msg.id)) continue;

    if (msg.id?.startsWith('local-') && msg.role === 'user') {
      const contentKey = normalizeContent(msg.content);
      const hasServerTwin = messages.some(
        (other) =>
          other !== msg &&
          other.role === 'user' &&
          other.id &&
          !other.id.startsWith('local-') &&
          !other.id.startsWith('__') &&
          normalizeContent(other.content) === contentKey,
      );
      if (hasServerTwin) continue;
    }

    if (msg.id) seenIds.add(msg.id);
    result.push(msg);
  }

  return result;
}

/** Keep optimistic user sends when server history arrives late or during streaming. */
export function shouldMergeChatHistory<T extends ChatMessageLike>(
  local: T[],
  _options: { sameDialogReload: boolean },
): boolean {
  return local.length > 0;
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

/** Replace optimistic local user bubble with persisted server message. */
export function upsertUserMessage<T extends ChatMessageLike>(
  messages: T[],
  incoming: T,
): T[] {
  const contentKey = normalizeContent(incoming.content);
  let replaced = false;

  const mapped = messages.map((msg) => {
    if (
      !replaced &&
      msg.role === 'user' &&
      msg.id?.startsWith('local-') &&
      normalizeContent(msg.content) === contentKey
    ) {
      replaced = true;
      return { ...msg, ...incoming, role: 'user' as const };
    }
    return msg;
  });

  if (
    replaced ||
    mapped.some((msg) => msg.id && msg.id === incoming.id)
  ) {
    return dedupeMessages(mapped);
  }

  return dedupeMessages([...mapped, { ...incoming, role: 'user' as const }]);
}
