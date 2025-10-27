import { HiArrowRight } from 'react-icons/hi2';
import Card from '../atoms/Card';
import Button from '../atoms/Button';

export default function ModuleCard({ title, description, icon, onClick }) {
  return (
    <Card className="hover:shadow-xl transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{icon}</span>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">{description}</p>
          <Button 
            variant="outline" 
            onClick={onClick}
            icon={HiArrowRight}
          >
            Acceder
          </Button>
        </div>
      </div>
    </Card>
  );
}