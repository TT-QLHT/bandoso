// =====================================================================
// GỬI NỘI DUNG SỰ CỐ QUA ZALO (bổ sung 11/2026)
// - Sau khi "Gửi báo cáo" hoặc "Lưu cập nhật" thành công: hiện nút 📤 Gửi qua Zalo.
// - Trong hồ sơ sự cố (Xem hồ sơ / Cập nhật): có thêm nút 📤 Gửi qua Zalo.
// Chỉ gửi NỘI DUNG CHỮ; người dùng tự chọn nhóm Zalo và tự đính kèm ảnh trong Zalo.
// Không cần đăng ký Zalo, không gửi dữ liệu đi đâu khác: nội dung được chép vào bộ nhớ tạm
// và mở bảng "Chia sẻ" của điện thoại để chọn Zalo.
// Nạp SAU su_co.js trong index.html:  <script src="zalo_share.js"></script>
// =====================================================================
(function () {
    'use strict';
    const API = String(window.SUCO_API_URL || '').trim();
    if (!API) return;

    const LOAI = {
        ngap_ung: '🌊 Ngập úng', sat_lo_dat: '⛰️ Sạt lở đất', sat_lo_taluy: '🏔️ Sạt lở taluy', cay_do: '🌳 Cây đổ',
        dat_da_tran: '🪨 Đất đá tràn mặt đường', hu_hong_mat_duong: '🚧 Hư hỏng mặt đường',
        hu_hong_cong_trinh: '🌉 Hư hỏng công trình', khac: '⚠️ Sự cố khác'
    };
    const TT = { dang_xay_ra: '🔴 Đang xảy ra', da_kiem_tra: '🟠 Đã kiểm tra', dang_xu_ly: '🟡 Đang xử lý', da_khac_phuc: '🟢 Đã khắc phục', da_ket_thuc: '⚫ Đã kết thúc' };
    const MUC_DO = { nhe: 'Nhẹ', trung_binh: 'Trung bình', nghiem_trong: 'Nghiêm trọng' };
    const GIAO_THONG = { binh_thuong: 'Lưu thông bình thường', han_che: 'Hạn chế, đi chậm', xe_lon: 'Chỉ xe lớn qua được', cam: 'Không qua được, phải phân luồng' };

    const cache = {};          // id -> sự cố mới nhất
    const notes = {};          // id -> ghi chú của lần cập nhật gần nhất (từ máy này)
    const PAGE = location.origin + location.pathname;

    function fmt(iso) {
        if (!iso) return '';
        const d = new Date(iso); if (isNaN(d)) return String(iso);
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    // ---------- Soạn nội dung ----------
    function buildText(inc, kind) {
        const L = [];
        L.push(kind === 'update' ? '📢 CẬP NHẬT SỰ CỐ HIỆN TRƯỜNG' : '🚨 BÁO CÁO SỰ CỐ HIỆN TRƯỜNG');
        L.push(`Mã: ${inc.id}`);
        L.push(`Loại: ${LOAI[inc.loai] || LOAI.khac}`);
        L.push(`Trạng thái: ${TT[inc.trang_thai] || inc.trang_thai || ''}`);
        if (inc.tuyen) L.push(`Tuyến: ${inc.tuyen}`);
        if (inc.dia_gioi) L.push(`Phường/xã: ${inc.dia_gioi}`);
        if (inc.huong_tuyen) L.push(`Hướng tuyến, làn: ${inc.huong_tuyen}`);
        if (inc.muc_do) L.push(`Mức độ: ${MUC_DO[inc.muc_do] || inc.muc_do}`);
        if (inc.giao_thong) L.push(`Giao thông: ${GIAO_THONG[inc.giao_thong] || inc.giao_thong}`);
        if (inc.mo_ta) L.push(`Mô tả: ${inc.mo_ta}`);
        if (kind === 'update' && notes[inc.id]) L.push(`Nội dung cập nhật: ${notes[inc.id]}`);
        if (inc.bien_phap_xu_ly) L.push(`Biện pháp xử lý: ${inc.bien_phap_xu_ly}`);
        if (inc.don_vi_phu_trach) L.push(`Đơn vị phụ trách: ${inc.don_vi_phu_trach}`);
        if (inc.thoi_gian_phat_hien) L.push(`Phát hiện lúc: ${fmt(inc.thoi_gian_phat_hien)}`);
        if (kind === 'update' && inc.thoi_gian_cap_nhat) L.push(`Cập nhật lúc: ${fmt(inc.thoi_gian_cap_nhat)}`);
        const nguoi = kind === 'update' ? (inc.ho_ten_nguoi_cap_nhat || inc.nguoi_cap_nhat) : (inc.ho_ten_nguoi_tao || inc.nguoi_tao);
        if (nguoi) L.push(`Người ${kind === 'update' ? 'cập nhật' : 'báo'}: ${nguoi}${kind !== 'update' && inc.don_vi_nguoi_tao ? ' – ' + inc.don_vi_nguoi_tao : ''}`);
        if (isFinite(inc.lat) && isFinite(inc.lng)) {
            L.push(`Vị trí: ${Number(inc.lat).toFixed(6)}, ${Number(inc.lng).toFixed(6)}`);
            L.push(`Chỉ đường: https://www.google.com/maps?q=${inc.lat},${inc.lng}`);
        }
        L.push(`Xem trên bản đồ: ${PAGE}?suco=${encodeURIComponent(inc.id)}`);
        return L.join('\n');
    }

    // ---------- Chép + mở Zalo ----------
    async function copy(text) {
        try { await navigator.clipboard.writeText(text); return true; } catch (e) { }
        try {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
        } catch (e) { return false; }
    }
    function note(msg, ms) {
        const el = document.createElement('div');
        el.className = 'sc-toast ok'; el.textContent = msg; el.style.zIndex = 10050;
        document.body.appendChild(el); setTimeout(() => el.remove(), ms || 6000);
    }
    const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Lưu ý: navigator.share phải gọi ngay trong lần bấm (iPhone chặn nếu chờ việc khác trước)
    function shareToZalo(inc, kind) {
        const text = buildText(inc, kind);
        if (navigator.share && isMobile()) {
            navigator.share({ text: text })
                .then(() => note('Đã chuyển nội dung. Trong Zalo: chọn nhóm → bấm 🖼 để đính kèm ảnh → Gửi.', 7000))
                .catch(e => { if (!e || e.name !== 'AbortError') fallback(text); });
            return;
        }
        fallback(text);
    }
    // Máy tính hoặc trình duyệt không hỗ trợ chia sẻ: chép nội dung, mở Zalo Web để dán
    async function fallback(text) {
        const copied = await copy(text);
        if (!isMobile()) window.open('https://chat.zalo.me/', '_blank', 'noopener');
        note(copied ? 'Đã chép nội dung. Mở nhóm Zalo → dán (Ctrl+V hoặc giữ ô nhập → Dán) → đính kèm ảnh → Gửi.'
            : 'Không tự chép được, hãy chép nội dung trong ô hiện ra.', 9000);
        if (!copied) showText(text);
    }
    function showText(text) {
        const bg = document.createElement('div'); bg.className = 'zl-bg';
        bg.innerHTML = `<div class="zl-box"><b>Nội dung gửi Zalo</b><textarea readonly></textarea>
            <button class="sc-btn blue" type="button">Đóng</button></div>`;
        bg.querySelector('textarea').value = text;
        bg.querySelector('button').onclick = () => bg.remove();
        document.body.appendChild(bg); bg.querySelector('textarea').select();
    }

    // ---------- Thanh nút sau khi lưu ----------
    function offer(inc, kind, plain) {
        const old = document.getElementById('zl-offer'); if (old) old.remove();
        const bar = document.createElement('div'); bar.id = 'zl-offer'; bar.className = 'zl-offer';
        bar.innerHTML = `<span>${plain ? 'Sự cố ' + inc.id + ':' : '✅ Đã lưu ' + inc.id + '. Gửi báo cáo vào nhóm Zalo?'}</span>
            <button type="button" class="zl-btn">📤 Gửi qua Zalo</button><button type="button" class="zl-x" aria-label="Đóng">×</button>`;
        bar.querySelector('.zl-btn').onclick = () => { shareToZalo(cache[inc.id] || inc, kind); bar.remove(); };
        bar.querySelector('.zl-x').onclick = () => bar.remove();
        document.body.appendChild(bar);
        setTimeout(() => { if (bar.isConnected) bar.remove(); }, 60000);
    }

    // ---------- Theo dõi kết quả gọi máy chủ (không sửa su_co.js) ----------
    const origFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
        const res = await origFetch(input, init);
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url.indexOf(API) === 0) {
                let req = {};
                if (init && init.method === 'POST' && typeof init.body === 'string') { try { req = JSON.parse(init.body); } catch (e) { } }
                res.clone().json().then(data => {
                    if (!data || !data.ok) return;
                    if (Array.isArray(data.incidents)) data.incidents.forEach(i => { cache[i.id] = i; });
                    if (data.incident) {
                        cache[data.incident.id] = data.incident;
                        if (req.action === 'create') offer(data.incident, 'create');
                        if (req.action === 'update') {
                            if (req.note) notes[data.incident.id] = req.note;
                            offer(data.incident, 'update');
                        }
                    }
                }).catch(() => { });
            }
        } catch (e) { }
        return res;
    };

    async function getIncident(id) {
        if (cache[id]) return cache[id];
        try {
            const r = await origFetch(API + (API.includes('?') ? '&' : '?') + new URLSearchParams({ action: 'list', all: '1', _: Date.now() }));
            const d = await r.json();
            if (d && d.ok && Array.isArray(d.incidents)) d.incidents.forEach(i => { cache[i.id] = i; });
        } catch (e) { }
        return cache[id];
    }

    // ---------- Nút trong hồ sơ sự cố ----------
    new MutationObserver(() => {
        const bg = document.getElementById('sc-modal-bg');
        if (!bg || bg.querySelector('.zl-detail')) return;
        const title = (bg.querySelector('header span') || {}).textContent || '';
        const m = title.match(/SC-\d{8}-\d+/);
        const footer = bg.querySelector('footer');
        if (!m || !footer || !bg.querySelector('.sc-detail')) return;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sc-btn zl-detail'; b.textContent = '📤 Gửi qua Zalo';
        b.onclick = async () => {
            const kindOf = inc => (inc.so_lan_cap_nhat > 1 ? 'update' : 'create');
            if (cache[m[0]]) { shareToZalo(cache[m[0]], kindOf(cache[m[0]])); return; }
            b.disabled = true; b.textContent = 'Đang tải…';
            const inc = await getIncident(m[0]);
            b.disabled = false; b.textContent = '📤 Gửi qua Zalo';
            if (inc) offer(inc, kindOf(inc), true);   // cần bấm thêm 1 lần để mở bảng chia sẻ
            else note('Chưa tải được thông tin sự cố, thử lại sau.', 4000);
        };
        footer.insertBefore(b, footer.firstChild);
    }).observe(document.body, { childList: true, subtree: false });

    // Nạp sẵn danh sách (kể cả đã kết thúc) để nút trong hồ sơ dùng được ngay
    setTimeout(() => getIncident('__nap_san__'), 4000);

    const css = document.createElement('style');
    css.textContent = `
        .zl-offer { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 10040;
            background: #fff; border-radius: 10px; box-shadow: 0 3px 14px rgba(0,0,0,.35); padding: 10px 12px;
            display: flex; align-items: center; gap: 8px; font: 14px sans-serif; max-width: 94vw; flex-wrap: wrap; }
        .zl-offer .zl-btn, .zl-detail { background: #0068ff !important; color: #fff !important; border: none;
            border-radius: 6px; padding: 9px 14px; font-weight: bold; cursor: pointer; }
        .zl-offer .zl-x { background: none; border: none; font-size: 22px; line-height: 1; cursor: pointer; color: #666; }
        .zl-bg { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 10060; display: flex; align-items: center; justify-content: center; }
        .zl-box { background: #fff; border-radius: 8px; padding: 12px; width: min(460px, 92vw); display: flex; flex-direction: column; gap: 8px; font: 14px sans-serif; }
        .zl-box textarea { width: 100%; height: 260px; font-size: 13px; box-sizing: border-box; }`;
    document.head.appendChild(css);
})();
