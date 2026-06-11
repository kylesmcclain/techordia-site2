# Techordia — marketing site

Static marketing site for Techordia, served via GitHub Pages.

- **Live URL:** https://kylesmcclain.github.io/techordia-site2/

## One effect system

Every page uses a single visual language — an "operating network" of nodes,
edges, and motion — expressed in different layout *modes*:

| Page | Mode | What it communicates |
|------|------|----------------------|
| Home | `core` | The Techordia command core: a circuit board where requests flow in, fixes flow out, and live status chips pop as work completes |
| All Services | `selector` | Interactive service map (hover a card → its path lights up); nodes are built from the cards on the page |
| Managed IT Services | `lanes` | Every layer of a client's IT connecting through Techordia as one accountable owner |
| Help Desk & Support | `response` | You call, an engineer answers — signals flowing both ways |
| IT Projects | `timeline` | Staged delivery: scope → prepare → cutover → test → handoff |
| The Techordia Way | `orbit` | The six Way qualities orbiting the Techordia hub |
| Contact | `response` | You call, an engineer answers — signals flowing both ways |

(Cybersecurity & Compliance is deliberately content-led, with no effect stage.)

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
index.html  services.html  managed-it.html  helpdesk-support.html
cybersecurity.html  it-projects.html  techordia-way.html  contact.html  404.html
assets/css/{app,effects}.css   assets/js/{site,effects}.js   assets/img/*
```

### Site structure

Services live on dedicated pages (one per pillar), all reachable from the
Services menu and the `services.html` hub:

- `managed-it.html` — the flagship flat-fee plan (with `#cloud`, `#strategy`,
  `#vendors` sections in-page)
- `helpdesk-support.html` — the support experience
- `cybersecurity.html` — security, `#compliance`, `#backup`, `#training`,
  `#cameras`
- `it-projects.html` — one-time projects

## Notes

- Contact form submits via Web3Forms.
- Client portal for existing customers: https://connect.techordia.com
  (linked in the header and footer).
- Founded 2010 — all copy and metadata reflect this.

## Local preview

```bash
python -m http.server 4178   # then open http://localhost:4178/
```
