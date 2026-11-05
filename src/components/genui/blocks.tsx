import { ChevronDown } from "lucide-react";
import { Component, useState, type ComponentType, type ReactNode } from "react";
import { cx } from "@/components/ui";
import * as B from "./basic";
import * as F from "./fun";
import * as I from "./inputs";
import { arr, box, obj, str, type P } from "./kit";
import * as X from "./practical";
import * as S from "./special";
import * as V from "./viz";

type Comp = ComponentType<{ p: P }>;

function TabsBlock({ p }: { p: P }) {
  const tabs = arr(p.tabs).map(obj).filter((t) => str(t.label)).slice(0, 8);
  const [i, setI] = useState(0);
  if (!tabs.length) return null;
  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-surface p-1" role="tablist">
        {tabs.map((_, k) => (
          <button key={k} type="button" role="tab" aria-selected={i === k} onClick={() => setI(k)} className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition", i === k ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink")}>
            {str(tabs[k].label)}
          </button>
        ))}
      </div>
      <div key={i} className="animate-[fadein_.3s_ease]">
        <Blocks blocks={tabs[i]?.blocks} />
      </div>
    </div>
  );
}

function AccordionBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj).filter((t) => str(t.title)).slice(0, 12);
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className={cx(box, "divide-y divide-line overflow-hidden")}>
      {items.map((it, k) => (
        <div key={k}>
          <button type="button" onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-bold hover:bg-surface" aria-expanded={open === k}>
            <span className="flex-1">{str(it.title)}</span>
            <ChevronDown className={cx("h-4 w-4 transition", open === k && "rotate-180")} />
          </button>
          {open === k && (
            <div className="animate-[fadein_.3s_ease] px-4 pb-4">
              <Blocks blocks={it.blocks ?? it.content} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const MAP: Record<string, Comp> = {
  text: B.TextBlock,
  buttons: B.ButtonsBlock,
  chips: B.ChipsBlock,
  callout: B.CalloutBlock,
  card: B.CardBlock,
  kv: B.KvBlock,
  divider: B.DividerBlock,
  progress: B.ProgressBlock,
  member_card: B.MemberCard,
  live_card: B.LiveCard,
  schedule: B.ScheduleBlock,
  countdown: B.CountdownBlock,
  stats: B.StatsBlock,
  member_grid: B.MemberGrid,
  compare: B.CompareBlock,
  chart: V.ChartBlock,
  table: V.TableBlock,
  heatmap: V.HeatmapBlock,
  timeline: V.TimelineBlock,
  gallery: V.GalleryBlock,
  tree: V.TreeBlock,
  before_after: V.BeforeAfterBlock,
  form: I.FormBlock,
  quiz: I.QuizBlock,
  poll: I.PollBlock,
  checklist: I.ChecklistBlock,
  personality: I.PersonalityBlock,
  simulator: I.SimulatorBlock,
  rating: I.RatingBlock,
  sortable: I.SortableBlock,
  tier_list: I.TierListBlock,
  calculator: I.CalculatorBlock,
  guess_member: F.GuessMemberBlock,
  roulette: F.RouletteBlock,
  leaderboard: F.LeaderboardBlock,
  youtube: F.YoutubeBlock,
  music: F.MusicBlock,
  karaoke: F.KaraokeBlock,
  live_preview: F.LivePreviewBlock,
  watch_party: F.WatchPartyBlock,
  calendar: X.CalendarBlock,
  reminder: X.ReminderBlock,
  share_card: X.ShareCardBlock,
  plan: X.PlanBlock,
  sources: X.SourcesBlock,
  api_tester: X.ApiTesterBlock,
  json: X.JsonBlock,
  stories: S.StoriesBlock,
  holo_cards: S.HoloCardsBlock,
  bar_race: S.BarRaceBlock,
  tabs: TabsBlock,
  accordion: AccordionBlock,
};

/** Satu blok yang gagal dirender tidak boleh menjatuhkan seluruh obrolan. */
class Guard extends Component<{ children: ReactNode; type: string }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    if (this.state.err) return <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[12.5px] text-ink-soft">Komponen “{this.props.type}” tidak bisa ditampilkan.</p>;
    return this.props.children;
  }
}

export function Blocks({ blocks, className }: { blocks: unknown; className?: string }) {
  const list = arr(blocks).map(obj).filter((b) => MAP[str(b.type)]);
  if (!list.length) return null;
  return (
    <div className={cx("space-y-3", className)}>
      {list.map((b, i) => {
        const C = MAP[str(b.type)];
        return (
          <div key={i} className="animate-[fadein_.4s_ease_both]" style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}>
            <Guard type={str(b.type)}>
              <C p={b} />
            </Guard>
          </div>
        );
      })}
    </div>
  );
}

export const SUPPORTED = Object.keys(MAP);
