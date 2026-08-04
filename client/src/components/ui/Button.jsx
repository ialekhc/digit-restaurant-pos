const styles = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-200/70 hover:bg-brand-700 focus:ring-brand-200',
  secondary:
    'border border-secondary-200 bg-secondary-50 text-secondary-800 hover:bg-secondary-100 focus:ring-secondary-100',
  neutral:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-200',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200',
  dangerOutline:
    'border border-rose-200 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50 focus:ring-rose-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-200'
};

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
  xl: 'px-5 py-3 text-base'
};

const Button = ({ variant = 'primary', size = 'md', className = '', ...props }) => {
  return (
    <button
      {...props}
      className={`rounded-full font-semibold transition duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size] || sizes.md} ${styles[variant]} ${className}`}
    />
  );
};

export default Button;
