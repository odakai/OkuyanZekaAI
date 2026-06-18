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

  // Firebase CDN modülleri
  const FB_VER = "10.12.2";
  const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;

  async function loadFirebase() {
    const { initializeApp } = await import(`${FB_BASE}/firebase-app.js`);
    const {
      getAuth,
      signInWithPopup,
      GoogleAuthProvider,
      createUserWithEmailAndPassword,
      signInWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      setPersistence,
      browserLocalPersistence,
      PhoneAuthProvider,
      RecaptchaVerifier,
      signInWithPhoneNumber,
    } = await import(`${FB_BASE}/firebase-auth.js`);

    const {
      getFirestore,
      doc,
      setDoc,
      getDoc,
      updateDoc,
      arrayUnion,
      collection,
      query,
      where,
      getDocs,
    } = await import(`${FB_BASE}/firebase-firestore.js`);

    const app  = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    // Kalıcı oturum
    await setPersistence(auth, browserLocalPersistence);

    // ── Auth helpers ──
    const Auth = {
      async loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        await ensureUserDoc(result.user);
        return result.user;
      },

      async loginWithEmail(email, password) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(result.user);
        return result.user;
      },

      async registerWithEmail(email, password, displayName) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(result.user, displayName);
        return result.user;
      },

      async logout() {
        await signOut(auth);
      },

      onAuthChange(cb) {
        onAuthStateChanged(auth, cb);
      },

      currentUser() {
        return auth.currentUser;
      },

      setupRecaptcha(elementId) {
        return new RecaptchaVerifier(auth, elementId, { size: 'invisible' });
      },

      async sendPhoneOTP(phone, recaptcha) {
        return signInWithPhoneNumber(auth, phone, recaptcha);
      }
    };

    // ── Firestore helpers ──
    async function ensureUserDoc(user, displayName) {
      const ref = doc(db, 'parents', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email || '',
          displayName: displayName || user.displayName || '',
          children: [],
          settings: { sessionDuration: 20, aiProvider: 'openai', apiKey: '', theme: 'default' },
          sessions: [],
          createdAt: new Date().toISOString()
        });
      }
    }

    const DB = {
      async getParent(uid) {
        const snap = await getDoc(doc(db, 'parents', uid));
        return snap.exists() ? snap.data() : null;
      },

      async updateParent(uid, data) {
        await updateDoc(doc(db, 'parents', uid), data);
      },

      async addChild(uid, child) {
        // child: { id, name, code, createdAt }
        const ref = doc(db, 'parents', uid);
        const snap = await getDoc(ref);
        const existing = snap.data().children || [];
        const updated = [...existing, child];
        await updateDoc(ref, { children: updated });
        return updated;
      },

      async saveSession(uid, session) {
        const ref = doc(db, 'parents', uid);
        const snap = await getDoc(ref);
        const sessions = snap.data().sessions || [];
        sessions.push(session);
        await updateDoc(ref, { sessions });
      },

      async getParentByChildCode(code) {
        const q = query(collection(db, 'parents'), where('children', 'array-contains', { code }));
        // array-contains ile nested object aramak Firestore'da çalışmaz
        // Alternatif: ayrı 'childCodes' map'i tut
        // Bunu basit tutmak için: tüm parent'larda arama yapabiliriz
        // Ama bu pahalı. Bunun yerine childCodes collection kullanacağız.
        const codeRef = doc(db, 'childCodes', code);
        const codeSnap = await getDoc(codeRef);
        if (!codeSnap.exists()) return null;
        const { parentUid, childId, childName } = codeSnap.data();
        const parentData = await DB.getParent(parentUid);
        return { parentUid, childId, childName, parentData };
      },

      async registerChildCode(code, parentUid, childId, childName) {
        await setDoc(doc(db, 'childCodes', code), {
          parentUid, childId, childName,
          createdAt: new Date().toISOString()
        });
      },

      async saveChildSession(code, session) {
        const info = await DB.getParentByChildCode(code);
        if (!info) throw new Error('Geçersiz kod');
        await DB.saveSession(info.parentUid, { ...session, childId: info.childId, childName: info.childName });
      }
    };

    window.OdakFirebase = { Auth, DB };
    window.dispatchEvent(new Event('odak:firebase:ready'));
  }

  loadFirebase().catch(console.error);

})();
