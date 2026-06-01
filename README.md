# Techordia — marketing site (STAGING)

Staging build of the Techordia marketing site. **Do not treat as production.**
Review here, then promote to the production repo once approved.

- **Staging URL:** https://kylesmcclain.github.io/techordia-site-staging/
- **Production (when approved):** https://kylesmcclain.github.io/techordia-site/

## One effect system

Every page uses a single visual language — an "operating network" of nodes,
edges, and motion — expressed in different layout *modes*:

| Page | Mode | What it communicates |
|------|------|----------------------|
| Home | `network` | Techordia as the IT operating center, connected to every domain |
| Services | `selector` | Interactive model selector (hover a card → its path lights up) |
| Managed IT | `ownership` | Techordia owns the whole operating surface (managed boundary) |
| Co-Managed IT | `lanes` | Two lanes (your IT / Techordia) meeting at a shared layer |
| Cybersecurity | `layers` | Concentric control layers + radar around a protected core |
| IT Projects | `timeline` | Staged delivery: scope → prepare → cutover → test → handoff |
| The Techordia Way | `framework` | Placeholder — full framework "coming soon" |

Motion is purposeful: subtle mouse parallax (depth), edge flow, hover
cross-highlighting, and restrained scroll reveals. All animation respects
`prefers-reduced-motion`.

## Anti-"AI slop" choices

Space Grotesk + Manrope (not Inter), asymmetric/editorial layouts (heroes are
composed differently per page), varied corner radii, and a single restrained
blue→teal accent.

## Stack

Hand-built static HTML/CSS/vanilla JS — no framework, no build step — so it maps
cleanly to GitHub Pages' multi-URL structure.

```
index.html  services.html  managed-it.html  co-managed-it.html
cybersecurity.html  it-projects.html  techordia-way.html  contact.html  404.html
assets/css/{app,effects}.css   assets/js/{site,effects}.js   assets/img/*
```

## Local preview

```bash
python -m http.server 4178   # then open http://localhost:4178/
```

## Known follow-ups (publish checklist)

- Contact form is front-end only — wire to a form service/backend to capture leads.
- The Techordia Way is a placeholder pending final framework content.
- Add analytics + verified review data (or omit any rating widget).
- Mobile QA + cross-browser pass (desktop is locked first, per plan).
