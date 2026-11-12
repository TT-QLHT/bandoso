// =====================================================================
// GỬI NỘI DUNG SỰ CỐ QUA ZALO (bổ sung 11/2026)
// - Sau khi "Đã lưu sự cố SC-…": tự hiện bảng soạn sẵn nội dung báo cáo.
// - Trong popup mỗi sự cố: thêm nút "📤 Gửi qua Zalo".
// - Chỉ gửi NỘI DUNG (chữ). Người dùng tự đính kèm ảnh trong Zalo.
// Điện thoại: mở bảng chia sẻ của máy, chọn Zalo -> chọn nhóm -> Gửi.
// Máy tính: tự sao chép nội dung, mở Zalo Web để dán (Ctrl+V).
// Yêu cầu: nạp SAU su_co_config.js và su_co.js.
// =====================================================================
(function () {
    'use strict';
    if (typeof map === 'undefined') return;
    const API = String(window.SUCO_API_URL || '').trim();

    const LOAI = {
        ngap_ung: '🌊 Ngập úng', sat_lo_dat: '⛰️ Sạt lở đất', sat_lo_taluy: '🏔️ Sạt lở taluy', cay_do: '🌳 Cây đổ',
        dat_da_tran: '🪨 Đất đá tràn mặt đường', hu_hong_mat_duong: '🚧 Hư hỏng mặt đường',
        hu_hong_cong_trinh: '🌉 Hư hỏng công trình', khac: '⚠️ Sự cố khác'
    };
    const TT = { dang_xay_ra: 'Đang xảy ra', da_kiem_tra: 'Đã kiểm tra', dang_xu_ly: 'Đang xử lý', da_khac_phuc: 'Đã khắc phục', da_ket_thuc: 'Đã kết thúc' };
    const MUC_DO = { nhe: 'Nhẹ', trung_binh: 'Trung bình', nghiem_trong: 'Nghiêm trọng' };
    const GIAO_THONG = { binh_thuong: 'Lưu thông bình thường', han_che: 'Hạn chế, đi chậm', xe_lon: 'Chỉ xe lớn qua được', cam: 'Không qua được, phải phân luồng' };

    const pageUrl = location.origin + location.pathname;
    const fmt = iso => {
        if (!iso) return '';
        const d = new Date(iso); if (isNaN(d)) return String(iso);
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())} ngày ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    };

    // ---------- Lấy dữ liệu sự cố (đọc công khai, có bộ nhớ đệm 30 giây) ----------
    let cache = { t: 0, list: [] };
    async function loadAll(force) {
        if (!API) return [];
        if (!force && Date.now() - cache.t < 30000) return cache.list;
        const r = await fetch(API + (API.includes('?') ? '&' : '?') + 'action=list&all=1');
        const j = await r.json();
        cache = { t: Date.now(), list: (j && j.incidents) || [] };
        return cache.list;
    }
    async function getIncident(id, force) {
        let inc = (await loadAll(force)).find(x => x.id === id);
        if (!inc && !force) inc = (await loadAll(true)).find(x => x.id === id);
        return inc || null;
    }

    // ---------- Soạn nội dung ----------
    function buildText(inc, fallback) {
        if (!inc) return fallback || '';
        const L = [];
        L.push(`🚨 BÁO CÁO SỰ CỐ HIỆN TRƯỜNG – ${inc.id}`);
        L.push(`• Loại: ${LOAI[inc.loai] || LOAI.khac}`);
        if (TT[inc.trang_thai]) L.push(`• Trạng thái: ${TT[inc.trang_thai]}`);
        if (inc.tuyen) L.push(`• Tuyến: ${inc.tuyen}`);
        if (inc.dia_gioi) L.push(`• Phường/xã: ${inc.dia_gioi}`);
        if (inc.huong_tuyen) L.push(`• Hướng/vị trí: ${inc.huong_tuyen}`);
        if (MUC_DO[inc.muc_do]) L.push(`• Mức độ: ${MUC_DO[inc.muc_do]}`);
        if (GIAO_THONG[inc.giao_thong]) L.push(`• Giao thông: ${GIAO_THONG[inc.giao_thong]}`);
        if (inc.mo_ta) L.push(`• Mô tả: ${inc.mo_ta}`);
        if (inc.thoi_gian_phat_hien) L.push(`• Thời gian phát hiện: ${fmt(inc.thoi_gian_phat_hien)}`);
        if (inc.bien_phap_xu_ly) L.push(`• Biện pháp xử lý: ${inc.bien_phap_xu_ly}`);
        if (inc.don_vi_phu_trach) L.push(`• Đơn vị phụ trách: ${inc.don_vi_phu_trach}`);
        const nguoi = [inc.ho_ten_nguoi_tao, inc.don_vi_nguoi_tao].filter(Boolean).join(' – ');
        if (nguoi) L.push(`• Người báo: ${nguoi}`);
        if (isFinite(inc.lat) && isFinite(inc.lng) && Number(inc.lat)) {
            const la = Number(inc.lat).toFixed(6), ln = Number(inc.lng).toFixed(6);
            L.push(`• Tọa độ: ${la}, ${ln}`);
            L.push(`📍 Google Maps: https://www.google.com/maps?q=${la},${ln}`);
        }
        L.push(`🗺 Xem trên bản đồ: ${pageUrl}?suco=${encodeURIComponent(inc.id)}`);
        return L.join('\n');
    }
    // Dự phòng khi chưa đọc được máy chủ: lấy chữ trong popup
    function textFromPopup(el, id, latlng) {
        const pop = el && el.querySelector('.sc-popup');
        const lines = pop ? [...pop.querySelectorAll('h4, div')].map(d => d.textContent.trim()).filter(Boolean) : [];
        const L = ['🚨 BÁO CÁO SỰ CỐ HIỆN TRƯỜNG'].concat(lines.map(s => '• ' + s));
        if (latlng) L.push(`📍 Google Maps: https://www.google.com/maps?q=${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`);
        if (id) L.push(`🗺 Xem trên bản đồ: ${pageUrl}?suco=${encodeURIComponent(id)}`);
        return L.join('\n');
    }

    // ---------- Sao chép & chia sẻ ----------
    function copyText(text) {
        try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text)); } catch (e) { }
        return Promise.resolve(legacyCopy(text));
    }
    function legacyCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
        ta.remove(); return ok;
    }
    const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    function note(msg, type) {
        const el = document.createElement('div');
        el.className = 'sc-toast ' + (type || 'info'); el.textContent = msg;
        el.style.zIndex = 4000;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }

    function shareToZalo(text) {
        const copied = copyText(text);              // luôn sao chép để dán lại khi cần
        if (navigator.share && isMobile()) {
            navigator.share({ text: text }).then(() => {
                note('Đã gửi nội dung. Mở nhóm Zalo, bấm biểu tượng ảnh 🖼 để đính kèm ảnh hiện trường.', 'ok');
            }).catch(e => {
                if (e && e.name === 'AbortError') return;
                copied.then(() => note('Đã sao chép nội dung. Mở Zalo, vào nhóm, giữ ngón tay vào ô nhập và chọn Dán.', 'ok'));
            });
            return;
        }
        copied.then(ok => {
            note(ok ? 'Đã sao chép nội dung. Trong Zalo, mở nhóm và nhấn Ctrl+V để dán, rồi đính kèm ảnh.' : 'Không tự sao chép được, hãy bôi đen nội dung và sao chép thủ công.', ok ? 'ok' : 'err');
            if (ok) window.open('https://chat.zalo.me/', '_blank', 'noopener');
        });
    }

    // ---------- Bảng soạn nội dung ----------
    function openSheet(text, title) {
        closeSheet();
        const bg = document.createElement('div');
        bg.id = 'zl-sheet-bg';
        bg.innerHTML = `
            <div class="zl-sheet" role="dialog" aria-label="Gửi nội dung qua Zalo">
                <div class="zl-head"><b>${title || '📤 Gửi nội dung sự cố qua Zalo'}</b><button class="zl-x" aria-label="Đóng">×</button></div>
                <div class="zl-hint">Có thể sửa nội dung trước khi gửi. Ảnh hiện trường: sau khi gửi nội dung vào nhóm, bấm 🖼 trong Zalo để đính kèm.</div>
                <textarea id="zl-text" rows="12"></textarea>
                <div class="zl-btns">
                    <button class="zl-btn zalo" id="zl-share">📤 Gửi qua Zalo</button>
                    <button class="zl-btn" id="zl-copy">📋 Chỉ sao chép</button>
                    <button class="zl-btn" id="zl-close">Để sau</button>
                </div>
            </div>`;
        document.body.appendChild(bg);
        const ta = bg.querySelector('#zl-text'); ta.value = text;
        bg.querySelector('.zl-x').onclick = closeSheet;
        bg.querySelector('#zl-close').onclick = closeSheet;
        bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
        bg.querySelector('#zl-share').onclick = () => shareToZalo(ta.value);
        bg.querySelector('#zl-copy').onclick = () => copyText(ta.value).then(ok => note(ok ? 'Đã sao chép nội dung' : 'Không sao chép được', ok ? 'ok' : 'err'));
    }
    function closeSheet() { const b = document.getElementById('zl-sheet-bg'); if (b) b.remove(); }

    async function openForId(id, fallbackText, force) {
        let inc = null;
        try { inc = await getIncident(id, force); } catch (e) { }
        const text = inc ? buildText(inc) : fallbackText;
        if (!text) { note('Chưa đọc được dữ liệu sự cố ' + id + ', thử lại sau ít giây.', 'err'); return; }
        openSheet(text);
    }

    // ---------- Nút trong popup sự cố ----------
    function injectButton(popup) {
        const el = popup.getElement && popup.getElement();
        if (!el) return;
        const open = el.querySelector('[data-sc-open]');
        if (!open || el.querySelector('[data-sc-zalo]')) return;
        const id = open.getAttribute('data-sc-open');
        const b = document.createElement('button');
        b.className = 'sc-btn full zl-popbtn'; b.setAttribute('data-sc-zalo', id);
        b.textContent = '📤 Gửi nội dung qua Zalo';
        open.insertAdjacentElement('afterend', b);
        b.onclick = ev => { ev.stopPropagation(); openForId(id, textFromPopup(el, id, popup.getLatLng())); };
        loadAll(false).catch(() => { });           // đọc trước để bấm là có ngay
    }
    map.on('popupopen', e => {
        injectButton(e.popup);
        // Khi bản đồ tự làm mới nội dung popup thì gắn lại nút
        if (!e.popup._zlHooked) { e.popup._zlHooked = true; e.popup.on('contentupdate', () => setTimeout(() => injectButton(e.popup), 0)); }
    });

    // ---------- Tự hiện bảng sau khi lưu sự cố mới ----------
    new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(n => {
            if (!(n instanceof HTMLElement) || !n.classList.contains('sc-toast')) return;
            const mm = /Đã lưu sự cố (SC-[\w-]+)/.exec(n.textContent || '');
            if (mm) setTimeout(() => openForId(mm[1], '', true), 600);
        }));
    }).observe(document.body, { childList: true });

    // ---------- Giao diện ----------
    const css = document.createElement('style');
    css.textContent = `
        #zl-sheet-bg { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 3000; display: flex; align-items: flex-end; justify-content: center; }
        .zl-sheet { background: #fff; width: 100%; max-width: 520px; border-radius: 12px 12px 0 0; padding: 12px 14px 16px; box-shadow: 0 -2px 12px rgba(0,0,0,.3); font-family: sans-serif; }
        @media (min-width: 700px) { #zl-sheet-bg { align-items: center; } .zl-sheet { border-radius: 12px; } }
        .zl-head { display: flex; justify-content: space-between; align-items: center; font-size: 15px; color: #0068ff; }
        .zl-x { border: none; background: none; font-size: 24px; cursor: pointer; line-height: 1; }
        .zl-hint { font-size: 12px; color: #555; margin: 6px 0; }
        #zl-text { width: 100%; box-sizing: border-box; font-size: 13px; padding: 8px; border: 1px solid #ccc; border-radius: 6px; resize: vertical; }
        .zl-btns { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .zl-btn { flex: 1; min-width: 110px; padding: 10px; border: 1px solid #ccc; border-radius: 6px; background: #f5f5f5; font-weight: bold; cursor: pointer; font-size: 14px; }
        .zl-btn.zalo { background: #0068ff; color: #fff; border-color: #0068ff; }
        .zl-popbtn { background: #0068ff !important; color: #fff !important; margin-top: 4px; }`;
    document.head.appendChild(css);
})();
