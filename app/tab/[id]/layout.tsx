import type { Metadata } from 'next';
import { getTabShareMetadata } from '@/lib/firebaseAdmin';
import { getSiteOrigin } from '@/lib/site';

/** Short line — iMessage often hides long og:description and shows the hostname instead. */
const shortFallbackOg =
  'Split checks, share trips, and pay your share on TabWrapped.';

const ogImageDims = { width: 1200, height: 630, alt: 'TabWrapped' as const };

function ogImageMeta(base: URL) {
  return [
    {
      url: new URL('/tab/[id]/opengraph-image', base).toString(),
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
  const base = getSiteOrigin();
  const tab = await getTabShareMetadata(id);
  const ogImages = ogImageMeta(base).map((img) => ({
    ...img,
    url: img.url.replace('/tab/[id]/opengraph-image', `/tab/${id}/opengraph-image`),
  }));
  const pageUrl = new URL(`/tab/${id}`, base).toString();

  if (!tab) {
    return {
      title: 'TabWrapped',
      description: shortFallbackOg,
      openGraph: {
        title: 'TabWrapped',
        description: shortFallbackOg,
        type: 'website',
        url: pageUrl,
        images: ogImages,
      },
      twitter: {
        card: 'summary_large_image',
        title: 'TabWrapped',
        description: shortFallbackOg,
        images: ogImages.map((i) => i.url),
      },
    };
  }

  const subheading = tab.description || tab.eyebrow;

  return {
    title: `${tab.title} · TabWrapped`,
    description: subheading,
    openGraph: {
      title: tab.title,
      description: subheading,
      type: 'website',
      url: pageUrl,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: tab.title,
      description: subheading,
      images: ogImages.map((i) => i.url),
    },
  };
}

export default function TabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
