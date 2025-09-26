// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCuSqCJgYelx_R74W81LGaqvadY_vEXwQA",
  authDomain: "fc-budget-planner.firebaseapp.com",
  projectId: "fc-budget-planner",
  storageBucket: "fc-budget-planner.appspot.com",
  messagingSenderId: "1067067218806",
  appId: "1:1067067218806:web:59f36bb006e02276d8b857"
};

// Importa le funzioni necessarie dagli SDK di Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getFirestore, collection, getDocs, getDoc, doc, addDoc, setDoc, deleteDoc, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- VARIABILI GLOBALI ---
let isReadyForSaving = false;
let currentQuoteId = null;
let selectedQuoteToLoad = null;

const defaultState = {
    mainInputs: { progetto: 'Nuovo Progetto', allievi: '10', ore: '80', ucs: '23,99' },
    tables: {
        gestione: [], realizzazione: [], docenze: [],
        commerciale: [{ percent_p1: '10,00', note_p1: 'Sul ricavo totale', percent_p2: '5,00', note_p2: 'Sul ricavo totale' }]
    }
};

// --- GESTIONE DATI CON FIRESTORE ---
const dataManager = {
    saveQuote: async (stateData) => {
        try {
            if (currentQuoteId) {
                const quoteRef = doc(db, "quotes", currentQuoteId);
                await setDoc(quoteRef, { ...stateData, updatedAt: new Date() }, { merge: true });
            } else {
                const docRef = await addDoc(collection(db, "quotes"), { ...stateData, createdAt: new Date(), updatedAt: new Date() });
                currentQuoteId = docRef.id;
            }
            return true;
        } catch (error) {
            console.error("Errore nel salvataggio del preventivo:", error);
            return false;
        }
    },

    findQuotesByName: async (projectName) => {
        try {
            const q = query(
                collection(db, "quotes"),
                where("mainInputs.progetto", ">=", projectName),
                where("mainInputs.progetto", "<=", projectName + '\uf8ff')
            );
            const querySnapshot = await getDocs(q);
            const quotes = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
                    data.updatedAt = data.updatedAt.toDate();
                }
                quotes.push({ id: doc.id, ...data });
            });

            const latestQuotesMap = new Map();
            quotes.forEach(quote => {
                const name = quote.mainInputs.progetto;
                if (quote.updatedAt && (!latestQuotesMap.has(name) || quote.updatedAt > latestQuotesMap.get(name).updatedAt)) {
                    latestQuotesMap.set(name, quote);
                }
            });
            return Array.from(latestQuotesMap.values());
        } catch (error) {
            console.error("Errore durante la ricerca dei preventivi:", error);
            alert("Si è verificato un errore durante la ricerca. Controlla la console del browser (tasto F12) per i dettagli. Potrebbe essere necessario creare un indice in Firestore.");
            return [];
        }
    },
    
    getSecurityData: async () => {
        const docRef = doc(db, "security", "passwords");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            await setDoc(docRef, { masterPassword: 'fracassa' });
            return { masterPassword: 'fracassa' };
        }
    },
    
    saveSecurityData: async (passwordsObject) => {
        const docRef = doc(db, "security", "passwords");
        await setDoc(docRef, passwordsObject); 
    },

    getAllProjectNames: async () => {
        const q = query(collection(db, "quotes"));
        const querySnapshot = await getDocs(q);
        const names = new Set();
        querySnapshot.forEach(doc => {
            const projectName = doc.data()?.mainInputs?.progetto;
            if (projectName) {
                names.add(projectName);
            }
        });
        return Array.from(names).sort();
    },
    
    renameProject: async (oldName, newName) => {
        const q = query(collection(db, "quotes"), where("mainInputs.progetto", "==", oldName));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach(document => {
            const docRef = doc(db, "quotes", document.id);
            batch.update(docRef, { "mainInputs.progetto": newName, updatedAt: new Date() });
        });
        await batch.commit();
        
        const securityData = await dataManager.getSecurityData();
        if(securityData[oldName] !== undefined) {
            securityData[newName] = securityData[oldName];
            delete securityData[oldName];
            await dataManager.saveSecurityData(securityData);
        }
    },

    deleteProject: async (projectName) => {
        const q = query(collection(db, "quotes"), where("mainInputs.progetto", "==", projectName));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach(document => {
            batch.delete(doc(db, "quotes", document.id));
        });
        await batch.commit();
        
        const securityData = await dataManager.getSecurityData();
        if(securityData[projectName] !== undefined) {
            delete securityData[projectName];
            await dataManager.saveSecurityData(securityData);
        }
    }
};

