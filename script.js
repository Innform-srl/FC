// IMPORTANTE: Assicurati che qui ci sia l'URL corretto del tuo script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEi4HLFXtMsr4Mx1W-xxnXiON490U1MsxAbRP_qRfb83qAgBRLWKOuJFl7pDU8Bzts2w/exec";
let isReadyForSaving = false;
let selectedQuoteToLoad = null; // Variabile per memorizzare temporaneamente il preventivo da caricare

// Oggetto globale per contenere i dati di sicurezza caricati dallo script
let securityData = {
    passwords: { masterPassword: 'fracassa' } // Default iniziale
};

const defaultState = {
    mainInputs: {
        progetto: 'Nuovo Progetto',
        allievi: '10',
        ore: '80',
        ucs: '23,99',
    },
    tables: {
        gestione: [],
        realizzazione: [],
        docenze: [],
        commerciale: [{
            percent_p1: '10,00',
            note_p1: 'Sul ricavo totale',
            percent_p2: '5,00',
            note_p2: 'Sul ricavo totale',
        }]
    }
};

// --- GESTIONE DATI TRAMITE GOOGLE SCRIPT ---
const dataManager = {
    // Carica tutti i dati di sicurezza (password)
    loadSecurityData: async () => {
        try {
            return new Promise((resolve, reject) => {
                window.handleSecurityDataLoad = (data) => {
                    if (data.result === 'error') return reject(new Error(data.message));
                    securityData = data;
                    delete window.handleSecurityDataLoad;
                    const scriptTag = document.getElementById('jsonp_security_loader');
                    if (scriptTag) document.body.removeChild(scriptTag);
                    resolve();
                };
                
                const script = document.createElement('script');
                script.id = 'jsonp_security_loader';
                script.src = `${SCRIPT_URL}?action=getSecurityData&callback=handleSecurityDataLoad&t=${new Date().getTime()}`;
                script.onerror = () => reject(new Error("Errore di rete nel caricamento dei dati di sicurezza."));
                document.body.appendChild(script);
            });
        } catch (error) {
            console.error("Errore nel caricamento dei dati di sicurezza:", error);
            alert("Impossibile caricare i dati di sicurezza. L'applicazione potrebbe non funzionare correttamente.");
        }
    },
    // Esegue un'azione sul backend tramite POST (salvataggio, rinomina, cancellazione)
    postAction: async (action, payload) => {
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, ...payload }),
            });
            const result = await response.json();
            if (result.result !== 'success') throw new Error(result.message);
            return result;
        } catch (error) {
            console.error(`Errore durante l'azione '${action}':`, error);
            alert(`Errore durante l'operazione: ${error.message}`);
            throw error; // Rilancia l'errore per essere gestito dal chiamante se necessario
        }
    },
    checkMasterPassword: (password) => {
        return password === securityData.passwords.masterPassword;
    },
    checkProjectPassword: (projectName, password) => {
        const projectPassword = securityData.passwords[projectName];
        return !projectPassword || password === projectPassword;
    },
};

