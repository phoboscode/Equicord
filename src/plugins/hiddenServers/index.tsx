import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { SelectedGuildStore, NavigationRouter, Menu } from "@webpack/common";
import React from "react";

// ==================== CONSTANTS ====================
const SECURITY_QUESTIONS = [
    "What was your first pet's name?",
    "What is your mother's maiden name?",
    "What city were you born in?",
    "What was your first school's name?",
    "What is your favorite color?",
    "What was your first car's brand?",
    "What was your favorite teacher's name?",
];
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

// ==================== SETTINGS ====================
const settings = definePluginSettings({
    pin: {
        type: OptionType.STRING,
        description: "4-digit PIN. Leave empty to be prompted to set one on first unlock.",
        default: "",
    },
    securityQuestion: { type: OptionType.STRING, default: "", hidden: true },
    securityAnswer:   { type: OptionType.STRING, default: "", hidden: true },
    hiddenGuildsList: { type: OptionType.STRING, default: "", hidden: true },
});

// ==================== HELPERS ====================
const store = () => settings.store as any;
function getPin(): string { return store().pin || ""; }
function getSQ(): string { return store().securityQuestion || ""; }
function getSA(): string { return store().securityAnswer || ""; }
function normAnswer(a: string): string {
    return a.trim().toLowerCase().replace(/\s+/g, " ");
}
function getHiddenIds(): string[] {
    const raw = store().hiddenGuildsList || "";
    return raw ? raw.split(",").filter(Boolean) : [];
}
function isHidden(id: string) { return getHiddenIds().includes(id); }

function getGuildStore(): any {
    try {
        const wp = (window as any).Vencord?.Webpack;
        return wp?.findByProps?.("getGuild", "getGuilds") || null;
    } catch { return null; }
}

// Web Animations API — sallantı yok, minimal ve premium soft glow
function attachTypingAnim(input: HTMLInputElement) {
    input.addEventListener("input", () => {
        try {
            input.animate(
                [
                    // Temel odak (focus) durumu
                    { boxShadow: "0 0 0 3px rgba(88, 101, 242, 0.25)", borderColor: "#5865f2" },
                    // Dışa doğru genişleyen soft mavi parlama
                    { boxShadow: "0 0 16px 5px rgba(88, 101, 242, 0.45)", borderColor: "#7289da" },
                    // Temel odak durumuna yumuşak dönüş
                    { boxShadow: "0 0 0 3px rgba(88, 101, 242, 0.25)", borderColor: "#5865f2" }
                ],
                { 
                    duration: 400, // Hızlı bitmemesi için süreyi uzattık
                    easing: "cubic-bezier(0.25, 0.8, 0.25, 1)" // Çok daha yumuşak, premium his veren bir eğri (ease-out)
                }
            );
        } catch { }
    });
}

