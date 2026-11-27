const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwEOxipUNxnKSwMYImTzUxa6-9uiCr4Th__eiCcWu8J0AsmjBa-2gYlQn2rr07tcks/exec";
const STORAGE_KEY = "MDS_312_AUDIT_DB_V1";
const GAS_URL_KEY = "MDS_312_GAS_URL_V1";
const SIM_MODE_KEY = "MDS_312_SIM_MODE_V1";
const SESSION_KEY = "MDS_312_SESSION_V1";

const TRANSACTION_SHEETS = [
    "Unmatch Transaksi",
    "Parked Invoice",
    "Item Correct",
    "Void-Bill Cancelation",
    "Return",
    "Price Overide",
    "Print Duplicate",
    "Disc Manual"
];

const SHEET_PAGE_MAP = {
    "Unmatch Transaksi": "index.html",
    "Parked Invoice": "parked-invoice.html",
    "Item Correct": "item-correct.html",
    "Void-Bill Cancelation": "void-bill.html",
    "Return": "return.html",
    "Price Overide": "price-override.html",
    "Print Duplicate": "print-duplicate.html",
    "Disc Manual": "disc-manual.html",
    "MASTER_USER": "master-user.html"
};

const DEFAULT_USERS = [
    { User_ID: "64593", Nama_Lengkap: "AGUS TRIYONO", Role: "ADMIN", PIN_Password: "123", Status_Aktif: "AKTIF" },
    { User_ID: "SPV312", Nama_Lengkap: "SUPERVISOR 312", Role: "SPV", PIN_Password: "123", Status_Aktif: "AKTIF" },
    { User_ID: "221521", Nama_Lengkap: "M. DENI AKBAR", Role: "KASIR / SA", PIN_Password: "123", Status_Aktif: "AKTIF" }
];

let db = {
    sheets: Object.fromEntries(TRANSACTION_SHEETS.map(s => [s, []])),
    users: [...DEFAULT_USERS]
};

let currentUser = null;
let activeTab = window.PAGE_SHEET || TRANSACTION_SHEETS[0];
let activeRemarksCtx = null;
let activeSpvCtx = null;
let isDrawingSig = false;
let currentPageNum = 1;
const PAGE_SIZE = 50;

function normalizeIdToken(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (s.endsWith(".0")) s = s.slice(0, -2);
    return s;
}

function getGasUrl() {
    return (localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL || "").trim();
}

function isSimulationMode() {
    return localStorage.getItem(SIM_MODE_KEY) === "1";
}

function enableSimulationMode() {
    localStorage.setItem(SIM_MODE_KEY, "1");
    updateConnectionBadge("Simulasi Lokal", "amber");
    hideConnectionError();
    if (currentUser) {
        renderTabs();
        renderSheetView();
    }
}

function saveDb() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (_) {}
}

function mergeUsers(serverUsers) {
    const map = new Map();
    DEFAULT_USERS.forEach(u => {
        const key = normalizeIdToken(u.User_ID).toLowerCase();
        if (key) map.set(key, { ...u, User_ID: normalizeIdToken(u.User_ID), PIN_Password: normalizeIdToken(u.PIN_Password) });
    });
    if (Array.isArray(serverUsers)) {
        serverUsers.forEach(raw => {
            const uid = normalizeIdToken(pickField(raw, ["User_ID", "User_ID (CashNum / AuthID)", "ID", "UserId"]));
            if (!uid) return;
            const pin = normalizeIdToken(pickField(raw, ["PIN_Password", "PIN", "Password", "Pin"]) || "123456");
            const nama = String(pickField(raw, ["Nama_Lengkap", "Nama", "Name"]) || uid).trim();
            const role = String(pickField(raw, ["Role"]) || "KASIR / SA").trim().toUpperCase();
            const status = String(pickField(raw, ["Status_Aktif", "Status"]) || "AKTIF").trim().toUpperCase();
            map.set(uid.toLowerCase(), {
                User_ID: uid,
                Nama_Lengkap: nama,
                Role: role,
                PIN_Password: pin,
                Status_Aktif: status
            });
        });
    }
    return Array.from(map.values());
}

function loadDbFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sheets) {
            TRANSACTION_SHEETS.forEach(s => {
                db.sheets[s] = Array.isArray(parsed.sheets[s]) ? parsed.sheets[s] : [];
            });
        }
        if (parsed && Array.isArray(parsed.users) && parsed.users.length) {
            db.users = mergeUsers(parsed.users);
        }
    } catch (_) {}
}

function showConnectionError(msg) {
    const textEl = document.getElementById("connection-error-text");
    const bannerEl = document.getElementById("connection-error-banner");
    if (textEl) textEl.textContent = "Gagal terhubung ke server Apps Script: " + msg;
    if (bannerEl) bannerEl.classList.remove("hidden");
    updateConnectionBadge("Terputus", "rose");
}

function hideConnectionError() {
    const bannerEl = document.getElementById("connection-error-banner");
    if (bannerEl) bannerEl.classList.add("hidden");
}

function updateConnectionBadge(text, color = "emerald") {
    const el = document.getElementById("connection-badge");
    if (!el) return;
    const map = {
        emerald: "bg-emerald-100 text-emerald-800",
        amber: "bg-amber-100 text-amber-800",
        rose: "bg-rose-100 text-rose-800"
    };
    el.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[color] || map.emerald}`;
    el.textContent = text;
}

function updateSyncTimeBadge(customText) {
    const el = document.getElementById("sync-time-badge");
    if (!el) return;
    if (customText) {
        el.textContent = customText;
        return;
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    el.textContent = `Sync: ${hh}:${mm}:${ss}`;
}

function toNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/[^\d.-]+/g, ""));
    return isFinite(n) ? n : 0;
}

function formatRupiah(val) {
    return "Rp " + Math.round(toNum(val)).toLocaleString("id-ID");
}

function pickField(obj, names) {
    if (!obj) return undefined;
    for (const name of names) {
        if (obj[name] !== undefined && obj[name] !== null && obj[name] !== "") {
            return obj[name];
        }
    }
    const lowerMap = {};
    for (const k of Object.keys(obj)) {
        lowerMap[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = obj[k];
    }
    for (const name of names) {
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lowerMap[key] !== undefined && lowerMap[key] !== null && lowerMap[key] !== "") {
            return lowerMap[key];
        }
    }
    return undefined;
}

function excelSerialToLocalDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const utcMs = utcDays * 86400 * 1000;
    const d = new Date(utcMs);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatDateParts(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return "";
    const fullYear = y < 100 ? (2000 + y) : y;
    return `${String(fullYear).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeDateIso(val) {
    if (val === null || val === undefined || val === "") return "";

    if (typeof val === "number" && isFinite(val)) {
        if (val > 20000 && val < 80000) {
            const dt = excelSerialToLocalDate(val);
            return formatDateParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
        }
        return "";
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
        return formatDateParts(val.getFullYear(), val.getMonth() + 1, val.getDate());
    }

    const s = String(val).trim();
    if (!s) return "";

    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        return formatDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
    }

    const slashMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s|$)/);
    if (slashMatch) {
        const first = parseInt(slashMatch[1], 10);
        const second = parseInt(slashMatch[2], 10);
        const yearPart = slashMatch[3];
        let month = first;
        let day = second;
        if (first > 12 && second <= 12) {
            day = first;
            month = second;
        } else if (second > 12 && first <= 12) {
            month = first;
            day = second;
        }
        return formatDateParts(yearPart, month, day);
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }

    return "";
}

