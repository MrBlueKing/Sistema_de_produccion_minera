import { HiHome, HiOutlineChartBarSquare } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import { ProduccionCompleta } from '../components/operaciones/ProduccionDashboard';

export default function DashboardOperaciones() {
  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
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
                { label: 'Operaciones' },
              ]}
            />
          </div>

          <div className="bg-white rounded-xl shadow-md px-5 py-3 mb-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-3">
              <HiOutlineChartBarSquare className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                  Operaciones
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  KPIs de producción y eficiencia, análisis de frentes y lotes, trazabilidad completa — información confidencial, de uso exclusivo para gerencia.
                </p>
              </div>
            </div>
          </div>

          <ProduccionCompleta />
        </main>
      </div>
    </>
  );
}
