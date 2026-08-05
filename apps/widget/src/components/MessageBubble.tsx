import { parseAssistantMessage } from '../utils/messageContent';

interface MessageBubbleProps {
  content: string;
  streaming?: boolean;
  isUser: boolean;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  messageId?: string;
  feedbackRating?: 'up' | 'down' | null;
  onFeedback?: (rating: 'up' | 'down') => void;
}

export function MessageBubble({
  content,
  streaming,
  isUser,
  isDark,
  primaryColor,
  textColor,
  messageId,
  feedbackRating,
  onFeedback,
}: MessageBubbleProps) {
  if (isUser) {
    return (
      <div
        className="aicw-bubble"
        style={{ background: primaryColor, color: textColor }}
      >
        {content}
      </div>
    );
  }

  const parsed = parseAssistantMessage(content, streaming);

  return (
    <>
      <div className={`aicw-bubble ${isDark ? 'dark' : ''}`}>
        {streaming && !content.trim() ? (
          <span className="aicw-typing-inline" aria-label="Печатает">
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-dot" />
          </span>
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
            {streaming && <span className="aicw-cursor" aria-hidden>▍</span>}
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
      {messageId && !streaming && onFeedback && (
        <div className={`aicw-feedback ${isDark ? 'dark' : ''}`} role="group" aria-label="Оценка ответа">
          <button
            type="button"
            className={`aicw-feedback-btn ${feedbackRating === 'up' ? 'active' : ''}`}
            onClick={() => onFeedback('up')}
            aria-label="Полезный ответ"
            aria-pressed={feedbackRating === 'up'}
          >
            👍
          </button>
          <button
            type="button"
            className={`aicw-feedback-btn ${feedbackRating === 'down' ? 'active' : ''}`}
            onClick={() => onFeedback('down')}
            aria-label="Не полезный ответ"
            aria-pressed={feedbackRating === 'down'}
          >
            👎
          </button>
        </div>
      )}
    </>
  );
}
