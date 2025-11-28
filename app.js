// --- FIREBASE IMPORT ÉS KONFIGURÁCIÓ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, deleteField } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// AZ ÁLTALAD MEGADOTT FIREBASE KONFIGURÁCIÓ
const firebaseConfig = {
    apiKey: "AIzaSyAKEKZzgKSTFQ3_K6Yhm7aPvTX5plMzXYg",
    authDomain: "tracker-fbe21.firebaseapp.com",
    projectId: "tracker-fbe21",
    storageBucket: "tracker-fbe21.firebasestorage.app",
    messagingSenderId: "402979419538",
    appId: "1:402979419538:web:ff7924c73c306ff8527d4b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// --- BIZTONSÁGI KONFIGURÁCIÓ ---

// !!! A titkos kulcs Base64-ben kódolva: "0013" (MDAxMw==) !!!
const ENCODED_ACCESS_KEY = "MDAxMw=="; 
const ACCESS_KEY_LOCAL_STORAGE = "trackerAccessGranted";

// Ez a KÖZÖS mappa neve a Firestore-ban.
const SHARED_UID = "SHARED_FRIENDS_GROUP"; 

// --- GLOBÁLIS VÁLTOZÓK ---
let trackerList = []; // Tartalmazza az összes médiaelemet
let gameList = [];    

const THEME_COLOR_KEY = 'trackerThemeColor';
const DEFAULT_COLOR = '#ff8c00'; 
const MEDIA_COLLECTION_NAME = 'media';
const GAME_COLLECTION_NAME = 'games';

// Kategória kezelés
let currentCategory = 'joint'; // Alapértelmezett kategória: Közös nézés
const CATEGORY_MAP = {
    'joint': '🧑‍🤝‍🧑 Közös nézés', 
    'cdrama': '🇨🇳 C-Drama',
    'kdrama': '🇰🇷 K-Drama',
    'anime': '🇯🇵 Anime',
    'donghua': '🎎 Donghua',
    'other': '🌍 Egyéb',
};
const CATEGORIES = Object.keys(CATEGORY_MAP); 

// === 1. HOZZÁFÉRÉS ÉS BELÉPTETÉS ===

window.checkAccessKey = function() {
    const inputKey = document.getElementById('access-key-input').value.trim();
    const errorDiv = document.getElementById('login-error');

    // A KULCS DEKÓDOLÁSA Base64-ből az összehasonlításhoz
    const SECRET_ACCESS_KEY = atob(ENCODED_ACCESS_KEY);

    if (inputKey === SECRET_ACCESS_KEY) {
        localStorage.setItem(ACCESS_KEY_LOCAL_STORAGE, 'true');
        errorDiv.textContent = '';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app-content').style.display = 'block';
        
        initAuthAndApp(); 
    } else {
        errorDiv.textContent = 'Hibás titkos kulcs!';
        localStorage.removeItem(ACCESS_KEY_LOCAL_STORAGE);
    }
}

function checkInitialAccess() {
    if (localStorage.getItem(ACCESS_KEY_LOCAL_STORAGE) === 'true') {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app-content').style.display = 'block';
        initAuthAndApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app-content').style.display = 'none';
    }
}

window.logout = function() {
    // Törli a helyi kulcsot, és újra betölti az oldalt
    localStorage.removeItem(ACCESS_KEY_LOCAL_STORAGE);
    window.location.reload(); 
}

// Haladó információk megjelenítése/elrejtése
window.toggleAdvancedInfo = function() {
    const content = document.getElementById('advanced-info-content');
    const icon = document.getElementById('toggle-icon');
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    icon.textContent = isHidden ? '▲' : '▼';
}

// === 2. ADATBÁZIS ELÉRÉSI HELYEK DINAMIKUS LÉTREHOZÁSA ===

function getMediaCollectionRef() {
    // Minden média adatot ugyanabban a gyűjteményben tárolunk
    return collection(db, 'users', SHARED_UID, MEDIA_COLLECTION_NAME);
}

function getGameCollectionRef() {
    return collection(db, 'users', SHARED_UID, GAME_COLLECTION_NAME);
}

// === 3. FIREBASE AZONOSÍTÁS ÉS APP INDÍTÁS ===

async function initAuthAndApp() {
    try {
        const userCredential = await signInAnonymously(auth);
        const actualUserId = userCredential.user.uid;
        
        // Haladó információk frissítése
        document.getElementById('shared-id-info').querySelector('strong').textContent = SHARED_UID;
        document.getElementById('user-id-info').querySelector('strong').textContent = actualUserId;

        loadThemeColor();
        startFirestoreListeners();
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app-content-container').style.display = 'block';
        
        // Kezdeti megjelenítés a 'media' fülön és a 'joint' alkategórián
        showMainTab('media');

    } catch (error) {
        console.error("Azonosítási hiba:", error);
        document.getElementById('shared-id-info').querySelector('strong').textContent = "HIBA: Ellenőrizze a konzolt!";
        document.getElementById('user-id-info').querySelector('strong').textContent = `Auth hiba: ${error.message}`;
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app-content-container').style.display = 'block';
    }
}

// === 4. FIREBASE ADAT BETÖLTÉSE ÉS FIGYELÉSE ===

function startFirestoreListeners() {
    // Media lista figyelése
    onSnapshot(getMediaCollectionRef(), (snapshot) => {
        trackerList = snapshot.docs.map(doc => ({
            firestoreId: doc.id,
            // Biztosítjuk, hogy legyen alapértelmezett kategória, ha hiányzik a régi elemekről
            category: doc.data().category || 'joint', 
            // Biztosítjuk, hogy legyen notes mező, ha hiányzik a régi elemekről
            notes: doc.data().notes || '', 
            // Biztosítjuk, hogy legyen previousCategory mező, ha hiányzik
            previousCategory: doc.data().previousCategory || null,
            ...doc.data()
        }));
        renderLists(); // Frissítés az összes média fülön
    }, (error) => {
        console.error("Hiba a media lista lekérésekor: ", error);
    });

    // Játék lista figyelése
    onSnapshot(getGameCollectionRef(), (snapshot) => {
        gameList = snapshot.docs.map(doc => ({
            firestoreId: doc.id,
            ...doc.data()
        }));
        renderGameLists();
    }, (error) => {
        console.error("Hiba a játék lista lekérésekor: ", error);
    });
}

// === 5. MEDIA CRUD FUNKCIÓK ===

window.addNewItem = async function() {
    const cim = document.getElementById('cim-input').value.trim();
    const tipus = document.getElementById('tipus-select').value;
    const maxEpizodInput = document.getElementById('max-epizod-input').value;
    const linkInput = document.getElementById('link-input').value.trim();
    
    if (cim === "") { return; }
    
    // Hozzáadjuk az aktuális alkategóriát és a Megjegyzések mezőt
    const newItem = {
        cim: cim,
        tipus: tipus,
        statusz: "nézendő",
        watchedEpisodes: (tipus === 'sorozat' ? 0 : null),
        maxEpisodes: (tipus === 'sorozat' && maxEpizodInput ? parseInt(maxEpizodInput) : null),
        link: (linkInput || null),
        category: currentCategory, // Aktuális kategória hozzáadva
        notes: "", // Új megjegyzés mező inicializálása üres stringgel
        previousCategory: null // Új mező a visszaküldéshez
    };

    try {
        await addDoc(getMediaCollectionRef(), newItem); 
    } catch (e) {
        console.error("Kritikus hiba az elem hozzáadásakor: ", e);
    }
    
    document.getElementById('cim-input').value = '';
    document.getElementById('max-epizod-input').value = '';
    document.getElementById('link-input').value = '';
}

window.deleteItem = async function(firestoreId) {
    try {
        await deleteDoc(doc(getMediaCollectionRef(), firestoreId));
    } catch (e) {
        console.error("Hiba az elem törlésekor: ", e);
    }
}

window.updateStatus = async function(firestoreId, newStatus) {
    try {
        await updateDoc(doc(getMediaCollectionRef(), firestoreId), {
            statusz: newStatus
        });
    } catch (e) {
        console.error("Hiba a státusz frissítésekor: ", e);
    }
}

// Elem áthelyezése a "Közös nézés" kategóriába
window.sendToJoint = async function(firestoreId) {
    const item = trackerList.find(i => i.firestoreId === firestoreId);
    if (!item) return;
    
    if (item.category === 'joint') return; 

    try {
        await updateDoc(doc(getMediaCollectionRef(), firestoreId), {
            category: 'joint',
            // Mentjük az előző kategóriát
            previousCategory: item.category 
        });
    } catch (e) {
        console.error("Hiba az elem közös listára küldésekor: ", e);
    }
}

// Elem visszaküldése az eredeti kategóriába
window.sendBackFromJoint = async function(firestoreId) {
    const item = trackerList.find(i => i.firestoreId === firestoreId);
    if (!item || item.category !== 'joint' || !item.previousCategory) return;
    
    const originalCategory = item.previousCategory;
    
    try {
        // Visszaállítás az eredeti kategóriára és a previousCategory mező törlése
        await updateDoc(doc(getMediaCollectionRef(), firestoreId), {
            category: originalCategory,
            previousCategory: deleteField() 
        });
    } catch (e) {
        console.error("Hiba az elem visszaküldésekor: ", e);
    }
}


window.changeEpisodeCount = async function(firestoreId, delta) {
    const item = trackerList.find(item => item.firestoreId === firestoreId);
    
    if (item && item.tipus === 'sorozat') {
        let newCount = item.watchedEpisodes + delta;
        newCount = Math.max(0, newCount);
        if (item.maxEpisodes !== null && item.maxEpisodes > 0) {
            newCount = Math.min(newCount, item.maxEpisodes);
        }
        let newStatus = item.statusz;
        if (item.maxEpisodes !== null && item.maxEpisodes > 0 && newCount === item.maxEpisodes) {
            newStatus = 'megnézve';
        } else if (newStatus === 'megnézve' && newCount < item.maxEpisodes) {
             newStatus = 'nézendő'; 
        }

        try {
            await updateDoc(doc(getMediaCollectionRef(), firestoreId), {
                watchedEpisodes: newCount,
                statusz: newStatus
            });
        } catch (e) {
            console.error("Hiba az epizód frissítésekor: ", e);
        }
    }
}

// === CÍM, LINK, MAX EPIZÓD ÉS MEGJEGYZÉS SZERKESZTÉSI LOGIKA ===

window.saveMediaItem = async function(firestoreId) {
    const titleInput = document.getElementById(`title-edit-${firestoreId}`);
    const linkInput = document.getElementById(`link-edit-${firestoreId}`);
    const maxEpInput = document.getElementById(`max-episode-edit-${firestoreId}`); 
    const notesTextarea = document.getElementById(`notes-edit-${firestoreId}`); 
    
    const newTitle = titleInput ? titleInput.value.trim() : null;
    const newLink = linkInput ? linkInput.value.trim() : null;
    const newMaxEpisodes = maxEpInput ? parseInt(maxEpInput.value) : null; 
    const newNotes = notesTextarea ? notesTextarea.value : null;

    if (!firestoreId || !titleInput) { return; }

    if (!newTitle || newTitle === "") { 
        // Cím üres, visszatérünk a normál nézethez
        toggleEditMode(firestoreId); 
        return; 
    }
    
    const updateData = {
        cim: newTitle,
        link: newLink || null, 
        notes: newNotes || "" 
    };

    const currentItem = trackerList.find(item => item.firestoreId === firestoreId);

    if (currentItem && currentItem.tipus === 'sorozat') {
         updateData.maxEpisodes = newMaxEpisodes && newMaxEpisodes > 0 ? newMaxEpisodes : null;
         
         if (updateData.maxEpisodes && currentItem.watchedEpisodes >= updateData.maxEpisodes) {
             updateData.statusz = 'megnézve';
         } else if (currentItem.statusz === 'megnézve' && currentItem.watchedEpisodes < (updateData.maxEpisodes || 0)) {
             updateData.statusz = 'nézendő';
         }
    }
    
    try {
        await updateDoc(doc(getMediaCollectionRef(), firestoreId), updateData);
    } catch (e) {
        console.error("Hiba az elem frissítésekor: ", e);
    }
}

window.toggleEditMode = function(firestoreId) {
    // Cím mezők
    const titleDisplay = document.getElementById(`title-display-${firestoreId}`);
    const titleInput = document.getElementById(`title-edit-${firestoreId}`);
    
    // Link mezők
    const linkDisplay = document.getElementById(`link-display-${firestoreId}`);
    const linkInput = document.getElementById(`link-edit-${firestoreId}`);
    
    // Max epizód mező (Csak input)
    const maxEpInput = document.getElementById(`max-episode-edit-${firestoreId}`);

    // Megjegyzés mezők
    const notesDisplay = document.getElementById(`notes-display-${firestoreId}`);
    const notesTextarea = document.getElementById(`notes-edit-${firestoreId}`);
    
    // Gombok
    const sendBtn = document.getElementById(`send-btn-${firestoreId}`);
    const backBtn = document.getElementById(`back-btn-${firestoreId}`); 
    const editBtn = document.getElementById(`edit-btn-${firestoreId}`);
    const saveBtn = document.getElementById(`save-btn-${firestoreId}`);
    const cancelBtn = document.getElementById(`cancel-btn-${firestoreId}`);
    // Törlés gomb
    const deleteBtn = document.getElementById(`delete-btn-${firestoreId}`); 
    
    if (!titleDisplay || !titleInput || !editBtn || !saveBtn || !cancelBtn) { return; } 

    const isEditing = titleDisplay.style.display === 'none';
    const currentItem = trackerList.find(item => item.firestoreId === firestoreId);

    if (!isEditing) {
        // Szerkesztési mód bekapcsolása
        titleDisplay.style.display = 'none';
        titleInput.style.display = 'inline-block';
        
        if (linkDisplay) linkDisplay.style.display = 'none'; 
        if (linkInput) linkInput.style.display = 'inline-block';
        
        if (currentItem.tipus === 'sorozat') {
            if (maxEpInput) maxEpInput.style.display = 'inline-block';
        }

        if (notesDisplay) notesDisplay.style.display = 'none';
        if (notesTextarea) {
            notesTextarea.style.display = 'block';
            notesTextarea.value = currentItem.notes || ''; 
        }
        
        titleInput.value = currentItem.cim; 
        if (linkInput) linkInput.value = currentItem.link || ''; 
        if (maxEpInput) maxEpInput.value = currentItem.maxEpisodes || ''; 
        
        if (sendBtn) sendBtn.style.display = 'none'; // Rejtett Send
        if (backBtn) backBtn.style.display = 'none'; // Rejtett Back
        editBtn.style.display = 'none'; // Rejtett Edit
        saveBtn.style.display = 'block'; // Látható Save
        cancelBtn.style.display = 'block'; // Látható Cancel
        if (deleteBtn) deleteBtn.style.display = 'none'; // Rejtett Törlés
        
        titleInput.focus();
        const len = titleInput.value.length;
        titleInput.setSelectionRange(len, len); 
    } else {
        // Szerkesztési mód kikapcsolása (Mégse/Mentés után)
        titleDisplay.style.display = 'inline-block';
        titleInput.style.display = 'none';
        
        if (linkDisplay) linkDisplay.style.display = 'block'; 
        if (linkInput) linkInput.style.display = 'none';
        
        if (currentItem.tipus === 'sorozat') {
            if (maxEpInput) maxEpInput.style.display = 'none';
        }

        if (notesDisplay) notesDisplay.style.display = 'block'; 
        if (notesTextarea) notesTextarea.style.display = 'none';
        
        // Visszamutatjuk a SEND/BACK gombot, ha a DOM-ban van
        if (sendBtn && currentItem.category !== 'joint') sendBtn.style.display = 'block'; 
        if (backBtn && currentItem.category === 'joint' && currentItem.previousCategory) backBtn.style.display = 'block'; 

        editBtn.style.display = 'block'; // Mutat Edit
        saveBtn.style.display = 'none'; // Rejtett Save
        cancelBtn.style.display = 'none'; // Rejtett Cancel
        if (deleteBtn) deleteBtn.style.display = 'block'; // Mutat Törlés
    }
}

// === 6. JÁTÉK CRUD FUNKCIÓK ===

window.addNewGame = async function() {
    const cim = document.getElementById('game-cim-input').value.trim();
    const platform = document.getElementById('game-platform-select').value;
    
    if (cim === "") { return; }

    const newItem = {
        cim: cim,
        platform: platform,
        statusz: "játszandó" 
    };
    
    try {
        await addDoc(getGameCollectionRef(), newItem);
    } catch (e) {
        console.error("Hiba a játék hozzáadásakor: ", e);
    }
    document.getElementById('game-cim-input').value = ''; 
}

window.updateGameStatus = async function(firestoreId, newStatus) {
    try {
        await updateDoc(doc(getGameCollectionRef(), firestoreId), {
            statusz: newStatus
        });
    } catch (e) {
        console.error("Hiba a játék státusz frissítésekor: ", e);
    }
}

window.deleteGameItem = async function(firestoreId) {
    try {
        await deleteDoc(doc(getGameCollectionRef(), firestoreId));
    } catch (e) {
        console.error("Hiba a játék törlésekor: ", e);
    }
}


// --- Segédfüggvények ---

// Fő fülek váltása (Filmek & Sorozatok vs. Játékok)
window.showMainTab = function(tabName) {
    const mediaContent = document.getElementById('media-content');
    const gameContent = document.getElementById('game-tracker-content');
    const subTabs = document.getElementById('media-sub-tabs');
    
    // Fő tabok stílusának frissítése
    document.getElementById('media-main-tab').classList.remove('active-main-tab');
    document.getElementById('game-main-tab').classList.remove('active-main-tab');
    document.getElementById(tabName + '-main-tab').classList.add('active-main-tab');

    if (tabName === 'media') {
        mediaContent.style.display = 'block';
        gameContent.style.display = 'none';
        subTabs.style.display = 'flex'; 
        
        showSubTab(currentCategory); 
    } else {
        mediaContent.style.display = 'none';
        gameContent.style.display = 'block';
        subTabs.style.display = 'none';
    }
}

// Alkategóriák váltása
window.showSubTab = function(category) {
    currentCategory = category;
    const titleElement = document.getElementById('media-category-title');

    // Alkategória stílusának frissítése
    CATEGORIES.forEach(cat => {
        const btn = document.getElementById(cat + '-sub-tab');
        if (btn) btn.classList.remove('active-sub-tab');
    });
    document.getElementById(category + '-sub-tab').classList.add('active-sub-tab');
    
    // Cím frissítése
    titleElement.textContent = CATEGORY_MAP[category];
    
    renderLists(); 
}


window.changeThemeColor = function(newColor) {
    document.documentElement.style.setProperty('--theme-color', newColor);
    localStorage.setItem(THEME_COLOR_KEY, newColor);
}

function loadThemeColor() {
    const savedColor = localStorage.getItem(THEME_COLOR_KEY) || DEFAULT_COLOR;
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) colorPicker.value = savedColor;
    changeThemeColor(savedColor);
}

