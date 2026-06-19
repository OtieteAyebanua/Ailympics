'use client';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

// Client-only: the dashboard uses wagmi + three.js (broadcast viewer, pitch).
const Dashboard = dynamic(() => import('@/src/dashboard'), { ssr: false });

export default function Page() {
  const { isConnected } = useAccount();
  const router = useRouter();

  // Gate: only signed-in wallets reach the dashboard (was <ProtectedRoute>).
  useEffect(() => {
    if (!isConnected) router.replace('/');
  }, [isConnected, router]);

  if (!isConnected) return null;
  return <Dashboard />;
}
