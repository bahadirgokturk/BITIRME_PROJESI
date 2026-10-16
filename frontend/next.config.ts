import type { NextConfig } from "next";

import { apiRewrites } from "./src/lib/apiRewrites";

const nextConfig: NextConfig = {
  // BACKEND_ORIGIN yalniz Vercel'de tanimli (staging: https://campusflow-api-staging-rpwx.onrender.com)
  async rewrites() {
    return apiRewrites(process.env.BACKEND_ORIGIN);
  },
};

export default nextConfig;
