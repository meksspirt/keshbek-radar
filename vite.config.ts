import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Підтримуємо як стандартні змінні Vite (VITE_*), так і змінні інтеграції Supabase+Vercel (NEXT_PUBLIC_*)
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