// ==================== STYLES ====================
function injectStyles() {
    if (document.getElementById("hs-styles")) return;
    if (!document.head) return;
    const s = document.createElement("style");
    s.id = "hs-styles";
    s.textContent = `
        /* ===== ANIMATIONS ===== */
        @keyframes hsBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hsBackdropOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes hsModalIn {
            0% { opacity: 0; transform: translateY(28px) scale(0.94); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hsModalOut {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(12px) scale(0.96); }
        }
        @keyframes hsTileIn {
            0% { opacity: 0; transform: translateY(14px) scale(0.85); }
            60% { opacity: 1; transform: translateY(-2px) scale(1.03); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hsShake {
            0%,100% { transform: translateX(0); }
            20% { transform: translateX(-9px); }
            40% { transform: translateX(9px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
        }
        @keyframes hsFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hsBadgePop {
            0% { transform: scale(0.4); }
            60% { transform: scale(1.25); }
            100% { transform: scale(1); }
        }
        @keyframes hsUnlockRing {
            0% { box-shadow: 0 20px 60px rgba(0,0,0,0.75),
                              0 0 0 0 rgba(88,101,242,0.55); }
            100% { box-shadow: 0 20px 60px rgba(0,0,0,0.75),
                                0 0 0 40px rgba(88,101,242,0); }
        }
        @keyframes hsFadeSlide {
            from { opacity: 0; transform: translateX(-6px); }
            to { opacity: 1; transform: translateX(0); }
        }

        /* ===== BACKDROP / MODAL ===== */
        .hs-backdrop {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            background: rgba(0, 0, 0, 0.72) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            z-index: 2147483646 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 !important; padding: 0 !important;
            animation: hsBackdropIn 0.2s ease-out !important;
        }
        .hs-backdrop.closing { animation: hsBackdropOut 0.18s ease-in forwards !important; }
        .hs-backdrop.closing .hs-modal { animation: hsModalOut 0.18s ease-in forwards !important; }

        .hs-modal {
            position: relative !important;
            background: linear-gradient(180deg, #36393f 0%, #2f3136 100%) !important;
            border-radius: 18px !important;
            width: 440px !important; max-width: 92vw !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.75),
                        0 0 0 1px rgba(255,255,255,0.05) inset !important;
            padding: 26px !important;
            color: #dbdee1 !important;
            font-family: gg sans, "Noto Sans", Helvetica, Arial, sans-serif !important;
            font-size: 14px !important;
            box-sizing: border-box !important;
            animation: hsModalIn 0.28s cubic-bezier(0.18, 1.1, 0.4, 1) !important;
            max-height: 90vh !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
        }
        .hs-modal.shake { animation: hsShake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97) !important; }
        .hs-modal.unlock-flash { animation: hsModalIn 0.28s cubic-bezier(0.18, 1.1, 0.4, 1),
                                             hsUnlockRing 0.8s ease-out !important; }

        /* ===== TEXT ===== */
        .hs-modal-title {
            font-weight: 700 !important; font-size: 19px !important;
            color: #f2f3f5 !important; margin-bottom: 6px !important;
            text-align: center !important;
            display: flex !important; align-items: center !important;
            justify-content: center !important; gap: 10px !important;
            animation: hsFadeSlide 0.35s ease-out !important;
        }
        .hs-modal-sub {
            text-align: center !important;
            color: #a3a6aa !important;
            font-size: 13px !important;
            margin-bottom: 22px !important;
            animation: hsFadeSlide 0.4s ease-out 0.05s both !important;
        }

        .hs-field-label {
            font-size: 12px !important;
            color: #b5bac1 !important;
            margin: 14px 0 6px 4px !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.4px !important;
            animation: hsFadeIn 0.3s ease-out both !important;
        }

        /* ===== INPUTS ===== */
        .hs-pin-input, .hs-answer-input, .hs-select {
            width: 100% !important;
            padding: 14px 12px !important;
            font-size: 16px !important;
            background: #1e1f22 !important;
            border: 2px solid #1e1f22 !important;
            border-radius: 10px !important;
            color: #f2f3f5 !important;
            outline: none !important;
            box-sizing: border-box !important;
            font-family: inherit !important;
            transition: border-color 0.18s, box-shadow 0.18s, background 0.18s !important;
            animation: hsFadeIn 0.3s ease-out both !important;
        }
        .hs-pin-input:hover, .hs-answer-input:hover { background: #232428 !important; }
        .hs-pin-input {
            font-size: 30px !important;
            letter-spacing: 18px !important;
            text-align: center !important;
            text-indent: 18px !important;
            padding: 16px 12px !important;
        }
        .hs-pin-input:focus, .hs-answer-input:focus, .hs-select:focus {
            border-color: #5865f2 !important;
            box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.25) !important;
            background: #232428 !important;
        }
        .hs-select {
            cursor: pointer !important;
            appearance: none !important;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23b5bac1'><path d='M7 10l5 5 5-5z'/></svg>") !important;
            background-repeat: no-repeat !important;
            background-position: right 14px center !important;
            padding-right: 40px !important;
        }

        /* ===== ERRORS ===== */
        .hs-pin-error {
            text-align: center !important; color: #f23f43 !important;
            font-size: 13px !important; margin-top: 12px !important;
            font-weight: 600 !important;
            animation: hsFadeIn 0.2s !important;
        }

        /* ===== BUTTONS ===== */
        .hs-btn-row { display: flex !important; gap: 10px !important; margin-top: 20px !important; }
        .hs-btn-row.center { justify-content: center !important; }
        .hs-btn {
            flex: 1 !important;
            padding: 12px !important;
            border-radius: 10px !important;
            border: none !important;
            cursor: pointer !important;
            font-weight: 600 !important;
            font-size: 14px !important;
            font-family: inherit !important;
            transition: filter 0.15s, background 0.15s, transform 0.1s, box-shadow 0.15s !important;
        }
        .hs-btn:active { transform: scale(0.97) !important; }
        .hs-btn:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }
        .hs-btn-primary { background: #5865f2 !important; color: #fff !important; }
        .hs-btn-primary:hover:not(:disabled) {
            background: #4752c4 !important;
            box-shadow: 0 6px 16px rgba(88,101,242,0.35) !important;
        }
        .hs-btn-secondary { background: #4e5058 !important; color: #dbdee1 !important; }
        .hs-btn-secondary:hover { background: #6d6f78 !important; }
        .hs-link-btn {
            background: none !important; border: none !important;
            color: #00a8fc !important; cursor: pointer !important;
            font-size: 13px !important; padding: 6px !important;
            font-family: inherit !important;
            text-align: center !important;
            margin-top: 10px !important;
            display: block !important;
            width: 100% !important;
            transition: color 0.15s, letter-spacing 0.15s !important;
        }
        .hs-link-btn:hover { color: #4bb8ff !important; text-decoration: underline !important; }

        /* ===== GRID / TILES ===== */
        .hs-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 10px !important;
            max-height: 380px !important;
            overflow-y: auto !important;
            padding: 8px 6px !important;
            scrollbar-width: thin !important;
            scrollbar-color: #1e1f22 transparent !important;
        }
        .hs-grid::-webkit-scrollbar { width: 6px; }
        .hs-grid::-webkit-scrollbar-thumb { background: #1e1f22; border-radius: 3px; }
        .hs-grid::-webkit-scrollbar-thumb:hover { background: #2b2d31; }
        .hs-grid::-webkit-scrollbar-track { background: transparent; }

        .hs-item {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            padding: 6px 4px !important;
            border-radius: 12px !important;
            transition: background 0.18s, transform 0.12s !important;
            animation: hsTileIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.1) both !important;
            user-select: none !important;
            position: relative !important;
        }
        .hs-item:hover { background: rgba(255,255,255,0.05) !important; }
        .hs-item:active { transform: scale(0.95) !important; }
        .hs-item-icon {
            width: 58px !important; height: 58px !important;
            border-radius: 16px !important;
            background: #1e1f22 !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: border-radius 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.1),
                        transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.1),
                        box-shadow 0.25s !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }
        .hs-item:hover .hs-item-icon {
            border-radius: 14px !important;
            transform: scale(1.1) translateY(-3px) !important;
            box-shadow: 0 10px 22px rgba(0,0,0,0.5),
                        0 0 0 2px rgba(88,101,242,0.4) !important;
        }
        .hs-item:active .hs-item-icon {
            transform: scale(1.02) translateY(0) !important;
        }
        .hs-img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        .hs-fallback {
            font-weight: 700 !important; color: #f2f3f5 !important;
            font-size: 22px !important;
        }
        .hs-item-name {
            font-size: 11px !important;
            color: #b5bac1 !important;
            max-width: 72px !important;
            width: 100% !important;
            text-align: center !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            transition: color 0.18s !important;
            font-weight: 500 !important;
        }
        .hs-item:hover .hs-item-name { color: #f2f3f5 !important; }

        .hs-empty {
            text-align: center !important; color: #a3a6aa !important;
            padding: 40px 0 !important; font-size: 14px !important;
            animation: hsFadeIn 0.4s ease-out !important;
        }
        .hs-empty::before {
            content: "📭" !important;
            display: block !important;
            font-size: 48px !important;
            margin-bottom: 12px !important;
            opacity: 0.5 !important;
        }

        .hs-badge-info {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            background: linear-gradient(90deg, rgba(88,101,242,0.18), rgba(88,101,242,0.1)) !important;
            color: #a5b3ff !important;
            padding: 6px 14px !important;
            border-radius: 20px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            margin: 0 auto 16px !important;
            border: 1px solid rgba(88,101,242,0.25) !important;
            animation: hsFadeSlide 0.4s ease-out 0.08s both !important;
        }

        /* ===== LOCK BUTTON ===== */
        .hs-lock-btn {
            transition: background 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1),
                        border-radius 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1),
                        transform 0.15s !important;
        }
        .hs-lock-btn:hover {
            transform: scale(1.06) !important;
        }
        .hs-lock-btn:active {
            transform: scale(0.93) !important;
        }
        .hs-badge {
            animation: hsBadgePop 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.4) !important;
        }

        /* ===== CONTEXT MENU ===== */
        .hs-tile-ctx {
            animation: hsModalIn 0.18s cubic-bezier(0.18, 1.1, 0.4, 1) !important;
        }
    `;
    document.head.appendChild(s);
}

