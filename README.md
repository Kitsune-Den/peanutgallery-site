# peanutgallery.gg

The coming-soon page for **Peanut Gallery**, your AI cov-host by Kitsune Den.

A single static page (`index.html`, `favicon.svg`, `peanut.png`), no build step
and no tracking. It loads the Fredoka and Nunito fonts from Google Fonts.

The app itself lives in a private repo; this repo is only the public site.

## Preview

```sh
python -m http.server 4317
```

## Deploy

Coolify on forge, project `sites`: Public Repository, branch `main`, build pack
Static, base directory `/`, domains `http://peanutgallery.gg,http://www.peanutgallery.gg`.
Traffic reaches it through the forge Cloudflare Tunnel (public hostnames for
`peanutgallery.gg` and `www`, both to `http://localhost:80`).
