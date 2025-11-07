export default function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-orange-100 text-orange-800 border border-orange-300',
    success: 'bg-green-100 text-green-800 border border-green-300',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    danger: 'bg-red-100 text-red-800 border border-red-300',
    orange: 'bg-orange-600 text-white shadow-sm',
  };

  return (
    <span className={`
      px-2 py-1 rounded-full text-xs font-medium
      ${variants[variant]}
    `}>
      {children}
    </span>
  );
}