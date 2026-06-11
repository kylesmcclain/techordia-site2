# Techordia — marketing site

Static marketing site for Techordia, served via GitHub Pages.

- **Live URL:** https://kylesmcclain.github.io/techordia-site2/

## One effect system

Every page uses a single visual language — an "operating network" of nodes,
edges, and motion — expressed in different layout *modes*:

| Page | Mode | What it communicates |
|------|------|----------------------|
| Home | `core` | The Techordia command core: a circuit board where requests flow in, fixes flow out, and live status chips pop as work completes |
| Services | `selector` | Interactive model selector (hover a card → its path lights up) |
| Managed IT | `lanes` | Every layer of a client's IT connecting through Techordia as one accountable owner |
| IT Projects | `timeline` | Staged delivery: scope → prepare → cutover → test → handoff |
| The Techordia Way | `orbit` | The six Way qualities orbiting the Techordia hub |
| Contact | `response` | You call, an engineer answers — signals flowing both ways |

Motion is purposeful: subtle mouse parallax (depth), edge flow, hover
cross-highlighting, and restrained scroll reveals. All animation respects
`prefers-reduced-motion`. Everything is hand-authored — no effect libraries.

## Design system

Space Grotesk + Manrope, asymmetric/editorial layouts (heroes are composed
differently per page), varied corner radii, and a single restrained
blue→teal accent. Light/dark theme toggle persisted in localStorage.

## Stack

Hand-built static HTML/CSS/vanilla JS — no framework, no build step — so it maps
cleanly to GitHub Pages' multi-URL structure.

```
index.html  services.html  managed-it.html  it-projects.html
techordia-way.html  contact.html  404.html
assets/css/{app,effects}.css   assets/js/{site,effects}.js   assets/img/*
```

## Notes

- Contact form submits via Web3Forms.
- Client portal for existing customers: https://connect.techordia.com
  (linked in the header and footer).
- Founded 2010 — all copy and metadata reflect this.

## Local preview

```bash
python -m http.server 4178   # then open http://localhost:4178/
```
