import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../src/auth/AuthContext';

export const metadata: Metadata = {
  title: 'Emily Cafe - Management System',
  description: 'Restaurant management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}