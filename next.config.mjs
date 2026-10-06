/** @type {import('next').NextConfig} */
const nextConfig = {
  // 서버가 전혀 필요 없는 도구라 정적으로 내보낸다.
  // Vercel은 호스팅만 하고, 영상·이미지 처리는 전부 브라우저에서 끝난다.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
