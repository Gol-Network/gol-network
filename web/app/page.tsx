import { GolApp } from '../src/components/GolApp';

export default function Page() {
  return <GolApp privyEnabled={Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)} />;
}