// --- FUNZIONI DI UI E LOGICA ---

const addRow = (sectionId, item = null) => {
    isReadyForSaving = true;
    const table = document.querySelector(`table[data-section="${sectionId}"]`);
    const tbody = table.querySelector('tbody');
    const newRow = document.createElement('tr');
    newRow.classList.add('cost-row');
    let template = '';
    if (sectionId === 'gestione') {
        const voce = item ? item.voce : 'Nuova Voce';
        const costo = item ? String(item.costo).replace('.',',') : '0,00';
        const quantita = item ? item.quantita : '1';
        const note = item ? item.note : '';
        template = `<td class="p-2"><input type="text" class="table-input" data-field="voce" value="${voce}"></td><td class="p-2"><input type="text" class="table-input cost-unitario" data-field="costo" value="${costo}"></td><td class="p-2"><input type="text" class="table-input quantita" data-field="quantita" value="${quantita}"></td><td class="p-2"><input type="text" class="table-input" data-field="note" value="${note}"></td><td class="p-2 text-right output-cell">€ 0,00</td><td class="p-2 text-center"><button class="delete-row-btn" onclick="deleteRow(this)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>`;
    } else if (sectionId === 'realizzazione') {
        const voce = item ? item.voce : 'Nuova Voce';
        const costo = item ? String(item.costo).replace('.',',') : '0,00';
        const quantita = item ? item.quantita : '1';
        const partner = item ? item.partner : false;
        const azienda = item ? item.azienda : false;
        template = `<td class="p-2"><input type="text" class="table-input" data-field="voce" value="${voce}"></td><td class="p-2"><input type="text" class="table-input cost-unitario" data-field="costo" value="${costo}"></td><td class="p-2"><input type="text" class="table-input quantita" data-field="quantita" value="${quantita}"></td><td class="p-2 text-right output-cell">€ 0,00</td><td class="p-2 text-center align-middle"><input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 realization-checkbox" data-field="partner" ${partner ? 'checked' : ''}></td><td class="p-2 text-center align-middle"><input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 azienda-checkbox" data-field="azienda" ${azienda ? 'checked' : ''}></td><td class="p-2 text-center"><button class="delete-row-btn" onclick="deleteRow(this)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>`;
    } else {
        const voce = item ? item.voce : 'Nuova Voce';
        const costo = item ? String(item.costo).replace('.',',') : '0,00';
        const quantita = item ? item.quantita : '1';
        const partner = item ? item.partner : false;
        const azienda = item ? item.azienda : false;
        template = `<td class="p-2"><input type="text" class="table-input" data-field="voce" value="${voce}"></td><td class="p-2"><input type="text" class="table-input cost-unitario" data-field="costo" value="${costo}"></td><td class="p-2"><input type="text" class="table-input quantita" data-field="quantita" value="${quantita}"></td><td class="p-2 text-right output-cell">€ 0,00</td><td class="p-2 text-center align-middle"><input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 docente-checkbox" data-field="partner" ${partner ? 'checked' : ''}></td><td class="p-2 text-center align-middle"><input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 azienda-checkbox" data-field="azienda" ${azienda ? 'checked' : ''}></td><td class="p-2 text-center"><button class="delete-row-btn" onclick="deleteRow(this)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>`;
    }
    newRow.innerHTML = template;
    tbody.appendChild(newRow);
    calculateAll();
    debouncedSave();
};
window.addRow = addRow; 