// ==================== HIDE ====================
function getClassName(el: Element): string {
    const c = (el as any).className;
    if (typeof c === "string") return c;
    return c?.baseVal || "";
}

function applyHiding() {
    document.querySelectorAll("[data-hs-hidden]").forEach(el => {
        (el as HTMLElement).style.removeProperty("display");
        el.removeAttribute("data-hs-hidden");
    });
    for (const id of getHiddenIds()) {
        const inner = document.querySelector<HTMLElement>(`[data-list-item-id="guildsnav___${id}"]`);
        if (!inner) continue;
        let el: HTMLElement | null = inner;
        let safety = 0;
        while (el && safety++ < 15) {
            if (/^listItem__/.test(getClassName(el))) break;
            el = el.parentElement;
        }
        const target: HTMLElement | null = el || inner.parentElement;
        if (target) {
            target.style.setProperty("display", "none", "important");
            target.setAttribute("data-hs-hidden", "1");
        }
    }
}

function setHiddenIds(ids: string[]) {
    store().hiddenGuildsList = ids.join(",");
    applyHiding();
    refreshBadge();
    if (modalEl && currentScreen === "unlocked") renderContent();
}

// ==================== MODAL STATE ====================
type Screen = "setup" | "pin" | "forgot" | "reset" | "unlocked";

