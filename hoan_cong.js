// =====================================================================
// LỚP HỒ SƠ HOÀN CÔNG (bổ sung 18/11/2026)
// - Nút "📐 Hồ sơ hoàn công" (góc trên bên trái): danh sách hồ sơ, tìm theo tên/tuyến.
// - Bấm một hồ sơ: hiện bản vẽ hoàn công (nét CAD tượng trưng) đúng vị trí trên bản đồ, cây lớp CAD
//   bật/tắt như QGIS, thông tin hồ sơ, đường dẫn hồ sơ đầy đủ trên NAS.
// - Người chưa đăng nhập chỉ thấy tên công trình, tuyến, lý trình và hình vẽ. Số biên bản, ngày bàn giao,
//   chủ đầu tư, đơn vị thi công, đường dẫn NAS chỉ hiện khi đã đăng nhập.
// - Quản trị viên: "＋ Tải hồ sơ lên" (tệp .geojson xuất từ QGIS bằng xuat_hoancong_web.py),
//   sửa thông tin, thay bản vẽ, xóa.
// - Dữ liệu: Google Sheet (trang HoanCong) + Google Drive (thư mục HoSoHoanCong) qua Code.gs 1.4.
// - Link mở sẵn: ?hoancong=HC-20261118-170000
// Được nạp tự động bởi kcht_layer.js (không cần sửa index.html).
// =====================================================================
(function () {
    'use strict';
    const API = String(window.SUCO_API_URL || '').trim();
    if (!API || typeof map === 'undefined') return;

    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function session() {
        try {
            const s = JSON.parse(localStorage.getItem('sc_session') || 'null');
            return s && s.token && Date.parse(s.expires) > Date.now() ? s : null;
        } catch (e) { return null; }
    }
    const isAdmin = () => { const s = session(); return !!(s && s.user && s.user.vai_tro === 'admin'); };
    function toast(msg, type) {
        const el = document.createElement('div');
        el.className = 'sc-toast ' + (type || 'ok'); el.textContent = msg; el.style.zIndex = 10050;
        document.body.appendChild(el); setTimeout(() => el.remove(), 5000);
    }
    function fmt(iso) {
        const d = new Date(iso); if (isNaN(d)) return iso || '';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    async function get(params) {
        const r = await fetch(API + (API.includes('?') ? '&' : '?') + new URLSearchParams(Object.assign({}, params, { _: Date.now() })));
        const d = await r.json();
        if (!d.ok) throw new Error(d.code === 'UNKNOWN_ACTION' ? 'Máy chủ Apps Script chưa cập nhật Code.gs phiên bản 1.4' : (d.message || d.code));
        return d;
    }
    async function post(body) {
        const s = session(); if (!s) throw new Error('Cần đăng nhập');
        const r = await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({ token: s.token }, body)) });
        const d = await r.json();
        if (!d.ok) throw new Error(d.code === 'UNKNOWN_ACTION' ? 'Máy chủ Apps Script chưa cập nhật Code.gs phiên bản 1.4' : (d.message || d.code));
        return d;
    }

    // Tên trường
    const F = {
        ten: 'Tên công trình', tuyen: 'Tuyến', ly_trinh: 'Lý trình / phạm vi', nam_hoan_thanh: 'Năm hoàn thành',
        so_bien_ban: 'Số biên bản bàn giao', ngay_ban_giao: 'Ngày bàn giao', chu_dau_tu: 'Chủ đầu tư', don_vi_thi_cong: 'Đơn vị thi công',
        don_vi_tu_van: 'Đơn vị tư vấn giám sát', quy_mo: 'Quy mô, nội dung chính', ghi_chu: 'Ghi chú', link_nas: 'Hồ sơ đầy đủ (NAS)'
    };
    const CONG_KHAI = ['tuyen', 'ly_trinh', 'nam_hoan_thanh'];
    const RIENG = ['so_bien_ban', 'ngay_ban_giao', 'chu_dau_tu', 'don_vi_thi_cong', 'don_vi_tu_van', 'quy_mo', 'ghi_chu'];

    // ---------- Trạng thái ----------
    let items = [];               // danh sách hồ sơ
    let full = {};                // ma -> thông tin đầy đủ (khi đã đăng nhập)
    let serverOk = null;
    const cache = {};             // ma -> GeoJSON bản vẽ
    let current = null;           // { ma, layer, labels, lops: {ten: {color, layers:[], on}} }
    map.createPane('hcPane'); map.getPane('hcPane').style.zIndex = 415;
    map.createPane('hcLabel'); map.getPane('hcLabel').style.zIndex = 445;
    const boxes = L.layerGroup();      // ô bao các bản vẽ
    const drawing = L.layerGroup().addTo(map);
    const labelGroup = L.layerGroup();

    // Màu theo tên lớp CAD (cố định cho cùng một tên)
    const MAU_RIENG = [[/tim|axis|center/i, '#e53935'], [/m[eé]p|bien|edge|bo via|bó vỉa/i, '#1e88e5'], [/cong|cống|thoat|drain|ga/i, '#8e24aa'],
    [/den|đèn|light|chieu sang/i, '#fdd835'], [/cay|cây|tree|xanh/i, '#43a047'], [/bien bao|biển|sign|son|sơn|vach|vạch/i, '#fb8c00'],
    [/text|chu|chữ|ghi chu|dim|kich thuoc/i, '#455a64'], [/cap|cáp|dien|điện|nuoc|nước|ong|ống/i, '#00897b']];
    function colorOf(name) {
        for (const [re, c] of MAU_RIENG) if (re.test(name)) return c;
        let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return `hsl(${h % 360}, 70%, 42%)`;
    }

    // ---------- Tải danh sách ----------
    async function loadList() {
        try {
            const d = await get({ action: 'hoancong_list' });
            serverOk = true; items = d.items;
            if (session()) {
                try { const x = await post({ action: 'hoancong_full' }); full = {}; x.items.forEach(r => full[r.ma] = r); items = x.items.map(r => r); } catch (e) { }
            }
            drawBoxes(); renderPanel();
            const q = new URLSearchParams(location.search).get('hoancong');
            if (q && !current && items.some(r => r.ma === q)) openHs(q);
        } catch (e) { serverOk = false; renderPanel(); }
    }
    function bboxOf(r) {
        const b = String(r.bbox || '').split(',').map(Number);
        return b.length === 4 && b.every(isFinite) ? L.latLngBounds([b[1], b[0]], [b[3], b[2]]) : null;
    }
    function drawBoxes() {
        boxes.clearLayers();
        items.filter(r => r.an !== 'co').forEach(r => {
            const b = bboxOf(r); if (!b) return;
            const rect = L.rectangle(b, { pane: 'hcPane', color: '#ff6d00', weight: 2, dashArray: '6 4', fillOpacity: 0.04 });
            rect.bindTooltip(`📐 ${r.ten}`, { sticky: true });
            rect.on('click', e => { L.DomEvent.stopPropagation(e); openHs(r.ma); });
            boxes.addLayer(rect);
        });
    }

    // ---------- Mở một hồ sơ ----------
    async function openHs(ma) {
        const r = items.find(x => x.ma === ma); if (!r) return;
        openPanel();
        closeDrawing();
        current = { ma, lops: {}, layer: null };
        renderPanel();
        try {
            if (!cache[ma]) { const d = await get({ action: 'hoancong_file', ma }); cache[ma] = JSON.parse(d.geojson); }
            if (!current || current.ma !== ma) return;
            showDrawing(cache[ma], r);
        } catch (e) { toast('Không tải được bản vẽ: ' + e.message, 'err'); }
        renderPanel();
    }
    function showDrawing(gj, r) {
        const lops = current.lops;
        const layer = L.geoJSON(gj, {
            pane: 'hcPane',
            style: f => ({ color: colorOf(f.properties.l || ''), weight: 1.6, opacity: 0.95, fill: false }),
            pointToLayer: (f, ll) => {
                if (f.properties.t) {
                    const m = L.marker(ll, { pane: 'hcLabel', interactive: false, icon: L.divIcon({ className: 'hc-txt', html: `<span style="color:${colorOf(f.properties.l || '')}">${esc(f.properties.t)}</span>`, iconSize: [0, 0] }) });
                    labelGroup.addLayer(m); (lops[f.properties.l || '(không tên)'] = lops[f.properties.l || '(không tên)'] || { color: colorOf(f.properties.l || ''), layers: [], on: true }).layers.push(m);
                    return L.circleMarker(ll, { pane: 'hcPane', radius: 0, opacity: 0, fillOpacity: 0, interactive: false });
                }
                return L.circleMarker(ll, { pane: 'hcPane', radius: 2, color: colorOf(f.properties.l || '') });
            },
            onEachFeature: (f, l) => {
                if (f.properties.t && l instanceof L.CircleMarker && l.options.radius === 0) return;
                const k = f.properties.l || '(không tên)';
                (lops[k] = lops[k] || { color: colorOf(k), layers: [], on: true }).layers.push(l);
                l.on('click', e => {
                    L.DomEvent.stopPropagation(e);
                    L.popup({ maxWidth: 300 }).setLatLng(e.latlng).setContent(`<div class="info-popup kcht-popup"><h4>📐 ${esc(r.ten)}</h4><table>
                        <tr><td>Lớp bản vẽ</td><td>${esc(k)}</td></tr>${f.properties.t ? `<tr><td>Ghi chú</td><td>${esc(f.properties.t)}</td></tr>` : ''}</table>
                        <p class="kcht-note">Xem thông tin hồ sơ ở bảng "📐 Hồ sơ hoàn công" bên trái.</p></div>`).openOn(map);
                });
            }
        });
        current.layer = layer;
        drawing.addLayer(layer);
        updateLabels();
        const b = layer.getBounds(); if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
    }
    function closeDrawing() {
        drawing.clearLayers(); labelGroup.clearLayers();
        if (map.hasLayer(labelGroup)) map.removeLayer(labelGroup);
        current = null;
    }
    // Chữ ghi chú chỉ hiện khi phóng to gần (≥ 17)
    function updateLabels() {
        if (current && map.getZoom() >= 17) { if (!map.hasLayer(labelGroup)) map.addLayer(labelGroup); }
        else if (map.hasLayer(labelGroup)) map.removeLayer(labelGroup);
    }
    map.on('zoomend', updateLabels);
    function setLop(name, on) {
        const o = current && current.lops[name]; if (!o) return;
        o.on = on;
        o.layers.forEach(l => {
            const g = l instanceof L.Marker ? labelGroup : current.layer;
            if (on) g.addLayer(l); else g.removeLayer(l);
        });
    }

    // ---------- Bảng bên trái ----------
    // Đặt như một nút điều khiển Leaflet góc trên bên trái (xếp ngay dưới bảng "Điểm nguy hiểm mùa mưa bão")
    const panel = document.createElement('div');
    panel.id = 'hc-panel'; panel.className = 'hc-panel leaflet-control collapsed';
    const Ctl = L.Control.extend({ options: { position: 'topleft' }, onAdd: () => panel });
    new Ctl().addTo(map);
    L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
    let query = '';
    function openPanel() {
        panel.classList.remove('collapsed');
        if (!map.hasLayer(boxes)) map.addLayer(boxes);
    }
    function nasHtml(link) {
        if (!link) return '';
        const http = /^https?:\/\//i.test(link);
        return `<div class="hc-nas"><b>📂 Hồ sơ đầy đủ (NAS)</b>
            ${http ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>` : `<code>${esc(link)}</code>`}
            <div class="hc-nas-btns">${http ? `<a class="hc-btn" href="${esc(link)}" target="_blank" rel="noopener">Mở hồ sơ</a>` : ''}<button class="hc-btn" data-copy="${esc(link)}">📋 Chép đường dẫn</button></div>
            <small>Chỉ mở được khi máy đang ở mạng cơ quan.${http ? '' : ' Dán đường dẫn vào thanh địa chỉ của File Explorer (Windows).'}</small></div>`;
    }
    function renderPanel() {
        const logged = !!session(), admin = isAdmin();
        let body = '';
        if (serverOk === false) body = `<div class="hc-note err">Chưa tải được danh sách hồ sơ hoàn công (máy chủ Apps Script cần phiên bản 1.4).</div>`;
        else if (current) {
            const r = Object.assign({}, items.find(x => x.ma === current.ma) || {}, full[current.ma] || {});
            const rows = CONG_KHAI.concat(logged ? RIENG : []).filter(k => r[k]).map(k => `<tr><td>${esc(F[k])}</td><td>${esc(k === 'ngay_ban_giao' ? r[k] : r[k])}</td></tr>`).join('');
            const lops = Object.keys(current.lops).sort((a, b) => a.localeCompare(b, 'vi'));
            body = `<a href="#" class="hc-back" data-act="back">← Danh sách hồ sơ</a>
                <h4>📐 ${esc(r.ten)}</h4>
                <table class="hc-tbl">${rows}<tr><td>Số đối tượng</td><td>${esc(r.so_doi_tuong)}</td></tr><tr><td>Cập nhật</td><td>${esc(fmt(r.ngay_cap_nhat))}</td></tr></table>
                ${logged ? nasHtml(r.link_nas) : '<div class="hc-note">🔒 Đăng nhập (bảng "Sự cố hiện trường") để xem số biên bản, chủ đầu tư, đơn vị thi công và đường dẫn hồ sơ đầy đủ trên NAS.</div>'}
                <div class="hc-sec">Lớp bản vẽ ${lops.length ? `<span><a href="#" data-act="all-on">bật hết</a> · <a href="#" data-act="all-off">tắt hết</a></span>` : ''}</div>
                <div class="hc-lops">${current.layer ? lops.map(n => `<label><input type="checkbox" data-lop="${esc(n)}"${current.lops[n].on ? ' checked' : ''}><span class="hc-sw" style="background:${current.lops[n].color}"></span>${esc(n)} <small>(${current.lops[n].layers.length})</small></label>`).join('') : '<div class="hc-note">Đang tải bản vẽ…</div>'}</div>
                <div class="hc-row"><label>Độ đậm nét <input type="range" min="0.2" max="1" step="0.1" value="0.95" data-act="opacity"></label></div>
                <div class="hc-row"><button class="hc-btn" data-act="fit">🔍 Phóng tới bản vẽ</button><button class="hc-btn" data-act="link">🔗 Chép link</button></div>
                ${admin ? `<div class="hc-row admin"><button class="hc-btn blue" data-act="edit">✏️ Sửa thông tin</button><button class="hc-btn blue" data-act="replace">🔁 Thay bản vẽ</button><button class="hc-btn red" data-act="del">🗑 Xóa</button></div>` : ''}`;
        } else {
            const q = query.trim().toLowerCase();
            const list = items.filter(r => r.an !== 'co' && (!q || (r.ten + ' ' + r.tuyen + ' ' + r.ly_trinh).toLowerCase().includes(q)));
            const hidden = admin ? items.filter(r => r.an === 'co') : [];
            body = `<input class="hc-q" placeholder="Tìm theo tên công trình, tuyến…" value="${esc(query)}">
                ${admin ? '<button class="hc-btn green full" data-act="upload">＋ Tải hồ sơ hoàn công lên</button>' : ''}
                <div class="hc-count">${list.length} hồ sơ${q ? ' phù hợp' : ''}</div>
                <ul class="hc-list">${list.map(r => `<li data-ma="${esc(r.ma)}"><b>${esc(r.ten)}</b><small>${esc([r.tuyen, r.ly_trinh, r.nam_hoan_thanh].filter(Boolean).join(' · '))}</small></li>`).join('') || '<li class="empty">Chưa có hồ sơ nào.</li>'}</ul>
                ${hidden.length ? `<div class="hc-note">🗑 Đã xóa: ${hidden.map(r => `<a href="#" data-restore="${esc(r.ma)}">${esc(r.ten)}</a>`).join(', ')}</div>` : ''}`;
        }
        panel.innerHTML = `<div class="hc-head" data-act="toggle"><span>📐 Hồ sơ hoàn công</span><span class="hc-tg">${panel.classList.contains('collapsed') ? '▸' : '▾'}</span></div><div class="hc-body">${body}</div>`;
        const qi = panel.querySelector('.hc-q');
        if (qi) qi.oninput = () => { query = qi.value; const pos = qi.selectionStart; renderPanel(); const n = panel.querySelector('.hc-q'); n.focus(); n.setSelectionRange(pos, pos); };
    }
    panel.addEventListener('click', e => {
        const li = e.target.closest('li[data-ma]');
        if (li) { openHs(li.dataset.ma); return; }
        const t = e.target.closest('[data-act],[data-copy],[data-restore]'); if (!t) return;
        if (t.dataset.copy) { copy(t.dataset.copy); return; }
        e.preventDefault();
        if (t.dataset.restore) { saveInfo(t.dataset.restore, {}, null, 'khoi_phuc'); return; }
        const a = t.dataset.act;
        if (a === 'toggle') {
            panel.classList.toggle('collapsed');
            if (!panel.classList.contains('collapsed')) { openPanel(); if (serverOk === null || !items.length) loadList(); }
            renderPanel();
        }
        else if (a === 'back') { closeDrawing(); renderPanel(); }
        else if (a === 'fit' && current && current.layer) map.fitBounds(current.layer.getBounds(), { padding: [40, 40] });
        else if (a === 'link' && current) copy(location.origin + location.pathname + '?hoancong=' + encodeURIComponent(current.ma));
        else if (a === 'all-on' || a === 'all-off') { Object.keys(current.lops).forEach(n => setLop(n, a === 'all-on')); renderPanel(); }
        else if (a === 'upload') openForm(null);
        else if (a === 'edit' && current) openForm(current.ma);
        else if (a === 'replace' && current) openForm(current.ma, true);
        else if (a === 'del' && current) {
            const r = items.find(x => x.ma === current.ma);
            if (confirm(`Xóa hồ sơ "${r.ten}" khỏi bản đồ?\nQuản trị viên khôi phục được trong danh sách "Đã xóa".`)) saveInfo(current.ma, {}, null, 'xoa');
        }
    });
    panel.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.lop) setLop(t.dataset.lop, t.checked);
    });
    panel.addEventListener('input', e => {
        const t = e.target;
        if (t.dataset.act === 'opacity' && current && current.layer) current.layer.setStyle({ opacity: +t.value });
    });
    function copy(text) {
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Đã chép: ' + text), () => prompt('Chép đường dẫn:', text));
    }

    // ---------- Biểu mẫu tải lên / sửa (quản trị viên) ----------
    function closeModal() { const m = document.getElementById('hc-modal'); if (m) m.remove(); preview.clearLayers(); }
    const preview = L.layerGroup().addTo(map);
    function openForm(ma, replaceOnly) {
        if (!isAdmin()) { toast('Chỉ quản trị viên được cập nhật hồ sơ hoàn công', 'err'); return; }
        const r = ma ? Object.assign({}, items.find(x => x.ma === ma), full[ma] || {}) : {};
        const fld = (k, rows) => `<label class="hc-f"><span>${esc(F[k])}${k === 'ten' ? ' *' : ''}</span>${rows ? `<textarea id="hc-${k}" rows="${rows}">${esc(r[k] || '')}</textarea>` : `<input id="hc-${k}" value="${esc(r[k] || '')}"${k === 'tuyen' ? ' list="hc-roads"' : ''}>`}</label>`;
        const roads = window.KCHT ? Object.keys(window.KCHT.roadIndex) : [];
        const sel = document.getElementById('road-select');
        const allRoads = [...new Set(roads.concat(sel ? [...sel.options].map(o => o.value).filter(Boolean) : []))].sort((a, b) => a.localeCompare(b, 'vi'));
        const fileBox = `<div class="hc-file"><b>Tệp bản vẽ (.geojson xuất từ QGIS bằng xuat_hoancong_web.py)</b>
            <input type="file" id="hc-file" accept=".geojson,.json,application/geo+json,application/json">
            <div id="hc-file-msg" class="hc-note">${ma ? 'Bỏ trống nếu giữ nguyên bản vẽ hiện tại.' : 'Chọn tệp để xem trước vị trí trên bản đồ.'}</div></div>`;
        const body = replaceOnly ? fileBox : `${ma ? '' : fileBox}
            ${fld('ten')}<div class="hc-2">${fld('tuyen')}${fld('ly_trinh')}</div>
            <div class="hc-2">${fld('nam_hoan_thanh')}${fld('so_bien_ban')}</div><div class="hc-2">${fld('ngay_ban_giao')}${fld('chu_dau_tu')}</div>
            <div class="hc-2">${fld('don_vi_thi_cong')}${fld('don_vi_tu_van')}</div>${fld('quy_mo', 2)}${fld('ghi_chu', 2)}
            <label class="hc-f"><span>${esc(F.link_nas)}</span><input id="hc-link_nas" value="${esc(r.link_nas || '')}" placeholder="VD: \\\\NAS-TTQLHT\\HoSoHoanCong\\2026\\Duong_A  hoặc  http://192.168.1.10:5000/..."></label>
            <datalist id="hc-roads">${allRoads.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
            <div class="hc-note">🔒 Từ "Số biên bản" trở xuống và đường dẫn NAS chỉ hiện với người đã đăng nhập.</div>`;
        const bg = document.createElement('div'); bg.className = 'sc-modal-bg'; bg.id = 'hc-modal';
        bg.innerHTML = `<div class="sc-modal" role="dialog" style="max-width:640px;width:94vw"><header><span>${ma ? (replaceOnly ? '🔁 Thay bản vẽ' : '✏️ Sửa hồ sơ hoàn công') : '＋ Tải hồ sơ hoàn công lên'}</span><button id="hc-x" aria-label="Đóng">×</button></header>
            <div class="content" style="max-height:70vh;overflow:auto">${body}<div id="hc-msg" class="hc-note"></div></div>
            <footer><button class="sc-btn" id="hc-cancel">Hủy</button><button class="sc-btn blue" id="hc-save">💾 Lưu</button></footer></div>`;
        document.body.appendChild(bg);
        L.DomEvent.disableClickPropagation(bg); L.DomEvent.disableScrollPropagation(bg);
        document.getElementById('hc-x').onclick = document.getElementById('hc-cancel').onclick = closeModal;
        let text = null, fname = '';
        const fi = document.getElementById('hc-file');
        if (fi) fi.onchange = async () => {
            const f = fi.files[0]; const m = document.getElementById('hc-file-msg'); text = null; preview.clearLayers();
            if (!f) return;
            if (f.size > 40 * 1048576) { m.textContent = 'Tệp quá lớn (trên 40 MB). Hãy tăng mức rút gọn khi xuất từ QGIS.'; m.className = 'hc-note err'; return; }
            try {
                const t = await f.text(); const gj = JSON.parse(t);
                if (gj.type !== 'FeatureCollection' || !gj.features || !gj.features.length) throw new Error('không phải GeoJSON có đối tượng');
                const lyr = L.geoJSON(gj, { pane: 'hcPane', style: { color: '#ff1744', weight: 1.5 }, pointToLayer: (x, ll) => L.circleMarker(ll, { radius: 1 }) });
                const b = lyr.getBounds();
                if (!b.isValid() || b.getWest() < 106.5 || b.getEast() > 109.5 || b.getSouth() < 14.5 || b.getNorth() > 17) throw new Error('tọa độ nằm ngoài Đà Nẵng – bản vẽ chưa nắn về VN-2000 hoặc chưa xuất đúng bằng script');
                preview.addLayer(lyr); map.fitBounds(b, { padding: [40, 40] });
                text = t; fname = f.name;
                const nl = new Set(gj.features.map(x => x.properties && x.properties.l)).size;
                m.textContent = `✔ ${gj.features.length} đối tượng, ${nl} lớp CAD, ${(f.size / 1048576).toFixed(1)} MB – nét đỏ trên bản đồ là vị trí xem trước.`; m.className = 'hc-note ok';
                const tn = document.getElementById('hc-ten'); if (tn && !tn.value) tn.value = (gj.name || f.name.replace(/\.[^.]+$/, '')).replace(/[_]+/g, ' ');
            } catch (e) { m.textContent = 'Không đọc được tệp: ' + e.message; m.className = 'hc-note err'; }
        };
        document.getElementById('hc-save').onclick = async function () {
            const msg = document.getElementById('hc-msg');
            const data = {};
            if (!replaceOnly) Object.keys(F).forEach(k => { const el = document.getElementById('hc-' + k); if (el) data[k] = el.value.trim(); });
            if (!replaceOnly && !data.ten) { msg.textContent = 'Hãy nhập tên công trình'; msg.className = 'hc-note err'; return; }
            if (!ma && !text) { msg.textContent = 'Hãy chọn tệp bản vẽ'; msg.className = 'hc-note err'; return; }
            if (replaceOnly && !text) { msg.textContent = 'Hãy chọn tệp bản vẽ mới'; msg.className = 'hc-note err'; return; }
            if (fname) data.ten_tep = fname;
            this.disabled = true; msg.textContent = text ? 'Đang tải bản vẽ lên (có thể mất 10–60 giây)…' : 'Đang lưu…'; msg.className = 'hc-note';
            try {
                const it = await saveInfo(ma, data, text);
                closeModal(); toast('Đã lưu hồ sơ: ' + it.ten);
            } catch (e) { msg.textContent = 'CHƯA LƯU: ' + e.message; msg.className = 'hc-note err'; this.disabled = false; }
        };
    }
    async function saveInfo(ma, data, text, kieu) {
        const d = await post({ action: 'hoancong_save', ma: ma || '', data: data, geojson: text || undefined, kieu: kieu });
        const it = d.item;
        full[it.ma] = it;
        const i = items.findIndex(x => x.ma === it.ma);
        if (i >= 0) items[i] = it; else items.unshift(it);
        if (text) cache[it.ma] = JSON.parse(text);
        drawBoxes();
        if (kieu === 'xoa') { closeDrawing(); toast('Đã xóa hồ sơ: ' + it.ten); renderPanel(); }
        else if (kieu === 'khoi_phuc') { toast('Đã khôi phục: ' + it.ten); openHs(it.ma); }
        else openHs(it.ma);
        return it;
    }

    // Đăng nhập / đăng xuất: tải lại thông tin
    let lastTok = (session() || {}).token;
    setInterval(() => {
        const t = (session() || {}).token;
        if (t !== lastTok) { lastTok = t; full = {}; if (!panel.classList.contains('collapsed') || current) loadList(); else renderPanel(); }
    }, 2000);

    // Thêm lớp "ô bao bản vẽ" vào "Chọn loại bản đồ"
    if (typeof layerControl !== 'undefined') layerControl.addOverlay(boxes, '<span style="color:#ff6d00">⬚</span> Hồ sơ hoàn công – vùng bản vẽ');

    const css = document.createElement('style');
    css.textContent = `
        .hc-panel { width: 300px; max-width: 78vw; background: #fff; border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,.3); font: 13px sans-serif; }
        .hc-panel .hc-head { display: flex; justify-content: space-between; padding: 8px 10px; cursor: pointer; font-weight: bold; color: #e65100; }
        .hc-panel.collapsed .hc-body { display: none; }
        .hc-body { padding: 0 10px 10px; max-height: calc(100vh - 300px); overflow-y: auto; }
        .hc-q { width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid #bbb; border-radius: 4px; margin-bottom: 6px; }
        .hc-count { color: #555; margin: 4px 0; }
        .hc-list { list-style: none; margin: 0; padding: 0; }
        .hc-list li { padding: 6px 4px; border-bottom: 1px solid #eee; cursor: pointer; }
        .hc-list li:hover { background: #fff3e0; } .hc-list li small { display: block; color: #666; }
        .hc-list li.empty { color: #888; cursor: default; }
        .hc-back { display: inline-block; margin: 2px 0 6px; }
        .hc-panel h4 { margin: 2px 0 6px; color: #0d47a1; font-size: 14px; }
        .hc-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .hc-tbl td { padding: 3px 4px; border-bottom: 1px solid #eee; vertical-align: top; word-wrap: break-word; font-size: 12px; }
        .hc-tbl td:first-child { width: 42%; color: #555; font-weight: 600; }
        .hc-nas { margin: 8px 0; padding: 7px; background: #e3f2fd; border-radius: 5px; font-size: 12px; }
        .hc-nas code { display: block; word-break: break-all; background: #fff; padding: 4px; border-radius: 3px; margin: 4px 0; }
        .hc-nas small { color: #555; display: block; margin-top: 4px; }
        .hc-nas-btns { display: flex; gap: 4px; margin-top: 4px; }
        .hc-sec { margin: 8px 0 4px; padding: 3px 6px; background: #fff3e0; color: #e65100; font-weight: bold; display: flex; justify-content: space-between; border-radius: 3px; }
        .hc-sec span { font-weight: normal; font-size: 12px; }
        .hc-lops label { display: flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 12px; cursor: pointer; }
        .hc-lops small { color: #888; }
        .hc-sw { display: inline-block; width: 18px; height: 4px; border-radius: 2px; }
        .hc-row { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; } .hc-row label { font-size: 12px; color: #555; }
        .hc-btn { flex: 1; padding: 6px 4px; border: 1px solid #90a4ae; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; text-align: center; text-decoration: none; color: #222; }
        .hc-btn.blue { background: #1565c0; color: #fff; border-color: #1565c0; } .hc-btn.red { background: #c62828; color: #fff; border-color: #c62828; }
        .hc-btn.green { background: #2e7d32; color: #fff; border-color: #2e7d32; font-weight: bold; } .hc-btn.full { display: block; width: 100%; margin-bottom: 4px; }
        .hc-note { font-size: 12px; color: #555; margin: 6px 0; } .hc-note.err { color: #c62828; } .hc-note.ok { color: #2e7d32; }
        .hc-txt span { font: 11px sans-serif; white-space: nowrap; text-shadow: 0 0 2px #fff, 0 0 2px #fff; transform: translate(-50%, -50%); display: inline-block; }
        .hc-f { display: block; margin: 5px 0; font-size: 12px; flex: 1; } .hc-f span { display: block; font-weight: bold; color: #444; margin-bottom: 2px; }
        .hc-f input, .hc-f textarea { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #bbb; border-radius: 4px; font: 13px sans-serif; }
        .hc-2 { display: flex; gap: 8px; }
        .hc-file { padding: 8px; border: 1px dashed #ff6d00; border-radius: 5px; margin-bottom: 8px; background: #fffaf3; }
        .hc-file input { margin-top: 6px; }`;
    document.head.appendChild(css);

    renderPanel();
    // Mở sẵn khi có ?hoancong=
    if (new URLSearchParams(location.search).get('hoancong')) { openPanel(); loadList(); }
    else loadList();
})();
