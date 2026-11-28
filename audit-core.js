// Konfigurasi ID Admin Penuh (default: 64593) & 1 ID Admin Khusus Lihat Semua Aktivitas (Read-Only)
const FULL_ADMIN_IDS = ["64593"];
const READONLY_ADMIN_IDS = ["GANTI_ID_ADMIN_LIHAT_SAJA"];

function isReadOnlyAdminUser(user = currentUser) {
    if (!user) return false;
    const uid = normalizeIdToken(user.User_ID).toLowerCase();
    if (!uid) return false;
    const roList = READONLY_ADMIN_IDS
        .map(id => normalizeIdToken(id).toLowerCase())
        .filter(id => id && id !== "ganti_id_admin_lihat_saja");
    return roList.includes(uid);
}

function isFullAdminUser(user = currentUser) {
    if (!user) return false;
    if (isReadOnlyAdminUser(user)) return false;
    const uid = normalizeIdToken(user.User_ID).toLowerCase();
    const role = normalizeRoleName(user.Role);
    const fullList = FULL_ADMIN_IDS.map(id => normalizeIdToken(id).toLowerCase());
    return fullList.includes(uid) || isAdminRole(role);
}

function isAnyAdminViewUser(user = currentUser) {
    return isFullAdminUser(user) || isReadOnlyAdminUser(user);
}
function getGroupAuthId(grp) {
    if (!grp) return "";
    const direct = normalizeIdToken(grp.AuthID);
    if (direct) return direct;
    if (Array.isArray(grp.items)) {
        for (const it of grp.items) {
            const aid = normalizeIdToken(it && it.AuthID);
            if (aid) return aid;
        }
    }
    return "";
}

function canUserVerifyGroup(grp) {
    if (!currentUser || !grp) return false;
    if (isReadOnlyAdminUser(currentUser)) return false;
    const isFullAdmin = isFullAdminUser(currentUser);
    const role = normalizeRoleName(currentUser.Role);
    const isSpv = !isFullAdmin && isSpvVerifierRole(role);
    if (!isFullAdmin && !isSpv) return false;

    const authId = getGroupAuthId(grp);
    if (!authId) return false;

    if (isSpv) {
        const myId = normalizeIdToken(currentUser.User_ID).toLowerCase();
        return authId.toLowerCase() === myId;
    }

    return true;
}
const STORE_ROLES = [
    "ADMIN",
    "STORE - ADMIN STAFF HR",
    "STORE - ASSISTANT STORE MANAGER",
    "STORE - ASSISTANT SUPERVISOR CASHIER",
    "STORE - CASHIER",
    "STORE - EDP",
    "STORE - EXPEDITION",
    "STORE - MONITOR & MCC",
    "STORE - SALES ASSOCIATE",
    "STORE - STORE MANAGER",
    "STORE - SUPERVISOR AREA",
    "STORE - SUPERVISOR CASHIER",
    "STORE - SUPERVISOR EXPEDITION",
    "STORE - SUPERVISOR HR & GA",
    "STORE - SUPERVISOR VM",
    "STORE - VM ARTIST"
];

const SPV_VERIFIER_ROLES = [
    "STORE - ASSISTANT STORE MANAGER",
    "STORE - ASSISTANT SUPERVISOR CASHIER",
    "STORE - STORE MANAGER",
    "STORE - SUPERVISOR AREA",
    "STORE - SUPERVISOR CASHIER",
    "STORE - SUPERVISOR EXPEDITION",
    "STORE - SUPERVISOR HR & GA",
    "STORE - SUPERVISOR VM"
];

const SELF_SCOPED_ROLES = [
    "STORE - CASHIER",
    "STORE - SALES ASSOCIATE"
];

