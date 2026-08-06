import { memo } from 'react';
import { MessageBubble } from './MessageBubble';

export interface MessageListItem {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  createdAt?: string;
}

interface MessageListProps {
  messages: MessageListItem[];
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  avatarUrl?: string;
  managerPhotoUrl?: string;
  managerName: string;
  historyIds: ReadonlySet<string>;
  formatTime: (date: Date) => string;
}

function MessageRow({
  msg,
  index,
  prevRole,
  isDark,
  primaryColor,
  textColor,
  avatarUrl,
  managerPhotoUrl,
  managerName,
  historyIds,
  formatTime,
}: {
  msg: MessageListItem;
  index: number;
  prevRole?: string;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  avatarUrl?: string;
  managerPhotoUrl?: string;
  managerName: string;
  historyIds: ReadonlySet<string>;
  formatTime: (date: Date) => string;
}) {
  const isUser = msg.role === 'user';
  const showAvatar = !isUser && (index === 0 || prevRole === 'user');
  const time = msg.createdAt ? formatTime(new Date(msg.createdAt)) : '';
  const isNewMessage =
    msg.id !== '__resume_hint__' && (!msg.id || !historyIds.has(msg.id));

  return (
    <div
      className={`aicw-message ${isUser ? 'user' : 'assistant'} ${isDark ? 'dark' : ''}${isNewMessage ? ' aicw-new' : ''}`}
      role="listitem"
    >
      {!isUser && showAvatar && (
        <div className="aicw-message-avatar">
          {avatarUrl || managerPhotoUrl ? (
            <img src={avatarUrl || managerPhotoUrl} alt="" />
          ) : (
            <div className="aicw-message-avatar-placeholder">{managerName[0]}</div>
          )}
        </div>
      )}
      <div className="aicw-message-content">
        <MessageBubble
          content={msg.content}
          streaming={msg.streaming}
          isUser={isUser}
          isDark={isDark}
          primaryColor={primaryColor}
          textColor={textColor}
        />
        {time && <div className="aicw-message-time">{time}</div>}
      </div>
    </div>
  );
}

const MemoMessageRow = memo(MessageRow);

export const MessageList = memo(function MessageList({
  messages,
  isDark,
  primaryColor,
  textColor,
  avatarUrl,
  managerPhotoUrl,
  managerName,
  historyIds,
  formatTime,
}: MessageListProps) {
  return (
    <>
      {messages.map((msg, i) => (
        <MemoMessageRow
          key={msg.id ?? `row-${i}-${msg.role}-${msg.createdAt ?? ''}`}
          msg={msg}
          index={i}
          prevRole={messages[i - 1]?.role}
          isDark={isDark}
          primaryColor={primaryColor}
          textColor={textColor}
          avatarUrl={avatarUrl}
          managerPhotoUrl={managerPhotoUrl}
          managerName={managerName}
          historyIds={historyIds}
          formatTime={formatTime}
        />
      ))}
    </>
  );
});