function normalizeTimeVal(val) {
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "number" && isFinite(val) && val >= 0 && val < 1) {
        const totalSeconds = Math.round(val * 86400);
        const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, "0");
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const ss = String(totalSeconds % 60).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
        const hh = String(val.getHours()).padStart(2, "0");
        const mm = String(val.getMinutes()).padStart(2, "0");
        const ss = String(val.getSeconds()).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }
    const s = String(val).trim();
    const match = s.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    return match ? match[1] : s;
}

function getColumnEValue(raw) {
    if (!raw || typeof raw !== "object") return "";
    const keys = Object.keys(raw).filter(k => !k.startsWith("_"));
    if (keys.length >= 5) {
        return raw[keys[4]];
    }
    return "";
}

function getRowDiscValue(row) {
    const direct = toNum(pickField(row, ["Disc", "Total Disc", "Disc Manual", "Disc Auto"]));
    if (direct > 0) return direct;
    const price = toNum(pickField(row, ["Price", "Amount"]));
    const net = toNum(pickField(row, ["NetAmount", "Payment"]));
    if (price > 0 && net > 0 && price > net) {
        return price - net;
    }
    return 0;
}

function normalizeServerRow(sheetName, raw, idx = 0) {
    let trxDate = normalizeDateIso(
        pickField(raw, ["TrxDate", "Trx Date", "Date", "CounterDate", "Counter Date", "TransactionDate", "Tanggal"])
    );
    if (!trxDate && String(sheetName).toLowerCase() === "parked invoice") {
        trxDate = normalizeDateIso(getColumnEValue(raw)) || normalizeDateIso(raw._groupDate || "");
    }

    const trxTime = normalizeTimeVal(
        pickField(raw, ["TrxTime", "Trx Time", "CreateTime", "TimeOfParking", "Time Of Parking", "Time", "Jam"])
    );
    const regNum = normalizeIdToken(
        pickField(raw, ["RegNum", "Reg Num", "POS", "Pos", "CounterID", "Counter ID", "Counter", "RegNo", "Reg No"])
    );
    const trxNum = normalizeIdToken(
        pickField(raw, ["TRXNUM", "Trx Num", "Parked Invoice Number", "Parked Invoice", "No"])
    );
    const sku = normalizeIdToken(pickField(raw, ["SKU", "Sku"]));
    const description = String(
        pickField(raw, ["Description", "Desc", "ItemDesc"]) ||
        (String(sheetName).toLowerCase() === "parked invoice" && trxNum ? `Parked Invoice ${trxNum}` : "")
    ).trim();
    const qty = toNum(pickField(raw, ["QTY", "Qty"])) || (sku || trxNum ? 1 : 0);
    const cashNum = normalizeIdToken(pickField(raw, ["CashNum", "Cash Num", "Cashier Name and ID", "CashierID"]));
    const cashName = String(pickField(raw, ["CashName", "CashierName"]) || "").trim();
    const authId = normalizeIdToken(pickField(raw, ["AuthID", "AuthId", "Auth ID"]));
    const authName = String(pickField(raw, ["AuthName", "Auth Name"]) || "").trim();

    const price = toNum(pickField(raw, ["Price", "OrigPrice", "NewPrice"]));
    const amount = toNum(pickField(raw, ["Amount"])) || price;
    const discManual = toNum(pickField(raw, ["Disc Manual", "DiscManual"]));
    const totalDisc = toNum(pickField(raw, ["Total Disc", "TotalDisc"]));
    const discAuto = toNum(pickField(raw, ["Disc Auto", "DiscAuto"]));

    let disc = toNum(pickField(raw, ["Disc"]));
    if (String(sheetName).toLowerCase() === "disc manual") {
        disc = totalDisc > 0 ? totalDisc : (discManual > 0 ? discManual : (discAuto > 0 ? discAuto : disc));
    } else if (disc === 0 && (totalDisc > 0 || discManual > 0 || discAuto > 0)) {
        disc = totalDisc > 0 ? totalDisc : (discManual > 0 ? discManual : discAuto);
    }

    const paymentRaw = pickField(raw, ["Payment", "NetAmount"]);
    const netAmount = (paymentRaw !== undefined && paymentRaw !== null && paymentRaw !== "")
        ? toNum(paymentRaw)
        : Math.max(0, amount - disc);
    const discPrc = String(pickField(raw, ["Disc Prc", "DiscPrc"]) || "").trim();

    const remarksKasir = String(pickField(raw, ["Remarks_Kasir", "RemarksKasir", "Remarks"]) || "").trim();
    const waktuRemarksKasir = String(pickField(raw, ["Waktu_Remarks_Kasir", "WaktuRemarksKasir"]) || "").trim();
    const statusSpv = String(pickField(raw, ["Status_Verifikasi_SPV", "StatusVerifikasiSPV"]) || "PENDING").trim().toUpperCase();
    const spvId = normalizeIdToken(pickField(raw, ["SPV_Verifikator_ID"]));
    const spvName = String(pickField(raw, ["SPV_Verifikator_Nama"]) || "").trim();
    const catatanSpv = String(pickField(raw, ["Catatan_SPV", "CatatanSPV"]) || "").trim();
    const parafSpv = String(pickField(raw, ["Paraf_TTD_Digital_SPV", "ParafSPV"]) || "").trim();
    const waktuSpv = String(pickField(raw, ["Waktu_Verifikasi_SPV", "WaktuVerifikasiSPV"]) || "").trim();

    return {
        ...raw,
        _rowIndex: Number(raw._rowIndex) || (idx + 2),
        TrxDate: trxDate,
        TrxTime: trxTime,
        RegNum: regNum,
        TRXNUM: trxNum,
        SKU: sku,
        Description: description,
        QTY: qty,
        CashNum: cashNum,
        CashName: cashName,
        AuthID: authId,
        AuthName: authName,
        Price: price,
        Amount: amount,
        Disc: disc,
        disc: disc,
        DiscManual: discManual,
        TotalDisc: totalDisc,
        DiscAuto: discAuto,
        DiscPrc: discPrc,
        Payment: netAmount,
        NetAmount: netAmount,
        Remarks_Kasir: remarksKasir,
        Waktu_Remarks_Kasir: waktuRemarksKasir,
        Status_Verifikasi_SPV: statusSpv,
        SPV_Verifikator_ID: spvId,
        SPV_Verifikator_Nama: spvName,
        Catatan_SPV: catatanSpv,
        Paraf_TTD_Digital_SPV: parafSpv,
        Waktu_Verifikasi_SPV: waktuSpv
    };
}

