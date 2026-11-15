# Husoon Hifz Tracker (الحصون الخمسة)

A Quran memorization tracker: daily awrad, a Mushaf map, a revision list and a built-in Mushaf reader.
It started as a Claude artifact and now runs as a standalone web app on **Firebase**
(Google sign-in, database, PDF storage) and **GitHub Pages** (hosting).

```
public/               the web app that gets deployed
  index.html          the whole app (same code as the artifact, plus sign-in and import)
  firebase-shim.js    adapter: gives the app the same storage calls it had as an artifact, backed by Firebase
  firebase-config.js  your Firebase project's web config (fill this in)
  pdfjs/, pdflib/     PDF reading and splitting libraries
firestore.rules       database security rules
storage.rules         PDF storage security rules
cors.json             lets the reader load PDFs from storage
artifact/             the last Claude-artifact version, for reference
migration/            Mushaf layout data exported from the artifact
```

## One-time setup (about 20 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com>, click **Create a project**, name it (e.g. `husoon`). Google Analytics is not needed.
2. On the project home page click the **Web** icon (`</>`) to add a web app. Name it `husoon`, leave Hosting unticked, click **Register app**.
3. Copy the values from the `firebaseConfig` it shows into `public/firebase-config.js` and commit the change.
   These values are not secret; the rules files control who can do what.

### 2. Turn on Google sign-in
1. **Build → Authentication → Get started → Sign-in method → Google**, enable it, pick a support email, **Save**.
2. **Authentication → Settings → Authorized domains → Add domain**: add `YOUR-GITHUB-USERNAME.github.io`.

### 3. Create the database
1. **Build → Firestore Database → Create database**. Choose a location near you (it cannot be changed later), start in **production mode**.
2. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, click **Publish**.

### 4. Create PDF storage
1. **Build → Storage → Get started.** Firebase asks you to switch to the **Blaze (pay as you go)** plan; that needs a card,
   but the first 5 GB of storage and normal reading stay free. Set a budget alert (for example $1) when it offers one.
2. Open the **Rules** tab, replace everything with the contents of `storage.rules`, click **Publish**.
3. Let the reader load PDFs (CORS). Open <https://console.cloud.google.com>, pick your project, click the
   **Activate Cloud Shell** icon (top right, `>_`), and run these, using the bucket name shown at the top of the
   Storage page (it looks like `husoon-xxxx.firebasestorage.app`):

   ```bash
   echo '[{"origin":["*"],"method":["GET","HEAD"],"responseHeader":["Content-Type","Content-Length","Content-Range","Accept-Ranges","Range"],"maxAgeSeconds":3600}]' > cors.json
   ```

   ```bash
   gsutil cors set cors.json gs://YOUR-BUCKET-NAME
   ```

### 5. Publish the site
1. In this GitHub repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Every push to `main` deploys `public/`. The site appears at `https://YOUR-GITHUB-USERNAME.github.io/REPO-NAME/`
   (the **Actions** tab shows progress).

### 6. Make yourself the admin
Only admins can add or remove Mushaf PDFs.
1. Open the site, go to **Settings → Account**, sign in with Google.
2. Copy the **Account id** shown there.
3. In Firebase: **Firestore Database → Data → Start collection**, collection id `admins`,
   document id = your account id, add any field (e.g. `role` = `owner`), **Save**.
4. Reload the site: **Settings** now shows **Mushaf types stored in the app**.

### 7. Add your Mushafs again
PDFs stored inside the Claude artifact cannot be moved out automatically, so upload them again:
- **مصحف الحفاظ**: type its name, choose **Page layout → Huffaz (from the old app)**, click **Add type**, then upload its 30 juz files.
  That layout keeps the juz start pages and blank pages from the old app.
- **madinah**: add it with **Standard 604 pages**, then upload its 30 juz files (or use *Add a full Mushaf PDF*).

### 8. Move everyone's progress
Each person, once:
1. In the **old app** (the Claude link): **Settings → Moving to the new app → Copy my progress**.
2. In the **new app**: **Settings → Account**, sign in with Google, open **Bring progress from the old app**, paste, **Import**.

## Testing locally
Serve `public/` with any static server, e.g. `npx serve public`, and add `http://localhost:3000` to the
authorized domains if you want to sign in locally. Without a filled-in `firebase-config.js` the app still
works, saving progress on the device only.
