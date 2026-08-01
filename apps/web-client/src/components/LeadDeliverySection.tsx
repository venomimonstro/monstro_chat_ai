import { useEffect, useState } from 'react';
import type {
  LeadDeliveryChannelDto,
  LeadDeliveryChannelType,
  LeadDeliveryLogDto,
} from '@ai-consultant/shared-types';
import {
  createLeadDeliveryChannel,
  deleteLeadDeliveryChannel,
  fetchLeadDeliveryChannels,
  fetchLeadDeliveryLogs,
  getGoogleSheetsConnectUrl,
  mockConnectGoogleSheets,
  sendLeadDeliveryTest,
  updateLeadDeliveryChannel,
  validateTelegramBot,
} from '../lib/lead-delivery';
import { extractErrorMessage } from '../lib/errors';

const TYPE_LABELS: Record<LeadDeliveryChannelType, string> = {
  telegram: 'Telegram',
  email: 'Email',
  google_sheets: 'Google Sheets',
  amocrm: 'amoCRM',
  bitrix24: 'Bitrix24',
};

function ChannelToggle({
  channel,
  onChanged,
}: {
  channel: LeadDeliveryChannelDto;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      await updateLeadDeliveryChannel(channel.id, { enabled: !channel.enabled });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={channel.enabled}
        disabled={saving}
        onChange={toggle}
      />
      {channel.enabled ? 'Включено' : 'Выключено'}
    </label>
  );
}