window.toggleMaxEpisodeInput = function() {
    const type = document.getElementById('tipus-select').value;
    const maxInput = document.getElementById('max-epizod-input');
    maxInput.style.display = (type === 'sorozat' ? 'block' : 'none');
    if (type === 'film') { maxInput.value = ''; }
}

// Lista megjelenítése (MÉDIA)
window.renderLists = function() { 
    const nezendoUl = document.getElementById('nezendo-lista');
    const megnezveUl = document.getElementById('megnezve-lista');
    if (!nezendoUl || !megnezveUl) return;
    nezendoUl.innerHTML = '';
    megnezveUl.innerHTML = '';
    
    // Keresőmező értékének lekérése és normalizálása
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();

    // 1. Szűrés az aktuális kategóriára
    let filteredList = trackerList.filter(item => item.category === currentCategory);
    
    // 2. Szűrés a keresési feltételre
    if (searchTerm.length > 0) {
        filteredList = filteredList.filter(item => 
            item.cim.toLowerCase().includes(searchTerm)
        );
    }

    // JAVÍTÁS: 3. Rendezés ABC sorrendbe cím alapján
    // 'hu' locale-lel a magyar ábécé szerinti sorrendhez
    filteredList.sort((a, b) => a.cim.localeCompare(b.cim, 'hu', { sensitivity: 'base' }));


    const isJointCategory = currentCategory === 'joint';

    filteredList.forEach(item => {
        const li = document.createElement('li');
        li.className = `tracker-item ${item.statusz === 'megnézve' ? 'watched' : ''}`;
        
        // --- BAL OLDALI TARTALOM (Cím, Link, Max epizód input) ---
        const itemDetails = document.createElement('div');
        itemDetails.className = 'item-details';
        
        // Cím konténer: megjelenített szöveg + rejtett input mező
        const titleContainer = document.createElement('div');
        titleContainer.className = 'item-title-container';
        
        // 1. Cím Megjelenítés és Szerkesztés
        const titleDisplay = document.createElement('strong');
        titleDisplay.id = `title-display-${item.firestoreId}`;
        titleDisplay.textContent = item.cim;
        titleDisplay.style.display = 'inline-block'; 
        titleDisplay.style.marginRight = '5px'; 
        

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.id = `title-edit-${item.firestoreId}`;
        titleInput.value = item.cim;
        titleInput.className = 'title-edit-input';
        titleInput.style.display = 'none'; 
        titleInput.onkeypress = (e) => { 
            if(e.key === 'Enter') {
                saveMediaItem(item.firestoreId); 
            } 
        };

        // 2. Link Megjelenítés és Szerkesztés
        const linkHtmlDisplay = item.link 
            ? `<a id="link-display-${item.firestoreId}" href="${item.link}" target="_blank">Link 🔗</a>` 
            : `<span id="link-display-${item.firestoreId}" style="color: #aaa;">Nincs link</span>`;

        const linkInput = document.createElement('input');
        linkInput.type = 'url';
        linkInput.id = `link-edit-${item.firestoreId}`;
        linkInput.value = item.link || '';
        linkInput.className = 'link-edit-input';
        linkInput.style.display = 'none'; 
        linkInput.placeholder = 'Link (pl.: IMDb)';
        
        // 3. Max Epizód Szerkesztés INPUT (Csak sorozatnál)
        if (item.tipus === 'sorozat') {
            const maxEpInput = document.createElement('input');
            maxEpInput.type = 'number';
            maxEpInput.id = `max-episode-edit-${item.firestoreId}`;
            maxEpInput.value = item.maxEpisodes || '';
            maxEpInput.className = 'max-episode-edit-input';
            maxEpInput.style.display = 'none'; 
            maxEpInput.placeholder = 'Max epizód';
            itemDetails.appendChild(maxEpInput);
        }
        
        titleContainer.appendChild(titleDisplay);
        titleContainer.appendChild(titleInput);

        itemDetails.appendChild(titleContainer);
        itemDetails.innerHTML += `<span>(${item.tipus === 'sorozat' ? 'Sorozat' : 'Film'})</span>`;
        
        // Link megjelenítő, utána a link szerkesztő
        itemDetails.innerHTML += linkHtmlDisplay;
        itemDetails.appendChild(linkInput);
        
        li.appendChild(itemDetails);

        // --- JOBB OLDALI TARTALOM (Vezérlők) ---            
        const controls = document.createElement('div');
        controls.className = 'item-controls';
        
        // Hozzáadunk egy sort az epizód, státusz és törlés gomboknak
        const controlsRow = document.createElement('div');
        controlsRow.className = 'controls-row';

        // Epizód vezérlés (4/20 formátum)
        if (item.tipus === 'sorozat') {
            const episodeControls = document.createElement('div');
            episodeControls.className = 'episode-controls';
            
            const watched = item.watchedEpisodes !== null && item.watchedEpisodes !== undefined ? item.watchedEpisodes : 0;
            const max = item.maxEpisodes !== null && item.maxEpisodes !== undefined ? item.maxEpisodes : '?';
            const episodeProgress = (max !== '?') ? `/${max}` : '';
            
            // Következő epizód számítása
            const nextEpisode = watched + 1;
            
            episodeControls.innerHTML = `
                <span style="font-weight: 600;">Következő epizód: <span style="color: var(--theme-color); font-size: 1.1em;">${nextEpisode}</span></span>
                <span style="margin-left: 10px;">Epizódok: <strong>${watched}${episodeProgress}</strong></span>
                <button onclick="changeEpisodeCount('${item.firestoreId}', -1)">-</button>
                <button onclick="changeEpisodeCount('${item.firestoreId}', 1)">+</button>
            `;
            controlsRow.appendChild(episodeControls);
        }
        
        // Státusz váltó gomb (marad a controlsRow-ban)
        if (item.statusz === 'nézendő') {
            const button = document.createElement('button');
            button.textContent = 'Megnéztem';
            button.onclick = () => updateStatus(item.firestoreId, 'megnézve');
            controlsRow.appendChild(button);
        } else {
            const button = document.createElement('button');
            button.textContent = 'Mégse láttam';
            button.onclick = () => updateStatus(item.firestoreId, 'nézendő');
            controlsRow.appendChild(button);
        }
        
        // Törlés gomb (Vissza a sorba, a fix szélességű stílussal)
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Törlés 🗑️';
        deleteBtn.id = `delete-btn-${item.firestoreId}`;
        deleteBtn.className = 'delete-button-matched'; 
        deleteBtn.onclick = () => deleteItem(item.firestoreId);
        controlsRow.appendChild(deleteBtn);

        controls.appendChild(controlsRow); // Hozzáadjuk a sort

        // 4. Szerkesztő Gombok (Send/Back, Edit, Save, Cancel) - FIX SZÉLESSÉGBEN STACKELVE A SOR ALATT
        
        
        if (!isJointCategory) {
            // Send gomb (csak ha nem 'joint' kategóriában van)
            const sendButton = document.createElement('button');
            sendButton.textContent = '➡️ Send'; 
            sendButton.id = `send-btn-${item.firestoreId}`;
            sendButton.className = 'title-action-btn'; 
            sendButton.title = 'Átküldés Közös nézés listára';
            sendButton.onclick = () => sendToJoint(item.firestoreId);
            controls.appendChild(sendButton);
        } else if (isJointCategory && item.previousCategory) {
            // Back gomb (csak ha 'joint' kategóriában van és van honnan visszamenni)
            const backButton = document.createElement('button');
            backButton.textContent = '⬅️ Back'; 
            backButton.id = `back-btn-${item.firestoreId}`;
            backButton.className = 'title-action-btn'; 
            backButton.title = 'Visszaküldés az eredeti listára';
            backButton.onclick = () => sendBackFromJoint(item.firestoreId);
            controls.appendChild(backButton);
        }


        const editButton = document.createElement('button');
        editButton.textContent = 'Edit'; 
        editButton.id = `edit-btn-${item.firestoreId}`;
        editButton.className = 'title-action-btn edit-button';
        editButton.title = 'Adatok szerkesztése';
        editButton.setAttribute('data-action', 'edit-media');
        editButton.setAttribute('data-id', item.firestoreId);
        controls.appendChild(editButton);

        const saveButton = document.createElement('button');
        saveButton.textContent = '✅ Mentés'; 
        saveButton.id = `save-btn-${item.firestoreId}`;
        saveButton.className = 'title-action-btn save-button';
        saveButton.style.display = 'none'; 
        saveButton.title = 'Adatok mentése';
        saveButton.setAttribute('data-action', 'save-media'); 
        saveButton.setAttribute('data-id', item.firestoreId);
        controls.appendChild(saveButton); 

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '❌ Mégse'; 
        cancelButton.id = `cancel-btn-${item.firestoreId}`;
        cancelButton.className = 'title-action-btn cancel-button';
        cancelButton.style.display = 'none'; 
        cancelButton.title = 'Szerkesztés megszakítása';
        cancelButton.setAttribute('data-action', 'cancel-media'); 
        cancelButton.setAttribute('data-id', item.firestoreId);
        controls.appendChild(cancelButton); 
        
        li.appendChild(controls);

        // --- MEGJEGYZÉSEK SZEKCIÓ ---
        const notesContainer = document.createElement('div');
        notesContainer.className = 'notes-container';
        notesContainer.innerHTML = `<span class="notes-label">Megjegyzések:</span>`;

        // Megjegyzés megjelenítő DIV
        const notesDisplay = document.createElement('div');
        notesDisplay.id = `notes-display-${item.firestoreId}`;
        notesDisplay.textContent = item.notes || 'Nincs megjegyzés.';
        notesDisplay.style.display = 'block'; 
        notesDisplay.className = 'notes-display-area';
        notesContainer.appendChild(notesDisplay);

        // Megjegyzés szerkesztő TEXTAREA
        const notesTextarea = document.createElement('textarea');
        notesTextarea.id = `notes-edit-${item.firestoreId}`;
        notesTextarea.className = 'notes-textarea';
        notesTextarea.style.display = 'none';
        notesContainer.appendChild(notesTextarea);
        
        li.appendChild(notesContainer);
        // --- MEGJEGYZÉSEK SZEKCIÓ VÉGE ---

        
        if (item.statusz === 'nézendő') {
            nezendoUl.appendChild(li);
        } else {
            megnezveUl.appendChild(li);
        }
    });
}

