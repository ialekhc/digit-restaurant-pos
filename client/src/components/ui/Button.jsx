const styles = {
  primary:
    'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-200/70 hover:from-brand-600 hover:to-brand-700 focus:ring-brand-200',
  secondary:
    'border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 focus:ring-orange-100',
  danger: 'bg-gradient-to-r from-rose-500 to-red-500 text-white hover:from-rose-600 hover:to-red-600 focus:ring-rose-200',
  success:
    'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white hover:from-aqua-600 hover:to-aqua-700 focus:ring-aqua-200'
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
      className={`rounded-xl font-semibold transition duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size] || sizes.md} ${styles[variant]} ${className}`}
    />
  );
};

export default Button;
