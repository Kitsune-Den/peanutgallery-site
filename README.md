# peanutgallery.gg

The coming-soon page for **Peanut Gallery**, your AI cov-host by Kitsune Den.

A single static page (`index.html`, `favicon.svg`, `peanut.webp`), no build step
and no tracking. It loads the Fredoka and Nunito fonts from Google Fonts.

The app itself lives in a private repo; this repo is only the public site.

## The account page

`/account/` is where a streamer signs in with Twitch, sees their co-host time
and plan, and subscribes or manages billing (Stripe, through
api.peanutgallery.gg). It's static too:

- Twitch sign-in uses the implicit flow with Peanut Gallery's own client id,
  so the Twitch app needs `https://peanutgallery.gg/account/` as an OAuth
  redirect URL. The page trades the Twitch token for a cloud session, then
  revokes it.
- The cloud session is kept in `sessionStorage`, so it's gone when the tab
  closes; "Sign out" ends it on the server too.
- Previewed from `127.0.0.1` it talks to a local cloud on
  `http://127.0.0.1:8090` (run with `WEB_ORIGINS=http://127.0.0.1:4317`).

## Preview

```sh
python -m http.server 4317
```

## Deploy

Coolify on forge, project `sites`: Public Repository, branch `main`, build pack
Static, base directory `/`, domains `http://peanutgallery.gg,http://www.peanutgallery.gg`.
Traffic reaches it through the forge Cloudflare Tunnel (public hostnames for
`peanutgallery.gg` and `www`, both to `http://localhost:80`).
