#!/bin/bash
# Netlify runs this before every build triggered by a Git push (including "Save" in /admin).
# exit 0 = skip (changes stay saved in GitHub, nothing goes live, no credits used)
# exit 1 = build and publish
# The "Put website live" button in /admin uses a build hook, which always builds (Netlify never skips hook builds).
msg="$(git log -1 --pretty=%B 2>/dev/null)"
if printf '%s' "$msg" | grep -qi '\[live\]'; then
  echo "Commit is marked [live] - publishing."
  exit 1
fi
echo "Saved only - not published. Click 'Put website live' in /admin to publish all saved changes."
exit 0
