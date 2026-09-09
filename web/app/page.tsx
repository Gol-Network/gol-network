import { GolApp } from '@/components/GolApp';
import { ConfigurationNotice } from '@/components/ConfigurationNotice';
import { publicConfigResult } from '@/server/env';

export const dynamic = 'force-dynamic';

export default function Page() {
  const result = publicConfigResult();
  if (!result.ok) return <ConfigurationNotice fields={result.fields} />;
  return <GolApp config={result.config} />;
}
