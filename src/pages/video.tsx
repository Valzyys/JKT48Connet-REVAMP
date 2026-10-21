import { useQuery } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { VideoCard } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, PageHero, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

export function VideoPage() {
  const videos = useQuery(q.videos());
  return (
    <Page deps={[videos.data]}>
      <PageHero
        eyebrow="YouTube"
        title={
          <>
            Video <span className="text-brand">terbaru.</span>
          </>
        }
        desc="Upload terbaru dari kanal resmi JKT48 dan JKT48 TV."
      />
      <section className="container-x pt-12">
        {videos.isError ? (
          <ErrorState error={videos.error} onRetry={() => videos.refetch()} />
        ) : videos.isLoading ? (
          <SkeletonGrid count={8} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" item="aspect-video rounded-3xl" />
        ) : videos.data?.length ? (
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.data.map((v) => (
              <VideoCard key={v.id} v={v} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<PlayCircle className="h-5 w-5" />} title="Belum ada video" />
        )}
      </section>
    </Page>
  );
}
