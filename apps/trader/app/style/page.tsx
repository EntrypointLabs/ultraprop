"use client";

import * as React from "react";
import {
  AssetIcon,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
  ChainChip,
  ConnectionDot,
  Countdown,
  Identicon,
  Input,
  Modal,
  Pill,
  PixelBanner,
  RadialGauge,
  SegmentedControl,
  Select,
  Skeleton,
  Sparkline,
  StatTile,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Toggle,
  Tooltip,
  Tr,
} from "@/components/ui";
import { DEMO_WALLET, INITIAL_PRICES, SEED_NOW } from "@/lib/mock/fixtures";
import { slippagePreview } from "@/lib/slippage-preview";
import { type ResolvedTheme, useTheme } from "@/lib/theme";
import {
  formatPct,
  formatPctOrDash,
  formatUsd,
  formatUsdOrDash,
} from "@/lib/utils";

type PreviewMode = "side-by-side" | "active";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function Primitives() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [tab, setTab] = React.useState("equity");
  const [seg, setSeg] = React.useState("long");
  const [toggle, setToggle] = React.useState(true);
  const [sort, setSort] = React.useState<"asc" | "desc" | null>("desc");

  const preview = slippagePreview({
    marketId: "BTC",
    side: "long",
    sizeUsd: 5000,
    oracleMid: 68_420.5,
  });

  return (
    <div className="mx-auto max-w-[1440px] space-y-12 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold text-text">Style kitchen sink</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every UI primitive in every variant. QA reference.
        </p>
      </header>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="brand">Brand</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="long">Long</Button>
        <Button variant="short">Short</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </Section>

      <Section title="Badges">
        <Badge>Default</Badge>
        <Badge variant="leverage">10X</Badge>
        <Badge variant="genesis">Genesis</Badge>
        <Badge variant="pending">Pending</Badge>
        <Badge variant="tier">Starter</Badge>
        <Badge variant="up">+2.14%</Badge>
        <Badge variant="down">-1.42%</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="outline">Outline</Badge>
      </Section>

      <Section title="Rule pills">
        <div className="w-full max-w-xs space-y-2">
          <Pill
            label="Max drawdown"
            value="$680 left"
            zone="safe"
            progress={0.32}
          />
          <Pill
            label="Daily loss"
            value="$120 left"
            zone="warn"
            progress={0.74}
          />
          <Pill
            label="Profit target"
            value="$210 left"
            zone="danger"
            progress={0.94}
          />
        </div>
      </Section>

      <Section title="Stat tiles">
        <StatTile
          label="Equity"
          value="$10,824"
          delta="+8.24%"
          deltaTone="up"
        />
        <StatTile
          label="Daily PnL"
          value="-$142"
          delta="-1.31%"
          deltaTone="down"
        />
        <StatTile
          label="Intents"
          value="3 / 200"
          delta="197 left"
          deltaTone="muted"
        />
      </Section>

      <Section title="Cards">
        <Card className="w-72">
          <CardHeader>
            <CardLabel>Vault</CardLabel>
            <Badge variant="leverage">10X</Badge>
          </CardHeader>
          <CardContent>
            <div className="tabular text-2xl font-semibold">$10,824.50</div>
            <p className="mt-1 text-sm text-text-muted">Starter evaluation</p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Sparkline + Radial gauge">
        <Sparkline
          data={INITIAL_PRICES[0].spark}
          width={120}
          height={36}
          fill
        />
        <Sparkline
          data={INITIAL_PRICES[1].spark}
          width={120}
          height={36}
          tone="down"
          fill
        />
        <RadialGauge value={0.32} label="32%" sublabel="of max DD" />
        <RadialGauge value={0.78} label="78%" sublabel="of max DD" />
        <RadialGauge value={0.95} label="95%" sublabel="of max DD" />
      </Section>

      <Section title="Status + chips + icons">
        <ConnectionDot status="live" />
        <ConnectionDot status="reconnecting" />
        <ConnectionDot status="stale" />
        <ChainChip />
        <AssetIcon symbol="BTC" size={24} />
        <AssetIcon symbol="ETH" size={24} />
        <AssetIcon symbol="SOL" size={24} />
        <Identicon address={DEMO_WALLET} size={28} />
        <Avatar address="0xdeadbeef" size={28} />
      </Section>

      <Section title="Inputs">
        <div className="w-64 space-y-3">
          <Input placeholder="Size in USD" mono />
          <Select defaultValue="BTC">
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="SOL">SOL</option>
          </Select>
          <Toggle
            checked={toggle}
            onCheckedChange={setToggle}
            label="Reduce only"
          />
        </div>
      </Section>

      <Section title="Segmented control + Tabs">
        <SegmentedControl
          options={[
            { value: "long", label: "Long" },
            { value: "short", label: "Short" },
          ]}
          value={seg}
          onValueChange={setSeg}
        />
        <div className="w-full max-w-md">
          <Tabs
            items={[
              { value: "equity", label: "Equity" },
              { value: "positions", label: "Positions" },
              { value: "history", label: "History" },
            ]}
            value={tab}
            onValueChange={setTab}
          />
        </div>
      </Section>

      <Section title="Countdown + Tooltip + Skeleton">
        <Countdown target={SEED_NOW + 8 * 3_600_000} />
        <Countdown target={SEED_NOW + 8 * 3_600_000} format="compact" />
        <Tooltip content="House tilt is always +2 bps against you">
          <span className="rounded-sm border border-border px-2 py-1 text-sm">
            Hover me
          </span>
        </Tooltip>
        <div className="w-48 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Section>

      <Section title="Pixel banner">
        <PixelBanner height={96} className="w-full max-w-sm">
          <span className="text-2xl font-bold">GENESIS</span>
        </PixelBanner>
      </Section>

      <Section title="Slippage preview (trust primitive)">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Oracle mid</span>
              <span className="tabular">{formatUsd(preview.oracleMid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Slippage</span>
              <span className="tabular">
                {preview.slippageBps.toFixed(2)} bps
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">House tilt</span>
              <span className="tabular text-down">+{preview.tiltBps} bps</span>
            </div>
            <div className="flex justify-between border-t border-border-soft pt-1 font-semibold">
              <span>Your fill</span>
              <span className="tabular">{formatUsd(preview.fill)}</span>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Table">
        <div className="w-full">
          <Table>
            <Thead>
              <Tr>
                <Th>Asset</Th>
                <Th numeric>Price</Th>
                <Th
                  numeric
                  sortable
                  sortDir={sort}
                  onSort={() => setSort(sort === "desc" ? "asc" : "desc")}
                >
                  24h
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {INITIAL_PRICES.map((p) => (
                <Tr key={p.symbol}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <AssetIcon symbol={p.symbol} />
                      {p.symbol}
                    </span>
                  </Td>
                  <Td numeric>{formatUsdOrDash(p.price)}</Td>
                  <Td
                    numeric
                    className={
                      (p.change24h ?? 0) >= 0 ? "text-up" : "text-down"
                    }
                  >
                    {formatPctOrDash(p.change24h)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </Section>

      <Section title="Modal">
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Max drawdown rule"
          footer={
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Got it
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            Equity may not fall more than 10% below its peak. This is the
            trailing drawdown floor that protects the evaluation.
          </p>
        </Modal>
      </Section>
    </div>
  );
}

function ThemePanel({ theme, label }: { theme: ResolvedTheme; label: string }) {
  return (
    <div
      className={`${theme} flex-1 rounded-lg border border-border bg-bg p-6`}
    >
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full bg-violet" />
        <span className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
      <Primitives />
    </div>
  );
}

export default function StylePage() {
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = React.useState<PreviewMode>("side-by-side");

  return (
    <div className="mx-auto max-w-[120rem] space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text">Style kitchen sink</h1>
        <p className="text-sm text-text-muted">
          Every UI primitive in both themes. The QA surface for the
          contrast/anti-slop pass and the dark screenshot-diff. Active theme:{" "}
          <span className="text-text">{resolvedTheme}</span>.
        </p>
        <SegmentedControl
          options={[
            { value: "side-by-side", label: "Light | Dark" },
            { value: "active", label: "Active theme" },
          ]}
          value={mode}
          onValueChange={setMode}
        />
      </header>

      {mode === "side-by-side" ? (
        <div className="flex flex-col gap-6 xl:flex-row">
          <ThemePanel theme="light" label="Light" />
          <ThemePanel theme="dark" label="Dark" />
        </div>
      ) : (
        <ThemePanel theme={resolvedTheme} label={resolvedTheme} />
      )}
    </div>
  );
}
