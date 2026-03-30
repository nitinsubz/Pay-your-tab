import type { Metadata } from 'next';
import { getTabShareMetadata } from '@/lib/firebaseAdmin';

const defaultOgDescription =
  "It's like spotify wrapped, except its the tab your broke ass ran up and now you're even more broke, wrapped.";

function siteOrigin(): URL | undefined {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : '');
  if (!raw) return undefined;
  try {
    return new URL(raw.endsWith('/') ? raw.slice(0, -1) : raw);
  } catch {
    return undefined;
  }
}

const ogImageDims = { width: 1200, height: 630, alt: 'TabWrapped' as const };

function ogImageMeta(base: URL | undefined) {
  if (!base) return undefined;
  return [
    {
      url: new URL('/opengraph-image', base).toString(),
      ...ogImageDims,
    },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const base = siteOrigin();
  const tab = await getTabShareMetadata(id);

  const ogImages = ogImageMeta(base);

  if (!tab) {
    return {
      title: 'TabWrapped',
      description: defaultOgDescription,
      openGraph: {
        title: 'TabWrapped',
        description: defaultOgDescription,
        type: 'website',
        ...(base ? { url: new URL(`/tab/${id}`, base).toString() } : {}),
        ...(ogImages ? { images: ogImages } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: 'TabWrapped',
        description: defaultOgDescription,
        ...(ogImages ? { images: ogImages.map((i) => i.url) } : {}),
      },
    };
  }

  /** Same hierarchy as the page: main title, then description or the eyebrow line. */
  const subheading = tab.description || tab.eyebrow;

  return {
    title: `${tab.title} · TabWrapped`,
    description: subheading,
    openGraph: {
      title: tab.title,
      description: subheading,
      type: 'website',
      ...(base ? { url: new URL(`/tab/${id}`, base).toString() } : {}),
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: tab.title,
      description: subheading,
      ...(ogImages ? { images: ogImages.map((i) => i.url) } : {}),
    },
  };
}

export default function TabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
