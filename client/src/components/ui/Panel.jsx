const Panel = ({ title, subtitle, right, children, className = '' }) => {
  return (
    <section className={`app-card relative min-w-0 overflow-hidden p-4 lg:p-5 ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-500 via-brand-300 to-secondary-900" />
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h3 className="app-title">{title}</h3> : null}
            {subtitle ? <p className="app-subtitle">{subtitle}</p> : null}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
};

export default Panel;