const deleteRow = (button) => { isReadyForSaving = true; const row = button.closest('tr'); row.remove(); calculateAll(); debouncedSave(); };
window.deleteRow = deleteRow;

const parseLocalFloat = (str) => { if (typeof str !== 'string' && typeof str !== 'number') return 0; return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0; }
const calculateAll = () => {
    const formatCurrency = (value) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
    const allievi = parseLocalFloat(document.getElementById('input-allievi').value);
    const ore = parseLocalFloat(document.getElementById('input-ore').value);
    const ucs = parseLocalFloat(document.getElementById('input-ucs').value);
    const ricavoTotale = allievi * ore * ucs;
    document.getElementById('summary-ricavo').textContent = formatCurrency(ricavoTotale);
    document.getElementById('compressed-summary-ricavo').textContent = formatCurrency(ricavoTotale);

    let costoTotaleProgetto = 0, costoAziendaTotale = 0, docenzePartner2Total = 0, realizzazionePartner1Total = 0, costoEsternoTotale = 0, gestioneTotal = 0;
    ['gestione', 'realizzazione', 'docenze'].forEach(sectionId => {
        let sectionTotal = 0;
        document.querySelectorAll(`table[data-section="${sectionId}"] tbody .cost-row`).forEach(row => {
            const costoUnitario = parseLocalFloat(row.querySelector('.cost-unitario').value);
            const quantita = parseLocalFloat(row.querySelector('.quantita').value);
            const subtotal = costoUnitario * quantita;
            row.querySelector('.output-cell').textContent = formatCurrency(subtotal);
            sectionTotal += subtotal;
            const isPartner = row.querySelector('[data-field=partner]')?.checked || false;
            const isAzienda = row.querySelector('[data-field=azienda]')?.checked || false;
            if (isAzienda) costoAziendaTotale += subtotal;
            if(sectionId === 'docenze' && isPartner) docenzePartner2Total += subtotal;
            if(sectionId === 'realizzazione' && isPartner) realizzazionePartner1Total += subtotal;
            if (sectionId !== 'gestione' && !isPartner && !isAzienda) costoEsternoTotale += subtotal;
        });
        if (sectionId === 'gestione') gestioneTotal = sectionTotal;
        document.getElementById(`total-${sectionId}`).textContent = formatCurrency(sectionTotal);
        costoTotaleProgetto += sectionTotal;
    });
    const percentP1 = parseLocalFloat(document.querySelector('[data-field=percent_p1]').value);
    const costoCommP1 = ricavoTotale * (percentP1 / 100);
    document.getElementById('subtotal_p1').textContent = formatCurrency(costoCommP1);
    const percentP2 = parseLocalFloat(document.querySelector('[data-field=percent_p2]').value);
    const costoCommP2 = ricavoTotale * (percentP2 / 100);
    document.getElementById('subtotal_p2').textContent = formatCurrency(costoCommP2);
    const totaleCommerciale = costoCommP1 + costoCommP2;
    document.getElementById('total-commerciale').textContent = formatCurrency(totaleCommerciale);
    costoTotaleProgetto += totaleCommerciale;
    document.getElementById('summary-costo').textContent = formatCurrency(costoTotaleProgetto);
    document.getElementById('compressed-summary-costo').textContent = formatCurrency(costoTotaleProgetto);

    const costoPartnership1 = realizzazionePartner1Total + costoCommP1;
    document.getElementById('summary-partnership-1').textContent = formatCurrency(costoPartnership1);
    const costoPartnership2 = docenzePartner2Total + costoCommP2;
    document.getElementById('summary-partnership-2').textContent = formatCurrency(costoPartnership2);
    document.getElementById('summary-azienda').textContent = formatCurrency(costoAziendaTotale);
    const altriCosti = costoEsternoTotale + gestioneTotal;
    document.getElementById('summary-esterno').textContent = formatCurrency(altriCosti);

    document.getElementById('compressed-summary-partnership-1').textContent = formatCurrency(costoPartnership1);
    document.getElementById('compressed-summary-partnership-2').textContent = formatCurrency(costoPartnership2);
    document.getElementById('compressed-summary-esterno').textContent = formatCurrency(altriCosti);

    const incidenzaPartnership1 = ricavoTotale > 0 ? (costoPartnership1 / ricavoTotale) * 100 : 0;
    document.getElementById('summary-incidenza-partnership-1').textContent = `${incidenzaPartnership1.toFixed(2).replace('.', ',')} %`;
    const incidenzaPartnership2 = ricavoTotale > 0 ? (costoPartnership2 / ricavoTotale) * 100 : 0;
    document.getElementById('summary-incidenza-partnership-2').textContent = `${incidenzaPartnership2.toFixed(2).replace('.', ',')} %`;
    const altriCostiRendicontabili = (costoTotaleProgetto - costoAziendaTotale) - costoPartnership1 - costoPartnership2;
    const incidenzaAltriCosti = ricavoTotale > 0 ? (altriCostiRendicontabili / ricavoTotale) * 100 : 0;
    document.getElementById('summary-incidenza-esterni').textContent = `${incidenzaAltriCosti.toFixed(2).replace('.', ',')} %`;
    const margine = ricavoTotale - costoTotaleProgetto + costoAziendaTotale;
    const incidenzaAzienda = ricavoTotale > 0 ? (margine / ricavoTotale) * 100 : 0;
    document.getElementById('summary-incidenza-azienda').textContent = `${incidenzaAzienda.toFixed(2).replace('.', ',')} %`;
    
    const margineEl = document.getElementById('summary-margine');
    margineEl.textContent = formatCurrency(margine);
    margineEl.classList.toggle('profit', margine >= 0);
    margineEl.classList.toggle('loss', margine < 0);

    const compressedMargineEl = document.getElementById('compressed-summary-margine');
    compressedMargineEl.textContent = formatCurrency(margine);
    compressedMargineEl.classList.toggle('profit', margine >= 0);
    compressedMargineEl.classList.toggle('loss', margine < 0);
};

