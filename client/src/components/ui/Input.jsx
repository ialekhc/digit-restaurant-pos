import { forwardRef } from 'react';

const Input = forwardRef(({ label, helperText, error, className = '', ...props }, ref) => {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span> : null}
      <input
        ref={ref}
        {...props}
        className={`w-full rounded-xl border border-orange-200/80 bg-gradient-to-b from-white to-orange-50/35 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${className}`}
      />
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
      {!error && helperText ? <span className="mt-1 block text-xs text-slate-500">{helperText}</span> : null}
    </label>
  );
});

Input.displayName = 'Input';

export default Input;