async function callGasApi(payload) {
    if (isSimulationMode()) {
        return { ok: true, simulated: true, data: null };
    }
    const url = getGasUrl();
    if (!url) {
        return { ok: false, error: "URL Web App belum dikonfigurasi." };
    }

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 45000);

    try {
        const response = await fetch(url, {
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const rawText = await response.text();
        let json;
        try {
            json = JSON.parse(rawText);
        } catch (_) {
            const errMsg = "Respon server bukan JSON valid (cek akses Web App: Anyone & versi deploy).";
            showConnectionError(errMsg);
            return { ok: false, error: errMsg };
        }

        if (!response.ok || (json && (json.ok === false || json.status === "error"))) {
            const msg = (json && (json.error || json.message)) || `HTTP ${response.status}`;
            showConnectionError(`Server Apps Script mengembalikan error: ${msg}`);
            return { ok: false, error: msg };
        }

        hideConnectionError();
        updateConnectionBadge("Terhubung Google Sheets", "emerald");
        return { ok: true, data: json.data !== undefined ? json.data : json };
    } catch (err) {
        console.error("GAS API Error:", err);
        const msg = err.name === "AbortError"
            ? "Permintaan ke Apps Script melebihi batas waktu (timeout 45 detik)."
            : "Tidak dapat menjangkau server Apps Script. Pastikan URL /exec benar dan deploy diakses oleh Anyone.";
        showConnectionError(msg);
        return { ok: false, error: err.message || msg };
    } finally {
        clearTimeout(timerId);
    }
}

async function refreshAllData(showLoading = true) {
    if (showLoading) {
        updateSyncTimeBadge("Sync: Memuat...");
    }
    if (!isSimulationMode() && getGasUrl()) {
        const res = await callGasApi({ action: "getAllData" });
        if (res.ok && res.data) {
            if (res.data.sheets) {
                TRANSACTION_SHEETS.forEach(sheetName => {
                    const list = Array.isArray(res.data.sheets[sheetName]) ? res.data.sheets[sheetName] : [];
                    db.sheets[sheetName] = list.map((row, idx) => normalizeServerRow(sheetName, row, idx));
                });
            }
            if (Array.isArray(res.data.users) && res.data.users.length) {
                db.users = mergeUsers(res.data.users);
            }
            saveDb();
            updateSyncTimeBadge();
        } else {
            updateSyncTimeBadge("Sync: Gagal");
        }
    } else {
        updateSyncTimeBadge(isSimulationMode() ? "Mode Simulasi" : "Sync: Lokal");
    }

    updateLatestDataDateBadge();
    if (currentUser) {
        renderTabs();
        renderSheetView();
    }
}

function updateLatestDataDateBadge() {
    let maxDate = "";
    TRANSACTION_SHEETS.forEach(s => {
        (db.sheets[s] || []).forEach(r => {
            const d = normalizeDateIso(r.TrxDate);
            if (d && (!maxDate || d > maxDate)) maxDate = d;
        });
    });
    const el = document.getElementById("latest-date-badge");
    if (el) el.textContent = `Data terakhir: ${maxDate || "-"}`;
}

async function handleLogin(e) {
    e.preventDefault();
    const uidInput = normalizeIdToken(document.getElementById("login-userid").value).toLowerCase();
    const pinInput = normalizeIdToken(document.getElementById("login-pin").value);
    const errEl = document.getElementById("login-error");
    const submitBtn = e.target.querySelector("button[type='submit']");

    const matchUser = (list) => list.find(u => {
        const uId = normalizeIdToken(u.User_ID).toLowerCase();
        const uPin = normalizeIdToken(u.PIN_Password);
        const st = String(u.Status_Aktif || "AKTIF").trim().toUpperCase();
        const isActive = st !== "NONAKTIF" && st !== "INACTIVE" && st !== "0" && st !== "FALSE";
        return isActive && uId === uidInput && uPin === pinInput;
    });

    let found = matchUser(db.users);
    if (!found && !isSimulationMode() && getGasUrl()) {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Memeriksa akun...";
        }
        await refreshAllData(false);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Masuk Aplikasi";
        }
        found = matchUser(db.users);
    }

    if (!found) {
        errEl.textContent = "User ID atau PIN tidak valid atau akun tidak aktif.";
        errEl.classList.remove("hidden");
        return;
    }

    errEl.classList.add("hidden");
    currentUser = found;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    applyRoleView();
    renderTabs();
    renderSheetView();
}

function logoutUser() {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    const infoBox = document.getElementById("user-info-box");
    const appView = document.getElementById("app-view");
    const loginView = document.getElementById("login-view");
    const settingsBtn = document.getElementById("btn-settings");
    if (infoBox) {
        infoBox.classList.add("hidden");
        infoBox.classList.remove("flex");
    }
    if (settingsBtn) {
        settingsBtn.classList.add("hidden");
    }
    if (appView) appView.classList.add("hidden");
    if (loginView) loginView.classList.remove("hidden");

    const pathName = (window.location.pathname || "").toLowerCase();
    const isIndexPage = pathName.endsWith("/") || pathName.endsWith("/index.html") || pathName === "index.html";
    if (!isIndexPage) {
        window.location.href = "index.html";
    }
}

