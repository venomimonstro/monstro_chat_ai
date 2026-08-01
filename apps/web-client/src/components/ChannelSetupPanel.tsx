import { useState } from 'react';
import type { SourceDto } from '@ai-consultant/shared-types';
import { connectTelegramChannel, connectVkChannel } from '../lib/channels';
import { extractErrorMessage } from '../lib/errors';
import { showToast } from './Toast';

const TYPE_LABELS: Record<string, string> = {
  website: 'Чат на сайте',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
};

export function ChannelSetupPanel({
  source,
  onConnected,
}: {
  source: SourceDto;
  onConnected?: () => void;
}) {
  const [botToken, setBotToken] = useState('');
  const [groupId, setGroupId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [saving, setSaving] = useState(false);

  if (source.type === 'website') return null;

  const handleTelegram = async () => {
    setSaving(true);
    try {
      const result = await connectTelegramChannel(source.id, botToken);
      showToast(`Бот @${result.botUsername ?? 'connected'} подключён`, 'success');
      setBotToken('');
      onConnected?.();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVk = async () => {
    setSaving(true);
    try {
      await connectVkChannel(source.id, {
        groupId: Number(groupId),
        accessToken,
        confirmationCode,
      });
      showToast('VK Callback API настроен', 'success');
      onConnected?.();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-800">
        Подключение: {TYPE_LABELS[source.type] ?? source.type}
      </p>
      {source.type === 'telegram' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            className="lk-input min-w-[240px] flex-1"
            placeholder="Bot Token от @BotFather"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || !botToken}
            onClick={() => void handleTelegram()}
            className="lk-btn-primary"
          >
            Подключить бота
          </button>
        </div>
      )}
      {source.type === 'vk' && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            className="lk-input"
            placeholder="ID группы"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          />
          <input
            type="password"
            className="lk-input"
            placeholder="Ключ доступа сообщества"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <input
            className="lk-input md:col-span-2"
            placeholder="Строка подтверждения Callback API"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || !groupId || !accessToken || !confirmationCode}
            onClick={() => void handleVk()}
            className="lk-btn-primary md:col-span-2"
          >
            Сохранить настройки VK
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Webhook URL: <code>/api/channels/{source.type}/{source.widgetKey}/webhook</code>
      </p>
    </div>
  );
}
