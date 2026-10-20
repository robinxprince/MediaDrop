# MediaDrop website

The landing page for MediaDrop, built with Next.js, Tailwind CSS and Motion, and exported as a static site for GitHub Pages.

```bash
npm install
npm run dev        # http://localhost:3000/MediaDrop
npm run build      # static site in out/
npm run typecheck
```

The version number shown on the page is read from the app's `package.json` at build time, so it updates with each release.

## Deploying

`.github/workflows/pages.yml` builds and deploys the site whenever `website/` (or the app's `package.json`) changes on `main`. It can also be run by hand from the Actions tab.

One-time setup: in the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. The site is then served at https://robinxprince.github.io/MediaDrop/.

The site is built for the `/MediaDrop` path. With a custom domain, the workflow passes an empty base path automatically; for a local build, set `PAGES_BASE_PATH=""`.

## Mockups

The product visuals are illustrations built from the app's real interface (`renderer/`): the same sidebar, Search tabs, sources, licence labels and download options. Thumbnails are drawn shapes, not stock photos.
