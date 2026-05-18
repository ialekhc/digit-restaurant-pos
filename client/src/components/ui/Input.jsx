import { forwardRef } from 'react';

const Input = forwardRef(({ label, helperText, error, className = '', ...props }, ref) => {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span> : null}
      <input
        ref={ref}
        {...props}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${className}`}
      />
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
      {!error && helperText ? <span className="mt-1 block text-xs text-slate-500">{helperText}</span> : null}
    </label>
  );
});

Input.displayName = 'Input';

export default Input;