// Lista megjelenítése (JÁTÉK) - Keresési logikával kiegészítve
window.renderGameLists = function() {
    const nezendoUl = document.getElementById('game-nezendo-lista');
    const megnezveUl = document.getElementById('game-megnezve-lista');
    if (!nezendoUl || !megnezveUl) return; 
    nezendoUl.innerHTML = '';
    megnezveUl.innerHTML = '';
    
    // Keresőmező értékének lekérése és normalizálása
    const searchTerm = document.getElementById('game-search-input').value.toLowerCase().trim();

    let filteredList = gameList;
    
    // 1. Szűrés a keresési feltételre
    if (searchTerm.length > 0) {
        filteredList = filteredList.filter(item => 
            item.cim.toLowerCase().includes(searchTerm)
        );
    }

    // JAVÍTÁS: 2. Rendezés ABC sorrendbe cím alapján
    filteredList.sort((a, b) => a.cim.localeCompare(b.cim, 'hu', { sensitivity: 'base' }));


    filteredList.forEach(item => {
        const li = document.createElement('li');
        li.className = `tracker-item ${item.statusz === 'kijátszottam' ? 'watched' : ''}`;
        
        const itemDetails = document.createElement('div');
        itemDetails.className = 'item-details';
        itemDetails.innerHTML = `<strong>${item.cim}</strong><span>(${item.platform})</span>`;
        li.appendChild(itemDetails);
        
        const controls = document.createElement('div');
        controls.className = 'item-controls';
        
        // Státusz gomb a controlsRow-ban (mivel itt nincs epizód, csak a státusz gomb)
        const controlsRow = document.createElement('div');
        controlsRow.className = 'controls-row';

        if (item.statusz === 'játszandó') {
            const button = document.createElement('button');
            button.textContent = 'Kijátszottam';
            button.onclick = () => updateGameStatus(item.firestoreId, 'kijátszottam');
            controlsRow.appendChild(button);
        } else {
            const button = document.createElement('button');
            button.textContent = 'Mégse játszottam';
            button.onclick = () => updateGameStatus(item.firestoreId, 'játszandó');
            controlsRow.appendChild(button);
        }
        
        // Törlés gomb (vissza a sorba, a fix szélességű stílussal)
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Törlés 🗑️';
        deleteBtn.className = 'delete-button-matched'; 
        deleteBtn.onclick = () => deleteGameItem(item.firestoreId);
        controlsRow.appendChild(deleteBtn);

        controls.appendChild(controlsRow);
        
        li.appendChild(controls);
        
        if (item.statusz === 'játszandó') {
            nezendoUl.appendChild(li);
        } else {
            megnezveUl.appendChild(li);
        }
    });
}

// === ESZEMÉNY DELEGÁCIÓ A DINAMIKUS GOMBOKHOZ ===
document.addEventListener('click', function(event) {
    const target = event.target;
    const firestoreId = target.getAttribute('data-id');
    
    // Média Elem Szerkesztés / Mentés / Mégse (Cím, Link, Max Ep, Megjegyzés)
    if (target.matches('[data-action="edit-media"]')) {
        toggleEditMode(firestoreId);
    }
    
    if (target.matches('[data-action="save-media"]')) {
         if (firestoreId) saveMediaItem(firestoreId);
    }

    if (target.matches('[data-action="cancel-media"]')) {
         if (firestoreId) toggleEditMode(firestoreId);
    }
});


// Alkalmazás indítása
window.onload = () => {
    toggleMaxEpisodeInput();
    checkInitialAccess(); 
};
