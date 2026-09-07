# Front page testing

`/admin/front-page` is a working copy of the public landing page, behind the
admin login. Change it, look at it, and copy what works into the live one.

## The copy will drift, and that is the point to watch

It is a duplicate of `src/pages/index.astro`, not a view of it. That isolation
is what makes it safe to change — and it is also the risk: edit one and the
other is silently out of date, which is exactly how a "tested" page ships
untested changes.

Two things guard against it.

**The banner.** The test copy carries a fixed amber bar reading "Test copy —
changes here are not live". The two can never be confused in a screenshot, and
nobody can be halfway through reviewing the wrong one.

**One command tells you what differs:**

```
git diff --no-index src/pages/index.astro src/pages/admin/front-page.astro
```

Immediately after this was created that diff was 30 lines: the two import
paths, the page title, the banner markup, and the note explaining all of it.
Anything beyond those is a real difference between what you tested and what
visitors see.

## Promoting a change

There is no deploy button, deliberately. Copy the changed part into
`src/pages/index.astro` yourself, then build and deploy as usual. An automatic
promotion would be one click away from publishing a half-finished experiment.

## What is shared and what is not

The two pages share everything they import — the layout, the lens component,
and every rule in `global.css`. So a change to the logo or to a shared style
shows up in both, live included. Only the page file itself is isolated.

If you want to try a style change safely, scope it under `.fp-test ~ *` or a
class you add on the test page only, rather than editing the shared rule.
