import { DiagnosticsPageClient } from '@/components/DiagnosticsPageClient';

export default function DiagnosticsPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <DiagnosticsPageClient token={params.token} />
    </div>
  );
}
