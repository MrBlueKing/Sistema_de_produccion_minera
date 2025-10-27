export default function Input({ 
  label, 
  error, 
  icon: Icon,
  ...props 
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        )}
        <input
          {...props}
          className={`
            w-full px-3 py-2 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500' : 'border-gray-300'}
          `}
        />
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  );
}