const populateForm = (data) => {
    ['gestione', 'realizzazione', 'docenze'].forEach(id => {
        const tbody = document.querySelector(`table[data-section="${id}"] tbody`);
        if (tbody) tbody.innerHTML = '';
    });

    document.getElementById('input-progetto').value = data.mainInputs.progetto;
    document.getElementById('input-allievi').value = data.mainInputs.allievi;
    document.getElementById('input-ore').value = data.mainInputs.ore;
    document.getElementById('input-ucs').value = String(data.mainInputs.ucs).replace('.', ',');
    
    document.querySelector('[data-field=percent_p1]').value = String(data.tables.commerciale[0].percent_p1).replace('.', ',');
    document.querySelector('[data-field=note_p1]').value = data.tables.commerciale[0].note_p1;
    document.querySelector('[data-field=percent_p2]').value = String(data.tables.commerciale[0].percent_p2).replace('.', ',');
    document.querySelector('[data-field=note_p2]').value = data.tables.commerciale[0].note_p2;
    
    if (data.tables.gestione) data.tables.gestione.forEach(item => addRow('gestione', item));
    if (data.tables.realizzazione) data.tables.realizzazione.forEach(item => addRow('realizzazione', item));
    if (data.tables.docenze) data.tables.docenze.forEach(item => addRow('docenze', item));
    
    calculateAll();
};

