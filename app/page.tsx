'use client';
import dynamic from 'next/dynamic';

// Client-only: the landing page uses wagmi + three.js (RetroPitch), which must
// not run during server render.
const Homepage = dynamic(() => import('@/src/landingPages/Homepage'), { ssr: false });

export default function Page() {
  return <Homepage />;
}
