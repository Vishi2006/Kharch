/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow mobile devices on local Wi-Fi to connect to HMR dev resources
  allowedDevOrigins: [
    '10.28.172.194',
    '10.28.172.194:3000',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