function applyRoleView() {
    if (!currentUser) return;
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    document.getElementById("user-info-box").classList.remove("hidden");
    document.getElementById("user-info-box").classList.add("flex");

    document.getElementById("user-name-label").textContent = currentUser.Nama_Lengkap || currentUser.User_ID;
    document.getElementById("user-id-label").textContent = `ID: ${currentUser.User_ID}`;
    document.getElementById("user-role-badge").textContent = currentUser.Role;

    const role = String(currentUser.Role || "").toUpperCase();
    const isAdmin = role.includes("ADMIN");
    const isSpv = role.includes("SPV");

    const adminBtns = document.getElementById("admin-action-buttons");
    if (adminBtns) adminBtns.classList.toggle("hidden", !isAdmin);
    const settingsBtn = document.getElementById("btn-settings");
    if (settingsBtn) settingsBtn.classList.toggle("hidden", !isAdmin);

    if (activeTab === "MASTER_USER" && !isAdmin) {
        window.location.href = "index.html";
        return;
    }

    if (isAdmin) {
        document.getElementById("role-banner-title").textContent = "Mode ADMIN: Akses penuh ke seluruh 8 sheet transaksi, upload Excel harian, download laporan, dan kelola Master User.";
        document.getElementById("role-banner-desc").textContent = "Anda dapat memantau remarks kasir, melakukan verifikasi SPV, mengunggah file Excel, mengekspor data, serta menghapus data per rentang tanggal.";
    } else if (isSpv) {
        document.getElementById("role-banner-title").textContent = "Mode SPV: Verifikasi & paraf digital seluruh transaksi setelah remarks kasir terisi.";
        document.getElementById("role-banner-desc").textContent = "Pilih transaksi yang sudah memiliki remarks kasir untuk melakukan Approval atau Rejection beserta paraf digital.";
    } else {
        document.getElementById("role-banner-title").textContent = "Mode KASIR / SA: Isi remarks/keterangan pada transaksi yang terkait ID Anda.";
        document.getElementById("role-banner-desc").textContent = "Hanya transaksi yang cocok dengan CashNum / AuthID Anda yang ditampilkan.";
    }
}

function getAccessibleRowsForSheet(sheetName) {
    const rows = db.sheets[sheetName] || [];
    if (!currentUser) return [];
    const role = String(currentUser.Role || "").toUpperCase();
    if (role.includes("ADMIN") || role.includes("SPV")) return rows;
    const myId = normalizeIdToken(currentUser.User_ID).toLowerCase();
    return rows.filter(r => {
        const cId = normalizeIdToken(r.CashNum).toLowerCase();
        const aId = normalizeIdToken(r.AuthID).toLowerCase();
        return cId === myId || aId === myId;
    });
}

function getRowAuditCategory(row) {
    const st = String(row.Status_Verifikasi_SPV || "PENDING").toUpperCase();
    if (st === "APPROVED") return "APPROVED";
    if (st === "REJECTED") return "REJECTED";
    const hasRemarks = Boolean(String(row.Remarks_Kasir || "").trim());
    return hasRemarks ? "READY_SPV" : "PENDING_REMARKS";
}

function updateKpiCards() {
    const role = String((currentUser && currentUser.Role) || "").toUpperCase();
    const showMasterUser = role.includes("ADMIN") && activeTab === "MASTER_USER";
    if (showMasterUser) {
        document.getElementById("kpi-total").textContent = db.users.length;
        document.getElementById("kpi-pending-remarks").textContent = 0;
        document.getElementById("kpi-ready-spv").textContent = 0;
        document.getElementById("kpi-done-spv").textContent = 0;
        return;
    }

    const rows = getAccessibleRowsForSheet(activeTab);
    let pendingRemarks = 0, readySpv = 0, doneSpv = 0;
    rows.forEach(r => {
        const cat = getRowAuditCategory(r);
        if (cat === "PENDING_REMARKS") pendingRemarks++;
        else if (cat === "READY_SPV") readySpv++;
        else doneSpv++;
    });

    document.getElementById("kpi-total").textContent = rows.length;
    document.getElementById("kpi-pending-remarks").textContent = pendingRemarks;
    document.getElementById("kpi-ready-spv").textContent = readySpv;
    document.getElementById("kpi-done-spv").textContent = doneSpv;
}

function renderTabs() {
    const container = document.getElementById("sheet-tabs");
    if (!container) return;
    const role = String((currentUser && currentUser.Role) || "").toUpperCase();
    const isAdmin = role.includes("ADMIN");

    let html = TRANSACTION_SHEETS.map(sheetName => {
        const count = getAccessibleRowsForSheet(sheetName).length;
        const active = activeTab === sheetName;
        const href = SHEET_PAGE_MAP[sheetName] || "index.html";
        return `
            <a href="${href}"
                class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition ${active ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}">
                <span>${sheetName}</span>
                <span class="px-1.5 py-0.5 rounded-full text-[11px] ${active ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-700"}">${count}</span>
            </a>
        `;
    }).join("");

    if (isAdmin) {
        const active = activeTab === "MASTER_USER";
        html += `
            <a href="${SHEET_PAGE_MAP.MASTER_USER}"
                class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition ${active ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}">
                <span>Master User</span>
                <span class="px-1.5 py-0.5 rounded-full text-[11px] ${active ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-700"}">${db.users.length}</span>
            </a>
        `;
    }

    container.innerHTML = html;
}

function resetFilters() {
    document.getElementById("filter-search").value = "";
    document.getElementById("filter-status").value = "ALL";
    document.getElementById("filter-id").value = "";
    currentPageNum = 1;
    renderSheetView();
}

function changePage(delta) {
    currentPageNum = Math.max(1, currentPageNum + delta);
    renderSheetView(false);
}