export function LeadDeliverySection({ onMessage }: { onMessage: (msg: string) => void }) {
  const [channels, setChannels] = useState<LeadDeliveryChannelDto[]>([]);
  const [logs, setLogs] = useState<LeadDeliveryLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [showTelegramForm, setShowTelegramForm] = useState(false);
  const [tgName, setTgName] = useState('Telegram уведомления');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailName, setEmailName] = useState('Email уведомления');
  const [emailRecipients, setEmailRecipients] = useState('');

  const [showSheetsForm, setShowSheetsForm] = useState(false);
  const [sheetsName, setSheetsName] = useState('Google Sheets');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Лиды');

  const load = async () => {
    setLoading(true);
    try {
      const [ch, lg] = await Promise.all([
        fetchLeadDeliveryChannels(),
        fetchLeadDeliveryLogs(20),
      ]);
      setChannels(ch);
      setLogs(lg);
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateTelegram = async () => {
    setSaving('tg-create');
    try {
      const validation = await validateTelegramBot({
        botToken: tgToken,
        chatId: tgChatId || undefined,
      });
      if (!validation.ok) {
        onMessage(validation.error ?? 'Ошибка валидации Telegram');
        return;
      }
      await createLeadDeliveryChannel({
        type: 'telegram',
        name: tgName,
        botToken: tgToken,
        config: { chatId: tgChatId, botUsername: validation.botUsername },
      });
      setTgToken('');
      setShowTelegramForm(false);
      onMessage('Telegram-канал подключён');
      await load();
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleCreateEmail = async () => {
    setSaving('email-create');
    try {
      const recipients = emailRecipients
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      await createLeadDeliveryChannel({
        type: 'email',
        name: emailName,
        config: { recipients },
      });
      setEmailRecipients('');
      setShowEmailForm(false);
      onMessage('Email-канал создан');
      await load();
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleCreateSheets = async () => {
    setSaving('sheets-create');
    try {
      const channel = await createLeadDeliveryChannel({
        type: 'google_sheets',
        name: sheetsName,
        config: { spreadsheetId, sheetName },
      });
      setShowSheetsForm(false);
      onMessage('Канал Google Sheets создан. Подключите Google аккаунт.');
      await load();
      return channel;
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const connectGoogle = async (channelId: string) => {
    setSaving(`google-${channelId}`);
    try {
      try {
        const url = await getGoogleSheetsConnectUrl(channelId);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        await mockConnectGoogleSheets(channelId);
        onMessage('Google Sheets подключён (mock)');
        await load();
      }
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (channelId: string) => {
    setSaving(`test-${channelId}`);
    try {
      await sendLeadDeliveryTest(channelId);
      onMessage('Тестовый лид отправлен');
      await load();
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить канал доставки?')) return;
    setSaving(`del-${id}`);
    try {
      await deleteLeadDeliveryChannel(id);
      onMessage('Канал удалён');
      await load();
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleCrmInstantToggle = async (channel: LeadDeliveryChannelDto) => {
    const instant = (channel.config as { instantDelivery?: boolean }).instantDelivery !== false;
    setSaving(`crm-${channel.id}`);
    try {
      await updateLeadDeliveryChannel(channel.id, {
        config: { instantDelivery: !instant },
      });
      await load();
    } catch (err: unknown) {
      onMessage(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Загрузка уведомлений о лидах…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Уведомления о лидах
        </h2>
        <p className="text-sm text-slate-500">
          Telegram, email, Google Sheets и мгновенная доставка в CRM
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowTelegramForm((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          + Telegram
        </button>
        <button
          type="button"
          onClick={() => setShowEmailForm((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          + Email
        </button>
        <button
          type="button"
          onClick={() => setShowSheetsForm((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          + Google Sheets
        </button>
      </div>

      {showTelegramForm && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-slate-800">Подключение Telegram-бота</h3>
          <p className="mt-1 text-xs text-slate-500">
            Создайте бота через @BotFather, добавьте в группу или начните ЛС, укажите chat_id
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Название канала"
              value={tgName}
              onChange={(e) => setTgName(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Bot Token"
              type="password"
              value={tgToken}
              onChange={(e) => setTgToken(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Chat ID (личный или группы)"
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={saving === 'tg-create'}
            onClick={handleCreateTelegram}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving === 'tg-create' ? 'Подключение…' : 'Подключить и протестировать'}
          </button>
        </div>
      )}

      {showEmailForm && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-slate-800">Email-получатели</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Название"
              value={emailName}
              onChange={(e) => setEmailName(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="email1@company.ru, email2@..."
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={saving === 'email-create'}
            onClick={handleCreateEmail}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving === 'email-create' ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      )}

      {showSheetsForm && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-slate-800">Google Sheets</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Название"
              value={sheetsName}
              onChange={(e) => setSheetsName(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="ID таблицы (из URL)"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Имя листа"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={saving === 'sheets-create'}
            onClick={handleCreateSheets}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving === 'sheets-create' ? 'Создание…' : 'Создать канал'}
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {channels.length === 0 && (
          <p className="text-sm text-slate-500">Каналы доставки не настроены</p>
        )}
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="font-medium text-slate-900">
                {channel.name}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({TYPE_LABELS[channel.type]})
                </span>
              </p>
              {channel.type === 'google_sheets' && (
                <p className="text-xs text-slate-500">
                  {(channel.config as { connected?: boolean }).connected
                    ? 'Google подключён'
                    : 'Требуется OAuth'}
                </p>
              )}
              {(channel.type === 'amocrm' || channel.type === 'bitrix24') && (
                <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={
                      (channel.config as { instantDelivery?: boolean }).instantDelivery !==
                      false
                    }
                    disabled={saving === `crm-${channel.id}`}
                    onChange={() => handleCrmInstantToggle(channel)}
                  />
                  Отправлять лид сразу при создании
                </label>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ChannelToggle channel={channel} onChanged={load} />
              {channel.type === 'google_sheets' &&
                !(channel.config as { connected?: boolean }).connected && (
                  <button
                    type="button"
                    disabled={saving === `google-${channel.id}`}
                    onClick={() => connectGoogle(channel.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                  >
                    Подключить Google
                  </button>
                )}
              <button
                type="button"
                disabled={saving === `test-${channel.id}`}
                onClick={() => handleTest(channel.id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
              >
                Тест
              </button>
              {channel.type !== 'amocrm' && channel.type !== 'bitrix24' && (
                <button
                  type="button"
                  disabled={saving === `del-${channel.id}`}
                  onClick={() => handleDelete(channel.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {logs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-700">Последние доставки</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Канал</th>
                  <th className="py-2 pr-4">Статус</th>
                  <th className="py-2 pr-4">Ошибка</th>
                  <th className="py-2">Время</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{log.channelName}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          log.status === 'success'
                            ? 'text-emerald-600'
                            : log.status === 'failed'
                              ? 'text-red-600'
                              : 'text-slate-500'
                        }
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      {log.errorMessage ?? '—'}
                    </td>
                    <td className="py-2 text-slate-500">
                      {new Date(log.createdAt).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
