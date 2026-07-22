import { HiHome, HiDocumentText } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import NoCopyGuard from '../components/shared/NoCopyGuard';
import CertificadosLeyes from '../components/certificados/CertificadosLeyes';

export default function DashboardCertificados() {
  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  return (
    <NoCopyGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
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
                { label: 'Certificados y Leyes' },
              ]}
            />
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <HiDocumentText className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  Certificados y Leyes
                </h2>
                <p className="text-gray-600 mt-1">
                  Información confidencial, de uso exclusivo para gerencia.
                </p>
              </div>
            </div>
          </div>

          <CertificadosLeyes />
        </main>
      </div>
    </NoCopyGuard>
  );
}
