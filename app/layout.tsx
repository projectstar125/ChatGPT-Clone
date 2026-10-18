import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AI Chat', description: 'Private multi-user AI chat workspace' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
