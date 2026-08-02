const CONTACT_START = '---contact---';
const CONTACT_END = '---end---';

const CONTACT_KEYWORDS =
  /(?:оставьте|оставь|укажите|напишите|пришлите|поделитесь).{0,40}(?:контакт|телефон|номер|email|почт|связ)/i;

export interface ParsedAssistantMessage {
  body: string;
  contactPrompt: string | null;
  paragraphs: string[];
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function heuristicContactSplit(content: string): ParsedAssistantMessage {
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length < 2) {
    return { body: content, contactPrompt: null, paragraphs };
  }

  const last = paragraphs[paragraphs.length - 1];
  if (!CONTACT_KEYWORDS.test(last)) {
    return { body: content, contactPrompt: null, paragraphs };
  }

  return {
    body: paragraphs.slice(0, -1).join('\n\n'),
    contactPrompt: last,
    paragraphs: paragraphs.slice(0, -1),
  };
}

export function parseAssistantMessage(
  content: string,
  streaming = false,
): ParsedAssistantMessage {
  const start = content.indexOf(CONTACT_START);
  if (start === -1) {
    return heuristicContactSplit(content);
  }

  const body = content.slice(0, start).trim();
  const afterStart = content.slice(start + CONTACT_START.length);
  const end = afterStart.indexOf(CONTACT_END);

  if (end === -1) {
    if (streaming) {
      return {
        body: body || content.replace(CONTACT_START, '').trim(),
        contactPrompt: null,
        paragraphs: splitParagraphs(body || content),
      };
    }
    const contactPrompt = afterStart.trim();
    return {
      body,
      contactPrompt: contactPrompt || null,
      paragraphs: splitParagraphs(body),
    };
  }

  const contactPrompt = afterStart.slice(0, end).trim();
  const tail = afterStart.slice(end + CONTACT_END.length).trim();
  const fullBody = [body, tail].filter(Boolean).join('\n\n');

  return {
    body: fullBody,
    contactPrompt: contactPrompt || null,
    paragraphs: splitParagraphs(fullBody),
  };
}
