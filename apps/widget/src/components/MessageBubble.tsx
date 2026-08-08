import { memo, useMemo } from 'react';
import { parseAssistantMessage } from '../utils/messageContent';

interface MessageBubbleProps {
  content: string;
  streaming?: boolean;
  isUser: boolean;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
}

function MessageBubbleInner({
  content,
  streaming,
  isUser,
  isDark,
  primaryColor,
  textColor,
}: MessageBubbleProps) {
  const parsed = useMemo(
    () => parseAssistantMessage(content, streaming),
    [content, streaming],
  );

  if (isUser) {
    return (
      <div
        className="aicw-bubble aicw-bubble-user"
        style={{ background: primaryColor, color: textColor || '#ffffff' }}
      >
        {content}
      </div>
    );
  }

  return (
    <>
      <div className={`aicw-bubble ${isDark ? 'dark' : ''}`}>
        {streaming && !content.trim() ? (
          <span className="aicw-typing-inline" aria-label="Печатает">
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-dot" />
          </span>
        ) : streaming ? (
          <p className="aicw-bubble-paragraph">
            {parsed.body || content}
            <span className="aicw-cursor" aria-hidden>
              ▍
            </span>
          </p>
        ) : (
          <>
            {parsed.paragraphs.length > 0 ? (
              parsed.paragraphs.map((paragraph, index) => (
                <p key={index} className="aicw-bubble-paragraph">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="aicw-bubble-paragraph">{parsed.body || content}</p>
            )}
          </>
        )}
      </div>
      {parsed.contactPrompt && !streaming && (
        <div className={`aicw-contact-card ${isDark ? 'dark' : ''}`}>
          <div className="aicw-contact-card-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.86.3 1.7.54 2.5a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.58-1.11a2 2 0 012.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0122 16.92z" />
            </svg>
          </div>
          <div>
            <p className="aicw-contact-card-title">Оставьте контакт</p>
            <p className="aicw-contact-card-text">{parsed.contactPrompt}</p>
          </div>
        </div>
      )}
    </>
  );
}

export const MessageBubble = memo(MessageBubbleInner);
