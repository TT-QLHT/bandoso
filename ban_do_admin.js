// =====================================================================
// CHỈNH SỬA BẢN ĐỒ CHO QUẢN TRỊ VIÊN (bổ sung 18/11/2026)
// - Đăng nhập tài khoản QUẢN TRỊ (admin) ở bảng "Sự cố hiện trường" sẽ thấy:
//   + Trong bảng thông tin của mọi đối tượng (đường đô thị, đoạn QL/ĐT, cầu, hầm, kè, phao, cọc Km…):
//     ✏️ Sửa thông tin · 📍 Sửa vị trí / vẽ lại · 🗑 Xóa · ↩ Về bản gốc · 🕘 Lịch sử
//   + Nút "🛠 Quản trị bản đồ" (góc dưới bên trái): thêm đối tượng mới (kể cả điểm ngập nước,
//     sạt lở PCTT), xem danh sách đã chỉnh sửa / đã xóa, tải GeoJSON đã gộp chỉnh sửa.
// - Chỉnh sửa lưu vào Google Sheet (trang BanDo_ChinhSua, lịch sử BanDo_LichSu) qua máy chủ
//   Apps Script của chức năng sự cố (Code.gs phiên bản 1.3). File GeoJSON trên GitHub giữ nguyên làm
//   dữ liệu gốc; mọi người mở bản đồ đều thấy bản đã sửa.
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
        return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    const clone = o => JSON.parse(JSON.stringify(o));

    // ---------- Loại đối tượng và mẫu thông tin cho đối tượng mới ----------
    const LOP = {
        do_thi: { ten: 'Đường đô thị (toàn tuyến)', kieu: 'line', mau: ['Loại=Đường đô thị', 'Tên tuyến (danh mục)', 'Điểm đầu', 'Điểm cuối', 'Số đoạn trong danh mục', 'Tổng chiều dài danh mục (km)', 'Phường (danh mục)', 'Cấp đường', 'Kết cấu mặt đường', 'Bề rộng mặt đường (m)', 'Năm đưa vào SD', 'Ghi chú'] },
        do_thi_doan: { ten: 'Đoạn đường đô thị', kieu: 'line', mau: ['Tuyến', 'Điểm đầu', 'Điểm cuối', 'Phường', 'Chiều dài DM (km)', 'Kết cấu mặt đường', 'Bề rộng mặt đường (m)', 'Ghi chú'] },
        ql_doan: { ten: 'Đoạn quốc lộ', kieu: 'line', mau: ['Tên tuyến', 'Từ Km', 'Đến Km', 'Chiều dài đang quản lý, bảo trì (km)', 'Cấp đường', 'Số làn xe', 'Bề rộng mặt đường (m)', 'Kết cấu mặt đường', 'Đơn vị bảo trì', 'Phường/xã (theo ranh giới)', 'Ghi chú'] },
        dt_doan: { ten: 'Đoạn đường tỉnh', kieu: 'line', mau: ['Tên tuyến', 'Từ Km / Điểm đầu', 'Đến Km / Điểm cuối', 'Chiều dài (km)', 'Cấp đường', 'Bề rộng mặt đường (m)', 'Kết cấu mặt đường', 'Đơn vị bảo trì', 'Phường/xã (theo ranh giới)', 'Ghi chú'] },
        tuyen_moi: { ten: 'Tuyến bổ sung (như ĐT.601, ĐT.602)', kieu: 'line', mau: ['Loại', 'Lý trình đầu/cuối', 'Chiều dài (km)', 'Ghi chú'] },
        khac_duong: { ten: 'Tuyến / đường khác', kieu: 'line', mau: ['Loại', 'Mô tả', 'Chiều dài (km)', 'Ghi chú'] },
        cau: { ten: 'Cầu', kieu: 'point', mau: ['Tên cầu', 'Tuyến', 'Lý trình tim cầu', 'Vượt', 'Chiều dài toàn cầu (m)', 'Chiều rộng toàn cầu (m)', 'Kết cấu nhịp chính', 'Tải trọng thiết kế', 'Năm xây dựng', 'Tình trạng cầu', 'Phường/xã (theo ranh giới)', 'Ghi chú'] },
        ham: { ten: 'Hầm đường bộ', kieu: 'point', mau: ['Tên hầm', 'Vị trí', 'Chiều dài (m)', 'Bề rộng (m)', 'Năm đưa vào SD', 'Ghi chú'] },
        ke_hao: { ten: 'Kè, hào kỹ thuật, sàn', kieu: 'point', mau: ['Loại', 'Tên', 'Vị trí', 'Quy mô', 'Năm hoàn thành', 'Ghi chú'] },
        bao_hieu: { ten: 'Phao, biển báo hiệu đường thủy nội địa', kieu: 'point', mau: ['Loại', 'Tên', 'Vị trí', 'Ghi chú'] },
        coc_km: { ten: 'Cọc Km', kieu: 'point', mau: [] },
        cau_osm: { ten: 'Cầu chưa có trong danh mục', kieu: 'point', mau: ['Tên cầu (OSM)', 'Tuyến', 'Ghi chú'] },
        khac_diem: { ten: 'Điểm khác', kieu: 'point', mau: ['Loại', 'Mô tả', 'Ghi chú'] }
    };
    // Thuộc tính phụ quyết định màu / nhóm
    const PROPS = {
        do_thi: [['st', 'Màu tuyến', [['ok', 'Xanh – khớp chiều dài danh mục'], ['dai', 'Cam – dài hơn phạm vi quản lý'], ['ngan', 'Đỏ – ngắn hơn danh mục']]]],
        ql_doan: [['hc', 'Lý trình', [[1, 'Đã hiệu chỉnh theo cọc (đỏ)'], [0, 'Ước tính (cam)']]]],
        dt_doan: [['hc', 'Lý trình', [[1, 'Đã hiệu chỉnh theo cọc (xanh)'], [0, 'Ước tính (tím)']]]],
        cau: [['nhom', 'Nhóm cầu', [['ql', 'Cầu trên quốc lộ (đỏ)'], ['dt', 'Cầu trên đường tỉnh (xanh)'], ['nt', 'Cầu nội thị, cầu khác (tím)']]]]
    };
    const ROUTE_PROP = { ql_doan: 1, dt_doan: 1, coc_km: 1, cau_osm: 1 };   // có thuộc tính "tuyen"

    // ---------- Trạng thái ----------
    const EDITS = {};   // mã -> bản ghi chỉnh sửa trên máy chủ
    const ORIG = {};    // mã -> đối tượng gốc (trước khi sửa) để khôi phục
    let serverOk = null;

    function apply(row) {
        const id = row.ma, cur = KCHT.ITEMS[id];
        if (!(id in ORIG)) ORIG[id] = cur && !(cur.f.properties._moi) ? clone(cur.f) : null;
        EDITS[id] = row;
        if (row.kieu === 'goc') {
            if (ORIG[id]) KCHT.add(clone(ORIG[id]), id); else KCHT.remove(id);
            return;
        }
        if (row.kieu === 'xoa') { KCHT.remove(id); return; }
        const base = cur ? cur.f : ORIG[id];
        const props = Object.assign({}, base ? base.properties : {}, row.props || {}, { lop: row.lop, ten: row.ten, tt: row.tt || [], id: id });
        if (row.kieu === 'them') props._moi = 1;
        const geom = row.hinh || (base && base.geometry);
        if (!geom) return;
        KCHT.add({ type: 'Feature', properties: props, geometry: geom }, id);
    }

    async function load() {
        try {
            const r = await fetch(API + (API.includes('?') ? '&' : '?') + 'action=bando_list&_=' + Date.now());
            const d = await r.json();
            if (!d.ok) { serverOk = false; return; }
            serverOk = true;
            d.items.forEach(row => { try { apply(row); } catch (e) { console.error('Không áp được chỉnh sửa', row.ma, e); } });
        } catch (e) { console.error('Không tải được chỉnh sửa bản đồ', e); }
    }

    async function post(body) {
        const s = session();
        if (!s) throw new Error('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại');
        const r = await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({ token: s.token }, body)) });
        const d = await r.json();
        if (!d.ok) throw new Error(d.code === 'UNKNOWN_ACTION' ? 'Máy chủ Apps Script chưa cập nhật Code.gs phiên bản 1.3' : (d.message || d.code));
        return d;
    }
    async function save(id, data) {
        const d = await post({ action: 'bando_save', ma: id, data: data });
        apply(d.item);
        return d.item;
    }
    function guard() {
        if (!isAdmin()) { toast('Cần đăng nhập tài khoản quản trị viên', 'err'); return false; }
        if (serverOk === false) { toast('Máy chủ Apps Script chưa cập nhật Code.gs phiên bản 1.3 nên chưa lưu được chỉnh sửa', 'err'); return false; }
        return true;
    }
    // Dữ liệu hiện tại của đối tượng để gửi lên máy chủ
    function dataOf(id) {
        const it = KCHT.ITEMS[id]; if (!it) return null;
        const p = it.f.properties, props = {};
        ['st', 'hc', 'nhom', 'tuyen'].forEach(k => { if (p[k] !== undefined) props[k] = p[k]; });
        return { lop: p.lop, kieu: p._moi ? 'them' : 'sua', ten: p.ten, tt: clone(p.tt || []), props: props, hinh: clone(it.f.geometry) };
    }
    function newId(lop) {
        const d = new Date(), p = n => String(n).padStart(2, '0');
        return `moi-${lop}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2, 5)}`;
    }

    // ---------- Nút trong bảng thông tin ----------
    window.KCHT_ADMIN_BTNS = function (id) {
        if (!isAdmin()) return '';
        const e = EDITS[id];
        const note = e && e.kieu !== 'goc' ? `<div class="bda-edited">Đã chỉnh sửa ${esc(fmt(e.ngay_cap_nhat))} – ${esc(e.ho_ten_nguoi_cap_nhat || e.nguoi_cap_nhat)}</div>` : '';
        return `${note}<div class="bda-btns">
            <button type="button" onclick="BDA.edit('${id}')">✏️ Sửa thông tin</button>
            <button type="button" onclick="BDA.geom('${id}')">📍 Sửa vị trí</button>
            <button type="button" class="red" onclick="BDA.del('${id}')">🗑 Xóa</button>
            ${e && e.kieu === 'sua' && ORIG[id] ? `<button type="button" onclick="BDA.revert('${id}')">↩ Về bản gốc</button>` : ''}
            ${e ? `<button type="button" onclick="BDA.history('${id}')">🕘 Lịch sử</button>` : ''}
        </div>`;
    };

    // ---------- Hộp thoại ----------
    function modal(title, body, foot) {
        closeModal();
        const bg = document.createElement('div');
        bg.className = 'sc-modal-bg'; bg.id = 'bda-modal';
        bg.innerHTML = `<div class="sc-modal bda-modal" role="dialog"><header><span>${title}</span><button id="bda-x" aria-label="Đóng">×</button></header>
            <div class="content">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
        document.body.appendChild(bg);
        L.DomEvent.disableClickPropagation(bg); L.DomEvent.disableScrollPropagation(bg);
        document.getElementById('bda-x').onclick = closeModal;
        return bg;
    }
    function closeModal() { const m = document.getElementById('bda-modal'); if (m) m.remove(); }
    function msg(t, type) { const el = document.getElementById('bda-msg'); if (el) { el.textContent = t; el.className = 'bda-msg ' + type; } }

    // ---------- Biểu mẫu sửa thông tin ----------
    function rowHtml(k, v) {
        return `<div class="bda-row"><input class="bda-k" value="${esc(k)}" placeholder="Tên trường"><textarea class="bda-v" rows="${Math.min(5, Math.max(1, Math.ceil(String(v || '').length / 55)))}" placeholder="Giá trị">${esc(v)}</textarea><button type="button" class="bda-delrow" title="Xóa dòng">✕</button></div>`;
    }
    function propsHtml(lop, p) {
        let h = '';
        (PROPS[lop] || []).forEach(([k, label, opts]) => {
            h += `<label class="bda-f"><span>${esc(label)}</span><select data-prop="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(p[k]) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
        });
        if (ROUTE_PROP[lop]) h += `<label class="bda-f"><span>Thuộc tuyến (VD: Quốc lộ 14B, ĐT.603)</span><input data-prop="tuyen" value="${esc(p.tuyen || '')}"></label>`;
        return h;
    }
    function openForm(opt) {
        // opt: { id, lop, ten, tt, props, hinh, kieu, title, after }
        const lopSel = opt.chonLop ? `<label class="bda-f"><span>Loại đối tượng</span><select id="bda-lop">${Object.keys(LOP).filter(k => LOP[k].kieu === LOP[opt.lop].kieu).map(k => `<option value="${k}"${k === opt.lop ? ' selected' : ''}>${esc(LOP[k].ten)}</option>`).join('')}</select></label>`
            : `<div class="bda-note">Loại: <b>${esc((LOP[opt.lop] || {}).ten || opt.lop)}</b> · Mã: ${esc(opt.id)}</div>`;
        const body = `${lopSel}
            <label class="bda-f"><span>Tên hiển thị trên bản đồ</span><input id="bda-ten" value="${esc(opt.ten)}"></label>
            <div id="bda-props">${propsHtml(opt.lop, opt.props || {})}</div>
            <div class="bda-sec">Bảng thông tin <small>(sửa trực tiếp; thêm hoặc xóa dòng tùy ý; dòng để trống giá trị sẽ không hiện)</small></div>
            <div id="bda-rows">${(opt.tt || []).map(r => rowHtml(r[0], r[1])).join('')}</div>
            <button type="button" class="bda-addrow" id="bda-addrow">＋ Thêm dòng</button>
            <div class="bda-msg" id="bda-msg"></div>`;
        modal(opt.title || '✏️ Sửa thông tin đối tượng', body, `<button class="sc-btn" id="bda-cancel">Hủy</button><button class="sc-btn blue" id="bda-save">💾 Lưu</button>`);
        const rows = document.getElementById('bda-rows');
        rows.addEventListener('click', e => { if (e.target.classList.contains('bda-delrow')) e.target.parentElement.remove(); });
        document.getElementById('bda-addrow').onclick = () => { rows.insertAdjacentHTML('beforeend', rowHtml('', '')); rows.lastElementChild.querySelector('.bda-k').focus(); };
        const ls = document.getElementById('bda-lop');
        if (ls) ls.onchange = () => { document.getElementById('bda-props').innerHTML = propsHtml(ls.value, opt.props || {}); };
        document.getElementById('bda-cancel').onclick = () => { closeModal(); if (opt.onCancel) opt.onCancel(); };
        document.getElementById('bda-x').onclick = document.getElementById('bda-cancel').onclick;
        document.getElementById('bda-save').onclick = async function () {
            const lop = ls ? ls.value : opt.lop;
            const ten = document.getElementById('bda-ten').value.trim();
            if (!ten) { msg('Hãy nhập tên hiển thị', 'err'); return; }
            const tt = [...rows.querySelectorAll('.bda-row')].map(r => [r.querySelector('.bda-k').value.trim(), r.querySelector('.bda-v').value.trim()]).filter(r => r[0]);
            const props = Object.assign({}, opt.props || {});
            ['st', 'hc', 'nhom', 'tuyen'].forEach(k => { if (!(PROPS[lop] || []).some(x => x[0] === k) && !(k === 'tuyen' && ROUTE_PROP[lop])) delete props[k]; });
            document.querySelectorAll('#bda-props [data-prop]').forEach(el => { props[el.dataset.prop] = el.dataset.prop === 'hc' ? +el.value : el.value.trim(); });
            const btn = this; btn.disabled = true; msg('Đang lưu…', 'info');
            try {
                await save(opt.id, { lop: lop, kieu: opt.kieu, ten: ten, tt: tt, props: props, hinh: opt.hinh });
                closeModal(); toast('Đã lưu: ' + ten);
                KCHT.show(opt.id);
            } catch (e) { msg('CHƯA LƯU: ' + e.message, 'err'); btn.disabled = false; }
        };
    }

    // ---------- Vẽ / sửa vị trí ----------
    map.createPane('bdaEdit'); map.getPane('bdaEdit').style.zIndex = 660;
    const GE = { on: false };
    function geStop() {
        if (GE.layers) GE.layers.forEach(l => map.removeLayer(l));
        if (GE.bar) GE.bar.remove();
        map.off('click', GE.onMapClick);
        map.getContainer().classList.remove('bda-editing');
        map.doubleClickZoom.enable();
        Object.assign(GE, { on: false, layers: null, bar: null });
    }
    // kieu: 'point' | 'line'; geom: hình học ban đầu (có thể null); done(geom) khi bấm Xong
    function geStart(kieu, geom, title, done, cancel) {
        if (GE.on) geStop();
        map.closePopup(); closeModal();
        GE.on = true; GE.layers = [];
        map.getContainer().classList.add('bda-editing');
        map.doubleClickZoom.disable();
        const bar = document.createElement('div');
        bar.className = 'bda-bar';
        L.DomEvent.disableClickPropagation(bar);
        document.body.appendChild(bar); GE.bar = bar;
        const finish = ok => {
            let g = null;
            if (ok) {
                if (kieu === 'point') {
                    if (!GE.marker) { toast('Hãy bấm lên bản đồ để chọn vị trí', 'err'); return; }
                    const ll = GE.marker.getLatLng(); g = { type: 'Point', coordinates: [+ll.lng.toFixed(6), +ll.lat.toFixed(6)] };
                } else {
                    const parts = GE.parts.filter(p => p.length >= 2).map(p => p.map(ll => [+ll.lng.toFixed(6), +ll.lat.toFixed(6)]));
                    if (!parts.length) { toast('Đường cần ít nhất 2 điểm', 'err'); return; }
                    g = parts.length === 1 ? { type: 'LineString', coordinates: parts[0] } : { type: 'MultiLineString', coordinates: parts };
                }
            }
            geStop();
            if (ok) done(g); else if (cancel) cancel();
        };
        if (kieu === 'point') {
            const icon = L.divIcon({ className: 'bda-pt', html: '<div></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
            const put = ll => {
                if (GE.marker) GE.marker.setLatLng(ll);
                else { GE.marker = L.marker(ll, { pane: 'bdaEdit', draggable: true, icon: icon }).addTo(map); GE.layers.push(GE.marker); }
            };
            GE.marker = null;
            if (geom && geom.type === 'Point') { put(L.latLng(geom.coordinates[1], geom.coordinates[0])); map.setView(GE.marker.getLatLng(), Math.max(map.getZoom(), 17)); }
            GE.onMapClick = e => put(e.latlng);
            map.on('click', GE.onMapClick);
            bar.innerHTML = `<b>${esc(title)}</b><span>Bấm lên bản đồ để đặt điểm, hoặc kéo điểm đỏ đến vị trí mới.</span>
                <button class="ok" id="bda-g-ok">✔ Xong</button><button id="bda-g-no">✕ Hủy</button>`;
        } else {
            GE.parts = [];
            if (geom && geom.type === 'LineString') GE.parts = [geom.coordinates.map(c => L.latLng(c[1], c[0]))];
            if (geom && geom.type === 'MultiLineString') GE.parts = geom.coordinates.map(p => p.map(c => L.latLng(c[1], c[0])));
            if (!GE.parts.length) GE.parts = [[]];
            const nv = GE.parts.reduce((a, p) => a + p.length, 0);
            GE.canDrag = nv <= 600;
            if (geom) {
                const old = L.geoJSON(geom, { pane: 'bdaEdit', interactive: false, style: { color: '#555', weight: 3, dashArray: '4 6', opacity: 0.7 } }).addTo(map);
                GE.layers.push(old); map.fitBounds(old.getBounds(), { padding: [60, 60] });
            }
            const line = L.polyline([], { pane: 'bdaEdit', interactive: false, color: '#ff1744', weight: 5 }).addTo(map);
            GE.layers.push(line);
            const vg = L.layerGroup().addTo(map); GE.layers.push(vg);
            const vIcon = L.divIcon({ className: 'bda-v', html: '<div></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
            const redraw = () => {
                line.setLatLngs(GE.parts);
                vg.clearLayers();
                if (!GE.canDrag) {
                    const last = GE.parts[GE.parts.length - 1]; if (last.length) L.marker(last[last.length - 1], { pane: 'bdaEdit', icon: vIcon, interactive: false }).addTo(vg);
                    return;
                }
                GE.parts.forEach((part, pi) => part.forEach((ll, i) => {
                    const m = L.marker(ll, { pane: 'bdaEdit', draggable: true, icon: vIcon }).addTo(vg);
                    m.on('drag', e => { part[i] = e.target.getLatLng(); line.setLatLngs(GE.parts); });
                    m.on('click', () => { part.splice(i, 1); redraw(); });
                }));
            };
            redraw();
            GE.onMapClick = e => { GE.parts[GE.parts.length - 1].push(e.latlng); redraw(); };
            map.on('click', GE.onMapClick);
            bar.innerHTML = `<b>${esc(title)}</b><span>Bấm lên bản đồ để thêm điểm vào cuối đường.${GE.canDrag ? ' Kéo đỉnh để dời, bấm vào đỉnh để xóa đỉnh.' : ' (Đường có nhiều điểm: chỉ thêm/bỏ điểm cuối hoặc vẽ lại.)'} Nét đứt xám là vị trí cũ.</span>
                <button id="bda-g-undo">↶ Bỏ điểm cuối</button><button id="bda-g-new">✎ Vẽ lại từ đầu</button><button id="bda-g-part">＋ Nhánh mới</button>
                <button class="ok" id="bda-g-ok">✔ Xong</button><button id="bda-g-no">✕ Hủy</button>`;
            document.getElementById('bda-g-undo').onclick = () => { for (let i = GE.parts.length - 1; i >= 0; i--) { if (GE.parts[i].length) { GE.parts[i].pop(); break; } } if (GE.parts.length > 1 && !GE.parts[GE.parts.length - 1].length) GE.parts.pop(); redraw(); };
            document.getElementById('bda-g-new').onclick = () => { GE.parts = [[]]; GE.canDrag = true; redraw(); };
            document.getElementById('bda-g-part').onclick = () => { if (GE.parts[GE.parts.length - 1].length) GE.parts.push([]); };
        }
        document.getElementById('bda-g-ok').onclick = () => finish(true);
        document.getElementById('bda-g-no').onclick = () => finish(false);
    }

    // ---------- Thao tác ----------
    const BDA = window.BDA = {};
    BDA.edit = function (id) {
        if (!guard()) return;
        const d = dataOf(id); if (!d) return;
        map.closePopup();
        openForm(Object.assign({ id: id }, d));
    };
    BDA.geom = function (id) {
        if (!guard()) return;
        const d = dataOf(id); if (!d) return;
        const kieu = d.hinh.type === 'Point' ? 'point' : 'line';
        geStart(kieu, d.hinh, (kieu === 'point' ? 'Sửa vị trí: ' : 'Vẽ lại tuyến: ') + d.ten, async g => {
            try { d.hinh = g; await save(id, d); toast('Đã lưu vị trí mới: ' + d.ten); KCHT.show(id); }
            catch (e) { toast('CHƯA LƯU: ' + e.message, 'err'); }
        });
    };
    BDA.del = async function (id) {
        if (!guard()) return;
        const d = dataOf(id); if (!d) return;
        if (!confirm(`Xóa "${d.ten}" khỏi bản đồ?\n\nCó thể khôi phục lại trong "🛠 Quản trị bản đồ" → "Đã xóa".`)) return;
        try { d.kieu = 'xoa'; map.closePopup(); await save(id, d); toast('Đã xóa: ' + d.ten); }
        catch (e) { toast('CHƯA XÓA: ' + e.message, 'err'); }
    };
    BDA.revert = async function (id) {
        if (!guard() || !ORIG[id]) return;
        if (!confirm('Bỏ mọi chỉnh sửa, đưa đối tượng về bản gốc trên GitHub?')) return;
        const o = ORIG[id].properties;
        try { map.closePopup(); await save(id, { lop: o.lop, kieu: 'goc', ten: o.ten, tt: [], props: {}, hinh: null }); toast('Đã khôi phục bản gốc: ' + o.ten); KCHT.show(id); }
        catch (e) { toast('CHƯA KHÔI PHỤC: ' + e.message, 'err'); }
    };
    BDA.restore = async function (id) {
        if (!guard()) return;
        const e = EDITS[id]; if (!e) return;
        try {
            // Khôi phục đúng nội dung lúc bị xóa (kể cả phần đã chỉnh sửa trước đó)
            await save(id, { lop: e.lop, kieu: ORIG[id] ? 'sua' : 'them', ten: e.ten, tt: e.tt, props: e.props, hinh: e.hinh });
            toast('Đã khôi phục: ' + e.ten); closeModal(); KCHT.show(id);
        } catch (x) { toast('CHƯA KHÔI PHỤC: ' + x.message, 'err'); }
    };
    BDA.history = async function (id) {
        if (!guard()) return;
        map.closePopup();
        modal('🕘 Lịch sử chỉnh sửa', '<div class="bda-msg info" id="bda-msg">Đang tải…</div>');
        try {
            const d = await post({ action: 'bando_history', ma: id });
            const K = { sua: 'Sửa', them: 'Thêm mới', xoa: 'Xóa', goc: 'Về bản gốc' };
            document.querySelector('#bda-modal .content').innerHTML = d.items.length ? `<table class="bda-tbl"><tr><th>Thời gian</th><th>Người</th><th>Thao tác</th><th>Tên sau khi sửa</th></tr>${d.items.map(r => {
                let ten = ''; try { ten = JSON.parse(r.sau).ten || ''; } catch (e) { }
                return `<tr><td>${esc(fmt(r.thoi_gian))}</td><td>${esc(r.ho_ten || r.nguoi)}</td><td>${esc(K[r.kieu] || r.kieu)}</td><td>${esc(ten)}</td></tr>`;
            }).join('')}</table><p class="bda-note">Bản đầy đủ (trước / sau) ở trang BanDo_LichSu trong Google Sheet.</p>` : '<p>Chưa có lịch sử.</p>';
        } catch (e) { msg('Lỗi: ' + e.message, 'err'); }
    };

    // Thêm đối tượng mới
    BDA.add = function (lop) {
        if (!guard()) return;
        if (lop === 'pctt_ngap' || lop === 'pctt_satlo') {
            if (typeof window.pcttAdminCreate !== 'function') { toast('Chưa nạp được chức năng điểm nguy hiểm PCTT (pctt_admin.js)', 'err'); return; }
            geStart('point', null, 'Thêm điểm ' + (lop === 'pctt_ngap' ? 'ngập nước' : 'sạt lở / nguy cơ khác'), g => {
                window.pcttAdminCreate(g.coordinates[1], g.coordinates[0], lop === 'pctt_ngap' ? 'Ngập nước' : 'Sạt lở');
            });
            return;
        }
        const def = LOP[lop];
        geStart(def.kieu, null, 'Thêm ' + def.ten.toLowerCase(), g => {
            const tt = def.mau.map(x => { const i = x.indexOf('='); return i > 0 ? [x.slice(0, i), x.slice(i + 1)] : [x, '']; });
            const props = {}; (PROPS[lop] || []).forEach(([k, , opts]) => { props[k] = opts[0][0]; });
            if (g.type === 'Point') tt.push(['Tọa độ (WGS-84)', g.coordinates[1].toFixed(6) + ', ' + g.coordinates[0].toFixed(6)]);
            openForm({ id: newId(lop), lop: lop, kieu: 'them', ten: '', tt: tt, props: props, hinh: g, chonLop: true, title: '＋ Thêm ' + def.ten.toLowerCase() });
        });
    };

    // ---------- Bảng quản trị ----------
    BDA.panel = function (tab) {
        if (!isAdmin()) return;
        tab = tab || 'them';
        const rows = Object.values(EDITS).filter(e => e.kieu !== 'goc').sort((a, b) => String(b.ngay_cap_nhat).localeCompare(String(a.ngay_cap_nhat)));
        const del = rows.filter(e => e.kieu === 'xoa'), act = rows.filter(e => e.kieu !== 'xoa');
        const K = { sua: 'Đã sửa', them: 'Thêm mới' };
        const tabs = `<div class="bda-tabs">
            <button data-tab="them" class="${tab === 'them' ? 'on' : ''}">＋ Thêm đối tượng</button>
            <button data-tab="sua" class="${tab === 'sua' ? 'on' : ''}">📝 Đã chỉnh sửa (${act.length})</button>
            <button data-tab="xoa" class="${tab === 'xoa' ? 'on' : ''}">🗑 Đã xóa (${del.length})</button>
            <button data-tab="tai" class="${tab === 'tai' ? 'on' : ''}">⬇ Tải dữ liệu</button></div>`;
        let body = '';
        if (tab === 'them') {
            body = `<p class="bda-note">Chọn loại đối tượng, rồi bấm lên bản đồ để đặt điểm hoặc vẽ đường (bấm từng điểm dọc tuyến), xong bấm <b>✔ Xong</b> và điền thông tin.</p>
            <div class="bda-sec">Phòng chống thiên tai</div>
            <div class="bda-grid"><button data-add="pctt_ngap">💧 Điểm ngập nước</button><button data-add="pctt_satlo">⛰️ Điểm sạt lở / nguy cơ khác</button></div>
            <div class="bda-sec">Đường</div>
            <div class="bda-grid">${['do_thi', 'do_thi_doan', 'ql_doan', 'dt_doan', 'tuyen_moi', 'khac_duong'].map(k => `<button data-add="${k}">${esc(LOP[k].ten)}</button>`).join('')}</div>
            <div class="bda-sec">Công trình, điểm</div>
            <div class="bda-grid">${['cau', 'ham', 'ke_hao', 'bao_hieu', 'coc_km', 'khac_diem'].map(k => `<button data-add="${k}">${esc(LOP[k].ten)}</button>`).join('')}</div>`;
        } else if (tab === 'sua' || tab === 'xoa') {
            const list = tab === 'sua' ? act : del;
            body = list.length ? `<table class="bda-tbl"><tr><th>Đối tượng</th><th>Loại</th><th>Thao tác</th><th>Cập nhật</th><th></th></tr>${list.map(e => `<tr>
                <td>${esc(e.ten)}</td><td>${esc((LOP[e.lop] || {}).ten || e.lop)}</td><td>${esc(K[e.kieu] || 'Đã xóa')}</td>
                <td>${esc(fmt(e.ngay_cap_nhat))}<br><small>${esc(e.ho_ten_nguoi_cap_nhat || e.nguoi_cap_nhat)}</small></td>
                <td>${tab === 'sua' ? `<a href="#" data-show="${esc(e.ma)}">Xem</a>` : `<a href="#" data-restore="${esc(e.ma)}">Khôi phục</a>`}</td></tr>`).join('')}</table>`
                : '<p class="bda-note">Chưa có.</p>';
        } else {
            body = `<p class="bda-note">Tải toàn bộ lớp KCHT <b>đã gộp các chỉnh sửa</b> thành file <code>KCHT_TTQLHT.geojson</code>. Có thể tải file này lên GitHub (ghi đè) để lưu cố định; các chỉnh sửa trong Google Sheet vẫn giữ và không bị áp trùng.</p>
                <button class="sc-btn blue" id="bda-dl">⬇ Tải KCHT_TTQLHT.geojson (đã gộp)</button>
                <button class="sc-btn" id="bda-dl-csv">⬇ Tải danh sách chỉnh sửa (CSV)</button>`;
        }
        modal('🛠 Quản trị bản đồ', tabs + body);
        const box = document.querySelector('#bda-modal .content');
        box.onclick = e => {
            const t = e.target.closest('[data-tab],[data-add],[data-show],[data-restore]'); if (!t) return;
            e.preventDefault();
            if (t.dataset.tab) BDA.panel(t.dataset.tab);
            else if (t.dataset.add) BDA.add(t.dataset.add);
            else if (t.dataset.show) { closeModal(); KCHT.show(t.dataset.show); }
            else if (t.dataset.restore) BDA.restore(t.dataset.restore);
        };
        const dl = document.getElementById('bda-dl');
        if (dl) dl.onclick = () => {
            const feats = Object.entries(KCHT.ITEMS).map(([id, it]) => {
                const f = clone(it.f); f.properties.id = id; delete f.properties._moi; return f;
            });
            download('KCHT_TTQLHT.geojson', JSON.stringify({ type: 'FeatureCollection', name: 'KCHT_TTQLHT', features: feats }), 'application/geo+json');
        };
        const dc = document.getElementById('bda-dl-csv');
        if (dc) dc.onclick = () => {
            const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
            const lines = [['Mã', 'Loại', 'Thao tác', 'Tên', 'Cập nhật', 'Người cập nhật'].map(q).join(',')]
                .concat(rows.map(e => [e.ma, (LOP[e.lop] || {}).ten || e.lop, e.kieu, e.ten, fmt(e.ngay_cap_nhat), e.ho_ten_nguoi_cap_nhat || e.nguoi_cap_nhat].map(q).join(',')));
            download('chinh_sua_ban_do.csv', '﻿' + lines.join('\r\n'), 'text/csv');
        };
    };
    function download(name, text, type) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: type }));
        a.download = name; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    // Nút "🛠 Quản trị bản đồ" chỉ hiện với quản trị viên
    const fab = document.createElement('button');
    fab.id = 'bda-fab'; fab.type = 'button'; fab.textContent = '🛠 Quản trị bản đồ';
    fab.onclick = () => BDA.panel('them');
    document.body.appendChild(fab);
    L.DomEvent.disableClickPropagation(fab);
    function syncFab() { fab.style.display = isAdmin() ? '' : 'none'; }
    syncFab(); setInterval(syncFab, 2000);
    window.addEventListener('storage', e => { if (e.key === 'sc_session') syncFab(); });

    // ---------- CSS ----------
    const css = document.createElement('style');
    css.textContent = `
        #bda-fab { position: fixed; left: 10px; bottom: 28px; z-index: 1000; background: #263238; color: #fff; border: none; border-radius: 6px;
            padding: 9px 12px; font: bold 13px sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; }
        .bda-btns { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .bda-btns button { flex: 1 1 45%; background: #1565c0; color: #fff; border: none; border-radius: 4px; padding: 6px 4px; font-size: 12px; font-weight: bold; cursor: pointer; }
        .bda-btns button.red { background: #c62828; }
        .bda-edited { margin-top: 6px; font-size: 11px; color: #e65100; }
        .bda-modal { max-width: 640px !important; width: 94vw !important; }
        #bda-modal .content { max-height: 72vh; overflow: auto; }
        .bda-f { display: block; margin: 6px 0; font-size: 12px; }
        .bda-f span { display: block; font-weight: bold; color: #444; margin-bottom: 2px; }
        .bda-f input, .bda-f select { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #bbb; border-radius: 4px; font: 13px sans-serif; }
        .bda-sec { margin: 10px 0 4px; padding: 3px 6px; background: #e3f2fd; color: #0d47a1; font-weight: bold; font-size: 12px; border-radius: 3px; }
        .bda-sec small { font-weight: normal; color: #555; }
        .bda-row { display: flex; gap: 4px; margin: 3px 0; align-items: flex-start; }
        .bda-row .bda-k { flex: 0 0 38%; padding: 5px; border: 1px solid #bbb; border-radius: 4px; font: bold 12px sans-serif; color: #444; box-sizing: border-box; }
        .bda-row .bda-v { flex: 1; padding: 5px; border: 1px solid #bbb; border-radius: 4px; font: 12px sans-serif; resize: vertical; min-height: 28px; box-sizing: border-box; }
        .bda-row .bda-delrow { border: none; background: #eee; border-radius: 4px; cursor: pointer; padding: 5px 8px; color: #c62828; }
        .bda-addrow { margin-top: 6px; background: #e8f5e9; border: 1px dashed #2e7d32; color: #2e7d32; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-weight: bold; }
        .bda-note { font-size: 12px; color: #555; margin: 4px 0; }
        .bda-msg { font-size: 13px; margin-top: 6px; } .bda-msg.err { color: #c62828; } .bda-msg.info { color: #1565c0; }
        .bda-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .bda-tabs button { flex: 1; border: 1px solid #90a4ae; background: #fff; border-radius: 4px; padding: 6px; cursor: pointer; font-size: 12px; }
        .bda-tabs button.on { background: #263238; color: #fff; }
        .bda-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
        .bda-grid button { padding: 9px 6px; border: 1px solid #1565c0; background: #fff; color: #0d47a1; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold; }
        .bda-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bda-tbl th, .bda-tbl td { border-bottom: 1px solid #eee; padding: 4px; text-align: left; vertical-align: top; }
        .bda-bar { position: fixed; left: 50%; top: 10px; transform: translateX(-50%); z-index: 2000; background: #fffde7; border: 2px solid #f9a825;
            border-radius: 8px; padding: 8px 10px; box-shadow: 0 2px 8px rgba(0,0,0,.3); font: 13px sans-serif; max-width: 94vw;
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .bda-bar span { flex: 1 1 100%; color: #444; font-size: 12px; }
        .bda-bar button { border: 1px solid #888; background: #fff; border-radius: 4px; padding: 6px 9px; cursor: pointer; font-size: 12px; }
        .bda-bar button.ok { background: #2e7d32; color: #fff; border-color: #2e7d32; font-weight: bold; }
        .bda-pt div { width: 18px; height: 18px; border-radius: 50%; background: #ff1744; border: 3px solid #fff; box-shadow: 0 0 4px #000; }
        .bda-v div { width: 10px; height: 10px; background: #fff; border: 2px solid #ff1744; border-radius: 2px; }
        .bda-editing { cursor: crosshair !important; }
        .bda-editing .leaflet-map-pane > .leaflet-pane:not(.leaflet-bdaEdit-pane) *,
        .bda-editing .leaflet-map-pane > .leaflet-pane:not(.leaflet-bdaEdit-pane) { pointer-events: none !important; }
        .bda-editing .leaflet-bdaEdit-pane .leaflet-marker-icon { pointer-events: auto !important; cursor: move; }`;
    document.head.appendChild(css);

    // ---------- Khởi động ----------
    if (window.KCHT && window.KCHT.ready) load();
    else document.addEventListener('kcht-ready', load, { once: true });
})();