// Funzioni dell'app (omesse per brevità, sono identiche a prima)
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
    } else { // docenze
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
const deleteRow = (button) => { isReadyForSaving = true; const row = button.closest('tr'); row.remove(); calculateAll(); debouncedSave(); };
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
    if (!data || typeof data !== 'object' || !data.mainInputs || !data.tables) { console.error("Dati non validi:", data); document.getElementById('save-status').textContent = `Errore: dati caricati non validi.`; return; }
    document.getElementById('input-progetto').value = data.mainInputs.progetto;
    document.getElementById('input-allievi').value = data.mainInputs.allievi;
    document.getElementById('input-ore').value = data.mainInputs.ore;
    document.getElementById('input-ucs').value = String(data.mainInputs.ucs).replace('.',',');
    Object.keys(data.tables).forEach(sectionId => {
        const table = document.querySelector(`table[data-section="${sectionId}"]`);
         if (sectionId === 'commerciale') {
             document.querySelector('[data-field=percent_p1]').value = String(data.tables.commerciale[0].percent_p1).replace('.',',');
             document.querySelector('[data-field=note_p1]').value = data.tables.commerciale[0].note_p1;
             document.querySelector('[data-field=percent_p2]').value = String(data.tables.commerciale[0].percent_p2).replace('.',',');
             document.querySelector('[data-field=note_p2]').value = data.tables.commerciale[0].note_p2;
        } else {
             const tbody = table.querySelector('tbody');
             tbody.innerHTML = '';
             if(data.tables[sectionId]) data.tables[sectionId].forEach(item => addRow(sectionId, item));
        }
    });
    calculateAll();
};
let debounceTimer;
const debouncedSave = () => { if (!isReadyForSaving) return; const saveStatus = document.getElementById('save-status'); saveStatus.className = 'status-badge status-unsaved'; saveStatus.textContent = 'Modifiche non salvate...'; clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { saveData(SCRIPT_URL); }, 1500); };
const saveData = (scriptURL) => {
    const saveStatus = document.getElementById('save-status');
    saveStatus.className = 'status-badge status-saving';
    saveStatus.textContent = 'Salvataggio...';
    const state = { mainInputs: { progetto: document.getElementById('input-progetto').value, allievi: document.getElementById('input-allievi').value, ore: document.getElementById('input-ore').value, ucs: document.getElementById('input-ucs').value, }, tables: { commerciale: [{ percent_p1: document.querySelector('[data-field=percent_p1]').value, note_p1: document.querySelector('[data-field=note_p1]').value, percent_p2: document.querySelector('[data-field=percent_p2]').value, note_p2: document.querySelector('[data-field=note_p2]').value, }] } };
    ['gestione', 'realizzazione', 'docenze'].forEach(sectionId => { state.tables[sectionId] = []; document.querySelectorAll(`table[data-section="${sectionId}"] tbody .cost-row`).forEach(row => { const rowData = {}; row.querySelectorAll('input, select').forEach(input => { if (input.dataset.field) { rowData[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value; } }); state.tables[sectionId].push(rowData); }); });
    fetch(scriptURL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', }, body: JSON.stringify({ stateJSON: JSON.stringify(state) }), })
    .then(response => response.json())
    .then(data => {
        if (data.result === 'success') {
            saveStatus.className = 'status-badge status-success';
            saveStatus.textContent = 'Tutte le modifiche sono state salvate.';
            loadProjectNameSuggestions();
        } else {
            throw new Error(data.message || 'Errore non specificato dallo script.');
        }
    })
    .catch(error => { console.error('Error!', error); saveStatus.className = 'status-badge status-error'; saveStatus.textContent = `Errore salvataggio: ${error.message}`; });
};

const loadProjectQuotes = (projectName, fromInitialLoader = true) => {
    const statusEl = fromInitialLoader ? document.getElementById('initial-loader-status') : document.getElementById('save-status');
    const loaderIndicator = fromInitialLoader ? document.getElementById('initial-loader-indicator') : null;
    const buttons = fromInitialLoader ? [document.getElementById('initial-load-btn'), document.getElementById('create-new-btn')] : [];
    
    const reEnableButtons = () => buttons.forEach(btn => btn.disabled = false);

    if (!projectName) {
        statusEl.className = 'text-sm text-red-600';
        statusEl.textContent = "Per favore, inserisci un nome preventivo.";
        return;
    }

    statusEl.className = 'text-sm text-blue-600';
    statusEl.textContent = `Ricerca in corso...`;
    if (loaderIndicator) loaderIndicator.classList.remove('hidden');
    buttons.forEach(btn => btn.disabled = true);

    window.handleQuotesLoad = (data) => {
        try {
            const quotes = Array.isArray(data) ? data : [];
            if (data.result === 'empty' || quotes.length === 0) {
                statusEl.className = 'text-sm text-gray-600';
                statusEl.textContent = 'Nessun preventivo trovato.';
                reEnableButtons();
            } else {
                const quotesList = document.getElementById('quotes-list');
                quotesList.innerHTML = '';
                window.loadedQuotes = quotes;
                
                quotes.forEach((quote, index) => {
                    const quoteTimestamp = quote.timestamp;
                    const projectNameDisplay = quote.mainInputs.progetto;
                    const button = document.createElement('button');
                    button.className = 'w-full text-left p-3 bg-gray-100 hover:bg-blue-100 rounded-lg transition-colors';
                    button.innerHTML = `<span class="font-semibold">${projectNameDisplay}</span><br><span class="text-sm text-gray-600">Salvato il: ${new Date(quoteTimestamp).toLocaleString('it-IT')}</span>`;
                    button.dataset.quoteIndex = index;
                    quotesList.appendChild(button);
                });
                
                document.getElementById('modal-title').textContent = `Seleziona un preventivo per "${projectName}"`;
                document.getElementById('quotes-modal').classList.add('open');
                statusEl.textContent = ``;
            }
        } catch (error) {
            console.error('Error!', error.message);
            statusEl.className = 'text-sm text-red-600';
            statusEl.textContent = `Errore lettura dati: ${error.message}`;
            reEnableButtons();
        } finally {
            if (loaderIndicator) loaderIndicator.classList.add('hidden');
            const scriptTag = document.getElementById('jsonp_quotes_loader');
            if (scriptTag) document.body.removeChild(scriptTag);
            delete window.handleQuotesLoad;
        }
    };

    const script = document.createElement('script');
    script.id = 'jsonp_quotes_loader';
    script.src = `${SCRIPT_URL}?projectName=${encodeURIComponent(projectName)}&callback=handleQuotesLoad&t=${new Date().getTime()}`;
    script.onerror = () => {
        statusEl.className = 'text-sm text-red-600';
        statusEl.textContent = `Errore di rete. Controlla l'URL e il deploy dello script.`;
        reEnableButtons();
    };
    document.body.appendChild(script);
};

const loadProjectNameSuggestions = () => {
    window.handleProjectNamesLoad = (data) => {
        try {
            const projectNames = (typeof data === 'string' ? JSON.parse(data) : data);
            if (projectNames && projectNames.result !== 'error' && Array.isArray(projectNames)) {
                const datalist2 = document.getElementById('initial-project-suggestions');
                datalist2.innerHTML = '';
                projectNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    datalist2.appendChild(option);
                });
            }
        } catch (e) { console.error("Errore nel caricare i suggerimenti dei progetti:", e); }
        finally {
             const scriptTag = document.getElementById('jsonp_script_loader_names');
             if (scriptTag) document.body.removeChild(scriptTag);
             delete window.handleProjectNamesLoad;
        }
    };
    const script = document.createElement('script');
    script.id = 'jsonp_script_loader_names';
    script.src = `${SCRIPT_URL}?callback=handleProjectNamesLoad&action=getProjectNames&t=${new Date().getTime()}`;
    script.onerror = () => console.error("Errore di rete nel caricamento dei suggerimenti.");
    document.body.appendChild(script);
};

