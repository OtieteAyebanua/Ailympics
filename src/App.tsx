import { Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import Homepage from './landingPages/Homepage';
import Dashboard from './dashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  if (!isConnected) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
