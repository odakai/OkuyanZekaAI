/* ─── Okuyan Zeka AI · Firebase Module (by ODAK-AI) ─── */
(function () {

const CONFIG = {
  apiKey:    "AIzaSyAa45zU_aIbhdbeDxLhyozDn8vdHy8eaxs",
  authDomain:"odak-ai-6ab3e.firebaseapp.com",
  projectId: "odak-ai-6ab3e",
  databaseURL:"https://odak-ai-6ab3e-default-rtdb.europe-west1.firebasedatabase.app",
  appId:     "1:344460023439:web:b77a83bb56d0be0b4342fa"
};

const FB_VER  = "10.12.2";
const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;
const FS_URL  = `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents`;
const RTDB_URL = CONFIG.databaseURL;

// ── Firestore REST helpers ──
function toFS(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number')  return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')  return { stringValue: val };
  if (Array.isArray(val))       return { arrayValue: { values: val.map(toFS) } };
  if (typeof val === 'object')  return { mapValue: { fields: objToFS(val) } };
  return { stringValue: String(val) };
}
function objToFS(obj) {
  const fields = {};
  for (const k in obj) fields[k] = toFS(obj[k]);
  return fields;
}
function fromFS(val) {
  if (!val) return null;
  if ('nullValue'    in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue);
  if ('doubleValue'  in val) return val.doubleValue;
  if ('stringValue'  in val) return val.stringValue;
  if ('arrayValue'   in val) return (val.arrayValue.values || []).map(fromFS);
  if ('mapValue'     in val) return fromFSFields(val.mapValue.fields || {});
  return null;
}
function fromFSFields(fields) {
  const obj = {};
  for (const k in fields) obj[k] = fromFS(fields[k]);
  return obj;
}

async function fsGet(path, token) {
  const res = await fetch(`${FS_URL}/${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${res.status}`);
  const doc = await res.json();
  return doc.fields ? fromFSFields(doc.fields) : null;
}

async function fsSet(path, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${FS_URL}/${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: objToFS(data) })
  });
  if (!res.ok) throw new Error(`Firestore SET ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fsUpdate(path, data, token) {
  const fields    = objToFS(data);
  const fieldMask = Object.keys(fields).join(',');
  const res = await fetch(`${FS_URL}/${path}?updateMask.fieldPaths=${encodeURIComponent(fieldMask)}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore UPDATE ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Realtime Database REST helpers (canlı süre takibi için) ──
async function rtdbSet(path, data, token) {
  const url = `${RTDB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`RTDB SET ${res.status}`);
  return res.json();
}

async function rtdbGet(path, token) {
  const url = `${RTDB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RTDB GET ${res.status}`);
  return res.json();
}

async function rtdbDelete(path, token) {
  const url = `${RTDB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  await fetch(url, { method: 'DELETE' });
}

// ── Firebase Auth ──
async function loadFirebase() {
  const { initializeApp } = await import(`${FB_BASE}/firebase-app.js`);
  const {
    getAuth, signInWithPopup, GoogleAuthProvider,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, setPersistence,
    browserLocalPersistence, RecaptchaVerifier, signInWithPhoneNumber,
    getIdToken
  } = await import(`${FB_BASE}/firebase-auth.js`);

  const app  = initializeApp(CONFIG);
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);


  // Token cache — her çağrıda Firebase'e gitmez
  let _cachedToken = null;
  let _tokenExpiry = 0;

  async function getToken() {
    const user = auth.currentUser;
    if (!user) throw new Error('Giriş yapılmamış');
    const now = Date.now();
    if (_cachedToken && now < _tokenExpiry) return _cachedToken;
    _cachedToken = await getIdToken(user, false);
    _tokenExpiry = now + 55 * 60 * 1000; // 55 dakika cache
    return _cachedToken;
  }


  function defaultParent(user, extra) {
    return {
      uid:         user.uid,
      email:       user.email || '',
      displayName: user.displayName || '',
      children:    [],
      settings:    { sessionDuration: 20, aiProvider: 'openai', apiKey: '' },
      sessions:    [],
      createdAt:   new Date().toISOString(),
      ...(extra || {})
    };
  }

  async function ensureUserDoc(user, displayName) {
    const token    = await getToken();
    const existing = await fsGet(`parents/${user.uid}`, token);
    if (!existing) {
      await fsSet(`parents/${user.uid}`, defaultParent(user, { displayName: displayName || user.displayName || '' }), token);
    }
  }

  const Auth = {
    async loginWithGoogle() {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
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
    async logout() { await signOut(auth); },
    onAuthChange(cb) { onAuthStateChanged(auth, cb); },
    currentUser()   { return auth.currentUser; },
    setupRecaptcha(elementId) {
      return new RecaptchaVerifier(auth, elementId, { size: 'invisible' });
    },
    async sendPhoneOTP(phone, recaptcha) {
      return signInWithPhoneNumber(auth, phone, recaptcha);
    }
  };

  const DB = {
    async getParent(uid) {
      const token = await getToken();
      const data  = await fsGet(`parents/${uid}`, token);
      if (!data) {
        const fresh = defaultParent(auth.currentUser || { uid, email:'', displayName:'' });
        await fsSet(`parents/${uid}`, fresh, token);
        return fresh;
      }
      if (!Array.isArray(data.children)) data.children = [];
      if (!Array.isArray(data.sessions)) data.sessions = [];
      if (!data.settings) data.settings = { sessionDuration:20, aiProvider:'openai', apiKey:'' };
      return data;
    },

    async updateParent(uid, data) {
      const token    = await getToken();
      const existing = await fsGet(`parents/${uid}`, token);
      if (!existing) {
        await fsSet(`parents/${uid}`, { ...defaultParent(auth.currentUser || {uid,email:'',displayName:''}), ...data }, token);
      } else {
        await fsUpdate(`parents/${uid}`, data, token);
      }
    },

    async addChild(uid, child) {
      const token  = await getToken();
      const parent = await DB.getParent(uid);
      const updated = [...(parent.children || []), child];
      await fsUpdate(`parents/${uid}`, { children: updated }, token);
      return updated;
    },

    async registerChildCode(code, parentUid, childId, childName, childAge) {
      const token = await getToken();
      await fsSet(`childCodes/${code}`, {
        parentUid, childId, childName,
        childAge: childAge || 10,
        createdAt: new Date().toISOString()
      }, token);
    },

    async saveActiveSession(parentUid, code, sessionData) {
      const token = await getToken();
      // childCodes/{code} dokümanına activeSession alanı ekle
      await fsUpdate(`childCodes/${code}`, { activeSession: sessionData }, token);
    },

    async getParentByChildCode(code) {
      const res = await fetch(`${FS_URL}/childCodes/${code}`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const doc = await res.json();
      if (!doc.fields) return null;
      const data = fromFSFields(doc.fields);
      const { parentUid, childId, childName, activeSession, childAge } = data;

      // Sadece settings'i almak için deneyebiliriz, hata olursa boş dön
      let parentData = { settings: { sessionDuration:20, aiProvider:'openai', apiKey:'' } };
      try {
        if (auth.currentUser) {
          parentData = await DB.getParent(parentUid);
        } else {
          const pRes = await fetch(`${FS_URL}/parents/${parentUid}`);
          if (pRes.ok) {
            const pDoc = await pRes.json();
            if (pDoc.fields) parentData = fromFSFields(pDoc.fields);
          }
        }
      } catch(e) {}

      return { parentUid, childId, childName, childAge, activeSession, parentData };
    },

    // childSessions collection'dan parent'a ait oturumları çek
    async getChildSessionsByParent(parentUid, children) {
      const token = await getToken();
      const codes = children.map(c => c.code);
      const results = [];
      for (const code of codes) {
        try {
          // childSessions/{code}_* pattern — prefix search yok, sadece known docs
          // Alternatif: Firestore query API kullan
          const queryRes = await fetch(`${FS_URL}:runQuery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              structuredQuery: {
                from: [{ collectionId: 'childSessions' }],
                where: {
                  fieldFilter: {
                    field: { fieldPath: 'code' },
                    op: 'EQUAL',
                    value: { stringValue: code }
                  }
                },
                limit: 50
              }
            })
          });
          if (queryRes.ok) {
            const docs = await queryRes.json();
            for (const d of docs) {
              if (d.document && d.document.fields) {
                results.push(fromFSFields(d.document.fields));
              }
            }
          }
        } catch(e) { /* bu kod için hata, devam et */ }
      }
      return results;
    },

    // ── Canlı Süre Takibi (Realtime Database) ──
    async startLiveTimer(code, totalSeconds) {
      await rtdbSet(`liveSessions/${code}`, {
        totalSeconds,
        remainingSeconds: totalSeconds,
        status: 'reading',
        startedAt: Date.now()
      }, null);
    },

    async updateLiveTimer(code, remainingSeconds, status) {
      await rtdbSet(`liveSessions/${code}`, {
        remainingSeconds,
        status: status || 'reading',
        updatedAt: Date.now()
      }, null);
    },

    async endLiveTimer(code) {
      await rtdbDelete(`liveSessions/${code}`, null);
    },

    // Ebeveyn panelinde — kendi çocuklarının canlı durumunu çek
    async getLiveSession(code) {
      try {
        const data = await rtdbGet(`liveSessions/${code}`, null);
        return data;
      } catch(e) { return null; }
    },

    async saveChildSession(code, session) {
      const res = await fetch(`${FS_URL}/childCodes/${code}`);
      if (!res.ok) throw new Error('Geçersiz kod');
      const doc  = await res.json();
      const data = fromFSFields(doc.fields || {});
      const { parentUid, childId, childName } = data;

      const sessionWithChild = { ...session, childId, childName, code };

      // 1) childSessions'a kaydet (token gerekmez — public write)
      const sessionId = `${code}_${Date.now()}`;
      await fsSet(`childSessions/${sessionId}`, sessionWithChild, null);

      // 2) Parent'ın sessions array'ine de ekle (loadReports için)
      // NOT: loadReports'u childSessions'dan okuyacak şekilde güncellememiz gerekiyor
      try {
        if (auth.currentUser) {
          const token  = await getToken();
          const parent = await DB.getParent(parentUid);
          const sessions = [...(parent.sessions || []), sessionWithChild];
          await fsUpdate(`parents/${parentUid}`, { sessions }, token);
        }
      } catch(e) {
        console.warn('Parent sessions güncellenemedi (çocuk auth değil):', e.message);
        // childSessions'a yazıldı, parent okuma sırasında oradan çekilecek
      }
    }
  };

  window.OdakFirebase = { Auth, DB };
  window.dispatchEvent(new Event('odak:firebase:ready'));
}

loadFirebase().catch(e => console.error('Firebase yüklenemedi:', e));

})();