const showMainContent = () => {
    document.getElementById('initial-loader').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    isReadyForSaving = true;
    attachMainAppListeners();
};

const handleDataInput = (event) => {
    isReadyForSaving = true;
    const target = event.target;
    if (target.matches('[data-field=partner], [data-field=azienda]')) {
        const row = target.closest('tr');
        if (target.checked) {
            if (target.dataset.field === 'partner') {
                row.querySelector('[data-field=azienda]')?.toggleAttribute('checked', false);
            } else if (target.dataset.field === 'azienda') {
                row.querySelector('[data-field=partner]')?.toggleAttribute('checked', false);
            }
        }
    }
    calculateAll();
    debouncedSave();
};

function attachMainAppListeners() {
    document.getElementById('main-inputs-section').addEventListener('input', handleDataInput);
    document.getElementById('costs-section').addEventListener('input', handleDataInput);
    
    document.getElementById('show-loader-btn').addEventListener('click', () => {
        document.getElementById('main-content').classList.add('hidden');
        document.getElementById('initial-loader').classList.remove('hidden');
        document.getElementById('initial-load-input').value = '';
        document.getElementById('initial-loader-status').textContent = '';
        document.getElementById('initial-loader-indicator').classList.add('hidden');
        document.getElementById('initial-load-btn').disabled = false;
        document.getElementById('create-new-btn').disabled = false;
        loadProjectNameSuggestions();
    });
}

