const VALUE_POINTS = [
  {
    title: "Deflect known issues earlier",
    description:
      "ResolveKit meets users inside the workflow that is already failing, so repeatable blockers can be handled before they turn into ticket queues.",
  },
  {
    title: "Make support knowledge executable",
    description:
      "Ground the agent in docs, flows, and screenshots, then connect approved product actions so guidance can turn into actual resolution.",
  },
  {
    title: "Keep teams aligned on risk",
    description:
      "Product, CX, and engineering share one policy layer for approvals, version limits, and trace history instead of improvising across tools.",
  },
];

export function MissionRail() {
  return (
    <section className="mt-14 border-y border-[#d6dee6] py-6">
      <div className="grid gap-5 md:grid-cols-3">
      {VALUE_POINTS.map((item, idx) => (
        <div
          key={item.title}
          className={`animate-fade-up border-l border-[#d6dee6] pl-4 ${idx === 1 ? "[animation-delay:90ms]" : idx === 2 ? "[animation-delay:180ms]" : ""}`}
        >
          <h2 className="text-lg font-semibold leading-tight text-[#10273f]">{item.title}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#4b5f72]">{item.description}</p>
        </div>
      ))}
      </div>
    </section>
  );
}
