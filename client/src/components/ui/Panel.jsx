const Panel = ({ title, subtitle, right, children, className = '' }) => {
  return (
    <section className={`app-card p-4 lg:p-5 ${className}`}>
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