async function populateAdminPanel() {
    const projectListContainer = document.getElementById('admin-project-passwords-list');
    projectListContainer.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

    try {
        const projectNames = await new Promise((resolve, reject) => {
            window.handleAdminProjectsLoad = (data) => {
                delete window.handleAdminProjectsLoad;
                if (data.result === 'error') return reject(new Error(data.message));
                resolve(data);
            };
            const script = document.createElement('script');
            script.src = `${SCRIPT_URL}?action=getProjectNames&callback=handleAdminProjectsLoad&t=${new Date().getTime()}`;
            script.onerror = () => reject(new Error("Errore di rete"));
            document.body.appendChild(script);
        });

        const allProjectNames = new Set(projectNames);
        Object.keys(securityData.passwords).forEach(name => {
            if (name !== 'masterPassword') allProjectNames.add(name);
        });

        projectListContainer.innerHTML = '';
        if (allProjectNames.size === 0) {
            projectListContainer.innerHTML = '<p class="text-gray-500 text-center">Nessun preventivo trovato.</p>';
        } else {
            allProjectNames.forEach(projectName => {
                const currentPassword = securityData.passwords[projectName] || '';
                const projectEl = document.createElement('div');
                projectEl.className = 'flex items-center space-x-2 p-2 bg-gray-100 rounded-md';
                projectEl.innerHTML = `
                    <span class="font-medium text-gray-800 flex-grow">${projectName}</span>
                    <input type="text" class="table-input w-40" placeholder="Password" value="${currentPassword}" data-project-name="${projectName}">
                    <button class="admin-action-btn save-project-pwd-btn" data-project-name="${projectName}" title="Salva Password">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    </button>
                    <button class="admin-action-btn rename-project-btn" data-project-name="${projectName}" title="Rinomina Preventivo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="admin-action-btn delete-project-btn" data-project-name="${projectName}" title="Cancella Preventivo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                `;
                projectListContainer.appendChild(projectEl);
            });
        }
    } catch (error) {
        projectListContainer.innerHTML = `<p class="text-red-500 text-center">Errore nel caricamento dei preventivi: ${error.message}</p>`;
    }
}