let lockWrap: HTMLDivElement | null = null;
let badgeEl: HTMLSpanElement | null = null;
let modalEl: HTMLDivElement | null = null;
let modalBox: HTMLDivElement | null = null;
let currentScreen: Screen = "pin";

let failedAttempts = 0;
let lockoutUntil = 0;

function refreshBadge() {
    if (badgeEl) {
        const n = getHiddenIds().length;
        badgeEl.textContent = n > 0 ? String(n) : "";
        badgeEl.style.display = n > 0 ? "flex" : "none";
    }
}

function openModal() {
    if (modalEl) return;
    injectStyles();

    currentScreen = !getPin() ? "setup" : "pin";
    failedAttempts = 0;

    modalEl = document.createElement("div");
    modalEl.className = "hs-backdrop";
    modalEl.addEventListener("mousedown", e => { if (e.target === modalEl) closeModal(); });

    modalBox = document.createElement("div");
    modalBox.className = "hs-modal";
    modalBox.addEventListener("mousedown", e => e.stopPropagation());
    modalEl.appendChild(modalBox);

    document.documentElement.appendChild(modalEl);
    renderContent();

    const escHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            closeModal();
            window.removeEventListener("keydown", escHandler);
        }
    };
    window.addEventListener("keydown", escHandler);
}

function closeModal() {
    if (!modalEl) return;
    const el = modalEl;
    el.classList.add("closing");
    setTimeout(() => {
        el.remove();
        if (modalEl === el) {
            modalEl = null;
            modalBox = null;
        }
    }, 180);
}

function setScreen(s: Screen) {
    currentScreen = s;
    renderContent();
}

function shakeModal() {
    if (!modalBox) return;
    modalBox.classList.remove("shake");
    void modalBox.offsetWidth;
    modalBox.classList.add("shake");
    setTimeout(() => modalBox?.classList.remove("shake"), 500);
}

function flashUnlock() {
    if (!modalBox) return;
    modalBox.classList.remove("unlock-flash");
    void modalBox.offsetWidth;
    modalBox.classList.add("unlock-flash");
    setTimeout(() => modalBox?.classList.remove("unlock-flash"), 900);
}

function renderContent() {
    if (!modalBox) return;
    modalBox.innerHTML = "";
    modalBox.classList.remove("shake");

    switch (currentScreen) {
        case "setup": renderSetup(); break;
        case "pin": renderPin(); break;
        case "forgot": renderForgot(); break;
        case "reset": renderReset(); break;
        case "unlocked": renderUnlockedList(); break;
    }
}

