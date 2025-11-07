import { HiChevronRight, HiHome } from 'react-icons/hi2';

export default function Breadcrumb({ items = [] }) {
  return (
    <nav className="flex items-center space-x-2 text-sm">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <HiChevronRight className="w-4 h-4 text-gray-400 mx-2" />
          )}

          {item.icon && index === 0 && (
            <item.icon className="w-4 h-4 mr-2 text-orange-600" />
          )}

          {item.href ? (
            <a
              href={item.href}
              onClick={item.onClick}
              className="text-gray-600 hover:text-orange-600 transition-colors font-medium hover:underline"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-orange-600 font-semibold">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
