/* Firebase adapter.
   The app was first built for Claude artifacts, which give the page window.claude.use("db" | "assets" | "user").
   This file provides the same calls backed by Firebase (Firestore, Storage, Google sign-in),
   so index.html keeps working with very few changes. */
(function () {
  "use strict";
  var V = "10.12.2", B = "https://www.gstatic.com/firebasejs/" + V + "/";
  var cfg = window.HUSOON_FIREBASE || {};
  var configured = !!(cfg.apiKey && cfg.projectId);
  var boot = null;

  function start() {
    if (boot) return boot;
    boot = Promise.all([
      import(B + "firebase-app.js"), import(B + "firebase-auth.js"),
      import(B + "firebase-firestore.js"), import(B + "firebase-storage.js")
    ]).then(function (m) {
      var app = m[0].initializeApp(cfg), A = m[1], F = m[2], S = m[3];
      var auth = A.getAuth(app), fs = F.getFirestore(app), st = S.getStorage(app);
      if (window.HUSOON_EMULATORS) { // local testing only: talk to the Firebase emulators instead of the real project
        A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        F.connectFirestoreEmulator(fs, "127.0.0.1", 8080);
        S.connectStorageEmulator(st, "127.0.0.1", 9199);
        window.__husoonFb = { A: A, auth: auth };
      }
      var authReady = new Promise(function (res) {
        var off = A.onAuthStateChanged(auth, function (u) { off(); res(u); });
      });
      return { A: A, F: F, S: S, auth: auth, fs: fs, st: st, authReady: authReady };
    });
    return boot;
  }

  function isPlain(v) { return v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype; }
  // Artifact "update" merges nested maps; Firestore's replaces them. Turn {files:{5:"x"}} into the field path files.5.
  function flatten(obj, pre, out) {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k], p = pre.concat([String(k)]);
      if (isPlain(v) && Object.keys(v).length) flatten(v, p, out); else out.push([p, v]);
    });
    return out;
  }

  function makeDb(c) {
    var F = c.F;
    function snapOf(s) { return { id: s.id, exists: s.exists(), data: function () { return s.data(); } }; }
    function docApi(ref) {
      return {
        id: ref.id,
        get: function () { return F.getDoc(ref).then(snapOf); },
        set: function (d) { return F.setDoc(ref, d); },
        update: function (d) {
          var pairs = flatten(d, [], []);
          if (!pairs.length) return Promise.resolve();
          var args = [ref];
          pairs.forEach(function (pv) { args.push(new F.FieldPath(...pv[0]), pv[1]); });
          return F.updateDoc.apply(null, args);
        },
        delete: function () { return F.deleteDoc(ref); },
        onSnapshot: function (cb, err) { return F.onSnapshot(ref, function (s) { cb(snapOf(s)); }, err); }
      };
    }
    return {
      doc: function (path) { return docApi(F.doc(c.fs, path)); },
      collection: function (path) {
        var col = F.collection(c.fs, path);
        return {
          doc: function (id) { return docApi(id ? F.doc(col, id) : F.doc(col)); },
          onSnapshot: function (cb, err) {
            return F.onSnapshot(col, function (q) { cb({ docs: q.docs.map(snapOf) }); }, err);
          }
        };
      }
    };
  }

  function makeAssets(c) {
    var S = c.S, urls = {};
    function rid() { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
    return {
      upload: function (file) {
        var id = "pdfs/" + rid() + ".pdf";
        return S.uploadBytes(S.ref(c.st, id), file, { contentType: "application/pdf" }).then(function () { return { id: id }; });
      },
      delete: function (id) { delete urls[id]; return S.deleteObject(S.ref(c.st, id)); },
      url: function (id) {
        if (!urls[id]) { urls[id] = S.getDownloadURL(S.ref(c.st, id)); urls[id].catch(function () { delete urls[id]; }); }
        return urls[id];
      }
    };
  }

  function makeUser(c) {
    return {
      id: function () { return c.authReady.then(function (u) { return u ? u.uid : null; }); },
      info: function () { return c.authReady.then(function (u) { return u ? { uid: u.uid, name: u.displayName || "", email: u.email || "" } : null; }); }
    };
  }

  function isAdmin(c) {
    return c.authReady.then(function (u) {
      if (!u) return false;
      return c.F.getDoc(c.F.doc(c.fs, "admins/" + u.uid)).then(function (s) { return s.exists(); }, function () { return false; });
    });
  }

  window.claude = {
    use: function (what) {
      if (!configured) return Promise.resolve(null);
      return start().then(function (c) {
        if (what === "db") return makeDb(c);
        if (what === "assets") return makeAssets(c);
        if (what === "user") return makeUser(c);
        if (what === "admin") return isAdmin(c);
        return null;
      });
    }
  };

  window.husoonAuth = {
    configured: configured,
    signIn: function () {
      return start().then(function (c) {
        var p = new c.A.GoogleAuthProvider();
        return c.A.signInWithPopup(c.auth, p).catch(function (e) {
          if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return c.A.signInWithRedirect(c.auth, p);
          throw e;
        });
      });
    },
    signOut: function () { return start().then(function (c) { return c.A.signOut(c.auth); }); },
    // the signed-in account's uid, shown in Settings so the owner can make themselves an admin
    uid: function () { return configured ? start().then(function (c) { return c.authReady; }).then(function (u) { return u ? u.uid : null; }) : Promise.resolve(null); }
  };
})();
