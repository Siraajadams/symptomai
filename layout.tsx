import './globals.css';

export const metadata = {
  title: 'SymptomAI',
  description: 'Simple pharmacy triage and referral support tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
