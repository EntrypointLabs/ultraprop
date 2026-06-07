import { Badge, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";

interface WeekRow {
  week: number;
  dates: string;
  members: number;
  passes: number;
  passRate: number;
  topTrader: string;
  status: "settled" | "pending";
}

const WEEK_HISTORY: WeekRow[] = [
  {
    week: 23,
    dates: "Jun 2 – Jun 8",
    members: 248,
    passes: 12,
    passRate: 31,
    topTrader: "satoshi.sui",
    status: "pending",
  },
  {
    week: 22,
    dates: "May 26 – Jun 1",
    members: 241,
    passes: 18,
    passRate: 28,
    topTrader: "vega",
    status: "settled",
  },
  {
    week: 21,
    dates: "May 19 – May 25",
    members: 229,
    passes: 15,
    passRate: 24,
    topTrader: "0xMomentum",
    status: "settled",
  },
  {
    week: 20,
    dates: "May 12 – May 18",
    members: 212,
    passes: 11,
    passRate: 22,
    topTrader: "quietalpha",
    status: "settled",
  },
  {
    week: 19,
    dates: "May 5 – May 11",
    members: 198,
    passes: 9,
    passRate: 19,
    topTrader: "delta_one",
    status: "settled",
  },
  {
    week: 18,
    dates: "Apr 28 – May 4",
    members: 180,
    passes: 7,
    passRate: 16,
    topTrader: "ronin",
    status: "settled",
  },
];

export function WeeklyHistory() {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
          Weekly History
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <Thead>
            <Tr>
              <Th>Week</Th>
              <Th>Dates</Th>
              <Th numeric>Members</Th>
              <Th numeric>Passes</Th>
              <Th numeric>Pass Rate</Th>
              <Th>Top Trader</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {WEEK_HISTORY.map((row) => (
              <Tr key={row.week}>
                <Td>
                  <span className="tabular font-semibold text-text">
                    W{row.week}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-text-muted">{row.dates}</span>
                </Td>
                <Td numeric>
                  <span className="tabular">{row.members}</span>
                </Td>
                <Td numeric>
                  <span className="tabular text-up">{row.passes}</span>
                </Td>
                <Td numeric>
                  <span className="tabular">{row.passRate}%</span>
                </Td>
                <Td>
                  <span className="text-xs text-text-muted">
                    {row.topTrader}
                  </span>
                </Td>
                <Td>
                  {row.status === "pending" ? (
                    <Badge variant="pending">PENDING</Badge>
                  ) : (
                    <Badge variant="up">Settled</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </section>
  );
}