// ==================== SCREEN: SETUP ====================
function renderSetup() {
    if (!modalBox) return;

    const title = document.createElement("div");
    title.className = "hs-modal-title";
    title.textContent = "🔐 Initial Setup";
    modalBox.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "hs-modal-sub";
    sub.textContent = "Set a PIN and a security question for your server lock";
    modalBox.appendChild(sub);

    const mkLabel = (t: string) => {
        const el = document.createElement("div");
        el.className = "hs-field-label";
        el.textContent = t;
        modalBox!.appendChild(el);
    };

    mkLabel("4-digit PIN");
    const pinInput = document.createElement("input");
    pinInput.className = "hs-pin-input";
    pinInput.type = "password";
    pinInput.inputMode = "numeric";
    pinInput.maxLength = 4;
    pinInput.placeholder = "••••";
    modalBox.appendChild(pinInput);
    attachTypingAnim(pinInput);

    mkLabel("Confirm PIN");
    const pin2Input = document.createElement("input");
    pin2Input.className = "hs-pin-input";
    pin2Input.type = "password";
    pin2Input.inputMode = "numeric";
    pin2Input.maxLength = 4;
    pin2Input.placeholder = "••••";
    modalBox.appendChild(pin2Input);
    attachTypingAnim(pin2Input);

    mkLabel("Security Question");
    const select = document.createElement("select");
    select.className = "hs-select";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Choose a question —";
    select.appendChild(opt0);
    for (const q of SECURITY_QUESTIONS) {
        const opt = document.createElement("option");
        opt.value = q;
        opt.textContent = q;
        select.appendChild(opt);
    }
    modalBox.appendChild(select);

    mkLabel("Answer");
    const answerInput = document.createElement("input");
    answerInput.className = "hs-answer-input";
    answerInput.type = "text";
    answerInput.placeholder = "Type your answer here";
    modalBox.appendChild(answerInput);
    attachTypingAnim(answerInput);

    const err = document.createElement("div");
    err.className = "hs-pin-error";
    err.style.display = "none";
    modalBox.appendChild(err);

    const row = document.createElement("div");
    row.className = "hs-btn-row";

    const saveBtn = document.createElement("button");
    saveBtn.className = "hs-btn hs-btn-primary";
    saveBtn.textContent = "Save & Unlock";
    row.appendChild(saveBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "hs-btn hs-btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = closeModal;
    row.appendChild(cancelBtn);

    modalBox.appendChild(row);

    const showError = (msg: string) => {
        err.textContent = msg;
        err.style.display = "block";
        shakeModal();
    };

    saveBtn.onclick = () => {
        const p1 = pinInput.value.trim();
        const p2 = pin2Input.value.trim();
        const q = select.value;
        const a = answerInput.value.trim();

        if (!/^\d{4}$/.test(p1)) { showError("PIN must be 4 digits (numbers only)"); pinInput.focus(); return; }
        if (p1 !== p2) { showError("PINs do not match"); pin2Input.focus(); return; }
        if (!q) { showError("Please choose a security question"); select.focus(); return; }
        if (a.length < 2) { showError("Answer must be at least 2 characters"); answerInput.focus(); return; }

        store().pin = p1;
        store().securityQuestion = q;
        store().securityAnswer = normAnswer(a);
        failedAttempts = 0;
        setScreen("unlocked");
        setTimeout(flashUnlock, 40);
    };

    setTimeout(() => pinInput.focus(), 150);
}

// ==================== SCREEN: PIN ====================
function renderPin() {
    if (!modalBox) return;

    const title = document.createElement("div");
    title.className = "hs-modal-title";
    title.textContent = "🔒 Hidden Servers";
    modalBox.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "hs-modal-sub";
    sub.textContent = "Enter your PIN to continue";
    modalBox.appendChild(sub);

    const input = document.createElement("input");
    input.className = "hs-pin-input";
    input.type = "password";
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = "••••";
    modalBox.appendChild(input);
    attachTypingAnim(input);

    const err = document.createElement("div");
    err.className = "hs-pin-error";
    err.style.display = "none";
    modalBox.appendChild(err);

    const row = document.createElement("div");
    row.className = "hs-btn-row";

    const unlockBtn = document.createElement("button");
    unlockBtn.className = "hs-btn hs-btn-primary";
    unlockBtn.textContent = "Unlock";
    row.appendChild(unlockBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "hs-btn hs-btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = closeModal;
    row.appendChild(cancelBtn);
    modalBox.appendChild(row);

    const forgot = document.createElement("button");
    forgot.className = "hs-link-btn";
    forgot.textContent = "Forgot your PIN?";
    forgot.onclick = () => setScreen("forgot");
    modalBox.appendChild(forgot);

    const attemptUnlock = () => {
        const now = Date.now();
        if (now < lockoutUntil) {
            const sec = Math.ceil((lockoutUntil - now) / 1000);
            err.textContent = `Too many attempts. Wait ${sec}s.`;
            err.style.display = "block";
            input.value = "";
            return;
        }
        if (input.value === getPin()) {
            failedAttempts = 0;
            setScreen("unlocked");
            setTimeout(flashUnlock, 40);
        } else {
            failedAttempts++;
            if (failedAttempts >= MAX_ATTEMPTS) {
                lockoutUntil = now + LOCKOUT_MS;
                failedAttempts = 0;
                err.textContent = `Too many wrong attempts. Wait ${LOCKOUT_MS / 1000}s.`;
            } else {
                err.textContent = `Wrong PIN (${MAX_ATTEMPTS - failedAttempts} attempts left)`;
            }
            err.style.display = "block";
            input.value = "";
            input.focus();
            shakeModal();
        }
    };
    unlockBtn.onclick = attemptUnlock;
    input.addEventListener("keydown", e => { if (e.key === "Enter") attemptUnlock(); });
    setTimeout(() => input.focus(), 150);
}

// ==================== SCREEN: FORGOT ====================
function renderForgot() {
    if (!modalBox) return;

    const title = document.createElement("div");
    title.className = "hs-modal-title";
    title.textContent = "❓ Security Question";
    modalBox.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "hs-modal-sub";
    sub.textContent = getSQ() || "(no question set)";
    modalBox.appendChild(sub);

    const aLabel = document.createElement("div");
    aLabel.className = "hs-field-label";
    aLabel.textContent = "Your Answer";
    modalBox.appendChild(aLabel);

    const input = document.createElement("input");
    input.className = "hs-answer-input";
    input.type = "text";
    input.placeholder = "Type your answer here";
    modalBox.appendChild(input);
    attachTypingAnim(input);

    const err = document.createElement("div");
    err.className = "hs-pin-error";
    err.style.display = "none";
    err.textContent = "Wrong answer";
    modalBox.appendChild(err);

    const row = document.createElement("div");
    row.className = "hs-btn-row";

    const submit = document.createElement("button");
    submit.className = "hs-btn hs-btn-primary";
    submit.textContent = "Verify";
    row.appendChild(submit);

    const back = document.createElement("button");
    back.className = "hs-btn hs-btn-secondary";
    back.textContent = "Back";
    back.onclick = () => setScreen("pin");
    row.appendChild(back);

    modalBox.appendChild(row);

    const tryVerify = () => {
        const expected = getSA();
        if (!expected) {
            err.textContent = "No security question set. Reset from settings.";
            err.style.display = "block";
            return;
        }
        if (normAnswer(input.value) === expected) {
            setScreen("reset");
        } else {
            err.style.display = "block";
            input.value = "";
            input.focus();
            shakeModal();
        }
    };
    submit.onclick = tryVerify;
    input.addEventListener("keydown", e => { if (e.key === "Enter") tryVerify(); });
    setTimeout(() => input.focus(), 150);
}

// ==================== SCREEN: RESET ====================
function renderReset() {
    if (!modalBox) return;

    const title = document.createElement("div");
    title.className = "hs-modal-title";
    title.textContent = "🔑 Set New PIN";
    modalBox.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "hs-modal-sub";
    sub.textContent = "Enter your new 4-digit PIN";
    modalBox.appendChild(sub);

    const l1 = document.createElement("div");
    l1.className = "hs-field-label";
    l1.textContent = "New PIN";
    modalBox.appendChild(l1);
    const p1 = document.createElement("input");
    p1.className = "hs-pin-input";
    p1.type = "password";
    p1.inputMode = "numeric";
    p1.maxLength = 4;
    p1.placeholder = "••••";
    modalBox.appendChild(p1);
    attachTypingAnim(p1);

    const l2 = document.createElement("div");
    l2.className = "hs-field-label";
    l2.textContent = "Confirm New PIN";
    modalBox.appendChild(l2);
    const p2 = document.createElement("input");
    p2.className = "hs-pin-input";
    p2.type = "password";
    p2.inputMode = "numeric";
    p2.maxLength = 4;
    p2.placeholder = "••••";
    modalBox.appendChild(p2);
    attachTypingAnim(p2);

    const err = document.createElement("div");
    err.className = "hs-pin-error";
    err.style.display = "none";
    modalBox.appendChild(err);

    const row = document.createElement("div");
    row.className = "hs-btn-row";

    const save = document.createElement("button");
    save.className = "hs-btn hs-btn-primary";
    save.textContent = "Save";
    row.appendChild(save);

    const cancel = document.createElement("button");
    cancel.className = "hs-btn hs-btn-secondary";
    cancel.textContent = "Cancel";
    cancel.onclick = closeModal;
    row.appendChild(cancel);

    modalBox.appendChild(row);

    save.onclick = () => {
        const v1 = p1.value.trim(), v2 = p2.value.trim();

        if (!/^\d{4}$/.test(v1)) {
            err.textContent = "PIN must be 4 digits (numbers only)";
            err.style.display = "block";
            p1.focus();
            return;
        }
        if (v1 === getPin()) {
            err.textContent = "You cannot reuse your previous PIN";
            err.style.display = "block";
            p1.value = "";
            p2.value = "";
            p1.focus();
            shakeModal();
            return;
        }
        if (v1 !== v2) {
            err.textContent = "PINs do not match";
            err.style.display = "block";
            p2.focus();
            return;
        }
        store().pin = v1;
        failedAttempts = 0;
        lockoutUntil = 0;
        setScreen("unlocked");
        setTimeout(flashUnlock, 40);
    };
    setTimeout(() => p1.focus(), 150);
}

// ==================== SCREEN: UNLOCKED ====================
function renderUnlockedList() {
    if (!modalBox) return;
    const hidden = getHiddenIds();
    const GS = getGuildStore();

    const title = document.createElement("div");
    title.className = "hs-modal-title";
    title.textContent = "🔓 Hidden Servers";
    modalBox.appendChild(title);

    const countBadge = document.createElement("div");
    countBadge.className = "hs-badge-info";
    countBadge.textContent = `${hidden.length} server${hidden.length === 1 ? "" : "s"} hidden`;
    modalBox.appendChild(countBadge);

    if (hidden.length === 0) {
        const empty = document.createElement("div");
        empty.className = "hs-empty";
        empty.textContent = "No hidden servers";
        modalBox.appendChild(empty);
    } else {
        const grid = document.createElement("div");
        grid.className = "hs-grid";
        hidden.forEach((id, i) => {
            const guild = GS?.getGuild?.(id) || null;

            const tile = document.createElement("div");
            tile.className = "hs-item";
            tile.title = (guild?.name || id) + "  —  click to open · right-click to unhide";
            tile.style.animationDelay = `${i * 35}ms`;

            const iconBox = document.createElement("div");
            iconBox.className = "hs-item-icon";

            let iconUrl: string | null = null;
            try {
                if (guild && typeof guild.getIconURL === "function") {
                    iconUrl = guild.getIconURL(64, true) || null;
                }
                if (!iconUrl && guild?.icon) {
                    const ext = guild.icon.startsWith("a_") ? "gif" : "png";
                    iconUrl = `https://cdn.discordapp.com/icons/${id}/${guild.icon}.${ext}?size=64`;
                }
            } catch { }

            if (iconUrl) {
                const img = document.createElement("img");
                img.src = iconUrl;
                img.className = "hs-img";
                img.draggable = false;
                iconBox.appendChild(img);
            } else {
                const fb = document.createElement("div");
                fb.className = "hs-fallback";
                fb.textContent = (guild?.name || "?")[0].toUpperCase();
                iconBox.appendChild(fb);
            }
            tile.appendChild(iconBox);

            const nameEl = document.createElement("div");
            nameEl.className = "hs-item-name";
            nameEl.textContent = guild?.name || "Unknown";
            tile.appendChild(nameEl);

            tile.onclick = () => {
                try { NavigationRouter.transitionTo(`/channels/${id}`); } catch { }
                closeModal();
            };
            tile.oncontextmenu = e => {
                e.preventDefault();
                e.stopPropagation();
                showTileContextMenu(e.clientX, e.clientY, id);
            };
            grid.appendChild(tile);
        });
        modalBox.appendChild(grid);
    }

    const row = document.createElement("div");
    row.className = "hs-btn-row";
    const closeBtn = document.createElement("button");
    closeBtn.className = "hs-btn hs-btn-secondary";
    closeBtn.textContent = "Close";
    closeBtn.onclick = closeModal;
    row.appendChild(closeBtn);
    modalBox.appendChild(row);
}

function showTileContextMenu(x: number, y: number, id: string) {
    document.querySelectorAll(".hs-tile-ctx").forEach(e => e.remove());

    const GS = getGuildStore();
    const guild = GS?.getGuild?.(id);
    const name = guild?.name || "Server";

    const menu = document.createElement("div");
    menu.className = "hs-tile-ctx";
    menu.style.cssText = `position:fixed;top:${y}px;left:${x}px;z-index:2147483647;
        background:linear-gradient(180deg,#36393f,#2f3136);border-radius:10px;padding:6px;
        box-shadow:0 12px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05);
        min-width:200px;color:#dbdee1;
        font-family:gg sans, sans-serif;font-size:14px;`;

    const header = document.createElement("div");
    header.textContent = name.length > 22 ? name.slice(0, 21) + "…" : name;
    header.style.cssText = "padding:6px 12px 8px;font-size:11px;color:#a3a6aa;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:4px;";
    menu.appendChild(header);

    const mk = (label: string, icon: string, fn: () => void) => {
        const el = document.createElement("div");
        el.style.cssText = "padding:9px 12px;cursor:pointer;border-radius:6px;color:#dbdee1;display:flex;align-items:center;gap:10px;transition:background 0.1s,transform 0.08s;";
        const ic = document.createElement("span");
        ic.textContent = icon;
        ic.style.cssText = "font-size:15px;width:18px;text-align:center;";
        el.appendChild(ic);
        const tx = document.createElement("span");
        tx.textContent = label;
        el.appendChild(tx);
        el.onmouseenter = () => { el.style.background = "#404249"; el.style.transform = "translateX(2px)"; };
        el.onmouseleave = () => { el.style.background = ""; el.style.transform = ""; };
        el.onclick = () => { fn(); menu.remove(); };
        menu.appendChild(el);
    };

    mk("Unhide", "👁️", () => {
        setHiddenIds(getHiddenIds().filter(x => x !== id));
    });

    document.documentElement.appendChild(menu);

    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) {
        menu.style.left = Math.max(8, window.innerWidth - r.width - 8) + "px";
    }
    if (r.bottom > window.innerHeight - 8) {
        menu.style.top = Math.max(8, window.innerHeight - r.height - 8) + "px";
    }

    setTimeout(() => {
        const close = (ev: MouseEvent) => {
            if (!menu.contains(ev.target as Node)) {
                menu.remove();
                window.removeEventListener("mousedown", close);
            }
        };
        window.addEventListener("mousedown", close);
    }, 50);
}

// ==================== LOCK BUTTON ====================
function buildLockButton() {
    if (lockWrap && document.body.contains(lockWrap)) return;

    const all = document.querySelectorAll<HTMLElement>('[data-list-item-id^="guildsnav___"]');
    if (all.length === 0) return;

    let last: HTMLElement | null = null;
    for (let i = all.length - 1; i >= 0; i--) {
        const r = all[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { last = all[i]; break; }
    }
    if (!last) return;

    let listItem: HTMLElement | null = last;
    let safety = 0;
    while (listItem && safety++ < 15) {
        if (/^listItem__/.test(getClassName(listItem))) break;
        listItem = listItem.parentElement;
    }
    if (!listItem) listItem = last;

    const container = listItem.parentElement;
    if (!container) return;

    if (lockWrap) { lockWrap.remove(); lockWrap = null; }

    try {
        lockWrap = document.createElement("div");
        lockWrap.className = "hs-lock-wrap";
        lockWrap.style.cssText = `
            display:flex;justify-content:center;align-items:center;
            width:100%;padding:4px 0;flex-shrink:0;box-sizing:border-box;
        `;

        const btn = document.createElement("button");
        btn.className = "hs-lock-btn";
        btn.style.cssText = `
            width:48px;height:48px;border-radius:16px;border:none;
            background:var(--background-secondary);font-size:22px;cursor:pointer;
            position:relative;display:flex;
            align-items:center;justify-content:center;color:var(--text-normal);
            margin:0 auto;
        `;
        btn.textContent = "🔒";
        btn.onmouseenter = () => { btn.style.background = "var(--background-modifier-hover)"; btn.style.borderRadius = "12px"; };
        btn.onmouseleave = () => { btn.style.background = "var(--background-secondary)"; btn.style.borderRadius = "16px"; };
        btn.onclick = openModal;

        badgeEl = document.createElement("span");
        badgeEl.className = "hs-badge";
        badgeEl.style.cssText = `
            position:absolute;top:-4px;right:-4px;background:#f23f43;color:#fff;
            font-size:11px;font-weight:700;min-width:18px;height:18px;
            border-radius:9px;display:none;align-items:center;
            justify-content:center;padding:0 4px;
        `;
        btn.appendChild(badgeEl);
        lockWrap.appendChild(btn);

        container.insertBefore(lockWrap, listItem.nextSibling);
        refreshBadge();
    } catch { }
}

// ==================== START ====================
let observer: MutationObserver | null = null;
let attempts = 0;

function tick() {
    applyHiding();
    buildLockButton();
    attempts++;
}

export default definePlugin({
    name: "HiddenServers",
    description: "Hide servers without leaving. Right click server -> Hide. PIN-protected recovery vault.",
    authors: [{ name: "You", id: 123456789012345678n }],
    settings,

    contextMenus: {
        "guild-context"(children, props) {
            try {
                const id = props?.guild?.id;
                if (!id) return;
                const hidden = isHidden(id);
                children.push(
                    <Menu.MenuGroup key="hs">
                        <Menu.MenuItem
                            id={hidden ? "hs-unhide" : "hs-hide"}
                            label={hidden ? "Unhide Server" : "Hide Server"}
                            action={() => {
                                const ids = getHiddenIds();
                                if (hidden) setHiddenIds(ids.filter(x => x !== id));
                                else {
                                    setHiddenIds([...ids, id]);
                                    try {
                                        if (SelectedGuildStore.getGuildId() === id)
                                            NavigationRouter.transitionTo("/channels/@me");
                                    } catch { }
                                }
                            }}
                        />
                    </Menu.MenuGroup>
                );
            } catch { }
        }
    },

    start() {
        setTimeout(() => {
            try { injectStyles(); applyHiding(); } catch { }
        }, 100);

        observer = new MutationObserver(() => { try { tick(); } catch { } });
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        if (document.head) observer.observe(document.head, { childList: true });

        const int = setInterval(() => {
            try { tick(); } catch { }
            if (attempts > 120) clearInterval(int);
        }, 500);
    },

    stop() {
        observer?.disconnect(); observer = null;
        lockWrap?.remove(); lockWrap = null; badgeEl = null;
        closeModal();
        document.querySelectorAll(".hs-tile-ctx").forEach(e => e.remove());
        document.querySelectorAll("[data-hs-hidden]").forEach(el => {
            (el as HTMLElement).style.removeProperty("display");
            el.removeAttribute("data-hs-hidden");
        });
        document.getElementById("hs-styles")?.remove();
    }
});