function renderSheetView(resetPage = true) {
    if (resetPage) currentPageNum = 1;
    updateKpiCards();

    if (activeTab === "MASTER_USER") {
        renderMasterUserTable();
        return;
    }

    const q = (document.getElementById("filter-search")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("filter-status")?.value || "ALL";
    const idFilter = (document.getElementById("filter-id")?.value || "").trim().toLowerCase();

    const baseRows = getAccessibleRowsForSheet(activeTab);
    const filtered = baseRows.filter(r => {
        const cat = getRowAuditCategory(r);
        if (statusFilter !== "ALL" && cat !== statusFilter) return false;

        if (idFilter) {
            const cId = String(r.CashNum || "").toLowerCase();
            const aId = String(r.AuthID || "").toLowerCase();
            if (!cId.includes(idFilter) && !aId.includes(idFilter)) return false;
        }

        if (q) {
            const hay = [
                r.TRXNUM, r.SKU, r.Description, r.Remarks_Kasir,
                r.CashNum, r.CashName, r.AuthID, r.AuthName, r.TrxDate
            ].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
        }

        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPageNum > totalPages) currentPageNum = totalPages;
    const startIdx = (currentPageNum - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    renderPaginationBar(filtered.length, totalPages);
    renderDesktopTable(pageRows, startIdx);
    renderMobileCards(pageRows, startIdx);
}

function renderPaginationBar(totalFiltered, totalPages) {
    const bar = document.getElementById("pagination-bar");
    if (!bar) return;
    if (totalFiltered <= PAGE_SIZE) {
        bar.classList.add("hidden");
        return;
    }
    bar.classList.remove("hidden");
    const startItem = (currentPageNum - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPageNum * PAGE_SIZE, totalFiltered);
    bar.innerHTML = `
        <span class="text-xs text-slate-600 font-semibold">Menampilkan ${startItem}-${endItem} dari ${totalFiltered} transaksi</span>
        <div class="flex items-center gap-2">
            <button onclick="changePage(-1)" ${currentPageNum <= 1 ? "disabled" : ""}
                class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-300 bg-white disabled:opacity-40">
                ← Sebelumnya
            </button>
            <span class="text-xs font-bold text-slate-700">Hal ${currentPageNum} / ${totalPages}</span>
            <button onclick="changePage(1)" ${currentPageNum >= totalPages ? "disabled" : ""}
                class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-300 bg-white disabled:opacity-40">
                Berikutnya →
            </button>
        </div>
    `;
}

function buildPriceBlockHtml(row) {
    const price = toNum(row.Price);
    const amount = toNum(row.Amount) || price;
    const disc = getRowDiscValue(row);
    const net = toNum(row.NetAmount !== undefined ? row.NetAmount : (Math.max(0, amount - disc)));
    const discPrc = String(row.DiscPrc || "").trim();
    const discText = disc > 0
        ? `Disc: <span class="font-bold text-rose-600">-${formatRupiah(disc)}</span>${discPrc ? ` <span class="text-[11px] text-rose-500">(${discPrc}%)</span>` : ""}`
        : `Disc: <span class="font-semibold text-slate-500">${formatRupiah(0)}</span>`;

    return `
        <div class="text-right leading-relaxed space-y-0.5">
            <div class="text-slate-600">Price: <span class="font-semibold text-slate-800">${formatRupiah(price)}</span></div>
            <div class="text-slate-600">Amount: <span class="font-semibold text-slate-800">${formatRupiah(amount)}</span></div>
            <div class="text-slate-600">${discText}</div>
            <div class="text-slate-900 font-extrabold border-t border-slate-100 pt-0.5">Net: ${formatRupiah(net)}</div>
        </div>
    `;
}

function buildItemBoxHtml(row) {
    const trxNum = row.TRXNUM || "-";
    const sku = row.SKU || "-";
    const desc = row.Description || `Item ${sku}`;
    const qty = toNum(row.QTY) || 1;
    const price = toNum(row.Price);
    const amount = toNum(row.Amount) || price;
    const disc = getRowDiscValue(row);
    const net = toNum(row.NetAmount !== undefined ? row.NetAmount : (Math.max(0, amount - disc)));

    return `
        <div class="space-y-1.5">
            <div class="flex items-center gap-2">
                <span class="font-extrabold text-slate-900">${trxNum}</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">1 SKU</span>
            </div>
            <div class="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-indigo-700">1. ${sku}</span>
                    <span class="font-extrabold text-slate-900">${formatRupiah(net)}</span>
                </div>
                <div class="text-[11px] text-slate-700">${desc}</div>
                <div class="text-[11px] text-slate-500">
                    Qty: ${qty} • Price: ${formatRupiah(price)} • Amt: ${formatRupiah(amount)} • Disc: ${formatRupiah(disc)}
                </div>
            </div>
        </div>
    `;
}

function buildActionButtonsHtml(row) {
    const role = String((currentUser && currentUser.Role) || "").toUpperCase();
    const isAdmin = role.includes("ADMIN");
    const isSpv = role.includes("SPV");
    const canRemark = isAdmin || (!isSpv);
    const canVerify = isAdmin || isSpv;
    const hasRemarks = Boolean(String(row.Remarks_Kasir || "").trim());
    const rowIdx = Number(row._rowIndex || 0);

    const btns = [];
    if (canRemark) {
        btns.push(`
            <button onclick="openRemarksModal('${activeTab.replace(/'/g, "\\'")}', ${rowIdx})"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition">
                ${hasRemarks ? "Edit Remarks" : "Isi Remarks"}
            </button>
        `);
    }
    if (canVerify) {
        btns.push(`
            <button onclick="openSpvModal('${activeTab.replace(/'/g, "\\'")}', ${rowIdx})"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                Verifikasi SPV
            </button>
        `);
    }
    return btns.join(" ") || `<span class="text-[11px] text-slate-400">-</span>`;
}

function renderDesktopTable(rows) {
    const tbody = document.getElementById("desktop-tbody");
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-semibold">Tidak ada data transaksi pada filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(row => {
        const cat = getRowAuditCategory(row);
        const statusBadge = cat === "APPROVED"
            ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">APPROVED</span>`
            : cat === "REJECTED"
                ? `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">REJECTED</span>`
                : cat === "READY_SPV"
                    ? `<span class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">Siap Verifikasi</span>`
                    : `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">Pending Remarks</span>`;

        return `
            <tr class="hover:bg-slate-50/70 align-top">
                <td class="py-3 px-3 whitespace-nowrap">
                    <div class="font-bold text-slate-900">${row.TrxDate || "-"}</div>
                    <div class="text-[11px] text-slate-500">${row.TrxTime || "-"} • <span class="text-indigo-600 font-semibold">${row.RegNum || "-"}</span></div>
                </td>
                <td class="py-3 px-3 max-w-xs">${buildItemBoxHtml(row)}</td>
                <td class="py-3 px-3 whitespace-nowrap">${buildPriceBlockHtml(row)}</td>
                <td class="py-3 px-3">
                    <div class="text-[11px] text-slate-500">CashNum: <span class="font-bold text-slate-800">${row.CashNum || "-"}</span></div>
                    <div class="text-[11px] text-indigo-700 font-semibold">${row.CashName || ""}</div>
                    <div class="text-[11px] text-slate-500 mt-1">AuthID: <span class="font-bold text-slate-800">${row.AuthID || "-"}</span></div>
                    <div class="text-[11px] text-indigo-700 font-semibold">${row.AuthName || ""}</div>
                </td>
                <td class="py-3 px-3 max-w-[200px]">
                    ${row.Remarks_Kasir
                        ? `<div class="text-slate-800 font-medium">${row.Remarks_Kasir}</div><div class="text-[10px] text-slate-400 mt-0.5">${row.Waktu_Remarks_Kasir || ""}</div>`
                        : `<span class="italic text-amber-600">Belum diisi kasir</span>`
                    }
                </td>
                <td class="py-3 px-3 space-y-1">
                    <div>${statusBadge}</div>
                    ${row.Catatan_SPV ? `<div class="text-[11px] text-slate-700">Catatan: ${row.Catatan_SPV}</div>` : ""}
                    ${row.SPV_Verifikator_Nama ? `<div class="text-[10px] text-slate-500">Oleh: ${row.SPV_Verifikator_Nama}</div>` : ""}
                    <div class="text-[11px] text-slate-400">${row.Paraf_TTD_Digital_SPV ? "Paraf tersimpan" : "Belum ada paraf"}</div>
                </td>
                <td class="py-3 px-3 text-right whitespace-nowrap">${buildActionButtonsHtml(row)}</td>
            </tr>
        `;
    }).join("");
}

function renderMobileCards(rows) {
    const container = document.getElementById("mobile-cards");
    if (!container) return;
    if (!rows.length) {
        container.innerHTML = `<div class="py-8 text-center text-xs text-slate-400 font-semibold">Tidak ada data transaksi pada filter ini.</div>`;
        return;
    }

    container.innerHTML = rows.map(row => `
        <div class="border border-slate-200 rounded-xl p-3 space-y-2.5 bg-white">
            <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-slate-900">${row.TrxDate || "-"} • ${row.TrxTime || "-"}</span>
                <span class="font-bold text-indigo-600">POS ${row.RegNum || "-"}</span>
            </div>
            ${buildItemBoxHtml(row)}
            ${buildPriceBlockHtml(row)}
            <div class="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                <div>CashNum: <strong>${row.CashNum || "-"}</strong> ${row.CashName ? `(${row.CashName})` : ""}</div>
                <div>Remarks: <strong>${row.Remarks_Kasir || "Belum diisi kasir"}</strong></div>
            </div>
            <div class="flex justify-end pt-1">${buildActionButtonsHtml(row)}</div>
        </div>
    `).join("");
}

function renderMasterUserTable() {
    const tbody = document.getElementById("master-user-tbody");
    if (!tbody) return;
    tbody.innerHTML = db.users.map((u, idx) => `
        <tr>
            <td class="py-2.5 px-3 font-bold text-slate-900">${u.User_ID}</td>
            <td class="py-2.5 px-3">${u.Nama_Lengkap}</td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">${u.Role}</span></td>
            <td class="py-2.5 px-3 font-mono">${u.PIN_Password}</td>
            <td class="py-2.5 px-3">${u.Status_Aktif}</td>
            <td class="py-2.5 px-3 text-right">
                <button onclick="openUserModal(${idx})" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">Edit</button>
            </td>
        </tr>
    `).join("");
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
}

function openUploadModal() {
    document.getElementById("excel-file-input").value = "";
    document.getElementById("upload-progress-text").classList.add("hidden");
    document.getElementById("upload-input-area").classList.remove("hidden");
    document.getElementById("upload-result-area").classList.add("hidden");
    openModal("upload-modal");
}

function detectExcelHeaderRow(rowsMatrix) {
    const known = [
        "trxdate", "date", "counterdate", "trxnum", "parkedinvoicenumber",
        "sku", "cashnum", "cashiernameandid", "price", "amount", "discmanual", "payment"
    ];
    let bestRow = 0;
    let bestScore = -1;
    const limit = Math.min(rowsMatrix.length, 15);
    for (let r = 0; r < limit; r++) {
        const cells = rowsMatrix[r].map(c => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
        const score = cells.filter(c => known.includes(c)).length;
        if (score > bestScore) {
            bestScore = score;
            bestRow = r;
        }
    }
    return bestScore > 0 ? bestRow : 0;
}

function parseExcelSheetRows(sheetName, ws) {
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!matrix || matrix.length <= 1) return [];
    const headerIdx = detectExcelHeaderRow(matrix);
    const headers = matrix[headerIdx].map(h => String(h || "").trim());
    let currentGroupDate = "";
    const out = [];

    for (let r = headerIdx + 1; r < matrix.length; r++) {
        const rowVals = matrix[r];
        if (!rowVals.some(v => String(v || "").trim() !== "")) continue;

        const joined = rowVals.join(" ");
        const dateMatch = joined.match(/Date\s*:\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i);
        if (dateMatch) {
            currentGroupDate = normalizeDateIso(dateMatch[1]);
        }

        const lowerJoined = joined.toLowerCase();
        if (
            lowerJoined.includes("total for") ||
            lowerJoined.includes("grand total") ||
            /^page\s+\d+\s+of\s+\d+/i.test(lowerJoined.trim()) ||
            lowerJoined.includes("storecode-counter no") ||
            /^date\s*:/i.test(lowerJoined.trim())
        ) {
            continue;
        }

        const obj = {};
        headers.forEach((h, c) => {
            if (h) obj[h] = rowVals[c];
        });

        if (String(sheetName).toLowerCase() === "parked invoice" && rowVals.length >= 5) {
            const colEDate = normalizeDateIso(rowVals[4]);
            if (colEDate) obj.TrxDate = colEDate;
        }

        if (!normalizeDateIso(pickField(obj, ["TrxDate", "Date", "CounterDate"])) && currentGroupDate) {
            obj.TrxDate = currentGroupDate;
        }

        out.push(normalizeServerRow(sheetName, obj, r));
    }
    return out;
}

async function submitExcelUpload() {
    const fileInput = document.getElementById("excel-file-input");
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
        alert("Pilih file Excel (.xlsx) terlebih dahulu.");
        return;
    }

    const progressEl = document.getElementById("upload-progress-text");
    const submitBtn = document.getElementById("btn-submit-upload");
    progressEl.textContent = "Membaca file Excel...";
    progressEl.classList.remove("hidden");
    submitBtn.disabled = true;

    try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheetsPayload = {};
        let localAdded = 0;

        TRANSACTION_SHEETS.forEach(sName => {
            const ws = wb.Sheets[sName];
            if (!ws) return;
            const parsedRows = parseExcelSheetRows(sName, ws);
            if (parsedRows.length > 0) {
                sheetsPayload[sName] = parsedRows;
                db.sheets[sName] = (db.sheets[sName] || []).concat(parsedRows);
                localAdded += parsedRows.length;
            }
        });

        saveDb();
        updateLatestDataDateBadge();

        let finalAdded = localAdded;
        let finalRejected = 0;
        let uploadSuccess = true;
        let popupMessage = `File <strong>${file.name}</strong> selesai diproses ke Google Sheets.`;
        const perSheetSummary = {};

        Object.keys(sheetsPayload).forEach(sName => {
            perSheetSummary[sName] = { added: sheetsPayload[sName].length, rejectedDuplicate: 0 };
        });

        const gasUrl = getGasUrl();
        if (!isSimulationMode() && gasUrl) {
            finalAdded = 0;
            finalRejected = 0;
            const BATCH_SIZE = 150;

            for (const [sName, rowsList] of Object.entries(sheetsPayload)) {
                perSheetSummary[sName] = { added: 0, rejectedDuplicate: 0 };
                for (let start = 0; start < rowsList.length; start += BATCH_SIZE) {
                    const end = Math.min(start + BATCH_SIZE, rowsList.length);
                    progressEl.textContent = `Mengirim ${sName} (${end}/${rowsList.length} baris)...`;
                    const chunk = rowsList.slice(start, end);
                    const res = await callGasApi({
                        action: "uploadDailyExcel",
                        sheets: { [sName]: chunk }
                    });
                    if (!res.ok) {
                        uploadSuccess = false;
                        popupMessage = `Upload file <strong>${file.name}</strong> gagal pada sheet <strong>${sName}</strong> (${res.error || "Terjadi kesalahan koneksi"}).`;
                        break;
                    }
                    if (res.data && res.data.perSheet && res.data.perSheet[sName]) {
                        const a = Number(res.data.perSheet[sName].added || 0);
                        const rj = Number(res.data.perSheet[sName].rejectedDuplicate || 0);
                        perSheetSummary[sName].added += a;
                        perSheetSummary[sName].rejectedDuplicate += rj;
                        finalAdded += a;
                        finalRejected += rj;
                    }
                }
                if (!uploadSuccess) break;
            }

            if (uploadSuccess) {
                await refreshAllData(false);
            }
        } else {
            popupMessage = `File <strong>${file.name}</strong> selesai diproses (Mode Simulasi Lokal).`;
            renderTabs();
            renderSheetView();
        }

        const listHtml = Object.entries(perSheetSummary).map(([sName, info]) => `
            <div class="p-3 flex flex-wrap items-center justify-between gap-2">
                <span class="font-bold text-slate-800">${sName}</span>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Added: ${info.added}</span>
                    <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Rejected Duplicate: ${info.rejectedDuplicate}</span>
                </div>
            </div>
        `).join("");

        document.getElementById("upload-summary-msg").innerHTML = popupMessage;
        document.getElementById("upload-totals-banner").innerHTML = `
            <span>Total Masuk: +${finalAdded} baris</span>
            <span>Total Duplikat Ditolak: ${finalRejected} baris</span>
        `;
        document.getElementById("upload-per-sheet-list").innerHTML = listHtml || `<div class="p-3 text-slate-500">Tidak ada baris baru pada sheet yang dipilih.</div>`;
        document.getElementById("upload-input-area").classList.add("hidden");
        document.getElementById("upload-result-area").classList.remove("hidden");
    } catch (err) {
        alert("Gagal membaca file Excel: " + (err.message || err));
    } finally {
        submitBtn.disabled = false;
        progressEl.classList.add("hidden");
    }
}

