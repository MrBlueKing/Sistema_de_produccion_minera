import { useState } from 'react';
import { HiHome, HiBanknotes } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import LotesComercial from '../components/comercial/LotesComercial';
import TarifasAdmin from '../components/comercial/TarifasAdmin';

const TABS = [
  { id: 'lotes', label: 'Lotes' },
  { id: 'tarifas', label: 'Tarifas' },
];

export default function DashboardComercial() {
  const [vista, setVista] = useState('lotes');

  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Portal M3H',
                href: import.meta.env.VITE_CENTRAL_URL,
                onClick: (e) => {
                  e.preventDefault();
                  handleGoBack();
                },
                icon: HiHome,
              },
              { label: 'Tarifas y Liquidaciones' },
            ]}
          />
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-amber-500">
          <div className="flex items-center gap-3">
            <HiBanknotes className="w-8 h-8 text-amber-600" />
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                Tarifas y Liquidaciones
              </h2>
              <p className="text-gray-600 mt-1">
                Seguimiento comercial de lotes canjeados: liquidación, anticipo y pago.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setVista(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                vista === t.id
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {vista === 'lotes' && <LotesComercial />}
        {vista === 'tarifas' && <TarifasAdmin />}
      </main>
    </div>
  );
}
