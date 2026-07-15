const PageHeader = ({ title, subtitle, right }) => {
  return (
    <section className="app-card relative overflow-hidden px-4 py-4 lg:px-5">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-gradient-to-br from-brand-200/50 to-secondary-200/50" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 lg:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
    </section>
  );
};

export default PageHeader;
