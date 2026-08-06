# Sneat theme provenance

Forge Platform adopts the **Sneat Free Bootstrap 5 Admin Template** (ThemeSelection, MIT, v1.0.0) as the shared visual language for:

- `@forge/design-system` (`--forge-*` tokens, Public Sans, layout/component primitives)
- `@forge/ui` (buttons, cards, form controls using `.forge-*` classes)
- `@forge/fx-design-tokens` (RMS `--fx-*` brand/surface bridge)
- Application shells: Industrial Safety, RMS, Forge Academy (and platform admin apps that import the design system)

## What we take / what we do not

| Included                                                      | Not included                 |
| ------------------------------------------------------------- | ---------------------------- |
| Color palette (primary `#696cff`, body `#f5f5f9`, semantics)  | Bootstrap 5 CSS/JS           |
| Typography (Public Sans)                                      | jQuery / template HTML pages |
| Radius, elevation, menu/navbar dimensions                     | Icon packs wholesale         |
| Conceptual sidebar + content shell patterns as CSS primitives | Vendor PHP/Blade/asset trees |

Apps consume CSS variables and React components only. The download under `Downloads/sneat-1.0.0` is a **reference**; it is not copied into the monorepo runtime.

## License

Sneat Free is distributed under the **MIT License** by ThemeSelection.
See [LICENSE excerpt below](#mit-license-excerpt) and the upstream
[themeselection/sneat-html-admin-template-free](https://github.com/themeselection/sneat-html-admin-template-free) repository.

Product page (historical): https://themeselection.com/products/sneat-free-bootstrap-html-admin-template/

Retain the MIT notice in redistribution of derived token values.

### MIT license excerpt

```
MIT License

Copyright (c) 2021 ThemeSelection (https://themeselection.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Theme classes

- Prefer `class="forge-theme-light"` on `<html>` for product UIs (overrides `prefers-color-scheme` auto-dark).
- RMS also sets `data-fx-theme="light"` for FX component tokens.
- Dark theme available via `.forge-theme-dark` / `data-fx-theme="dark"` when needed.
