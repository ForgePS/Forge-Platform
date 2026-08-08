/** Static Sneat Free CSS (vendored under /public/sneat) plus Boxicons for menu glyphs. */
export function SneatHeadAssets() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap"
        rel="stylesheet"
      />
      {/* Prefer local vendor fonts; CDN is a fallback for icon glyph coverage. */}
      <link rel="stylesheet" href="/sneat/fonts/boxicons.css" />
      <link rel="stylesheet" href="/sneat/fonts/iconify-icons.css" />
      <link rel="stylesheet" href="/sneat/css/core.css" />
      <link rel="stylesheet" href="/sneat/css/theme-default.css" />
      <link rel="stylesheet" href="/sneat/css/theme-forge.css" />
      <link rel="stylesheet" href="/sneat/css/demo.css" />
      <link rel="stylesheet" href="/sneat/css/pages/page-auth.css" />
      <link rel="stylesheet" href="/sneat/libs/perfect-scrollbar.css" />    </>
  );
}
