# No client-side routing

The app has multiple screens (Clock, Entries, Reports, Settings) but uses a single-page layout with tab/section switching instead of Angular Router. GitHub Pages has no server-side rewrite, so any router-based deep link or page refresh on a non-root path 404s unless a 404.html redirect hack is added. Skipping routing entirely avoids that failure mode rather than working around it, at the cost of no bookmarkable/shareable per-screen URLs.
