import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GovAsset - Digital Tracking & Optimization of Government Asset Maintenance',
  description: 'Unified civic infrastructure maintenance, defect reporting, and tracking platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Default strictly to Light Mode for new visitors and clean up any legacy stale dark preferences.
                  // Only apply dark mode if the user has an explicit, active preference in the current v2 system.
                  var explicitPref = localStorage.getItem('govasset-theme-v2');
                  if (explicitPref === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    // Default to light mode; clear legacy dark default from previous versions if present
                    document.documentElement.classList.remove('dark');
                    if (!explicitPref && localStorage.getItem('govasset-theme') === 'dark') {
                      localStorage.removeItem('govasset-theme');
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 antialiased selection:bg-[#0B4FC2] selection:text-white transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
