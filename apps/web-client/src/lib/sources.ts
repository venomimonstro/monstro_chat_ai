import { api } from './api';
import { withRetry } from './retry';
import type { SourceDto, SourceConfig, SourceType } from '@ai-consultant/shared-types';

export async function fetchSources(): Promise<SourceDto[]> {
  return withRetry(() => api.get<SourceDto[]>('/sources').then((r) => r.data));
}

export async function createSource(
  name: string,
  type: SourceType = 'website',
): Promise<SourceDto> {
  const res = await api.post<SourceDto>('/sources', { name, type });
  return res.data;
}

export async function updateSource(
  id: string,
  data: { name?: string; status?: 'active' | 'inactive'; config?: Partial<SourceConfig> },
): Promise<SourceDto> {
  const res = await api.patch<SourceDto>(`/sources/${id}`, data);
  return res.data;
}

export async function deleteSource(id: string): Promise<void> {
  await api.delete(`/sources/${id}`);
}

export async function cloneSource(id: string): Promise<SourceDto> {
  const res = await api.post<SourceDto>(`/sources/${id}/clone`);
  return res.data;
}

export function getEmbedCode(widgetKey: string, widgetScriptUrl: string): string {
  return `<script>
  (function(w,d,s,o,f,js,fjs){
    w['AIConsultantWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;js.defer=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','aicw','${widgetScriptUrl}'));
  aicw('init', { widgetKey: '${widgetKey}', lazyLoad: true });
</script>`;
}