let debounceTimer;
const debouncedSave = () => {
    if (!isReadyForSaving) return;
    const saveStatus = document.getElementById('save-status');
    saveStatus.className = 'status-badge status-unsaved';
    saveStatus.textContent = 'Modifiche non salvate...';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        saveStatus.className = 'status-badge status-saving';
        saveStatus.textContent = 'Salvataggio...';
        
        const state = {
            mainInputs: {
                progetto: document.getElementById('input-progetto').value,
                allievi: document.getElementById('input-allievi').value,
                ore: document.getElementById('input-ore').value,
                ucs: document.getElementById('input-ucs').value,
            },
            tables: { commerciale: [{ percent_p1: document.querySelector('[data-field=percent_p1]').value, note_p1: document.querySelector('[data-field=note_p1]').value, percent_p2: document.querySelector('[data-field=percent_p2]').value, note_p2: document.querySelector('[data-field=note_p2]').value, }] }
        };
        ['gestione', 'realizzazione', 'docenze'].forEach(sectionId => {
            state.tables[sectionId] = [];
            document.querySelectorAll(`table[data-section="${sectionId}"] tbody .cost-row`).forEach(row => {
                const rowData = {};
                row.querySelectorAll('input, select').forEach(input => {
                    if (input.dataset.field) {
                        rowData[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
                    }
                });
                state.tables[sectionId].push(rowData);
            });
        });

        const success = await dataManager.saveQuote(state);
        if (success) {
            saveStatus.className = 'status-badge status-success';
            saveStatus.textContent = 'Tutte le modifiche sono state salvate.';
            loadProjectNameSuggestions();
        } else {
            saveStatus.className = 'status-badge status-error';
            saveStatus.textContent = 'Errore durante il salvataggio.';
        }
    }, 1500);
};

