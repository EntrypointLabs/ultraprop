const STATS = [
  { label: "Simulated Volume", value: "$51B+" },
  { label: "Open Interest", value: "$300M+" },
  { label: "Traders", value: "26K+" },
];

export function Stats() {
  return (
    <section className="border-y border-border-soft py-14">
      <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-10 px-5 sm:grid-cols-3 sm:px-8">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-sm text-text-muted">{s.label}</div>
            <div className="mt-2 font-display text-4xl font-medium sm:text-5xl">
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