function openRemarksModal(sheetName, rowIndex) {
    const row = (db.sheets[sheetName] || []).find(r => Number(r._rowIndex) === Number(rowIndex));
    if (!row) return;
    activeRemarksCtx = { sheetName, row };
    document.getElementById("remarks-trx-info").innerHTML = `
        <div><strong>Sheet:</strong> ${sheetName} • <strong>No Trx:</strong> ${row.TRXNUM || "-"}</div>
        <div><strong>SKU:</strong> ${row.SKU || "-"} • <strong>Net:</strong> ${formatRupiah(row.NetAmount)}</div>
    `;
    document.getElementById("remarks-input").value = row.Remarks_Kasir || "";
    openModal("remarks-modal");
}

async function submitRemarks() {
    if (!activeRemarksCtx) return;
    const { sheetName, row } = activeRemarksCtx;
    const remarks = document.getElementById("remarks-input").value.trim();
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    row.Remarks_Kasir = remarks;
    row.Waktu_Remarks_Kasir = nowStr;
    saveDb();
    renderSheetView(false);
    closeModal("remarks-modal");

    await callGasApi({
        action: "saveRemarks",
        sheetName,
        rowIndex: row._rowIndex,
        remarks
    });
}

function openSpvModal(sheetName, rowIndex) {
    const row = (db.sheets[sheetName] || []).find(r => Number(r._rowIndex) === Number(rowIndex));
    if (!row) return;
    activeSpvCtx = { sheetName, row };
    document.getElementById("spv-trx-info").innerHTML = `
        <div><strong>Sheet:</strong> ${sheetName} • <strong>No Trx:</strong> ${row.TRXNUM || "-"}</div>
        <div><strong>Remarks Kasir:</strong> ${row.Remarks_Kasir || "-"}</div>
    `;
    document.getElementById("spv-status-select").value = row.Status_Verifikasi_SPV === "REJECTED" ? "REJECTED" : "APPROVED";
    document.getElementById("spv-note-input").value = row.Catatan_SPV || "";
    clearSignatureCanvas();
    openModal("spv-modal");
}

