import { useQuery } from "@tanstack/react-query";
import { VideoCard } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

export function VideoPage() {
  const videos = useQuery(q.videos());
  return (
    <Page deps={[videos.data]}>
      <PageHeader title="Video" desc="Upload terbaru dari kanal YouTube JKT48 dan JKT48 TV." />
      <section className="container-x pt-8">
        {videos.isError ? (
          <ErrorState error={videos.error} onRetry={() => videos.refetch()} />
        ) : videos.isLoading ? (
          <SkeletonGrid count={8} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" item="aspect-video" />
        ) : videos.data?.length ? (
          <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {videos.data.map((v) => (
              <VideoCard key={v.id} v={v} />
            ))}
          </div>
        ) : (
          <Empty>Belum ada video.</Empty>
        )}
      </section>
    </Page>
  );
}
