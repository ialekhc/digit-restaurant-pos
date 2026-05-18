const Loader = ({ text = 'Loading...' }) => {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="app-card w-full max-w-sm p-6 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
        <p className="mt-4 text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
};

export default Loader;