function clearSignatureCanvas() {
    const canvas = document.getElementById("signature-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function initSignatureEvents() {
    const canvas = document.getElementById("signature-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return {
            x: (src.clientX - rect.left) * (canvas.width / rect.width),
            y: (src.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const start = (e) => {
        isDrawingSig = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };
    const move = (e) => {
        if (!isDrawingSig) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    const end = () => {
        isDrawingSig = false;
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
}

async function submitVerification() {
    if (!activeSpvCtx) return;
    const { sheetName, row } = activeSpvCtx;
    const status = document.getElementById("spv-status-select").value;
    const catatanSpv = document.getElementById("spv-note-input").value.trim();
    const canvas = document.getElementById("signature-canvas");
    const signatureBase64 = canvas.toDataURL("image/png");
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    row.Status_Verifikasi_SPV = status;
    row.Catatan_SPV = catatanSpv;
    row.SPV_Verifikator_ID = currentUser.User_ID;
    row.SPV_Verifikator_Nama = currentUser.Nama_Lengkap;
    row.Paraf_TTD_Digital_SPV = signatureBase64;
    row.Waktu_Verifikasi_SPV = nowStr;

    saveDb();
    renderSheetView(false);
    closeModal("spv-modal");

    await callGasApi({
        action: "saveVerification",
        sheetName,
        rowIndex: row._rowIndex,
        status,
        catatanSpv,
        spvId: currentUser.User_ID,
        spvName: currentUser.Nama_Lengkap,
        signatureBase64
    });
}

function openDeleteRangeModal() {
    const box = document.getElementById("delete-sheet-checkboxes");
    box.innerHTML = TRANSACTION_SHEETS.map(s => `
        <label class="flex items-center gap-1.5">
            <input type="checkbox" class="del-sheet-cb" value="${s}" checked />
            <span class="truncate">${s}</span>
        </label>
    `).join("");
    openModal("delete-range-modal");
}

async function submitDeleteByDateRange() {
    const startDate = document.getElementById("delete-start-date").value;
    const endDate = document.getElementById("delete-end-date").value;
    const sheets = Array.from(document.querySelectorAll(".del-sheet-cb:checked")).map(cb => cb.value);

    if (!startDate || !endDate || !sheets.length) {
        alert("Pilih rentang tanggal dan minimal satu sheet.");
        return;
    }

    sheets.forEach(sName => {
        db.sheets[sName] = (db.sheets[sName] || []).filter(r => {
            const d = normalizeDateIso(r.TrxDate);
            return !(d && d >= startDate && d <= endDate);
        });
    });

    saveDb();
    updateLatestDataDateBadge();
    renderTabs();
    renderSheetView();
    closeModal("delete-range-modal");

    const res = await callGasApi({
        action: "deleteByDateRange",
        sheets,
        startDate,
        endDate
    });
    if (res.ok) {
        await refreshAllData(false);
    }
}

function openUserModal(idx = -1) {
    const u = idx >= 0 ? db.users[idx] : null;
    document.getElementById("mu-userid").value = u ? u.User_ID : "";
    document.getElementById("mu-nama").value = u ? u.Nama_Lengkap : "";
    document.getElementById("mu-role").value = u ? u.Role : "KASIR / SA";
    document.getElementById("mu-pin").value = u ? u.PIN_Password : "123456";
    document.getElementById("mu-status").value = u ? u.Status_Aktif : "AKTIF";
    openModal("user-modal");
}

async function submitSaveUser() {
    const userId = normalizeIdToken(document.getElementById("mu-userid").value);
    const nama = document.getElementById("mu-nama").value.trim();
    const role = document.getElementById("mu-role").value;
    const pin = normalizeIdToken(document.getElementById("mu-pin").value) || "123456";
    const status = document.getElementById("mu-status").value;

    if (!userId || !nama) {
        alert("User ID dan Nama Lengkap wajib diisi.");
        return;
    }

    const existingIdx = db.users.findIndex(u => normalizeIdToken(u.User_ID).toLowerCase() === userId.toLowerCase());
    const record = { User_ID: userId, Nama_Lengkap: nama, Role: role, PIN_Password: pin, Status_Aktif: status };
    if (existingIdx >= 0) db.users[existingIdx] = record;
    else db.users.push(record);

    saveDb();
    renderTabs();
    renderMasterUserTable();
    closeModal("user-modal");

    await callGasApi({
        action: "saveUser",
        userId,
        nama,
        role,
        pin,
        status
    });
}

function openChangePinModal() {
    document.getElementById("new-pin-input").value = "";
    openModal("change-pin-modal");
}

async function submitChangePin() {
    const newPin = normalizeIdToken(document.getElementById("new-pin-input").value);
    if (!newPin || !currentUser) return;
    currentUser.PIN_Password = newPin;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    const target = db.users.find(u => normalizeIdToken(u.User_ID).toLowerCase() === normalizeIdToken(currentUser.User_ID).toLowerCase());
    if (target) target.PIN_Password = newPin;
    saveDb();
    closeModal("change-pin-modal");

    await callGasApi({
        action: "saveUser",
        userId: currentUser.User_ID,
        nama: currentUser.Nama_Lengkap,
        role: currentUser.Role,
        pin: newPin,
        status: currentUser.Status_Aktif || "AKTIF"
    });
}

function openSettingsModal() {
    document.getElementById("settings-gas-url").value = getGasUrl();
    document.getElementById("settings-sim-mode").checked = isSimulationMode();
    openModal("settings-modal");
}

async function saveSettings() {
    const url = document.getElementById("settings-gas-url").value.trim();
    const sim = document.getElementById("settings-sim-mode").checked;
    localStorage.setItem(GAS_URL_KEY, url);
    localStorage.setItem(SIM_MODE_KEY, sim ? "1" : "0");
    closeModal("settings-modal");
    await refreshAllData(true);
}

function exportAllToExcel() {
    const wb = XLSX.utils.book_new();
    TRANSACTION_SHEETS.forEach(sName => {
        const rows = db.sheets[sName] || [];
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sName.slice(0, 31));
    });
    XLSX.writeFile(wb, "Audit_Kasir_MDS_312_Export.xlsx");
}

window.addEventListener("DOMContentLoaded", async () => {
    loadDbFromStorage();
    initSignatureEvents();
    if (isSimulationMode()) {
        updateConnectionBadge("Simulasi Lokal", "amber");
    }
    const settingsBtnInit = document.getElementById("btn-settings");
    if (settingsBtnInit) settingsBtnInit.classList.add("hidden");
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
        try {
            currentUser = JSON.parse(savedSession);
            applyRoleView();
            renderTabs();
            renderSheetView();
        } catch (_) {}
    }
    await refreshAllData(true);
});