const loadProjectNameSuggestions = async () => {
    try {
        const projectNames = await dataManager.getAllProjectNames();
        const datalist = document.getElementById('initial-project-suggestions');
        if (datalist) {
            datalist.innerHTML = '';
            projectNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Impossibile caricare i suggerimenti dei preventivi:", error);
    }
};

const showMainContent = () => {
    document.getElementById('initial-loader').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    isReadyForSaving = true;
};

const handleDataInput = () => {
    isReadyForSaving = true;
    calculateAll();
    debouncedSave();
};

async function handleQuoteSelection(quote) {
    selectedQuoteToLoad = quote;
    const projectName = quote.mainInputs.progetto;
    const passwordModal = document.getElementById('password-modal');
    
    const security = await dataManager.getSecurityData();
    const projectPassword = security[projectName];

    if (!projectPassword) {
        loadSelectedQuote();
    } else {
        document.getElementById('password-modal-title').textContent = `Password per "${projectName}"`;
        const passwordInput = document.getElementById('password-input');
        passwordInput.value = '';
        document.getElementById('password-error').textContent = '';
        passwordModal.classList.add('open');
        passwordInput.focus();
    }
}

function loadSelectedQuote() {
    if (selectedQuoteToLoad) {
        currentQuoteId = selectedQuoteToLoad.id;
        if (selectedQuoteToLoad.updatedAt && typeof selectedQuoteToLoad.updatedAt.toDate === 'function') {
            selectedQuoteToLoad.updatedAt = selectedQuoteToLoad.updatedAt.toDate();
        }
        if (selectedQuoteToLoad.createdAt && typeof selectedQuoteToLoad.createdAt.toDate === 'function') {
            selectedQuoteToLoad.createdAt = selectedQuoteToLoad.createdAt.toDate();
        }
        populateForm(selectedQuoteToLoad);
        showMainContent();
        document.getElementById('save-status').className = 'status-badge status-success';
        document.getElementById('save-status').textContent = 'Preventivo caricato correttamente.';
        selectedQuoteToLoad = null;
    }
}

async function openAdminPanel() {
    const adminModal = document.getElementById('admin-modal');
    adminModal.classList.add('open');
    
    const projectListContainer = document.getElementById('admin-project-passwords-list');
    projectListContainer.innerHTML = '<div class="loading-dots text-center p-4"><span></span><span></span><span></span></div>';
    
    try {
        const [allNames, security] = await Promise.all([
            dataManager.getAllProjectNames(),
            dataManager.getSecurityData()
        ]);
        
        projectListContainer.innerHTML = '';

        if (allNames.length === 0) {
            projectListContainer.innerHTML = `<p class="text-gray-500 text-center">Nessun preventivo trovato nel database.</p>`;
            return;
        }

        allNames.forEach(name => {
            const currentPassword = security[name] || '';
            const projectEl = document.createElement('div');
            projectEl.className = 'flex items-center space-x-2 p-2 bg-gray-100 rounded-md';
            projectEl.innerHTML = `
                <span class="font-medium text-gray-800 flex-grow">${name}</span>
                <input type="text" class="table-input w-40" placeholder="Password" value="${currentPassword}">
                <button class="action-btn save-btn" title="Salva Password"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
                <button class="action-btn rename-btn" title="Rinomina Preventivo"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="action-btn delete-btn" title="Elimina Preventivo"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            `;

            const passwordInput = projectEl.querySelector('input');
            
            projectEl.querySelector('.save-btn').addEventListener('click', async () => {
                const newPassword = passwordInput.value.trim();
                const currentSecurity = await dataManager.getSecurityData();
                if (newPassword) {
                    currentSecurity[name] = newPassword;
                } else {
                    delete currentSecurity[name];
                }
                await dataManager.saveSecurityData(currentSecurity);
                alert(`Password per "${name}" salvata.`);
            });

            projectEl.querySelector('.rename-btn').addEventListener('click', async () => {
                const newName = prompt(`Inserisci il nuovo nome per "${name}":`, name);
                if (newName && newName.trim() !== "" && newName.trim() !== name) {
                    await dataManager.renameProject(name, newName.trim());
                    alert(`"${name}" rinominato in "${newName.trim()}".`);
                    openAdminPanel();
                }
            });

            projectEl.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm(`Sei sicuro di voler eliminare tutti i preventivi chiamati "${name}"? L'azione è irreversibile.`)) {
                    await dataManager.deleteProject(name);
                    alert(`Preventivi "${name}" eliminati.`);
                    openAdminPanel();
                }
            });

            projectListContainer.appendChild(projectEl);
        });
    } catch(error) {
        projectListContainer.innerHTML = `<p class="text-red-500 text-center">Impossibile caricare i preventivi.</p>`;
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('initial-loader-status');
    const initialLoaderBtn = document.getElementById('initial-load-btn');
    const initialLoaderInput = document.getElementById('initial-load-input');
    const createNewBtn = document.getElementById('create-new-btn');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    
    const quotesModal = document.getElementById('quotes-modal');
    const passwordModal = document.getElementById('password-modal');

    const initializeApp = async () => {
        try {
            statusEl.textContent = 'Connessione al database...';
            await dataManager.getSecurityData(); 
            statusEl.textContent = '';
            await loadProjectNameSuggestions();
            initialLoaderBtn.disabled = false;
            createNewBtn.disabled = false;
        } catch (error) {
            statusEl.innerHTML = `<p class="text-red-500">Connessione al database fallita.</p><p class="text-xs text-gray-500 mt-1">Controlla le regole di sicurezza di Firestore.</p>`;
            console.error("Errore di connessione a Firestore:", error);
        }
    };

    initialLoaderBtn.addEventListener('click', async () => {
        const loaderIndicator = document.getElementById('initial-loader-indicator');
        const buttons = [initialLoaderBtn, createNewBtn];
        const projectName = initialLoaderInput.value.trim();

        if (!projectName) {
            statusEl.textContent = "Inserisci un nome preventivo.";
            return;
        }

        statusEl.textContent = "Ricerca in corso...";
        loaderIndicator.classList.remove('hidden');
        buttons.forEach(btn => btn.disabled = true);
        
        const quotes = await dataManager.findQuotesByName(projectName);
        
        loaderIndicator.classList.add('hidden');
        buttons.forEach(btn => btn.disabled = false);

        if (quotes.length > 0) {
            const quotesList = document.getElementById('quotes-list');
            quotesList.innerHTML = '';
            quotes.forEach(quote => {
                const button = document.createElement('button');
                button.className = 'w-full text-left p-3 bg-gray-100 hover:bg-blue-100 rounded-lg transition-colors';
                button.innerHTML = `<span class="font-semibold">${quote.mainInputs.progetto}</span><br><span class="text-sm text-gray-600">Salvato il: ${quote.updatedAt.toLocaleString('it-IT')}</span>`;
                button.addEventListener('click', () => {
                    quotesModal.classList.remove('open');
                    handleQuoteSelection(quote);
                });
                quotesList.appendChild(button);
            });
            document.getElementById('modal-title').textContent = `Seleziona un preventivo`;
            quotesModal.classList.add('open');
            statusEl.textContent = "";
        } else {
            statusEl.textContent = "Nessun preventivo trovato.";
        }
    });
    
    initialLoaderInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') initialLoaderBtn.click();
    });

    createNewBtn.addEventListener('click', () => {
        const projectName = prompt("Inserisci il nome del nuovo progetto:", "Nuovo Progetto");
        if (projectName && projectName.trim() !== "") {
            currentQuoteId = null; 
            const newState = JSON.parse(JSON.stringify(defaultState));
            newState.mainInputs.progetto = projectName.trim();
            populateForm(newState);
            showMainContent();
            isReadyForSaving = true; 
            debouncedSave();
            document.getElementById('save-status').textContent = `Creato nuovo preventivo "${projectName.trim()}".`;
        }
    });

    adminPanelBtn.addEventListener('click', async () => {
        const password = prompt("Inserisci la master password:");
        if (password === null) return;
        
        try {
            const security = await dataManager.getSecurityData();
            if (password === security.masterPassword) {
                openAdminPanel();
            } else {
                alert("Master password errata.");
            }
        } catch (error) {
            alert("Impossibile verificare la password. Controllare la connessione al database.");
        }
    });
    
    document.getElementById('admin-save-master-password-btn').addEventListener('click', async () => {
        const newPassword = document.getElementById('admin-master-password-input').value;
        if (newPassword && newPassword.length >= 4) {
            const security = await dataManager.getSecurityData();
            security.masterPassword = newPassword;
            await dataManager.saveSecurityData(security);
            alert("Master password aggiornata.");
            document.getElementById('admin-master-password-input').value = '';
        } else {
            alert("La master password deve essere di almeno 4 caratteri.");
        }
    });
    
    document.getElementById('main-inputs-section').addEventListener('input', handleDataInput);
    document.getElementById('costs-section').addEventListener('input', handleDataInput);
    
    document.getElementById('show-loader-btn').addEventListener('click', () => {
        document.getElementById('main-content').classList.add('hidden');
        document.getElementById('initial-loader').classList.remove('hidden');
        currentQuoteId = null;
    });

    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const passwordInput = document.getElementById('password-input');
    passwordSubmitBtn.addEventListener('click', async () => {
        const security = await dataManager.getSecurityData();
        const correctPassword = security[selectedQuoteToLoad.mainInputs.progetto];
        if (passwordInput.value === correctPassword) {
            passwordModal.classList.remove('open');
            loadSelectedQuote();
        } else {
            document.getElementById('password-error').textContent = 'Password errata. Riprova.';
        }
    });
    passwordInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') passwordSubmitBtn.click() });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('.close-btn, #password-cancel-btn')) {
                modal.classList.remove('open');
            }
        });
    });

    initializeApp();
});

