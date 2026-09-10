import type { Metadata } from 'next';
import { ToolDirectory } from '@/components/ToolDirectory';

export const metadata: Metadata = {
  title: 'GOL Agent tools',
  description: 'Tools currently available to the GOL Agent',
};

export default function ToolsPage() {
  return <ToolDirectory />;
}