function handleQuoteSelection(quote) {
    selectedQuoteToLoad = quote;
    const projectName = quote.mainInputs.progetto;
    const passwordModal = document.getElementById('password-modal');
    
    if (!securityData.passwords[projectName]) {
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
        ['gestione', 'realizzazione', 'docenze'].forEach(id => {
            const tbody = document.querySelector(`table[data-section="${id}"] tbody`);
            if(tbody) tbody.innerHTML = '';
        });
        populateForm(selectedQuoteToLoad);
        showMainContent();
        const saveStatus = document.getElementById('save-status');
        saveStatus.className = 'status-badge status-success';
        saveStatus.textContent = 'Preventivo caricato correttamente.';
        selectedQuoteToLoad = null;
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('initial-loader-status');
    statusEl.textContent = "Caricamento dati di sicurezza...";
    
    try {
        await dataManager.loadSecurityData();
        statusEl.textContent = "";
    } catch (error) {
        statusEl.textContent = "Errore caricamento dati.";
        alert("Impossibile caricare i dati di sicurezza. Controlla il link dello script e le autorizzazioni.");
        return;
    }

    const initialLoaderBtn = document.getElementById('initial-load-btn');
    const initialLoaderInput = document.getElementById('initial-load-input');
    const createNewBtn = document.getElementById('create-new-btn');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const quotesModal = document.getElementById('quotes-modal');
    const passwordModal = document.getElementById('password-modal');
    const adminModal = document.getElementById('admin-modal');

    initialLoaderBtn.addEventListener('click', () => loadProjectQuotes(initialLoaderInput.value.trim(), true));
    initialLoaderInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') initialLoaderBtn.click(); });

    createNewBtn.addEventListener('click', () => {
        const projectName = prompt("Per favore, inserisci il nome del nuovo progetto:", "Nuovo Progetto");
        if (projectName && projectName.trim() !== "") {
            const newState = JSON.parse(JSON.stringify(defaultState));
            newState.mainInputs.progetto = projectName.trim();
            populateForm(newState);
            showMainContent();
            isReadyForSaving = true; 
            saveData(SCRIPT_URL); 
            document.getElementById('save-status').className = 'status-badge status-success';
            document.getElementById('save-status').textContent = `Creato nuovo preventivo "${projectName.trim()}".`;
        }
    });
    
    adminPanelBtn.addEventListener('click', () => {
        const password = prompt("Inserisci la master password:");
        if (password === null) return;
        if (dataManager.checkMasterPassword(password)) {
            adminModal.classList.add('open');
            populateAdminPanel();
        } else {
            alert("Master password errata.");
        }
    });

    const initialButtons = [initialLoaderBtn, createNewBtn];
    const closeModalAndReset = () => initialButtons.forEach(btn => btn.disabled = false);

    document.getElementById('close-modal-btn').addEventListener('click', () => { quotesModal.classList.remove('open'); closeModalAndReset(); });
    quotesModal.addEventListener('click', e => { if (e.target === quotesModal) { quotesModal.classList.remove('open'); closeModalAndReset(); }});
    
    document.getElementById('quotes-list').addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button && button.dataset.quoteIndex) {
            const index = parseInt(button.dataset.quoteIndex, 10);
            const selectedQuote = window.loadedQuotes[index];
            quotesModal.classList.remove('open');
            handleQuoteSelection(selectedQuote);
        }
    });

    document.getElementById('password-cancel-btn').addEventListener('click', () => { passwordModal.classList.remove('open'); closeModalAndReset(); });
    passwordModal.addEventListener('click', e => { if (e.target === passwordModal) { passwordModal.classList.remove('open'); closeModalAndReset(); }});
    
    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const passwordInput = document.getElementById('password-input');
    
    passwordSubmitBtn.addEventListener('click', () => {
        const password = passwordInput.value;
        const projectName = selectedQuoteToLoad.mainInputs.progetto;
        if (dataManager.checkProjectPassword(projectName, password)) {
            passwordModal.classList.remove('open');
            loadSelectedQuote();
        } else {
            document.getElementById('password-error').textContent = 'Password errata. Riprova.';
        }
    });
    passwordInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') passwordSubmitBtn.click(); });
    
    document.getElementById('admin-close-btn').addEventListener('click', () => adminModal.classList.remove('open'));
    adminModal.addEventListener('click', e => { if (e.target === adminModal) adminModal.classList.remove('open'); });

    document.getElementById('admin-save-master-password-btn').addEventListener('click', async () => {
        const newMasterPassword = document.getElementById('admin-master-password-input').value;
        if (newMasterPassword.length < 4) {
            alert("La master password deve essere di almeno 4 caratteri.");
            return;
        }
        const updatedPasswords = { ...securityData.passwords, masterPassword: newMasterPassword };
        try {
            await dataManager.postAction('saveSecurityData', { payload: updatedPasswords });
            securityData.passwords = updatedPasswords;
            alert('Master password salvata con successo.');
            document.getElementById('admin-master-password-input').value = '';
        } catch(e) {}
    });

    document.getElementById('admin-project-passwords-list').addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const projectName = button.dataset.projectName;

        if (button.classList.contains('save-project-pwd-btn')) {
            const projectPasswordInput = document.querySelector(`input[data-project-name="${projectName}"]`);
            const newPassword = projectPasswordInput.value.trim();
            const updatedPasswords = { ...securityData.passwords };
            if (newPassword) {
                updatedPasswords[projectName] = newPassword;
            } else {
                delete updatedPasswords[projectName];
            }
            try {
                await dataManager.postAction('saveSecurityData', { payload: updatedPasswords });
                securityData.passwords = updatedPasswords;
                alert('Password salvata con successo.');
            } catch(e) {}
        } 
        else if (button.classList.contains('rename-project-btn')) {
            const newName = prompt(`Inserisci il nuovo nome per "${projectName}":`, projectName);
            if (newName && newName.trim() !== "" && newName !== projectName) {
                try {
                    await dataManager.postAction('renameProject', { oldName: projectName, newName: newName.trim() });
                    alert('Preventivo rinominato con successo!');
                    await dataManager.loadSecurityData();
                    populateAdminPanel();
                } catch (e) {}
            }
        } 
        else if (button.classList.contains('delete-project-btn')) {
            if (confirm(`Sei sicuro di voler cancellare TUTTI i preventivi con il nome "${projectName}"? L'azione è irreversibile.`)) {
                try {
                    await dataManager.postAction('deleteProject', { projectName: projectName });
                    alert('Preventivo cancellato con successo!');
                    await dataManager.loadSecurityData();
                    populateAdminPanel();
                } catch (e) {}
            }
        }
    });

    const summarySection = document.getElementById('summary-section');
    const header = document.querySelector('#main-content header');
    const observer = new IntersectionObserver(([e]) => {
         const isSticky = e.intersectionRatio < 1;
         summarySection.classList.toggle('compressed', isSticky);
         document.getElementById('summary-full-view').classList.toggle('hidden', isSticky);
         document.getElementById('summary-compressed-view').classList.toggle('hidden', !isSticky);
    }, {threshold: [1]});
    if(header) observer.observe(header);

    loadProjectNameSuggestions();
    calculateAll(); 
});

