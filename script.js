// State Management
let appState = {
    cards: [],
    transactions: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadData();
    
    // Set Default Date
    const dateFields = document.querySelectorAll('input[type="date"]');
    dateFields.forEach(field => field.valueAsDate = new Date());
});

// --- API Helper ---
async function callAPI(action, payload = {}) {
    document.getElementById('loading').classList.remove('hidden');
    try {
        // ใช้ fetch แบบ POST text/plain เพื่อเลี่ยง CORS Preflight ของ GAS
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
        return null;
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

// --- Data Loading ---
async function loadData() {
    const [cards, txns] = await Promise.all([
        callAPI('getCards'),
        callAPI('getTransactions')
    ]);

    if (cards) appState.cards = cards;
    if (txns) appState.transactions = txns;

    renderDashboard();
    renderCards();
    renderTransactions();
    populateCardSelects();
}

// --- Navigation ---
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    // Simple logic to highlight nav (could be improved via ID matching)
    event.currentTarget.classList.add('active');
}

// --- Rendering Logic ---

function renderDashboard() {
    let totalDebt = 0;
    let totalLimit = 0;
    let dueCount = 0;
    const debtByCard = {};
    const today = new Date().getDate();

    appState.cards.forEach(card => {
        const bal = parseFloat(card.CurrentBalance) || 0;
        const lim = parseFloat(card.CreditLimit) || 0;
        const due = parseInt(card.DueDate);

        totalDebt += bal;
        totalLimit += lim;
        debtByCard[card.CardName] = bal;

        // Check if due within 7 days (simple logic)
        let dayDiff = due - today;
        if (dayDiff >= 0 && dayDiff <= 7 && bal > 0) dueCount++;
    });

    document.getElementById('totalDebt').innerText = `฿${totalDebt.toLocaleString()}`;
    document.getElementById('totalAvailable').innerText = `฿${(totalLimit - totalDebt).toLocaleString()}`;
    document.getElementById('dueCount').innerText = `${dueCount} รายการ`;

    // Render Chart
    const ctx = document.getElementById('debtChart').getContext('2d');
    
    // Destroy existing chart if exists
    if (window.debtChartInstance) window.debtChartInstance.destroy();

    window.debtChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(debtByCard),
            datasets: [{
                data: Object.values(debtByCard),
                backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderCards() {
    const container = document.getElementById('cardsList');
    container.innerHTML = '';

    appState.cards.forEach(card => {
        const bal = parseFloat(card.CurrentBalance) || 0;
        const limit = parseFloat(card.CreditLimit) || 0;
        const percent = limit > 0 ? (bal / limit) * 100 : 0;
        
        let colorClass = 'bg-gradient-to-r from-blue-500 to-blue-600';
        if (card.BankName.includes('KBank')) colorClass = 'bg-gradient-to-r from-green-500 to-green-600';
        if (card.BankName.includes('SCB')) colorClass = 'bg-gradient-to-r from-purple-600 to-purple-700';

        const cardHTML = `
            <div class="${colorClass} text-white rounded-xl p-6 shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <div class="absolute right-[-20px] top-[-20px] opacity-10 text-9xl">
                    <i class="fas fa-credit-card"></i>
                </div>
                <div class="relative z-10">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-bold text-lg">${card.CardName}</h3>
                            <p class="text-xs opacity-80">${card.BankName}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs opacity-80">ครบกำหนดวันที่</p>
                            <p class="font-bold text-xl">${card.DueDate}</p>
                        </div>
                    </div>
                    
                    <div class="mb-2">
                        <p class="text-xs opacity-80">ยอดหนี้ปัจจุบัน</p>
                        <p class="text-2xl font-bold">฿${bal.toLocaleString()}</p>
                    </div>

                    <div class="w-full bg-black bg-opacity-20 rounded-full h-2 mb-1">
                        <div class="bg-white h-2 rounded-full" style="width: ${percent}%"></div>
                    </div>
                    <div class="flex justify-between text-xs opacity-80">
                        <span>ใช้ไป ${percent.toFixed(1)}%</span>
                        <span>วงเงิน ${limit.toLocaleString()}</span>
                    </div>
                    
                    <button onclick="deleteCard('${card.CardID}')" class="absolute bottom-2 right-2 p-2 bg-red-500 bg-opacity-0 hover:bg-opacity-100 rounded text-xs transition-all">
                       <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function renderTransactions() {
    const tbody = document.getElementById('txnTableBody');
    tbody.innerHTML = '';

    // Sort by Date Desc
    const sortedTxns = [...appState.transactions].sort((a, b) => new Date(b.Date) - new Date(a.Date));

    sortedTxns.forEach(txn => {
        const card = appState.cards.find(c => c.CardID == txn.CardID);
        const cardName = card ? card.CardName : 'Unknown Card';
        const date = new Date(txn.Date).toLocaleDateString('th-TH');
        
        const row = `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td class="p-4 text-sm text-gray-700 dark:text-gray-300">${date}</td>
                <td class="p-4">
                    <div class="text-sm font-bold text-gray-800 dark:text-gray-200">${txn.Description}</div>
                    <div class="text-xs text-gray-500">${txn.Category}</div>
                </td>
                <td class="p-4 text-sm text-gray-600 dark:text-gray-400">
                    <span class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs">${cardName}</span>
                </td>
                <td class="p-4 text-sm font-bold text-red-500">
                    -฿${parseFloat(txn.Amount).toLocaleString()}
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// --- Logic Forms ---
function populateCardSelects() {
    const opts = appState.cards.map(c => `<option value="${c.CardID}">${c.CardName}</option>`).join('');
    document.getElementById('txnCardSelect').innerHTML = '<option value="">เลือกบัตร</option>' + opts;
    document.getElementById('payCardSelect').innerHTML = '<option value="">เลือกบัตร</option>' + opts;
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openTransactionModal() { openModal('txnModal'); }

// --- Actions ---

async function handleAddCard(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    
    await callAPI('addCard', payload);
    closeModal('cardModal');
    e.target.reset();
    Swal.fire('Success', 'เพิ่มบัตรเรียบร้อย', 'success');
    loadData();
}

async function handleAddTxn(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    
    await callAPI('addTransaction', payload);
    closeModal('txnModal');
    e.target.reset();
    Swal.fire('Success', 'บันทึกรายการเรียบร้อย', 'success');
    loadData();
}

async function deleteCard(id) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "ข้อมูลบัตรจะหายไปถาวร",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ลบเลย'
    });

    if (result.isConfirmed) {
        await callAPI('deleteCard', { CardID: id });
        loadData();
    }
}

// --- Payment Logic ---
let pendingPaymentPayload = null;

function updatePayInfo() {
    const cardId = document.getElementById('payCardSelect').value;
    const card = appState.cards.find(c => c.CardID == cardId);
    
    if (card) {
        const bal = parseFloat(card.CurrentBalance);
        document.getElementById('payFull').innerText = `฿${bal.toLocaleString()}`;
        document.getElementById('payMin').innerText = `฿${(bal * 0.10).toLocaleString()}`; // 10% Min Payment
        document.getElementById('payAmount').value = bal;
    }
}

async function handlePayment(e) {
    e.preventDefault();
    
    const cardId = document.getElementById('payCardSelect').value;
    const amount = document.getElementById('payAmount').value;
    const phone = document.getElementById('promptPayNumber').value;
    
    if (!cardId || !amount || !phone) return;

    // 1. ขอ PromptPay Payload จาก Server
    const res = await callAPI('generatePromptPay', { phone, amount });
    
    if (res && res.payload) {
        // 2. Generate QR on Client
        const qr = new QRious({
            element: document.getElementById('qrCanvas'),
            value: res.payload,
            size: 200
        });
        
        document.getElementById('qrResult').classList.remove('hidden');
        
        // เก็บข้อมูลไว้รอ Confirm
        pendingPaymentPayload = {
            CardID: cardId,
            Amount: amount,
            PaymentDate: new Date().toISOString().split('T')[0],
            PaymentMethod: 'PromptPay',
            PromptPayNumber: phone,
            Status: 'Completed'
        };
    }
}

async function confirmPayment() {
    if (pendingPaymentPayload) {
        await callAPI('addPayment', pendingPaymentPayload);
        document.getElementById('qrResult').classList.add('hidden');
        document.getElementById('paymentForm').reset();
        pendingPaymentPayload = null;
        Swal.fire('Success', 'ชำระเงินเรียบร้อย ยอดหนี้อัพเดทแล้ว', 'success');
        loadData();
    }
}

// --- Theme Toggle ---
function initTheme() {
    const btn = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // Check Local Storage
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }

    btn.addEventListener('click', () => {
        html.classList.toggle('dark');
        localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
    });
}
