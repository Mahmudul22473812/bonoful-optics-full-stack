import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bonoful Optics',
    short_name: 'Bonoful Optics',
    description: 'Eyeglasses, sunglasses and everyday frames from Bonoful Optics.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7faf7',
    theme_color: '#153f35',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
