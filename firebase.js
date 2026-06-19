/* ─── ODAK-AI · Firebase Module ─── */
(function () {

  const firebaseConfig = {
    apiKey: "AIzaSyAa45zU_aIbhdbeDxLhyozDn8vdHy8eaxs",
    authDomain: "odak-ai-6ab3e.firebaseapp.com",
    projectId: "odak-ai-6ab3e",
    storageBucket: "odak-ai-6ab3e.firebasestorage.app",
    messagingSenderId: "344460023439",
    appId: "1:344460023439:web:b77a83bb56d0be0b4342fa"
  };

  const FB_VER  = "10.12.2";
  const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;

  // Firestore offline hatasını handle eden wrapper
  async function withRetry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e) {
        const isOffline = e.message && (
          e.message.includes('offline') ||
          e.message.includes('client is offline') ||
          e.code === 'unavailable'
        );
        if (isOffline && i < retries - 1) {
          await new Promise(r => setTimeout(r, 1500 * (i + 1)));
          continue;
        }
        throw e;
      }
    }
  }

  async function loadFirebase() {
    const { initializeApp }     = await import(`${FB_BASE}/firebase-app.js`);
    const {
      getAuth, signInWithPopup, GoogleAuthProvider,
      createUserWithEmailAndPassword, signInWithEmailAndPassword,
      signOut, onAuthStateChanged, setPersistence,
      browserLocalPersistence, RecaptchaVerifier, signInWithPhoneNumber,
    } = await import(`${FB_BASE}/firebase-auth.js`);

    const {
      getFirestore, enableNetwork, doc, setDoc, getDoc,
      updateDoc, arrayUnion, collection, getDocs,
    } = await import(`${FB_BASE}/firebase-firestore.js`);

    const app  = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    // Kalıcı oturum
    await setPersistence(auth, browserLocalPersistence);

    // Network yeniden bağlan (offline hatasından sonra)
    async function ensureOnline() {
      try { await enableNetwork(db); } catch(e) { /* zaten online */ }
    }

    // ── Auth helpers ──
    const Auth = {
      async loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        const result   = await signInWithPopup(auth, provider);
        await ensureOnline();
        await ensureUserDoc(result.user);
        return result.user;
      },

      async loginWithEmail(email, password) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await ensureOnline();
        await ensureUserDoc(result.user);
        return result.user;
      },

      async registerWithEmail(email, password, displayName) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await ensureOnline();
        await ensureUserDoc(result.user, displayName);
        return result.user;
      },

      async logout() { await signOut(auth); },

      onAuthChange(cb) { onAuthStateChanged(auth, cb); },

      currentUser() { return auth.currentUser; },

      setupRecaptcha(elementId) {
        return new RecaptchaVerifier(auth, elementId, { size: 'invisible' });
      },

      async sendPhoneOTP(phone, recaptcha) {
        return signInWithPhoneNumber(auth, phone, recaptcha);
      }
    };

    // ── Firestore helpers ──
    async function ensureUserDoc(user, displayName) {
      const ref  = doc(db, 'parents', user.uid);
      const snap = await withRetry(() => getDoc(ref));
      if (!snap.exists()) {
        await withRetry(() => setDoc(ref, {
          uid:         user.uid,
          email:       user.email || '',
          displayName: displayName || user.displayName || '',
          children:    [],
          settings:    { sessionDuration: 20, aiProvider: 'openai', apiKey: '' },
          sessions:    [],
          createdAt:   new Date().toISOString()
        }));
      }
    }

    const DB = {
      async getParent(uid) {
        await ensureOnline();
        const ref  = doc(db, 'parents', uid);
        const snap = await withRetry(() => getDoc(ref));
        if (!snap.exists()) {
          // Doküman yoksa oluştur
          const fresh = {
            uid,
            email:       auth.currentUser?.email || '',
            displayName: auth.currentUser?.displayName || '',
            children:    [],
            settings:    { sessionDuration: 20, aiProvider: 'openai', apiKey: '' },
            sessions:    [],
            createdAt:   new Date().toISOString()
          };
          await withRetry(() => setDoc(ref, fresh));
          return fresh;
        }
        const data = snap.data();
        // Eksik alanları garantiye al
        if (!Array.isArray(data.children)) data.children = [];
        if (!Array.isArray(data.sessions)) data.sessions = [];
        if (!data.settings) data.settings = { sessionDuration: 20, aiProvider: 'openai', apiKey: '' };
        return data;
      },

      async updateParent(uid, data) {
        await ensureOnline();
        const ref  = doc(db, 'parents', uid);
        const snap = await withRetry(() => getDoc(ref));
        if (!snap.exists()) {
          // Doküman yoksa setDoc ile oluştur
          await withRetry(() => setDoc(ref, {
            uid,
            email:       auth.currentUser?.email || '',
            displayName: auth.currentUser?.displayName || '',
            children:    [],
            settings:    { sessionDuration: 20, aiProvider: 'openai', apiKey: '' },
            sessions:    [],
            createdAt:   new Date().toISOString(),
            ...data
          }));
        } else {
          await withRetry(() => updateDoc(ref, data));
        }
      },

      async addChild(uid, child) {
        await ensureOnline();
        const ref  = doc(db, 'parents', uid);
        const snap = await withRetry(() => getDoc(ref));
        const existing = snap.exists() ? (snap.data().children || []) : [];
        const updated  = [...existing, child];
        if (!snap.exists()) {
          await withRetry(() => setDoc(ref, {
            uid, children: updated, sessions: [], settings: {},
            createdAt: new Date().toISOString()
          }));
        } else {
          await withRetry(() => updateDoc(ref, { children: updated }));
        }
        return updated;
      },

      async registerChildCode(code, parentUid, childId, childName) {
        await ensureOnline();
        await withRetry(() => setDoc(doc(db, 'childCodes', code), {
          parentUid, childId, childName,
          createdAt: new Date().toISOString()
        }));
      },

      async getParentByChildCode(code) {
        await ensureOnline();
        const codeSnap = await withRetry(() => getDoc(doc(db, 'childCodes', code)));
        if (!codeSnap.exists()) return null;
        const { parentUid, childId, childName } = codeSnap.data();
        const parentData = await DB.getParent(parentUid);
        return { parentUid, childId, childName, parentData };
      },

      async saveChildSession(code, session) {
        await ensureOnline();
        const info = await DB.getParentByChildCode(code);
        if (!info) throw new Error('Geçersiz kod');
        const ref      = doc(db, 'parents', info.parentUid);
        const snap     = await withRetry(() => getDoc(ref));
        const sessions = snap.exists() ? (snap.data().sessions || []) : [];
        sessions.push({ ...session, childId: info.childId, childName: info.childName });
        if (!snap.exists()) {
          await withRetry(() => setDoc(ref, { sessions }));
        } else {
          await withRetry(() => updateDoc(ref, { sessions }));
        }
      }
    };

    window.OdakFirebase = { Auth, DB };
    window.dispatchEvent(new Event('odak:firebase:ready'));
  }

  loadFirebase().catch(e => {
    console.error('Firebase yüklenemedi:', e);
  });

})();
