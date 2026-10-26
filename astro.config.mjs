// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // 网站正式公网地址。若以后绑定了自己的域名，改这里即可。
  site: 'https://ukimi.netlify.app',
  integrations: [sitemap()],
});
