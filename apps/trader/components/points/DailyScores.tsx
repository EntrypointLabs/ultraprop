import {
  Avatar,
  Badge,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import { accountHandle } from "@/lib/identity";

interface DayRow {
  date: string;
  trader: string;
  wallet: string;
  tier: string;
  passes: number;
  consistency: number;
  shadowPnlPct: number;
}

const DAY_ROWS: DayRow[] = [
  {
    date: "Jun 7",
    trader: "satoshi.sui",
    wallet: "0x9a4f2c1e7b8d3056af19e2c4b7d8f0a1",
    tier: "Basic",
    passes: 2,
    consistency: 91.4,
    shadowPnlPct: 5.2,
  },
  {
    date: "Jun 7",
    trader: "vega",
    wallet: "0xa1f3c7d9b1a5e29f4c8e2d0b6f1a3c5e",
    tier: "Pro",
    passes: 1,
    consistency: 88.7,
    shadowPnlPct: 8.1,
  },
  {
    date: "Jun 7",
    trader: "0xMomentum",
    wallet: "0xa2f3c7d9b1a5e29f4c8e2d0b6f1a3c5e",
    tier: "Starter",
    passes: 3,
    consistency: 79.2,
    shadowPnlPct: 3.6,
  },
  {
    date: "Jun 6",
    trader: "quietalpha",
    wallet: "0xa3f3c7d9b1a5e29f4c8e2d0b6f1a3c5e",
    tier: "Basic",
    passes: 1,
    consistency: 84.5,
    shadowPnlPct: 6.8,
  },
  {
    date: "Jun 6",
    trader: "delta_one",
    wallet: "0xa4f3c7d9b1a5e29f4c8e2d0b6f1a3c5e",
    tier: "Pro",
    passes: 1,
    consistency: 92.1,
    shadowPnlPct: 9.3,
  },
  {
    date: "Jun 5",
    trader: "ronin",
    wallet: "0xa5f3c7d9b1a5e29f4c8e2d0b6f1a3c5e",
    tier: "Starter",
    passes: 2,
    consistency: 76.3,
    shadowPnlPct: 4.1,
  },
];

export function DailyScores() {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
          Daily Scores
        </h2>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-faint">Resets 00:00 UTC</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Trader</Th>
              <Th>Tier</Th>
              <Th numeric>Passes</Th>
              <Th numeric>Consistency</Th>
              <Th numeric>Simulated P&L</Th>
            </Tr>
          </Thead>
          <Tbody>
            {DAY_ROWS.map((row, i) => (
              <Tr key={i}>
                <Td>
                  <span className="tabular text-xs text-text-faint">
                    {row.date}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar address={row.wallet} size={20} />
                    <div>
                      <div className="text-xs font-medium text-text">
                        {row.trader}
                      </div>
                      <div className="tabular text-xs text-text-faint">
                        {accountHandle(row.wallet)}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge variant="tier">{row.tier}</Badge>
                </Td>
                <Td numeric>
                  <span className="tabular text-up font-semibold">
                    {row.passes}
                  </span>
                </Td>
                <Td numeric>
                  <span className="tabular">{row.consistency.toFixed(1)}</span>
                </Td>
                <Td numeric>
                  <span className="tabular text-up">
                    +{row.shadowPnlPct.toFixed(1)}%
                  </span>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </section>
  );
}
