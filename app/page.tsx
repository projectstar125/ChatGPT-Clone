import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ChatApp from '@/components/chat-app';
export default async function Home() { const user = await getCurrentUser(); if (!user) redirect('/login'); return <ChatApp user={user} />; }