function normalizeRoleName(role) {
    return String(role || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function isAdminRole(role) {
    return normalizeRoleName(role) === "ADMIN";
}

function isSpvVerifierRole(role) {
    const r = normalizeRoleName(role);
    return SPV_VERIFIER_ROLES.includes(r) || r.includes("SUPERVISOR") || r.includes("MANAGER");
}

function isSelfScopedRole(role) {
    const r = normalizeRoleName(role);
    return SELF_SCOPED_ROLES.includes(r) || r.includes("CASHIER") || r.includes("SALES ASSOCIATE");
}

function populateRoleSelect(defaultRole = "STORE - CASHIER") {
    const sel = document.getElementById("mu-role");
    if (!sel) return;
    const normDefault = normalizeRoleName(defaultRole);
    const list = STORE_ROLES.includes(normDefault) || !normDefault
        ? STORE_ROLES
        : [normDefault, ...STORE_ROLES];
    sel.innerHTML = list.map(r => `<option value="${r}">${r}</option>`).join("");
    sel.value = normDefault || "STORE - CASHIER";
}

const GROUP_BY_TRXNUM_SHEETS = [
    "Item Correct",
    "Return",
    "Print Duplicate",
    "Disc Manual"
];
const GROUP_BY_TRXTIME_SHEETS = [
    "Void-Bill Cancelation"
];

function isValidTrxNum(val) {
    const s = normalizeIdToken(val);
    return Boolean(s && s !== "-" && s !== "0");
}

function formatGroupTrxHeader(trxNum, trxTime) {
    const cleanTrx = isValidTrxNum(trxNum) ? normalizeIdToken(trxNum) : "Tanpa No Trx";
    const cleanTime = String(trxTime || "").trim() || "-";
    return `${cleanTrx} • ${cleanTime}`;
}

function groupRowsForDisplay(sheetName, rows) {
    const byTrxNum = GROUP_BY_TRXNUM_SHEETS.includes(sheetName);
    const byTrxTime = GROUP_BY_TRXTIME_SHEETS.includes(sheetName);

    if (!byTrxNum && !byTrxTime) {
        return rows.map(r => {
            const price = toNum(r.Price);
            const amount = toNum(r.Amount) || price;
            const disc = getRowDiscValue(r);
            const net = toNum(r.NetAmount !== undefined ? r.NetAmount : Math.max(0, amount - disc));
            const cleanTrx = isValidTrxNum(r.TRXNUM) ? normalizeIdToken(r.TRXNUM) : "-";
            return {
                groupKey: String(r._rowIndex || Math.random()),
                groupLabel: cleanTrx,
                primaryRow: r,
                items: [r],
                rowIndexes: [Number(r._rowIndex || 0)],
                TrxDate: r.TrxDate || "",
                TrxTime: r.TrxTime || "",
                RegNum: r.RegNum || "",
                TRXNUM: cleanTrx,
                rawTrxNum: isValidTrxNum(r.TRXNUM) ? normalizeIdToken(r.TRXNUM) : "",
                CashNum: r.CashNum || "",
                CashName: r.CashName || "",
                AuthID: r.AuthID || "",
                AuthName: r.AuthName || "",
                totalPrice: price,
                totalAmount: amount,
                totalDisc: disc,
                totalNet: net,
                DiscPrc: r.DiscPrc || "",
                Remarks_Kasir: r.Remarks_Kasir || "",
                Waktu_Remarks_Kasir: r.Waktu_Remarks_Kasir || "",
                Status_Verifikasi_SPV: r.Status_Verifikasi_SPV || "PENDING",
                Catatan_SPV: r.Catatan_SPV || "",
                SPV_Verifikator_Nama: r.SPV_Verifikator_Nama || "",
                Paraf_TTD_Digital_SPV: r.Paraf_TTD_Digital_SPV || ""
            };
        });
    }

    const map = new Map();
    rows.forEach((r, idx) => {
        let key = "";
        let label = "";
        const validTrx = isValidTrxNum(r.TRXNUM) ? normalizeIdToken(r.TRXNUM) : "";
        if (byTrxNum) {
            const dt = String(r.TrxDate || "").trim();
            key = validTrx ? `TRX|${dt}|${validTrx}` : `ROW|${r._rowIndex || idx}`;
            label = validTrx || "-";
        } else if (byTrxTime) {
            const tm = String(r.TrxTime || "").trim();
            const dt = String(r.TrxDate || "").trim();
            const reg = normalizeIdToken(r.RegNum);
            const cash = normalizeIdToken(r.CashNum);
            key = tm ? `TIME|${dt}|${tm}|${reg}|${cash}` : `ROW|${r._rowIndex || idx}`;
            label = formatGroupTrxHeader(validTrx, tm);
        }

        const price = toNum(r.Price);
        const amount = toNum(r.Amount) || price;
        const disc = getRowDiscValue(r);
        const net = toNum(r.NetAmount !== undefined ? r.NetAmount : Math.max(0, amount - disc));

        if (!map.has(key)) {
            map.set(key, {
                groupKey: key,
                groupLabel: label,
                primaryRow: r,
                items: [r],
                rowIndexes: [Number(r._rowIndex || 0)],
                TrxDate: r.TrxDate || "",
                TrxTime: r.TrxTime || "",
                RegNum: r.RegNum || "",
                TRXNUM: label,
                rawTrxNum: validTrx,
                CashNum: r.CashNum || "",
                CashName: r.CashName || "",
                AuthID: r.AuthID || "",
                AuthName: r.AuthName || "",
                totalPrice: price,
                totalAmount: amount,
                totalDisc: disc,
                totalNet: net,
                DiscPrc: r.DiscPrc || "",
                Remarks_Kasir: r.Remarks_Kasir || "",
                Waktu_Remarks_Kasir: r.Waktu_Remarks_Kasir || "",
                Status_Verifikasi_SPV: r.Status_Verifikasi_SPV || "PENDING",
                Catatan_SPV: r.Catatan_SPV || "",
                SPV_Verifikator_Nama: r.SPV_Verifikator_Nama || "",
                Paraf_TTD_Digital_SPV: r.Paraf_TTD_Digital_SPV || ""
            });
        } else {
            const grp = map.get(key);
            grp.items.push(r);
            grp.rowIndexes.push(Number(r._rowIndex || 0));
            grp.totalPrice += price;
            grp.totalAmount += amount;
            grp.totalDisc += disc;
            grp.totalNet += net;
            if (!grp.rawTrxNum && validTrx) {
                grp.rawTrxNum = validTrx;
                if (byTrxTime) {
                    grp.TRXNUM = formatGroupTrxHeader(validTrx, grp.TrxTime || r.TrxTime);
                    grp.groupLabel = grp.TRXNUM;
                }
            }
            if (!grp.CashNum && r.CashNum) grp.CashNum = r.CashNum;
            if (!grp.CashName && r.CashName) grp.CashName = r.CashName;
            if (!grp.AuthID && r.AuthID) grp.AuthID = r.AuthID;
            if (!grp.AuthName && r.AuthName) grp.AuthName = r.AuthName;
            if (!grp.Remarks_Kasir && r.Remarks_Kasir) {
                grp.Remarks_Kasir = r.Remarks_Kasir;
                grp.Waktu_Remarks_Kasir = r.Waktu_Remarks_Kasir || "";
            }
            if (grp.Status_Verifikasi_SPV === "PENDING" && r.Status_Verifikasi_SPV && r.Status_Verifikasi_SPV !== "PENDING") {
                grp.Status_Verifikasi_SPV = r.Status_Verifikasi_SPV;
                grp.Catatan_SPV = r.Catatan_SPV || "";
                grp.SPV_Verifikator_Nama = r.SPV_Verifikator_Nama || "";
                grp.Paraf_TTD_Digital_SPV = r.Paraf_TTD_Digital_SPV || "";
            }
        }
    });

    return Array.from(map.values()).sort((a, b) => {
        const da = `${a.TrxDate || ""} ${a.TrxTime || ""}`;
        const db = `${b.TrxDate || ""} ${b.TrxTime || ""}`;
        return da.localeCompare(db);
    });
}
const REMARKS_TEMPLATES = {
    "Unmatch Transaksi": [
        "Selisih sistem POS dengan fisik struk / EDC",
        "Double input transaksi pada mesin EDC / POS",
        "Transaksi gagal cetak struk namun tercatat di sistem",
        "Koreksi metode pembayaran (Tunai / Debit / QRIS / Kredit)"
    ],
    "Parked Invoice": [
        "Customer mengambil barang tambahan / ketinggalan barang",
        "Customer menunggu konfirmasi pembayaran / transfer / limit kartu",
        "Antrean kasir dialihkan sementara ke POS lain",
        "Transaksi batal setelah di-park (sudah konfirmasi SPV)"
    ],
    "Item Correct": [
        "Salah scan barcode / double scan item oleh kasir",
        "Customer batal membeli sebagian item sebelum pembayaran",
        "Penyesuaian kuantitas (QTY) pembelian customer",
        "Salah input kode SKU / ukuran / warna barang"
    ],
    "Void-Bill Cancelation": [
        "Customer membatalkan seluruh pembelian sebelum pembayaran",
        "Salah metode pembayaran / salah input promo sehingga bill di-void dan input ulang",
        "Kendala jaringan EDC / QRIS saat proses pembayaran",
        "Double transaksi pada nomor struk yang sama"
    ],
    "Return": [
        "Penukaran ukuran / warna barang (sesuai syarat & ketentuan)",
        "Barang cacat / rusak saat diterima customer",
        "Salah beli item oleh customer (dengan struk asli & otorisasi SPV)",
        "Selisih harga / promo tidak terbaca saat transaksi awal"
    ],
    "Price Overide": [
        "Penyesuaian harga sesuai label rak / POP promo berjalan",
        "Barang display / minor defect dengan persetujuan SPV / Store Manager",
        "Koreksi harga sistem yang belum ter-update",
        "Harga khusus member / event store resmi"
    ],
    "Print Duplicate": [
        "Kertas struk habis / macet / terpotong saat pencetakan pertama",
        "Permintaan copy struk oleh customer untuk klaim / garansi",
        "Copy struk untuk arsip administrasi / finance store",
        "Hasil cetak struk pertama buram / tidak terbaca"
    ],
    "Disc Manual": [
        "Diskon promo store / event berjalan yang belum otomatis di POS",
        "Diskon voucher / kupon fisik / member khusus",
        "Diskon persetujuan SPV / Store Manager (barang last piece / minor defect)",
        "Koreksi diskon bundel / beli 2 gratis 1 yang tidak terbaca sistem"
    ]
};

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
        const shifted = new Date(val.getTime() + 12 * 3600 * 1000);
        return formatDateParts(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
    }

    const s = String(val).trim();
    if (!s) return "";

    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const parsedIso = new Date(s);
        if (!isNaN(parsedIso.getTime())) {
            const shifted = new Date(parsedIso.getTime() + 12 * 3600 * 1000);
            return formatDateParts(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
        }
    }

    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        if (Number(isoMatch[1]) <= 1900) return "";
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

    return "";
}

function normalizeTimeVal(val) {
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "number" && isFinite(val) && val >= 0) {
        const frac = val % 1;
        const totalSeconds = Math.round(frac * 86400);
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
    const plainTime = s.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (plainTime) {
        const parts = plainTime[1].split(":");
        const hh = String(parts[0]).padStart(2, "0");
        const mm = String(parts[1]).padStart(2, "0");
        const ss = String(parts[2] || "00").padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            const ss = String(d.getSeconds()).padStart(2, "0");
            return `${hh}:${mm}:${ss}`;
        }
    }
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
        trxDate = normalizeDateIso(raw._groupDate || "");
    }

    const trxTime = normalizeTimeVal(
        pickField(raw, ["TrxTime", "Trx Time", "CreateTime", "TimeOfParking", "Time Of Parking", "Time", "Jam"])
    );
    const regNum = normalizeIdToken(
        pickField(raw, ["RegNum", "Reg Num", "POS", "Pos", "CounterID", "Counter ID", "Counter", "RegNo", "Reg No"])
    );
    const trxNum = normalizeIdToken(
        pickField(raw, ["TrxNum", "TRXNUM", "Trx Num", "Parked Invoice Number", "Parked Invoice", "Invoice", "Receipt"])
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
    const el = document.getElementById("latest-date-badge");
    if (!el) return;
    const canSee = Boolean(currentUser && isAnyAdminViewUser(currentUser));
    el.classList.toggle("hidden", !canSee);
    if (!canSee) return;

    let maxDate = "";
    TRANSACTION_SHEETS.forEach(s => {
        (db.sheets[s] || []).forEach(r => {
            const d = normalizeDateIso(r.TrxDate);
            if (d && (!maxDate || d > maxDate)) maxDate = d;
        });
    });
    el.textContent = `Data terakhir: ${maxDate || "-"}`;
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
    document.documentElement.classList.remove("has-session");
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
    const latestBadge = document.getElementById("latest-date-badge");
    if (latestBadge) {
        latestBadge.classList.add("hidden");
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
    document.documentElement.classList.remove("has-session");
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    document.getElementById("user-info-box").classList.remove("hidden");
    document.getElementById("user-info-box").classList.add("flex");

    const roleLabel = normalizeRoleName(currentUser.Role) || "STORE - CASHIER";
    document.getElementById("user-name-label").textContent = currentUser.Nama_Lengkap || currentUser.User_ID;
    document.getElementById("user-id-label").textContent = `ID: ${currentUser.User_ID}`;
    document.getElementById("user-role-badge").textContent = roleLabel;

    const isFullAdmin = isFullAdminUser(currentUser);
    const isReadOnlyAdmin = isReadOnlyAdminUser(currentUser);
    const isAnyAdmin = isFullAdmin || isReadOnlyAdmin;
    const isSpv = !isAnyAdmin && isSpvVerifierRole(roleLabel);
    const isSelfScoped = !isAnyAdmin && !isSpv && isSelfScopedRole(roleLabel);

    const adminBtns = document.getElementById("admin-action-buttons");
    if (adminBtns) adminBtns.classList.toggle("hidden", !isFullAdmin);
    const settingsBtn = document.getElementById("btn-settings");
    if (settingsBtn) settingsBtn.classList.toggle("hidden", !isFullAdmin);
    updateLatestDataDateBadge();

    if (activeTab === "MASTER_USER" && !isAnyAdmin) {
        window.location.href = "index.html";
        return;
    }

    if (isReadOnlyAdmin) {
        document.getElementById("role-banner-title").textContent = `Mode ADMIN AUDITOR (Hanya Lihat): Memantau seluruh aktivitas & data 8 sheet transaksi serta Master User.`;
        document.getElementById("role-banner-desc").textContent = "Mode khusus pemantauan (read-only): Anda dapat melihat seluruh data dan aktivitas, tanpa akses ubah/hapus/upload/verifikasi/pengaturan.";
    } else if (isFullAdmin) {
        document.getElementById("role-banner-title").textContent = `Mode ${roleLabel} (ID ${currentUser.User_ID}): Akses penuh ke seluruh 8 sheet transaksi, upload Excel harian, download laporan, dan kelola Master User.`;
        document.getElementById("role-banner-desc").textContent = "Anda dapat memantau remarks, melakukan verifikasi SPV, mengunggah file Excel, mengekspor data, serta menghapus data per rentang tanggal.";
    } else if (isSpv) {
        document.getElementById("role-banner-title").textContent = `Mode ${roleLabel}: Data yang tampil hanya transaksi dengan AuthID sesuai ID Anda (${currentUser.User_ID}).`;
        document.getElementById("role-banner-desc").textContent = "Anda hanya melihat dan memverifikasi transaksi yang AuthID-nya cocok dengan ID Anda sendiri.";
    } else if (isSelfScoped) {
        document.getElementById("role-banner-title").textContent = `Mode ${roleLabel}: Isi remarks/keterangan pada transaksi yang terkait ID Anda.`;
        document.getElementById("role-banner-desc").textContent = "Hanya transaksi yang cocok dengan CashNum / AuthID Anda yang ditampilkan.";
    } else {
        document.getElementById("role-banner-title").textContent = `Mode ${roleLabel}: Pemantauan & pengisian remarks audit transaksi.`;
        document.getElementById("role-banner-desc").textContent = "Anda dapat memantau data transaksi pada sheet audit dan mengisi remarks/keterangan sesuai kebutuhan.";
    }
}

function getAccessibleRowsForSheet(sheetName) {
    const rows = db.sheets[sheetName] || [];
    if (!currentUser) return [];
    if (isFullAdminUser(currentUser) || isReadOnlyAdminUser(currentUser)) return rows;

    const role = normalizeRoleName(currentUser.Role);
    const myId = normalizeIdToken(currentUser.User_ID).toLowerCase();

    if (isSpvVerifierRole(role)) {
        return rows.filter(r => {
            const aId = normalizeIdToken(r.AuthID).toLowerCase();
            return Boolean(aId) && aId === myId;
        });
    }

    if (!isSelfScopedRole(role)) return rows;

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
    const showMasterUser = isAnyAdminViewUser(currentUser) && activeTab === "MASTER_USER";
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
    const isAnyAdmin = isAnyAdminViewUser(currentUser);

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

    const activeAnalitik = activeTab === "REKAP_AKTIVITAS";
    html += `
        <a href="rekap-aktivitas.html"
            class="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition ${activeAnalitik ? "bg-rose-600 text-white shadow-sm" : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"}">
            <span>Grafik &amp; Ranking SPV/Kasir</span>
        </a>
    `;

    if (isAnyAdmin) {
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

    const groupedEntries = groupRowsForDisplay(activeTab, filtered);
    const totalPages = Math.max(1, Math.ceil(groupedEntries.length / PAGE_SIZE));
    if (currentPageNum > totalPages) currentPageNum = totalPages;
    const startIdx = (currentPageNum - 1) * PAGE_SIZE;
    const pageGroups = groupedEntries.slice(startIdx, startIdx + PAGE_SIZE);

    renderPaginationBar(groupedEntries.length, totalPages);
    renderDesktopTable(pageGroups, startIdx);
    renderMobileCards(pageGroups, startIdx);
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

function buildPriceBlockHtml(grp) {
    const price = toNum(grp.totalPrice);
    const amount = toNum(grp.totalAmount) || price;
    const disc = toNum(grp.totalDisc);
    const net = toNum(grp.totalNet);
    const discPrc = grp.items.length === 1 ? String(grp.DiscPrc || "").trim() : "";
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

function buildItemBoxHtml(grp) {
    const headerLabel = grp.TRXNUM || "-";
    const itemCount = grp.items.length;
    const itemsHtml = grp.items.map((item, i) => {
        const sku = item.SKU || "-";
        const desc = item.Description || `Item ${sku}`;
        const qty = toNum(item.QTY) || 1;
        const price = toNum(item.Price);
        const amount = toNum(item.Amount) || price;
        const disc = getRowDiscValue(item);
        const net = toNum(item.NetAmount !== undefined ? item.NetAmount : (Math.max(0, amount - disc)));

        return `
            <div class="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-indigo-700">${i + 1}. ${sku}</span>
                    <span class="font-extrabold text-slate-900">${formatRupiah(net)}</span>
                </div>
                <div class="text-[11px] text-slate-700">${desc}</div>
                <div class="text-[11px] text-slate-500">
                    Qty: ${qty} • Price: ${formatRupiah(price)} • Amt: ${formatRupiah(amount)} • Disc: ${formatRupiah(disc)}
                </div>
            </div>
        `;
    }).join("");

    return `
        <div class="space-y-1.5">
            <div class="flex items-center gap-2">
                <span class="font-extrabold text-slate-900">${headerLabel}</span>
                <span class="px-2 py-0.5 rounded ${itemCount > 1 ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700"} font-bold text-[11px]">${itemCount} SKU</span>
            </div>
            <div class="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin pr-0.5">
                ${itemsHtml}
            </div>
        </div>
    `;
}

function buildActionButtonsHtml(grp) {
    if (isReadOnlyAdminUser(currentUser)) {
        return `<span class="text-[11px] text-slate-400 italic">Hanya Lihat</span>`;
    }
    const isFullAdmin = isFullAdminUser(currentUser);
    const role = normalizeRoleName(currentUser && currentUser.Role);
    const isSpv = !isFullAdmin && isSpvVerifierRole(role);
    const authId = getGroupAuthId(grp);
    const canRemark = isFullAdmin || (!isSpv) || !authId;
    const canVerify = canUserVerifyGroup(grp);
    const hasRemarks = Boolean(String(grp.Remarks_Kasir || "").trim());
    const rowIndicesCsv = grp.rowIndexes.join(",");

    const btns = [];
    if (canRemark) {
        btns.push(`
            <button onclick="openRemarksModal('${activeTab.replace(/'/g, "\\'")}', '${rowIndicesCsv}')"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition">
                ${hasRemarks ? "Edit Remarks" : "Isi Remarks"}
            </button>
        `);
    }
    if (canVerify) {
        btns.push(`
            <button onclick="openSpvModal('${activeTab.replace(/'/g, "\\'")}', '${rowIndicesCsv}')"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                Verifikasi SPV
            </button>
        `);
    }
    if (!btns.length && !authId) {
        return `<span class="text-[11px] text-slate-400 italic">Tanpa AuthID (Remarks saja)</span>`;
    }
    return btns.join(" ") || `<span class="text-[11px] text-slate-400">-</span>`;
}

function renderDesktopTable(groups) {
    const tbody = document.getElementById("desktop-tbody");
    if (!tbody) return;
    if (!groups.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-semibold">Tidak ada data transaksi pada filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = groups.map(grp => {
        const cat = getRowAuditCategory(grp);
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
                    <div class="font-bold text-slate-900">${grp.TrxDate || "-"}</div>
                    <div class="text-[11px] text-slate-500">${grp.TrxTime || "-"} • <span class="text-indigo-600 font-semibold">${grp.RegNum || "-"}</span></div>
                </td>
                <td class="py-3 px-3 max-w-xs">${buildItemBoxHtml(grp)}</td>
                <td class="py-3 px-3 whitespace-nowrap">${buildPriceBlockHtml(grp)}</td>
                <td class="py-3 px-3">
                    <div class="text-[11px] text-slate-500">CashNum: <span class="font-bold text-slate-800">${grp.CashNum || "-"}</span></div>
                    <div class="text-[11px] text-indigo-700 font-semibold">${grp.CashName || ""}</div>
                    <div class="text-[11px] text-slate-500 mt-1">AuthID: <span class="font-bold text-slate-800">${grp.AuthID || "-"}</span></div>
                    <div class="text-[11px] text-indigo-700 font-semibold">${grp.AuthName || ""}</div>
                </td>
                <td class="py-3 px-3 max-w-[200px]">
                    ${grp.Remarks_Kasir
                        ? `<div class="text-slate-800 font-medium">${grp.Remarks_Kasir}</div><div class="text-[10px] text-slate-400 mt-0.5">${grp.Waktu_Remarks_Kasir || ""}</div>`
                        : `<span class="italic text-amber-600">Belum diisi kasir</span>`
                    }
                </td>
                <td class="py-3 px-3 space-y-1">
                    <div>${statusBadge}</div>
                    ${grp.Catatan_SPV ? `<div class="text-[11px] text-slate-700">Catatan: ${grp.Catatan_SPV}</div>` : ""}
                    ${grp.SPV_Verifikator_Nama ? `<div class="text-[10px] text-slate-500">Oleh: ${grp.SPV_Verifikator_Nama}</div>` : ""}
                    <div class="text-[11px] text-slate-400">${grp.Paraf_TTD_Digital_SPV ? "Paraf tersimpan" : "Belum ada paraf"}</div>
                </td>
                <td class="py-3 px-3 text-right whitespace-nowrap">${buildActionButtonsHtml(grp)}</td>
            </tr>
        `;
    }).join("");
}

function renderMobileCards(groups) {
    const container = document.getElementById("mobile-cards");
    if (!container) return;
    if (!groups.length) {
        container.innerHTML = `<div class="py-8 text-center text-xs text-slate-400 font-semibold">Tidak ada data transaksi pada filter ini.</div>`;
        return;
    }

    container.innerHTML = groups.map(grp => {
        const authId = getGroupAuthId(grp) || grp.AuthID || "";
        const authName = grp.AuthName || (Array.isArray(grp.items) ? (grp.items.find(it => it && it.AuthName)?.AuthName || "") : "");
        const spvStatus = String(grp.Status_Verifikasi_SPV || "PENDING").toUpperCase();
        const spvNote = grp.Catatan_SPV || "";
        const hasSig = Boolean(grp.Paraf_TTD_Digital_SPV);

        return `
        <div class="border border-slate-200 rounded-xl p-3 space-y-2.5 bg-white min-w-0">
            <div class="flex items-center justify-between text-xs gap-2">
                <span class="font-bold text-slate-900">${grp.TrxDate || "-"} • ${grp.TrxTime || "-"}</span>
                <span class="font-bold text-indigo-600 shrink-0">POS ${grp.RegNum || "-"}</span>
            </div>
            ${buildItemBoxHtml(grp)}
            ${buildPriceBlockHtml(grp)}
            <div class="text-[11px] text-slate-600 pt-1.5 border-t border-slate-100 space-y-1 break-words">
                <div>CashNum: <strong class="text-slate-900">${grp.CashNum || "-"}</strong> ${grp.CashName ? `<span class="font-semibold text-indigo-700">${grp.CashName}</span>` : ""}</div>
                ${(authId || authName) ? `
                <div>AuthID: <strong class="text-slate-900">${authId || "-"}</strong> ${authName ? `<span class="font-semibold text-indigo-700">${authName}</span>` : ""}</div>
                ` : `<div class="text-slate-400">AuthID: -</div>`}
                <div>Remarks: <strong class="text-slate-900">${grp.Remarks_Kasir || "Belum diisi kasir"}</strong></div>
                <div>Status SPV: <strong class="text-slate-900">${spvStatus}</strong>${spvNote ? ` • <span>${spvNote}</span>` : ""} • <span class="text-slate-500">${hasSig ? "Paraf tersimpan" : "Belum ada paraf"}</span></div>
            </div>
            <div class="flex flex-wrap justify-end gap-1.5 pt-1">${buildActionButtonsHtml(grp)}</div>
        </div>
    `;
    }).join("");
}

function renderMasterUserTable() {
    const tbody = document.getElementById("master-user-tbody");
    if (!tbody) return;
    const ro = isReadOnlyAdminUser(currentUser);
    tbody.innerHTML = db.users.map((u, idx) => `
        <tr>
            <td class="py-2.5 px-3 font-bold text-slate-900">${u.User_ID}</td>
            <td class="py-2.5 px-3">${u.Nama_Lengkap}</td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">${u.Role}</span></td>
            <td class="py-2.5 px-3 font-mono">${ro ? "••••••" : u.PIN_Password}</td>
            <td class="py-2.5 px-3">${u.Status_Aktif}</td>
            <td class="py-2.5 px-3 text-right">
                ${ro
                    ? `<span class="text-[11px] text-slate-400 italic">Hanya Lihat</span>`
                    : `<button onclick="openUserModal(${idx})" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">Edit</button>`
                }
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
        const totalForDateMatch = joined.match(/Total\s+For\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i);
        if (dateMatch) {
            currentGroupDate = normalizeDateIso(dateMatch[1]);
        } else if (totalForDateMatch) {
            currentGroupDate = normalizeDateIso(totalForDateMatch[1]);
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
        const wb = XLSX.read(buf, { type: "array", cellDates: false });
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

function onRemarksTemplateChange() {
    const sel = document.getElementById("remarks-template-select");
    const textarea = document.getElementById("remarks-input");
    if (!sel || !textarea) return;
    const val = sel.value;
    if (val === "__MANUAL__") {
        textarea.focus();
        return;
    }
    if (val) {
        textarea.value = val;
        textarea.focus();
    }
}

function clearRemarksText() {
    const sel = document.getElementById("remarks-template-select");
    const textarea = document.getElementById("remarks-input");
    if (sel) sel.value = "__MANUAL__";
    if (textarea) {
        textarea.value = "";
        textarea.focus();
    }
}

function parseRowIndices(rowIndexOrCsv) {
    return String(rowIndexOrCsv || "")
        .split(",")
        .map(s => Number(s.trim()))
        .filter(n => n > 0);
}

function openRemarksModal(sheetName, rowIndexOrCsv) {
    const indices = parseRowIndices(rowIndexOrCsv);
    const rows = (db.sheets[sheetName] || []).filter(r => indices.includes(Number(r._rowIndex)));
    if (!rows.length) return;
    const primary = rows[0];
    const totalGroupNet = rows.reduce((acc, item) => acc + toNum(item.NetAmount), 0);
    activeRemarksCtx = { sheetName, rows };

    const skuSummary = rows.length > 1 ? `${rows.length} SKU (${rows.map(x => x.SKU || "-").join(", ")})` : (primary.SKU || "-");
    document.getElementById("remarks-trx-info").innerHTML = `
        <div><strong>Sheet:</strong> ${sheetName} • <strong>No Trx / Jam:</strong> ${primary.TRXNUM || primary.TrxTime || "-"}</div>
        <div><strong>SKU:</strong> ${skuSummary} • <strong>Total Net:</strong> ${formatRupiah(totalGroupNet)}</div>
    `;

    const existingRemarks = String(primary.Remarks_Kasir || "").trim();
    const templates = REMARKS_TEMPLATES[sheetName] || [];
    const sel = document.getElementById("remarks-template-select");
    if (sel) {
        let optsHtml = `<option value="__MANUAL__">-- Tulis Manual / Bebas --</option>`;
        optsHtml += templates.map(t => `<option value="${t.replace(/"/g, "&quot;")}">${t}</option>`).join("");
        sel.innerHTML = optsHtml;
        if (existingRemarks && templates.includes(existingRemarks)) {
            sel.value = existingRemarks;
        } else {
            sel.value = "__MANUAL__";
        }
    }

    const textarea = document.getElementById("remarks-input");
    if (textarea) {
        textarea.value = existingRemarks;
    }
    openModal("remarks-modal");
}

async function submitRemarks() {
    if (isReadOnlyAdminUser(currentUser)) return;
    if (!activeRemarksCtx) return;
    const { sheetName, rows } = activeRemarksCtx;
    const remarks = document.getElementById("remarks-input").value.trim();
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    rows.forEach(r => {
        r.Remarks_Kasir = remarks;
        r.Waktu_Remarks_Kasir = nowStr;
    });
    saveDb();
    renderSheetView(false);
    closeModal("remarks-modal");

    for (const r of rows) {
        await callGasApi({
            action: "saveRemarks",
            sheetName,
            rowIndex: r._rowIndex,
            remarks
        });
    }
}

function openSpvModal(sheetName, rowIndexOrCsv) {
    const indices = parseRowIndices(rowIndexOrCsv);
    const rows = (db.sheets[sheetName] || []).filter(r => indices.includes(Number(r._rowIndex)));
    if (!rows.length) return;
    const primary = rows[0];
    activeSpvCtx = { sheetName, rows };

    document.getElementById("spv-trx-info").innerHTML = `
        <div><strong>Sheet:</strong> ${sheetName} • <strong>No Trx / Jam:</strong> ${primary.TRXNUM || primary.TrxTime || "-"} (${rows.length} SKU)</div>
        <div><strong>Remarks Kasir:</strong> ${primary.Remarks_Kasir || "-"}</div>
    `;
    document.getElementById("spv-status-select").value = primary.Status_Verifikasi_SPV === "REJECTED" ? "REJECTED" : "APPROVED";
    document.getElementById("spv-note-input").value = primary.Catatan_SPV || "";
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
    if (isReadOnlyAdminUser(currentUser)) return;
    if (!activeSpvCtx) return;
    const { sheetName, rows } = activeSpvCtx;
    const status = document.getElementById("spv-status-select").value;
    const catatanSpv = document.getElementById("spv-note-input").value.trim();
    const canvas = document.getElementById("signature-canvas");
    const signatureBase64 = canvas.toDataURL("image/png");
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    rows.forEach(r => {
        r.Status_Verifikasi_SPV = status;
        r.Catatan_SPV = catatanSpv;
        r.SPV_Verifikator_ID = currentUser.User_ID;
        r.SPV_Verifikator_Nama = currentUser.Nama_Lengkap;
        r.Paraf_TTD_Digital_SPV = signatureBase64;
        r.Waktu_Verifikasi_SPV = nowStr;
    });

    saveDb();
    renderSheetView(false);
    closeModal("spv-modal");

    for (const r of rows) {
        await callGasApi({
            action: "saveVerification",
            sheetName,
            rowIndex: r._rowIndex,
            status,
            catatanSpv,
            spvId: currentUser.User_ID,
            spvName: currentUser.Nama_Lengkap,
            signatureBase64
        });
    }
}

function toggleAllDeleteSheets(checked) {
    document.querySelectorAll(".del-sheet-cb").forEach(cb => {
        cb.checked = Boolean(checked);
    });
}

function openDeleteRangeModal() {
    const box = document.getElementById("delete-sheet-checkboxes");
    box.innerHTML = TRANSACTION_SHEETS.map(s => `
        <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" class="del-sheet-cb" value="${s}" checked />
            <span class="truncate">${s}</span>
        </label>
    `).join("");
    const prog = document.getElementById("delete-progress-text");
    if (prog) {
        prog.textContent = "";
        prog.classList.add("hidden");
    }
    const inputArea = document.getElementById("delete-input-area");
    const resultArea = document.getElementById("delete-result-area");
    if (inputArea) inputArea.classList.remove("hidden");
    if (resultArea) resultArea.classList.add("hidden");
    const submitBtn = document.getElementById("btn-submit-delete");
    const cancelBtn = document.getElementById("btn-cancel-delete");
    if (submitBtn) submitBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    openModal("delete-range-modal");
}

async function submitDeleteByDateRange() {
    if (isReadOnlyAdminUser(currentUser)) return;
    const startDate = document.getElementById("delete-start-date").value;
    const endDate = document.getElementById("delete-end-date").value;
    const sheets = Array.from(document.querySelectorAll(".del-sheet-cb:checked")).map(cb => cb.value);

    if (!startDate || !endDate || !sheets.length) {
        alert("Pilih rentang tanggal dan minimal satu sheet.");
        return;
    }
    if (startDate > endDate) {
        alert("Tanggal Mulai tidak boleh lebih besar dari Tanggal Akhir.");
        return;
    }

    const prog = document.getElementById("delete-progress-text");
    const submitBtn = document.getElementById("btn-submit-delete");
    const cancelBtn = document.getElementById("btn-cancel-delete");
    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    let totalDeleted = 0;
    const perSheet = {};
    let deleteOk = true;
    let errorDetail = "";

    const gasUrl = getGasUrl();
    if (!isSimulationMode() && gasUrl) {
        for (let i = 0; i < sheets.length; i++) {
            const sName = sheets[i];
            if (prog) {
                prog.textContent = `Menghapus data pada ${sName} (${i + 1}/${sheets.length})...`;
                prog.classList.remove("hidden");
            }
            const res = await callGasApi({
                action: "deleteByDateRange",
                sheets: [sName],
                startDate,
                endDate
            });
            if (!res.ok) {
                deleteOk = false;
                errorDetail = `Gagal pada sheet ${sName}: ${res.error || "Terjadi kesalahan koneksi"}`;
                break;
            }
            const deletedCount = Number((res.data && res.data.perSheet && res.data.perSheet[sName]) || (res.data && res.data.totalDeleted) || 0);
            perSheet[sName] = deletedCount;
            totalDeleted += deletedCount;
        }

        if (prog) {
            prog.textContent = "Menyegarkan data terbaru dari Google Sheets...";
        }
        await refreshAllData(false);
    } else {
        sheets.forEach(sName => {
            const before = (db.sheets[sName] || []).length;
            db.sheets[sName] = (db.sheets[sName] || []).filter(r => {
                const d = normalizeDateIso(r.TrxDate);
                return !(d && d >= startDate && d <= endDate);
            });
            const deletedCount = before - db.sheets[sName].length;
            perSheet[sName] = deletedCount;
            totalDeleted += deletedCount;
        });
        saveDb();
        updateLatestDataDateBadge();
        renderTabs();
        renderSheetView();
    }

    if (submitBtn) submitBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (prog) prog.classList.add("hidden");

    const summaryMsg = document.getElementById("delete-summary-msg");
    const totalsBanner = document.getElementById("delete-totals-banner");
    const listEl = document.getElementById("delete-per-sheet-list");

    if (summaryMsg) {
        summaryMsg.innerHTML = deleteOk
            ? `Penghapusan data rentang <strong>${startDate}</strong> s/d <strong>${endDate}</strong> selesai diproses.`
            : `<span class="text-rose-700">Proses penghapusan terhenti. ${errorDetail}</span>`;
    }
    if (totalsBanner) {
        totalsBanner.innerHTML = `
            <span>Status: ${deleteOk ? "Berhasil" : "Gagal / Sebagian"}</span>
            <span class="text-rose-700">Total Dihapus: ${totalDeleted} baris</span>
        `;
    }
    if (listEl) {
        listEl.innerHTML = Object.entries(perSheet).map(([sName, cnt]) => `
            <div class="p-2.5 flex items-center justify-between">
                <span class="font-bold text-slate-800">${sName}</span>
                <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Terhapus: ${cnt}</span>
            </div>
        `).join("") || `<div class="p-3 text-slate-500">Belum ada sheet yang diproses.</div>`;
    }

    const inputArea = document.getElementById("delete-input-area");
    const resultArea = document.getElementById("delete-result-area");
    if (inputArea) inputArea.classList.add("hidden");
    if (resultArea) resultArea.classList.remove("hidden");
}

function openUserModal(idx = -1) {
    const u = idx >= 0 ? db.users[idx] : null;
    document.getElementById("mu-userid").value = u ? u.User_ID : "";
    document.getElementById("mu-nama").value = u ? u.Nama_Lengkap : "";
    populateRoleSelect(u ? u.Role : "STORE - CASHIER");
    document.getElementById("mu-pin").value = u ? u.PIN_Password : "123456";
    document.getElementById("mu-status").value = u ? u.Status_Aktif : "AKTIF";
    openModal("user-modal");
}

async function submitSaveUser() {
    if (isReadOnlyAdminUser(currentUser)) return;
    const userId = normalizeIdToken(document.getElementById("mu-userid").value);
    const nama = document.getElementById("mu-nama").value.trim();
    const role = normalizeRoleName(document.getElementById("mu-role").value);
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

// =====================================================
// PWA INSTALL & SERVICE WORKER REGISTRATION
// =====================================================
let deferredPwaPrompt = null;

window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const btn = document.getElementById("btn-install-pwa");
    if (btn) btn.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
    deferredPwaPrompt = null;
    const btn = document.getElementById("btn-install-pwa");
    if (btn) btn.classList.add("hidden");
});

async function installPwaApp() {
    if (!deferredPwaPrompt) {
        alert("Gunakan menu browser (⋮ / Bagikan) lalu pilih 'Tambahkan ke Layar Utama' atau 'Install App'.");
        return;
    }
    deferredPwaPrompt.prompt();
    await deferredPwaPrompt.userChoice;
    deferredPwaPrompt = null;
    const btn = document.getElementById("btn-install-pwa");
    if (btn) btn.classList.add("hidden");
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
}

// =====================================================
// NOTIFIKASI APLIKASI (BROWSER / OS + IN-APP ALERT)
// =====================================================
const NOTIF_PREF_KEY = "MDS_312_NOTIF_ENABLED_V1";
const NOTIF_SEEN_KEY = "MDS_312_NOTIF_LAST_SIG_V1";

function isNotificationEnabled() {
    try {
        return localStorage.getItem(NOTIF_PREF_KEY) === "1";
    } catch (_) {
        return false;
    }
}

function setNotificationEnabled(val) {
    try {
        localStorage.setItem(NOTIF_PREF_KEY, val ? "1" : "0");
    } catch (_) {}
    updateNotifButtonLabel();
}

function updateNotifButtonLabel() {
    const btn = document.getElementById("btn-notif-pwa");
    if (!btn) return;
    if (!("Notification" in window)) {
        btn.textContent = "Notif: In-App";
        return;
    }
    if (Notification.permission === "granted" && isNotificationEnabled()) {
        btn.textContent = "Notif: Aktif";
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition";
    } else if (Notification.permission === "denied") {
        btn.textContent = "Notif: Diblokir";
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition";
    } else {
        btn.textContent = "Notif: Aktifkan";
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition";
    }
}

function showInAppToast(title, message) {
    let toast = document.getElementById("mds-inapp-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "mds-inapp-toast";
        toast.className = "fixed bottom-4 right-4 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 p-4 space-y-1 transition";
        document.body.appendChild(toast);
    }
    toast.innerHTML = `
        <div class="flex items-start justify-between gap-2">
            <div class="text-xs font-extrabold text-amber-300">${title}</div>
            <button onclick="document.getElementById('mds-inapp-toast')?.remove()" class="text-slate-400 hover:text-white text-xs font-bold">✕</button>
        </div>
        <div class="text-xs text-slate-100 leading-relaxed">${message}</div>
    `;
    toast.classList.remove("hidden");
    clearTimeout(window.__mdsToastTimer);
    window.__mdsToastTimer = setTimeout(() => {
        const el = document.getElementById("mds-inapp-toast");
        if (el) el.classList.add("hidden");
    }, 7000);
}

function computeUserNotificationSummary() {
    if (!currentUser) return null;
    const role = normalizeRoleName(currentUser.Role);
    const isFullAdmin = isFullAdminUser(currentUser);
    const isReadOnlyAdmin = isReadOnlyAdminUser(currentUser);
    const isSpv = !isFullAdmin && !isReadOnlyAdmin && isSpvVerifierRole(role);

    let pendingRemarksCount = 0;
    let readySpvCount = 0;
    let totalRows = 0;

    TRANSACTION_SHEETS.forEach(sheet => {
        const rows = getAccessibleRowsForSheet(sheet);
        totalRows += rows.length;
        rows.forEach(r => {
            const cat = getRowAuditCategory(r);
            if (cat === "PENDING_REMARKS") pendingRemarksCount++;
            else if (cat === "READY_SPV") readySpvCount++;
        });
    });

    if (isSpv) {
        return {
            title: "Audit Kasir MDS 312 • Verifikasi SPV",
            body: readySpvCount > 0
                ? `Ada ${readySpvCount} transaksi (AuthID Anda) siap diverifikasi/diparaf.`
                : `Tidak ada transaksi baru yang siap diverifikasi untuk ID ${currentUser.User_ID}.`,
            sig: `SPV|${currentUser.User_ID}|${readySpvCount}|${pendingRemarksCount}`
        };
    }

    if (isFullAdmin || isReadOnlyAdmin) {
        return {
            title: "Audit Kasir MDS 312 • Ringkasan Audit",
            body: `Pending Remarks: ${pendingRemarksCount} • Siap Verifikasi SPV: ${readySpvCount} (Total data: ${totalRows}).`,
            sig: `ADMIN|${currentUser.User_ID}|${pendingRemarksCount}|${readySpvCount}|${totalRows}`
        };
    }

    return {
        title: "Audit Kasir MDS 312 • Pengingat Remarks",
        body: pendingRemarksCount > 0
            ? `Ada ${pendingRemarksCount} transaksi terkait ID Anda yang belum diisi remarks.`
            : `Semua transaksi terkait ID Anda sudah memiliki remarks.`,
        sig: `USER|${currentUser.User_ID}|${pendingRemarksCount}|${readySpvCount}`
    };
}

async function sendSystemOrInAppNotification(summary, forceAlert = false) {
    if (!summary) return;
    updateNotifButtonLabel();

    let prevSig = "";
    try {
        prevSig = localStorage.getItem(NOTIF_SEEN_KEY) || "";
    } catch (_) {}

    const changed = summary.sig !== prevSig;
    try {
        localStorage.setItem(NOTIF_SEEN_KEY, summary.sig);
    } catch (_) {}

    if (!forceAlert && !changed) return;

    showInAppToast(summary.title, summary.body);

    if ("Notification" in window && Notification.permission === "granted" && isNotificationEnabled()) {
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && typeof reg.showNotification === "function") {
                    await reg.showNotification(summary.title, {
                        body: summary.body,
                        icon: "./icon-192.png",
                        badge: "./icon-192.png",
                        tag: "mds-312-audit-notif"
                    });
                    return;
                }
            }
            new Notification(summary.title, {
                body: summary.body,
                icon: "./icon-192.png"
            });
        } catch (_) {}
    }
}

async function toggleOrTriggerNotifications() {
    if (!currentUser) {
        showInAppToast("Info Notifikasi", "Silakan login terlebih dahulu untuk mengecek notifikasi tugas Anda.");
        return;
    }

    if (!("Notification" in window)) {
        const summary = computeUserNotificationSummary();
        await sendSystemOrInAppNotification(summary, true);
        return;
    }

    if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
            setNotificationEnabled(true);
            const summary = computeUserNotificationSummary();
            await sendSystemOrInAppNotification(summary, true);
            return;
        }
    }

    if (Notification.permission === "granted") {
        const nextState = !isNotificationEnabled();
        setNotificationEnabled(nextState);
        const summary = computeUserNotificationSummary();
        if (nextState) {
            await sendSystemOrInAppNotification(summary, true);
        } else {
            showInAppToast("Notifikasi Perangkat Dinonaktifkan", "Notifikasi pop-up di dalam aplikasi tetap tampil saat ada pembaruan.");
        }
        return;
    }

    const summary = computeUserNotificationSummary();
    await sendSystemOrInAppNotification(summary, true);
}

window.addEventListener("load", () => {
    updateNotifButtonLabel();
    setTimeout(() => {
        if (currentUser) {
            const summary = computeUserNotificationSummary();
            sendSystemOrInAppNotification(summary, false);
        }
    }, 1200);
});
