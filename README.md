# p5 Phone Simple Start

A starting point for writing p5.js sketches on your laptop and opening them on your phone.

It is the same setup you have used in the p5 web editor:

- `index.html` links p5.js 2.x and p5-phone.
- `sketch.js` is your sketch.

It also includes two extras. `.agents/skills` teaches coding agents about p5.js 2.x and p5-phone (see the end of this page). `.nojekyll` is an empty file that tells GitHub Pages to publish your files exactly as they are.

## Use it

The full walkthrough with screenshots is here:
https://digitalfuturesocadu.github.io/vsCodeSetup/guide/

The short version:

1. Click **Use this template**, then **Create a new repository**. Keep it **Public**.
2. In your new repository, open **Settings**, then **Pages**. Under **Build and deployment**, leave **Source** on **Deploy from a branch**. Set **Branch** to **main** and the folder to **/ (root)**, then click **Save**. After that, every push publishes your sketch.
3. In VS Code, choose **Clone Git Repository**, then **Clone from GitHub**, and pick your new repository.
4. Open `index.html` and click **Go Live** to see the sketch on your laptop.
5. Change `sketch.js`. In Source Control, write a message, click **Commit**, then **Sync Changes**.
6. Wait about a minute. Open this address on your phone:

```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

If the page does not appear, see the next part.

## If your page does not publish

GitHub does not copy the Pages setting from the template, so each new copy needs step 2 once. Until then, your address shows a 404.

- **By hand:** open **Settings**, then **Pages**. **Source:** Deploy from a branch. **Branch:** main, **/ (root)**. Click **Save**. In about a minute the page says **Your site is live at** with your address.
- **Or ask your coding agent.** In OpenCode, or in VS Code's Chat set to **Agent**, open this project and paste the prompt below. It needs the GitHub CLI signed in first: run `gh auth login`.

```
Turn on GitHub Pages for this repo so it publishes from the main branch. Use the GitHub CLI. Run gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/". If it says Pages is already enabled, run gh api -X PUT "repos/{owner}/{repo}/pages" -f build_type=legacy -f "source[branch]=main" -f "source[path]=/" instead. If the file .github/workflows/static.yml exists, delete it, then commit and push that change. Then find the newest run with gh run list --limit 1, follow it with gh run watch and its ID, and when it finishes tell me the Pages address from gh api "repos/{owner}/{repo}/pages" --jq .html_url.
```

In the **Actions** tab you may see a run marked cancelled just before the green one. That is normal. The next push replaced it.

**Made your copy before September 29, 2026?** Switch Pages on the same way, from the main branch. Your copy has a file from the old setup, `.github/workflows/static.yml`. It does no harm: it publishes the same files a second time after each push. To tidy up, delete it, or let the prompt do it.

**Never click Configure** on the Pages settings page. If you choose **GitHub Actions** as the source, GitHub offers a workflow with a **Configure** button. In a copy made before September 29 it tries to add a file your repo already has, and GitHub says the file already exists. You do not need it.

The same fix is in the setup guide, with a Copy button for the prompt: [Pages is not switched on](https://digitalfuturesocadu.github.io/vsCodeSetup/guide/#fix--pages-off).

## What is in the sketch

Nothing yet. `sketch.js` is the same blank sketch you get in the p5 web editor: a `setup()` that makes a 400 by 400 canvas and a `draw()` that fills it with grey. Start from there.

p5-phone is already linked in `index.html`, so its functions are ready when you want your phone's sensors.

## Skills for your coding agent

The `.agents/skills` folder holds two skills. A skill is a set of notes a coding agent reads when it needs them. OpenCode and the Chat in VS Code both look in this folder.

- `p5-phone` explains how p5-phone reaches the phone's sensors and asks for permissions.
- `p5js-2x` keeps the agent writing p5.js 2.x code, not the older 1.x code most models learned from.

They come from the [p5-phone repository](https://github.com/npuckett/p5-phone). Leave them as they are for now. You can add your own skills next to them later.
