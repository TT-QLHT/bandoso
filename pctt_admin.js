// =====================================================================
// CHỈNH SỬA ĐIỂM NGUY HIỂM MÙA MƯA BÃO (PCTT) NGAY TRÊN BẢN ĐỒ (bổ sung 11/2026)
// (20/11/2026) Ẩn nhanh: nút "🙈 Ẩn điểm này" ngay trong bảng thông tin của điểm (quản trị viên);
//              mục "Điểm đã ẩn" có nút "👁 Hiện lại" cho từng điểm.
// (18/11/2026) Thêm điểm ngập nước / sạt lở mới: nút trong bảng PCTT, chuột phải (nhấn giữ) lên bản đồ,
//              hoặc nút "🛠 Quản trị bản đồ" (ban_do_admin.js);
//              sửa được tên tuyến của điểm.
// - Cán bộ quản lý (quan_ly) và quản trị viên (admin) đã đăng nhập ở bảng "Sự cố hiện trường"
//   sẽ thấy nút "✏️ Chỉnh sửa điểm này" trong popup của mỗi điểm nguy hiểm.
// - Nội dung sửa được lưu vào Google Sheet (trang PCTT_ChinhSua, lịch sử ở PCTT_LichSu)
//   qua cùng máy chủ Apps Script của chức năng sự cố; mọi người mở bản đồ đều thấy bản đã sửa.
// - Quản trị viên được ẩn điểm (và hiện lại trong mục "Điểm đã ẩn").
// - File PCTT_BaoLu.geojson trên GitHub giữ nguyên làm dữ liệu gốc.
// Được nạp tự động bởi kcht_layer.js (không cần sửa index.html).
// =====================================================================
(function () {
    'use strict';
    const API = String(window.SUCO_API_URL || '').trim();
    if (!API || typeof pcttItems === 'undefined') return;

    const SYNC = { ly_trinh: 'Lý trình', phan_loai: 'Phân loại', danh_gia_nguy_co: 'Đánh giá nguy cơ', dia_phuong: 'Địa phương' };
    const TT_ORDER = ['Mô tả sự cố', 'Chiều dài', 'Điểm nội suy', 'Lực lượng', 'Phương tiện', 'Vật tư, thiết bị',
        'Đơn vị thực hiện/phối hợp', 'Doanh nghiệp phối hợp', 'Phương án phân luồng', 'Ghi chú'];
    const hidden = {};         // ma -> item đã ẩn (giữ để hiện lại)
    let serverOk = null;       // null: chưa biết; false: máy chủ chưa cập nhật Code.gs

    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function session() {
        try {
            const s = JSON.parse(localStorage.getItem('sc_session') || 'null');
            return s && s.token && Date.parse(s.expires) > Date.now() ? s : null;
        } catch (e) { return null; }
    }
    const role = () => { const s = session(); return s && s.user ? s.user.vai_tro : ''; };
    const canEdit = () => ['quan_ly', 'admin'].includes(role());
    const isAdmin = () => role() === 'admin';
    function fmt(iso) {
        const d = new Date(iso); if (isNaN(d)) return iso || '';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    function toast(msg, type) {
        const el = document.createElement('div');
        el.className = 'sc-toast ' + (type || 'ok'); el.textContent = msg; el.style.zIndex = 10050;
        document.body.appendChild(el); setTimeout(() => el.remove(), 5000);
    }

    // ---------- Áp dữ liệu đã chỉnh sửa lên điểm trên bản đồ ----------
    function itemsOf(ma) { return pcttItems.filter(it => it.feature.properties.nhom === 'nguy_hiem' && it.feature.properties.ma === ma); }
    function applyOne(r) {
        let its = itemsOf(r.ma);
        if (!its.length && hidden[r.ma]) its = [hidden[r.ma]];
        // (18/11/2026) Điểm bổ sung mới (không có trong PCTT_BaoLu.geojson): tạo điểm trên bản đồ
        if (!its.length && r.lat !== '' && r.lng !== '' && isFinite(+r.lat) && isFinite(+r.lng)) {
            const f = { type: 'Feature', geometry: { type: 'Point', coordinates: [+r.lng, +r.lat] },
                properties: { nhom: 'nguy_hiem', ma: r.ma, ten: r.ten, tuyen: (r.thong_tin || {})['Tuyến'] || '', phan_loai: r.phan_loai || 'Nguy cơ khác',
                    danh_gia_nguy_co: r.danh_gia_nguy_co || '', dia_phuong: r.dia_phuong || '', thong_tin: {}, nguon: 'Bổ sung trên bản đồ' } };
            const it = pcttBuildLayer(f);
            if (it) { pcttItems.push(it); pcttHazardByMa[r.ma] = it; its = [it]; }
        }
        its.forEach(it => {
            const p = it.feature.properties;
            ['ten', 'ly_trinh', 'phan_loai', 'danh_gia_nguy_co', 'dia_phuong', 'giai_phap_de_xuat', 'ket_qua_xac_nhan', 'ho_so_lien_quan']
                .forEach(k => { if (r[k] !== undefined && r[k] !== '') p[k] = r[k]; else if (['giai_phap_de_xuat', 'ket_qua_xac_nhan', 'ho_so_lien_quan'].includes(k)) p[k] = r[k] || ''; });
            if (r.thong_tin && Object.keys(r.thong_tin).length) p.thong_tin = Object.assign({}, r.thong_tin);
            if (r.thong_tin && r.thong_tin['Tuyến']) p.tuyen = r.thong_tin['Tuyến'];
            if (r.ngay_cap_nhat) p.ngay_cap_nhat = fmt(r.ngay_cap_nhat) + (r.ho_ten_nguoi_cap_nhat ? ' – ' + r.ho_ten_nguoi_cap_nhat : '');
            it.group = p.phan_loai === 'Ngập nước' ? 'ngap' : 'satlo';
            const lay = it.layer;
            if (lay.setLatLng && r.lat !== '' && r.lng !== '' && isFinite(+r.lat) && isFinite(+r.lng)) lay.setLatLng([+r.lat, +r.lng]);
            if (lay.setStyle) {
                const cao = p.danh_gia_nguy_co === 'Nguy cơ cao';
                lay.setStyle(lay.setLatLng ? { fillColor: pcttColor(p), color: cao ? '#d50000' : '#ffffff', weight: cao ? 3 : 2 } : { color: pcttColor(p) });
            }
            if (lay.setTooltipContent) lay.setTooltipContent(`${p.ma} · ${p.ly_trinh || p.ten}`);
            // Ẩn / hiện
            const idx = pcttItems.indexOf(it);
            if (r.an === 'co') {
                if (idx >= 0) pcttItems.splice(idx, 1);
                Object.values(pcttGroups).forEach(g => g.removeLayer(lay));
                delete pcttHazardByMa[p.ma];
                hidden[p.ma] = it;
            } else if (idx < 0) {
                pcttItems.push(it); pcttHazardByMa[p.ma] = it; delete hidden[p.ma];
            }
        });
    }
    function refresh() { try { pcttApplyFilter(false); } catch (e) { } renderAdminLink(); }

    async function loadEdits() {
        try {
            const r = await fetch(API + (API.includes('?') ? '&' : '?') + 'action=pctt_list&_=' + Date.now());
            const d = await r.json();
            if (!d.ok) { serverOk = false; return; }
            serverOk = true;
            d.items.forEach(applyOne);
            refresh();
        } catch (e) { }
    }

    // ---------- Nút sửa trong popup ----------
    const origPopup = window.pcttHazardPopup;
    window.pcttHazardPopup = function (p, latlng) {
        let html = origPopup(p, latlng);
        if (canEdit() && p && p.ma) {
            let btn = `<button type="button" class="pa-edit-btn" onclick="pcttAdminEdit('${esc(p.ma)}')">✏️ Chỉnh sửa điểm này</button>`;
            if (isAdmin()) btn += `<button type="button" class="pa-hide-btn" onclick="pcttAdminHide('${esc(p.ma)}', true)">🙈 Ẩn điểm này khỏi bản đồ</button>`;
            html = html.replace(/<\/div>\s*$/, btn + '</div>');
        }
        return html;
    };

    // ---------- Biểu mẫu chỉnh sửa ----------
    function field(id, label, val, rows) {
        return `<label class="pa-f"><span>${esc(label)}</span>${rows ? `<textarea id="${id}" rows="${rows}">${esc(val)}</textarea>` : `<input id="${id}" value="${esc(val)}">`}</label>`;
    }
    function select(id, label, val, opts) {
        return `<label class="pa-f"><span>${esc(label)}</span><select id="${id}">${opts.map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    let pendingNew = null;     // mã điểm mới đang nhập (chưa lưu) – hủy thì bỏ khỏi bản đồ
    function closeForm() {
        const m = document.getElementById('pa-modal'); if (m) m.remove();
        if (pendingNew) {
            const it = pcttHazardByMa[pendingNew];
            if (it) { const i = pcttItems.indexOf(it); if (i >= 0) pcttItems.splice(i, 1); Object.values(pcttGroups).forEach(g => g.removeLayer(it.layer)); }
            delete pcttHazardByMa[pendingNew]; pendingNew = null; refresh();
        }
    }
    // (18/11/2026) Thêm điểm nguy hiểm mới tại vị trí đã chọn
    window.pcttAdminCreate = function (lat, lng, phanLoai) {
        if (!canEdit()) { toast('Cần đăng nhập tài khoản quản lý hoặc quản trị', 'err'); return; }
        if (serverOk === false) { toast('Máy chủ Apps Script chưa được cập nhật (Code.gs phiên bản 1.2 trở lên)', 'err'); return; }
        const d = new Date(), z = n => String(n).padStart(2, '0');
        const ma = `BS${String(d.getFullYear()).slice(2)}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
        const f = { type: 'Feature', geometry: { type: 'Point', coordinates: [+lng, +lat] },
            properties: { nhom: 'nguy_hiem', ma: ma, ten: '', tuyen: '', phan_loai: phanLoai || 'Ngập nước', danh_gia_nguy_co: '', dia_phuong: '', thong_tin: {}, nguon: 'Bổ sung trên bản đồ' } };
        const it = pcttBuildLayer(f);
        if (!it) return;
        pcttItems.push(it); pcttHazardByMa[ma] = it;
        map.addLayer(pcttGroups[it.group]); refresh();
        pcttAdminEdit(ma, true);
    };

    window.pcttAdminEdit = function (ma, isNew) {
        if (!canEdit()) { toast('Cần đăng nhập tài khoản quản lý hoặc quản trị để chỉnh sửa', 'err'); return; }
        if (serverOk === false) { toast('Máy chủ Apps Script chưa được cập nhật (Code.gs phiên bản 1.2) nên chưa lưu được chỉnh sửa', 'err'); return; }
        const it = pcttHazardByMa[ma] || hidden[ma];
        if (!it) return;
        map.closePopup();
        if (pendingNew && pendingNew !== ma) closeForm();
        if (isNew) pendingNew = ma;
        const p = it.feature.properties, tt = p.thong_tin || {};
        const ll = it.layer.getLatLng ? it.layer.getLatLng() : null;
        const ttKeys = TT_ORDER.concat(Object.keys(tt).filter(k => !TT_ORDER.includes(k) && !Object.values(SYNC).includes(k) && k !== 'Tuyến'));
        const body = `
            <div class="pa-note">Mã điểm <b>${esc(ma)}</b>${isNew ? ' (điểm mới)' : ''}. Ô để trống = không có dữ liệu.</div>
            ${field('pa-ten', 'Tên điểm', p.ten)}
            ${field('pa-tuyen', 'Tuyến (VD: Quốc lộ 14B, ĐT.603, đường Nguyễn Tất Thành)', p.tuyen)}
            ${field('pa-ly_trinh', 'Lý trình', p.ly_trinh)}
            <div class="pa-row">${select('pa-phan_loai', 'Phân loại', p.phan_loai, ['Ngập nước', 'Sạt lở', 'Nguy cơ khác'])}
            ${select('pa-danh_gia_nguy_co', 'Đánh giá nguy cơ', p.danh_gia_nguy_co || '', ['Nguy cơ cao', 'Nguy cơ thấp', ''])}</div>
            ${field('pa-dia_phuong', 'Địa phương (phường/xã)', p.dia_phuong)}
            ${ll ? `<div class="pa-row">${field('pa-lat', 'Vĩ độ', ll.lat.toFixed(6))}${field('pa-lng', 'Kinh độ', ll.lng.toFixed(6))}</div>` : ''}
            <div class="pa-sec">Thông tin hiện trạng và phương án ứng phó</div>
            ${ttKeys.map((k, i) => field('pa-tt-' + i, k, tt[k] || '', 2)).join('')}
            <div class="pa-sec">Xử lý</div>
            ${field('pa-giai_phap_de_xuat', 'Giải pháp xử lý đề xuất', p.giai_phap_de_xuat, 3)}
            ${field('pa-ket_qua_xac_nhan', 'Kết quả xử lý đã xác nhận', p.ket_qua_xac_nhan, 3)}
            ${field('pa-ho_so_lien_quan', 'Hồ sơ liên quan (số văn bản, đường link…)', p.ho_so_lien_quan, 2)}
            ${isAdmin() ? `<label class="pa-chk"><input type="checkbox" id="pa-an"${hidden[ma] ? ' checked' : ''}> Ẩn điểm này khỏi bản đồ (chỉ quản trị viên)</label>` : ''}
            <div class="pa-msg" id="pa-msg"></div>`;
        const bg = document.createElement('div');
        bg.className = 'sc-modal-bg'; bg.id = 'pa-modal';
        bg.innerHTML = `<div class="sc-modal" role="dialog"><header><span>${isNew ? '＋ Thêm điểm nguy hiểm mới' : '✏️ Chỉnh sửa điểm nguy hiểm'}</span><button id="pa-x" aria-label="Đóng">×</button></header>
            <div class="content">${body}</div>
            <footer><button class="sc-btn" id="pa-cancel">Hủy</button><button class="sc-btn blue" id="pa-save">💾 Lưu chỉnh sửa</button></footer></div>`;
        document.body.appendChild(bg);
        L.DomEvent.disableClickPropagation(bg); L.DomEvent.disableScrollPropagation(bg);
        document.getElementById('pa-x').onclick = closeForm;
        document.getElementById('pa-cancel').onclick = closeForm;
        document.getElementById('pa-save').onclick = async function () {
            const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
            const data = {
                ten: v('pa-ten'), ly_trinh: v('pa-ly_trinh'), phan_loai: v('pa-phan_loai'), danh_gia_nguy_co: v('pa-danh_gia_nguy_co'),
                dia_phuong: v('pa-dia_phuong'), giai_phap_de_xuat: v('pa-giai_phap_de_xuat'), ket_qua_xac_nhan: v('pa-ket_qua_xac_nhan'),
                ho_so_lien_quan: v('pa-ho_so_lien_quan'), lat: v('pa-lat'), lng: v('pa-lng'), thong_tin: {}
            };
            if (v('pa-tuyen')) data.thong_tin['Tuyến'] = v('pa-tuyen');
            if (!data.ten) { msg('Hãy nhập tên điểm', 'err'); return; }
            ttKeys.forEach((k, i) => { const x = v('pa-tt-' + i); if (x) data.thong_tin[k] = x; });
            Object.keys(SYNC).forEach(k => { if (data[k]) data.thong_tin[SYNC[k]] = data[k]; });
            const an = document.getElementById('pa-an'); if (an) data.an = an.checked ? 'co' : '';
            if (data.lat && !(Math.abs(+data.lat) <= 90 && Math.abs(+data.lng) <= 180)) { msg('Tọa độ không hợp lệ', 'err'); return; }
            const btn = this; btn.disabled = true; msg('Đang lưu…', 'info');
            try {
                const r = await fetch(API, { method: 'POST', body: JSON.stringify({ action: 'pctt_save', token: session().token, ma: ma, data: data }) });
                const d = await r.json();
                if (!d.ok) throw new Error(d.code === 'UNKNOWN_ACTION' ? 'Máy chủ Apps Script chưa được cập nhật Code.gs phiên bản 1.2' : (d.message || d.code));
                pendingNew = null;
                applyOne(d.item); refresh(); closeForm();
                toast(d.item.an === 'co' ? `Đã ẩn điểm ${ma}` : `Đã lưu chỉnh sửa ${ma}`);
                const it2 = pcttHazardByMa[ma];
                if (it2) it2.layer.openPopup();
            } catch (e) { msg('CHƯA LƯU: ' + e.message, 'err'); btn.disabled = false; }
        };
        function msg(t, type) { const el = document.getElementById('pa-msg'); el.textContent = t; el.className = 'pa-msg ' + type; }
    };

    // ---------- (20/11/2026) Ẩn / hiện lại nhanh một điểm (quản trị viên) ----------
    function dataOf(it, an) {
        const p = it.feature.properties, ll = it.layer.getLatLng ? it.layer.getLatLng() : null;
        const tt = Object.assign({}, p.thong_tin || {});
        if (p.tuyen) tt['Tuyến'] = p.tuyen;
        Object.keys(SYNC).forEach(k => { if (p[k]) tt[SYNC[k]] = p[k]; });
        return {
            ten: p.ten || '', ly_trinh: p.ly_trinh || '', phan_loai: p.phan_loai || '', danh_gia_nguy_co: p.danh_gia_nguy_co || '',
            dia_phuong: p.dia_phuong || '', giai_phap_de_xuat: p.giai_phap_de_xuat || '', ket_qua_xac_nhan: p.ket_qua_xac_nhan || '',
            ho_so_lien_quan: p.ho_so_lien_quan || '', lat: ll ? ll.lat.toFixed(6) : '', lng: ll ? ll.lng.toFixed(6) : '',
            thong_tin: tt, an: an ? 'co' : ''
        };
    }
    window.pcttAdminHide = async function (ma, an) {
        if (!isAdmin()) { toast('Chỉ quản trị viên được ẩn / hiện lại điểm', 'err'); return; }
        if (serverOk === false) { toast('Máy chủ Apps Script chưa được cập nhật (Code.gs phiên bản 1.2 trở lên)', 'err'); return; }
        const it = an ? pcttHazardByMa[ma] : hidden[ma];
        if (!it) { toast('Không tìm thấy điểm ' + ma, 'err'); return; }
        const p = it.feature.properties;
        if (an && !confirm(`Ẩn điểm ${ma}${p.ten ? ' – ' + p.ten : ''} khỏi bản đồ?\n\nĐiểm không bị xóa: quản trị viên vẫn hiện lại được ở mục "Điểm đã ẩn" cuối bảng "Điểm nguy hiểm mùa mưa bão".`)) return;
        map.closePopup();
        toast(an ? 'Đang ẩn điểm ' + ma + '…' : 'Đang hiện lại điểm ' + ma + '…', 'ok');
        try {
            const r = await fetch(API, { method: 'POST', body: JSON.stringify({ action: 'pctt_save', token: session().token, ma: ma, data: dataOf(it, an) }) });
            const d = await r.json();
            if (!d.ok) throw new Error(d.code === 'UNKNOWN_ACTION' ? 'Máy chủ Apps Script chưa được cập nhật Code.gs phiên bản 1.2' : (d.message || d.code));
            applyOne(d.item); refresh();
            if (!an) { const it2 = pcttHazardByMa[ma]; if (it2) { if (!map.hasLayer(pcttGroups[it2.group])) map.addLayer(pcttGroups[it2.group]); setTimeout(() => it2.layer.openPopup && it2.layer.openPopup(), 300); } }
            toast(an ? `Đã ẩn điểm ${ma}` : `Đã hiện lại điểm ${ma}`);
        } catch (e) { toast('CHƯA LƯU: ' + e.message, 'err'); }
    };

    // ---------- Mục "Điểm đã ẩn" cho quản trị viên ----------
    function renderAdminLink() {
        const body = document.querySelector('#pctt-panel .pctt-body');
        if (!body) return;
        let a = document.getElementById('pa-hidden-link');
        const n = Object.keys(hidden).length;
        if (!isAdmin() || !n) { if (a) a.remove(); return; }
        if (!a) { a = document.createElement('div'); a.id = 'pa-hidden-link'; a.className = 'pa-hidden-link'; body.appendChild(a); }
        const open = a.dataset.open === '1';
        a.innerHTML = `<div class="pa-hl-head">🙈 Điểm đã ẩn (${n}) <span>${open ? '▾' : '▸'}</span></div>` + (open ? '<ul>' + Object.keys(hidden).map(m => {
            const p = hidden[m].feature.properties;
            return `<li><b>${esc(m)}</b>${p.ten ? ' – ' + esc(p.ten) : ''}<br><button type="button" data-show="${esc(m)}">👁 Hiện lại</button> <button type="button" data-edit="${esc(m)}">✏️ Sửa</button></li>`;
        }).join('') + '</ul>' : '');
        a.onclick = e => {
            const t = e.target;
            if (t.closest('.pa-hl-head')) { a.dataset.open = open ? '0' : '1'; renderAdminLink(); return; }
            const sh = t.closest('[data-show]'); if (sh) { pcttAdminHide(sh.dataset.show, false); return; }
            const ed = t.closest('[data-edit]'); if (ed) pcttAdminEdit(ed.dataset.edit);
        };
    }

    // ---------- (18/11/2026) Lối tắt thêm điểm ngập / sạt lở ----------
    // 1) Nút "＋ Thêm điểm ngập / sạt lở" trong bảng "Điểm nguy hiểm mùa mưa bão"
    // 2) Bấm chuột phải (điện thoại: nhấn giữ) lên bản đồ → "Thêm điểm ngập nước / sạt lở tại đây"
    let picking = false;
    window.pcttPickAndCreate = function (phanLoai) {
        if (!canEdit()) { toast('Cần đăng nhập tài khoản quản lý hoặc quản trị', 'err'); return; }
        map.closePopup(); picking = true;
        // tạm tắt bấm vào các lớp (ranh giới phường, đường…) để cú bấm rơi đúng xuống bản đồ
        map.getContainer().classList.add('pa-picking');
        toast('Bấm lên bản đồ tại vị trí cần thêm điểm ' + (phanLoai === 'Sạt lở' ? 'sạt lở' : 'ngập nước') + ' (phím Esc để hủy)', 'ok');
        const stop = () => { picking = false; map.getContainer().classList.remove('pa-picking'); map.off('click', onPick); document.removeEventListener('keydown', onKey); };
        const onPick = e => { stop(); pcttAdminCreate(e.latlng.lat, e.latlng.lng, phanLoai); };
        const onKey = e => { if (e.key === 'Escape') stop(); };
        map.on('click', onPick); document.addEventListener('keydown', onKey);
    };
    function renderAddBtn() {
        const body = document.querySelector('#pctt-panel .pctt-body');
        if (!body) return;
        let b = document.getElementById('pa-add');
        if (!canEdit()) { if (b) b.remove(); return; }
        if (b) return;
        b = document.createElement('div'); b.id = 'pa-add'; b.className = 'pa-add';
        b.innerHTML = '<button type="button" data-pl="Ngập nước">💧 Thêm điểm ngập</button><button type="button" data-pl="Sạt lở">⛰️ Thêm điểm sạt lở</button>';
        b.onclick = e => { const t = e.target.closest('button[data-pl]'); if (t) pcttPickAndCreate(t.dataset.pl); };
        body.insertBefore(b, body.firstChild);
    }
    // Bắt sự kiện trên khung bản đồ (kể cả khi bấm trúng ranh giới phường hay đường)
    map.getContainer().addEventListener('contextmenu', ev => {
        if (!canEdit() || picking) return;
        if (ev.target.closest('.leaflet-control, .leaflet-popup')) return;
        ev.preventDefault();
        const ll = map.mouseEventToLatLng(ev);
        L.popup({ maxWidth: 260 }).setLatLng(ll).setContent(
            `<div class="pa-ctx"><b>Thêm tại vị trí này</b>
             <button type="button" onclick="map.closePopup();pcttAdminCreate(${ll.lat},${ll.lng},'Ngập nước')">💧 Điểm ngập nước</button>
             <button type="button" onclick="map.closePopup();pcttAdminCreate(${ll.lat},${ll.lng},'Sạt lở')">⛰️ Điểm sạt lở / nguy cơ khác</button></div>`).openOn(map);
    });
    renderAddBtn(); setInterval(renderAddBtn, 2000);

    // ---------- Khởi động: chờ dữ liệu PCTT tải xong ----------
    let tries = 0;
    (function wait() {
        if (pcttItems.length) { loadEdits(); return; }
        if (++tries < 120) setTimeout(wait, 500);
    })();
    window.addEventListener('storage', e => { if (e.key === 'sc_session') renderAdminLink(); });

    const css = document.createElement('style');
    css.textContent = `
        .pa-edit-btn { margin-top: 8px; width: 100%; background: #1565c0; color: #fff; border: none; border-radius: 5px; padding: 7px; font-weight: bold; cursor: pointer; }
        #pa-modal .content { max-height: 70vh; overflow: auto; }
        .pa-f { display: block; margin: 6px 0; font-size: 12px; }
        .pa-f span { display: block; font-weight: bold; color: #444; margin-bottom: 2px; }
        .pa-f input, .pa-f textarea, .pa-f select { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #bbb; border-radius: 4px; font: 13px sans-serif; }
        .pa-row { display: flex; gap: 8px; } .pa-row > * { flex: 1; }
        .pa-sec { margin: 10px 0 4px; padding: 3px 6px; background: #e3f2fd; color: #0d47a1; font-weight: bold; font-size: 12px; border-radius: 3px; }
        .pa-note { font-size: 12px; color: #555; margin-bottom: 4px; }
        .pa-chk { display: block; margin: 10px 0; font-size: 13px; color: #b71c1c; font-weight: bold; }
        .pa-msg { font-size: 13px; margin-top: 6px; } .pa-msg.err { color: #c62828; } .pa-msg.info { color: #1565c0; }
        .pa-hidden-link { font-size: 12px; margin-top: 8px; color: #555; border: 1px dashed #b0bec5; border-radius: 5px; padding: 5px 7px; }
        .pa-hidden-link .pa-hl-head { cursor: pointer; font-weight: bold; color: #37474f; display: flex; justify-content: space-between; }
        .pa-hidden-link ul { list-style: none; margin: 6px 0 0; padding: 0; max-height: 180px; overflow-y: auto; }
        .pa-hidden-link li { padding: 4px 0; border-top: 1px solid #eee; }
        .pa-hidden-link li button { margin-top: 3px; border: 1px solid #90a4ae; background: #fff; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; }
        .pa-hide-btn { margin-top: 6px; width: 100%; background: #fff; color: #b71c1c; border: 1px solid #e57373; border-radius: 5px; padding: 6px; font-weight: bold; cursor: pointer; }
        .pa-picking { cursor: crosshair !important; }
        .pa-picking .leaflet-map-pane > .leaflet-pane, .pa-picking .leaflet-map-pane > .leaflet-pane * { pointer-events: none !important; }
        .pa-add { display: flex; gap: 6px; margin: 4px 0 8px; }
        .pa-add button { flex: 1; border: none; border-radius: 5px; padding: 7px 4px; font-weight: bold; font-size: 12px; cursor: pointer; color: #fff; background: #1e88e5; }
        .pa-add button[data-pl="Sạt lở"] { background: #8d5524; }
        .pa-ctx { display: block; width: 220px; } .pa-ctx b { display: block; margin-bottom: 6px; }
        .pa-ctx button { display: block; width: 100%; margin: 4px 0; padding: 7px; border: none; border-radius: 5px; background: #1565c0; color: #fff; font-weight: bold; cursor: pointer; }`;
    document.head.appendChild(css);
})();
