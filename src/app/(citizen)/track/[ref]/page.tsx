import { redirect } from 'next/navigation';

interface Props {
  params: {
    ref: string;
  };
}

/**
 * Route alias: /track/[ref] -> /track?ref=[ref]
 * Provides direct URL bookmarking support for complaint tracking.
 */
export default function TrackRefPage({ params }: Props) {
  const ref = params?.ref || '';
  redirect(`/track?ref=${encodeURIComponent(ref)}`);
}
