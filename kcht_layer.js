// PHIÊN BẢN 18/11/2026 (2) – chọn nhiều tuyến cùng lúc (nút "☑ Chọn nhiều tuyến", link ?nhieu=A|B)
// (18/11/2026) – mã định danh đối tượng + giao diện chỉnh sửa cho quản trị viên (ban_do_admin.js)
// (17/11/2026 (4)) – tuyến được chọn nằm trên ranh giới phường, bấm lại vẫn hiện thông tin
// (17/11/2026 (3)) – bảng thông tin gọn; chọn tuyến thì phóng tới và tự mở bảng thông tin
// (17/11/2026 (2): bấm đường QL/ĐT màu đen hiện bảng thông tin đoạn theo danh mục)
// (17/11/2026: dữ liệu theo Danh mục chuẩn hóa v11; thêm lớp phao báo hiệu ĐTNĐ)
// (12/11/2026: ẩn QL/ĐT màu đen (DT.geojson), chỉ hiện tuyến được chọn)
// =====================================================================
// LỚP KCHT TTQLHT (bổ sung 11/2026)
// Dữ liệu: KCHT_TTQLHT.geojson – chuyển từ KMZ "KCHT_GT_TTQLHT_tong_hop_ra_soat_ban_do"
// (Danh mục chuẩn hóa KCHTGT TTQLHT v11 – 17/11/2026; KMZ Bão Lũ 03.09; OpenStreetMap 10/11/2026)
// Gồm: đường đô thị theo tên, đoạn QL/ĐT theo danh mục, ĐT.601/ĐT.602, cọc Km,
//      cầu, cầu trên OSM chưa có trong danh mục, hầm, kè/hào (vị trí tham chiếu).
// Tham số URL: ?duong=Tên đường  (VD: ?duong=Lê Thanh Nghị)
// Yêu cầu: chạy sau script chính của index.html (dùng biến map, layerControl).
// =====================================================================
(function () {
    if (typeof map === 'undefined' || typeof layerControl === 'undefined') return;

    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // (11/2026) Khi mở trang KHÔNG tự hiện các điểm PCTT (ngập, sạt lở, tuyến tránh, điểm tập kết).
    // Muốn xem: bấm "Chọn loại bản đồ" và tích lớp cần xem, hoặc bấm một điểm trong bảng PCTT.
    // Nếu đường link có ?tuyen= / ?loai= / ?ma= (chia sẻ, mã QR) thì vẫn hiện như cũ.
    // Thu gọn bảng "Điểm nguy hiểm mùa mưa bão" khi mở trang (bấm vào tiêu đề để mở ra)
    try {
        const pp = document.getElementById('pctt-panel');
        if (pp && !pp.classList.contains('collapsed') && !new URLSearchParams(location.search).get('tuyen')) {
            pp.classList.add('collapsed');
            const tg = document.getElementById('pctt-toggle'); if (tg) tg.textContent = '▸';
        }
    } catch (e) { }

    try {
        const q0 = new URLSearchParams(location.search);
        if (typeof pcttGroups !== 'undefined' && !q0.get('tuyen') && !q0.get('loai') && !q0.get('ma')) {
            ['ngap', 'satlo', 'tranh', 'tapket'].forEach(k => { if (pcttGroups[k] && map.hasLayer(pcttGroups[k])) map.removeLayer(pcttGroups[k]); });
            // Chọn tuyến trong bảng PCTT thì tự bật lại các lớp điểm nguy hiểm
            const sel = document.getElementById('pctt-tuyen');
            if (sel) sel.addEventListener('change', function () {
                if (this.value) ['ngap', 'satlo', 'tranh', 'tapket'].forEach(k => map.addLayer(pcttGroups[k]));
            });
        }
    } catch (e) { }

    map.createPane('kchtLines'); map.getPane('kchtLines').style.zIndex = 410;
    map.createPane('kchtPoints'); map.getPane('kchtPoints').style.zIndex = 440;

    // Nhóm lớp: [khóa, nhãn trong bảng chọn lớp, bật sẵn?]
    const GROUPS = [
        ['ql_doan', '<span style="color:#e60000">━</span> Quốc lộ – đoạn theo danh mục', false],
        ['dt_doan', '<span style="color:#0050e6">━</span> Đường tỉnh – đoạn theo danh mục', false],
        ['do_thi_doan', '<span style="color:#00b8d4">┅</span> Đường đô thị – đoạn cắt theo điểm đầu/cuối', false],
        ['coc_km', '<span>◦</span> Cọc Km tính toán (QL/ĐT)', false],
        ['cau', '<span style="color:#6a1b9a">▲</span> Cầu (QL, ĐT, nội thị)', false],
        ['cau_osm', '<span style="color:#9e9e9e">■</span> Cầu trên QL/ĐT chưa có trong danh mục (OSM)', false],
        ['ham', '<span style="color:#0d47a1">▼</span> Hầm đường bộ', false],
        ['ke_hao', '<span style="color:#795548">ⓘ</span> Kè, hào kỹ thuật, sàn (vị trí tham chiếu)', false],
        ['bao_hieu', '<span style="color:#00838f">●</span> Phao báo hiệu đường thủy nội địa', false],
        ['khac', '<span style="color:#455a64">◆</span> Đối tượng khác (quản trị viên bổ sung)', true]
    ];
    const groups = {};
    GROUPS.forEach(g => { groups[g[0]] = L.layerGroup(); });
    // Đường đô thị và ĐT.601/602: KHÔNG có ô bật cả lớp; chỉ hiện đúng tuyến được chọn ở ô "Chọn tên đường"
    const chosen = L.layerGroup().addTo(map);

    const DT_COLOR = { ok: '#00a000', dai: '#ff8c00', ngan: '#e53935' };
    function lineStyle(p) {
        switch (p.lop) {
            case 'do_thi': return { color: DT_COLOR[p.st] || '#00a000', weight: 4, opacity: 0.9 };
            case 'tuyen_moi': return { color: '#000000', weight: 4, opacity: 1 };
            case 'ql_doan': return { color: p.hc ? '#e60000' : '#ff8c00', weight: 5, opacity: 0.85 };
            case 'dt_doan': return { color: p.hc ? '#0050e6' : '#b400b4', weight: 5, opacity: 0.85 };
            case 'do_thi_doan': return { color: '#00b8d4', weight: 3, opacity: 0.9, dashArray: '6 5' };
            case 'khac_duong': return { color: '#455a64', weight: 4, opacity: 0.9 };
        }
        return { color: '#333', weight: 3 };
    }

    // (17/11/2026) Bảng thông tin gọn: khung rộng cố định, cuộn khi dài; trường chính ở trên, còn lại thu vào "Thông tin khác"
    (function addCss() {
        const st = document.createElement('style');
        st.textContent = `
        .leaflet-popup-content .kcht-popup { display:block; width:340px; max-width:78vw; }
        .kcht-popup h4 { white-space:normal !important; font-size:14px; line-height:1.3; margin:0 0 6px !important; padding-right:14px; }
        .kcht-popup .kcht-sub { margin:0 0 6px; color:#555; font-size:11px; }
        .kcht-popup .kcht-body { max-height:52vh; overflow-y:auto; }
        .kcht-popup table { width:100%; table-layout:fixed; border-collapse:collapse; }
        .kcht-popup td { font-size:12px !important; padding:4px 4px !important; vertical-align:top; border-bottom:1px solid #eee; word-wrap:break-word; }
        .kcht-popup td:first-child { width:42%; color:#555; font-weight:600; }
        .kcht-popup details { margin-top:6px; }
        .kcht-popup summary { cursor:pointer; color:#0b57d0; font-size:12px; padding:3px 0; }
        .kcht-popup .kcht-note { font-size:11px; color:#666; margin-top:6px; }`;
        document.head.appendChild(st);
    })();
    const MAIN_KEYS = ['Tuyến', 'Tên tuyến', 'Tên tuyến (danh mục)', 'Tên đường', 'Tên cầu', 'Tên hầm', 'Tên', 'Loại', 'Nhóm',
        'Lý trình đầu', 'Lý trình cuối', 'Lý trình/điểm đầu', 'Lý trình/điểm cuối', 'Từ Km', 'Đến Km', 'Từ Km / Điểm đầu', 'Đến Km / Điểm cuối',
        'Điểm đầu', 'Điểm cuối', 'Lý trình tim cầu',
        'Chiều dài quản lý (km)', 'Chiều dài đang quản lý, bảo trì (km)', 'Chiều dài (km)', 'Chiều dài DM (km)', 'Tổng chiều dài danh mục (km)', 'Số đoạn trong danh mục',
        'Chiều dài toàn cầu (m)', 'Chiều dài cầu (m)', 'Chiều dài (m)', 'Quy mô', 'Diện tích',
        'Bề rộng mặt (m)', 'Bề rộng mặt đường (m)', 'Số làn', 'Số làn xe', 'Kết cấu mặt', 'Kết cấu mặt đường', 'Cấp đường', 'Cấp', 'Tải trọng TK', 'Tải trọng thiết kế',
        'Năm đưa vào SD', 'Nhóm đường (DT 2027-2029)', 'Trạng thái', 'Đơn vị bảo trì', 'Phường', 'Phường (danh mục)', 'Phường/xã (theo ranh giới)', 'Phường/xã đi qua (theo ranh giới)', 'Phường/xã',
        'Tình trạng', 'Tình trạng định vị', 'Vị trí'];
    const HIDE_KEYS = /^(Cập nhật danh mục v11|— Thông tin danh mục v11|Cơ quan chủ quản|Mã đối tượng|Nguồn danh mục|Nguồn dữ liệu|Nguồn)/;
    function popupHtml(p, latlng, sub, keepOrder) {
        const tt = (p.tt || []).filter(r => r[1] !== '' && r[1] != null && !HIDE_KEYS.test(r[0]));
        const seen = new Set(), main = [], other = [];
        MAIN_KEYS.forEach(k => { const r = tt.find(x => x[0] === k); if (r && !seen.has(k)) { seen.add(k); main.push(r); } });
        tt.forEach(r => { if (!seen.has(r[0])) { seen.add(r[0]); other.push(r); } });
        if (keepOrder) { main.length = 0; other.length = 0; main.push(...tt); }
        else if (main.length < 4) { main.push(...other.splice(0, 8 - main.length)); }
        const tr = r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`;
        const gmap = latlng ? `<tr><td>Bản đồ</td><td><a href="https://www.google.com/maps?q=${latlng.lat},${latlng.lng}" target="_blank" rel="noopener">Mở Google Maps</a></td></tr>` : '';
        const more = other.length ? `<details><summary>Thông tin khác (${other.length})</summary><table>${other.map(tr).join('')}</table></details>` : '';
        return `<div class="info-popup kcht-popup"><h4>${esc(p.ten)}</h4>${sub ? `<p class="kcht-sub">${esc(sub)}</p>` : ''}<div class="kcht-body"><table>${main.map(tr).join('')}${gmap}</table>${more}</div></div>`;
    }

    const ITEMS = {};          // (18/11/2026) mã đối tượng -> { f, layer } (để quản trị viên sửa/xóa)
    function fid(f) {
        const p = f.properties;
        if (p.id) return String(p.id);
        let c = f.geometry.coordinates; while (Array.isArray(c[0])) c = c[0];
        const s = p.lop + '|' + p.ten + '|' + (+c[0]).toFixed(5) + ',' + (+c[1]).toFixed(5);
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        let id = p.lop + '-' + (h >>> 0).toString(36), k = 2;
        while (ITEMS[id]) id = p.lop + '-' + (h >>> 0).toString(36) + '-' + (k++);
        return id;
    }
    // Nút quản trị (do ban_do_admin.js cung cấp) gắn vào cuối bảng thông tin
    function withBtns(html, id) {
        const b = (typeof window.KCHT_ADMIN_BTNS === 'function' && id) ? window.KCHT_ADMIN_BTNS(id) : '';
        return b ? html.replace(/<\/div>\s*$/, b + '</div>') : html;
    }
    const roadIndex = {};      // tên đường -> layer (để chọn từ danh sách)
    const segByRoute = {};     // tên tuyến QL/ĐT -> các đoạn theo danh mục (có bảng thông tin)
    let kchtHighlighted = null;

    function buildLayer(f) {
        const p = f.properties, g = f.geometry;
        if (!g) return null;
        let layer;
        if (g.type === 'Point') {
            const ll = L.latLng(g.coordinates[1], g.coordinates[0]);
            if (p.lop === 'coc_km') {
                layer = L.marker(ll, {
                    pane: 'kchtPoints', interactive: false,
                    icon: L.divIcon({ className: 'kcht-km', html: `<div>${esc(p.ten)}</div>`, iconSize: [0, 0] })
                });
                return layer;
            }
            if (p.lop === 'cau') {
                const col = p.nhom === 'ql' ? '#c62828' : (p.nhom === 'dt' ? '#1565c0' : '#6a1b9a');
                layer = L.marker(ll, {
                    pane: 'kchtPoints',
                    icon: L.divIcon({ className: 'kcht-cau', html: `<span style="color:${col}">▲</span>`, iconSize: [16, 16], iconAnchor: [8, 10] })
                });
            } else if (p.lop === 'cau_osm') {
                layer = L.circleMarker(ll, { pane: 'kchtPoints', radius: 4, fillColor: '#9e9e9e', fillOpacity: 1, color: '#fff', weight: 1 });
            } else if (p.lop === 'ham') {
                layer = L.marker(ll, {
                    pane: 'kchtPoints',
                    icon: L.divIcon({ className: 'kcht-cau', html: '<span style="color:#0d47a1">▼</span>', iconSize: [16, 16], iconAnchor: [8, 8] })
                });
            } else if (p.lop === 'khac_diem') {
                layer = L.marker(ll, {
                    pane: 'kchtPoints',
                    icon: L.divIcon({ className: 'kcht-cau', html: '<span style="color:#455a64">◆</span>', iconSize: [16, 16], iconAnchor: [8, 8] })
                });
            } else if (p.lop === 'bao_hieu') {
                layer = L.circleMarker(ll, { pane: 'kchtPoints', radius: 6, fillColor: '#00838f', fillOpacity: 1, color: '#fff', weight: 2 });
            } else {
                layer = L.circleMarker(ll, { pane: 'kchtPoints', radius: 6, fillColor: '#795548', fillOpacity: 0.9, color: '#fff', weight: 2 });
            }
            layer.bindPopup(() => withBtns(popupHtml(p, ll), layer._kchtId), { maxWidth: 380 });
            layer.bindTooltip(p.ten, { direction: 'top' });
            layer._kchtProps = p;
            return layer;
        }
        layer = L.geoJSON(f, { pane: 'kchtLines', style: () => lineStyle(p) });
        layer.bindPopup(() => withBtns(popupHtml(p, null), layer._kchtId), { maxWidth: 380 });
        layer.bindTooltip(p.ten, { sticky: true });
        layer.on({
            mouseover: e => { if (layer !== kchtHighlighted) layer.setStyle({ weight: 7, color: '#FF0000' }); },
            mouseout: e => { if (layer !== kchtHighlighted) layer.setStyle(layer._multiStyle || lineStyle(p)); }
        });
        layer._kchtProps = p;
        if (p.lop === 'do_thi' || p.lop === 'tuyen_moi') roadIndex[p.ten] = layer;
        if (p.lop === 'ql_doan' || p.lop === 'dt_doan') (segByRoute[p.tuyen] = segByRoute[p.tuyen] || []).push(layer);
        return layer;
    }

    // Cọc Km chỉ hiện khi phóng to (>= 13) và lớp đang bật
    const cocAll = L.layerGroup();
    function updateCoc() {
        const on = map.hasLayer(groups.coc_km);
        if (on && map.getZoom() >= 13) { if (!groups.coc_km.hasLayer(cocAll)) groups.coc_km.addLayer(cocAll); }
        else groups.coc_km.clearLayers();
    }
    map.on('zoomend overlayadd overlayremove', updateCoc);

    function clearChosen() {
        if (kchtHighlighted) kchtHighlighted.setStyle(kchtHighlighted._multiStyle || lineStyle(kchtHighlighted._kchtProps));
        kchtHighlighted = null;
        chosen.clearLayers();
    }
    function focusRoad(name) {
        const layer = roadIndex[name];
        if (!layer) return false;
        clearChosen();
        chosen.addLayer(layer);
        kchtHighlighted = layer;
        layer.setStyle({ color: '#FFD800', weight: 8, opacity: 1 });
        layer.bringToFront();
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        let lls = []; layer.eachLayer(pl => { let x = pl.getLatLngs(); while (x.length && Array.isArray(x[0])) x = [].concat(...x); lls.push(...x); });
        const c = layer.getBounds().getCenter(); let at = lls[0] || c;
        lls.forEach(q => { if (q.distanceTo(c) < at.distanceTo(c)) at = q; });
        setTimeout(() => layer.openPopup(at), 350);
        return true;
    }

    // (11/2026) Ẩn các tuyến QL/ĐT màu đen của DT.geojson khi mở trang.
    // Chọn tên tuyến ở ô "Chọn tên đường" thì chỉ hiện tuyến đó; muốn xem tất cả: tích lớp
    // "Quốc lộ, đường tỉnh – toàn bộ (nền cũ)" trong "Chọn loại bản đồ".
    const dtChosen = L.layerGroup().addTo(map);
    (function hideDt(n) {
        if (typeof dtLayer !== 'undefined' && dtLayer && dtLayer.getLayers().length) {
            if (map.hasLayer(dtLayer)) map.removeLayer(dtLayer);
            layerControl.addOverlay(dtLayer, '<span style="color:#000">━</span> Quốc lộ, đường tỉnh – toàn bộ (nền cũ)');
            return;
        }
        if (n < 240) setTimeout(() => hideDt(n + 1), 250);
    })(0);

    // Mở rộng hàm chọn đường sẵn có: tên thuộc lớp KCHT thì xử lý tại đây
    const originalZoomToRoad = window.zoomToRoad;
    window.zoomToRoad = function (roadName) {
        if (roadName && roadIndex[roadName]) { dtChosen.clearLayers(); focusRoad(roadName); return; }
        clearChosen();
        // Tuyến QL/ĐT gốc (DT.geojson, màu đen): chỉ hiện đúng tuyến được chọn, tô vàng, mở bảng tóm tắt
        // (17/11/2026) Vẽ BẢN SAO tuyến được chọn ở lớp kchtLines (nằm trên ranh giới phường/xã),
        // để rê chuột qua phường không che mất tuyến; bấm vào tuyến luôn hiện thông tin đoạn.
        dtChosen.clearLayers(); segHighlight.clearLayers();
        const picked = [];
        if (roadName && typeof dtLayer !== 'undefined' && dtLayer) {
            dtLayer.eachLayer(l => {
                if (!(l.feature && l.feature.properties.name === roadName)) return;
                const copy = L.geoJSON(l.feature, { pane: 'kchtLines', style: () => ({ color: '#FFD800', weight: 8, opacity: 1 }) });
                copy.on('click', e => dtClick(e, roadName));
                copy.bindTooltip(roadName, { sticky: true });
                dtChosen.addLayer(copy); picked.push(copy);
            });
        }
        if (!picked.length) { if (typeof originalZoomToRoad === 'function') originalZoomToRoad(roadName); return; }
        let bounds = null;
        picked.forEach(l => { bounds = bounds ? bounds.extend(l.getBounds()) : L.latLngBounds(l.getBounds().getSouthWest(), l.getBounds().getNorthEast()); });
        map.fitBounds(bounds, { padding: [50, 50] });
        // điểm trên tuyến gần tâm khung nhìn để đặt bảng thông tin
        let lls = []; picked[0].eachLayer(pl => { let x = pl.getLatLngs(); while (x.length && Array.isArray(x[0])) x = [].concat(...x); lls.push(...x); });
        const c = bounds.getCenter(); let at = lls[0];
        lls.forEach(q => { if (q.distanceTo(c) < at.distanceTo(c)) at = q; });
        setTimeout(() => L.popup({ maxWidth: 380 }).setLatLng(at).setContent(routeSummary(roadName)).openOn(map), 350);
    };
    function routeSummary(name) {
        const route = dtRouteName(name), segs = (route && segByRoute[route]) || [];
        if (!segs.length) return `<div class="info-popup kcht-popup"><h4>${esc(name)}</h4><p class="kcht-note">Tuyến này chưa có đoạn nào trong danh mục TTQLHT quản lý.</p></div>`;
        const get = (p, ks) => { for (const k of ks) { const r = (p.tt || []).find(x => x[0] === k); if (r && r[1] !== '' && r[1] != null) return r[1]; } return ''; };
        const km = t => { const m = String(t).replace(/\s/g, '').match(/Km(\d+)(?:\+(\d+(?:[.,]\d+)?))?/i); return m ? (+m[1]) * 1000 + (m[2] ? parseFloat(m[2].replace(',', '.')) : 0) : null; };
        let tot = 0, lo = null, hi = null; const cap = new Set(), kc = new Set(), dv = new Set(), px = new Set();
        segs.forEach(g => {
            const p = g._kchtProps;
            const L1 = parseFloat(get(p, ['Chiều dài đang quản lý, bảo trì (km)', 'Chiều dài quản lý (km)', 'Chiều dài (km)'])); if (!isNaN(L1)) tot += L1;
            const a = km(get(p, ['Từ Km', 'Lý trình đầu', 'Từ Km / Điểm đầu', 'Lý trình/điểm đầu'])), b = km(get(p, ['Đến Km', 'Lý trình cuối', 'Đến Km / Điểm cuối', 'Lý trình/điểm cuối']));
            [a, b].forEach(v => { if (v != null) { lo = lo == null ? v : Math.min(lo, v); hi = hi == null ? v : Math.max(hi, v); } });
            const c1 = get(p, ['Cấp đường']); if (c1) cap.add(c1);
            const k1 = get(p, ['Kết cấu mặt đường', 'Kết cấu mặt']); if (k1) kc.add(k1);
            const d1 = get(p, ['Đơn vị bảo trì']); if (d1) dv.add(d1);
            String(get(p, ['Phường/xã (theo ranh giới)'])).split(',').forEach(w => { w = w.trim(); if (w) px.add(w); });
        });
        const f = v => 'Km' + Math.floor(v / 1000) + '+' + String(Math.round(v % 1000)).padStart(3, '0');
        const rows = [['Số đoạn TTQLHT quản lý', segs.length], ['Tổng chiều dài theo danh mục (km)', tot.toFixed(3)],
            ['Phạm vi lý trình', lo != null ? f(lo) + ' → ' + f(hi) : ''], ['Cấp đường', [...cap].join(', ')], ['Kết cấu mặt', [...kc].join(', ')],
            ['Đơn vị bảo trì', [...dv].join('; ')], ['Phường/xã đi qua', [...px].join(', ')]].filter(r => r[1] !== '');
        return popupHtml({ ten: route + ' – toàn tuyến', tt: rows }, null, 'Bấm vào vị trí bất kỳ trên đường vàng để xem thông tin đoạn tại đó', true);
    }

    // (17/11/2026) Bấm vào đường QL/ĐT màu đen (DT.geojson) trước đây chỉ hiện tên tuyến.
    // Nay: tìm đoạn theo danh mục TTQLHT tại vị trí bấm và hiện đủ bảng thông tin của đoạn đó.
    function dtRouteName(n) {
        n = String(n || '').trim();
        let m = n.match(/thành\s*[DĐ]T\.?\s*(\d+[A-Z]?)/i);
        if (m) return 'ĐT.' + m[1].toUpperCase();
        m = n.match(/^Qu[ốo]c L[ộo]\s*(\d+[A-Z]?)/i) || n.match(/QL\.?\s*(\d+[A-Z]?)/i);
        if (m) return 'Quốc lộ ' + m[1].toUpperCase();
        m = n.match(/^[DĐ]T\.?\s*(\d+[A-Z]?)/i);
        if (m) return 'ĐT.' + m[1].toUpperCase();
        if (/tiên kỳ/i.test(n)) return 'Tuyến tránh TT Tiên Kỳ';
        return null;
    }
    const segHighlight = L.layerGroup().addTo(map);
    map.on('popupclose', () => segHighlight.clearLayers());
    function nearestSeg(latlng, route) {
        const pools = route && segByRoute[route] ? [segByRoute[route]] : Object.values(segByRoute);
        const P = map.latLngToLayerPoint(latlng);
        let best = null;
        pools.forEach(list => list.forEach(g => g.eachLayer(pl => {
            let lls = pl.getLatLngs(); if (lls.length && Array.isArray(lls[0])) lls = [].concat(...lls);
            for (let i = 0; i < lls.length - 1; i++) {
                const d = L.LineUtil.pointToSegmentDistance(P, map.latLngToLayerPoint(lls[i]), map.latLngToLayerPoint(lls[i + 1]));
                if (!best || d < best.d) best = { d, g, pl };
            }
        })));
        return best;
    }
    function dtClick(e, name) {
        L.DomEvent.stopPropagation(e);
        const route = dtRouteName(name);
        let b = nearestSeg(e.latlng, route);
        if (route && (!b || b.d > 40)) b = nearestSeg(e.latlng, null);
        let html;
        if (b && b.d <= 40) {
            const p = b.g._kchtProps;
            html = withBtns(popupHtml(p, e.latlng, 'Đoạn theo danh mục TTQLHT tại vị trí bấm'), b.g._kchtId);
            segHighlight.clearLayers();
            L.polyline(b.pl.getLatLngs(), { pane: 'kchtLines', color: '#FFD800', weight: 9, opacity: 0.9, interactive: false }).addTo(segHighlight);
        } else {
            html = `<div class="info-popup kcht-popup"><h4>${esc(name)}</h4><p>Vị trí này chưa có đoạn nào trong danh mục TTQLHT quản lý.</p></div>`;
        }
        L.popup({ maxWidth: 380 }).setLatLng(e.latlng).setContent(html).openOn(map);
    }
    function attachDtPopups(n) {
        if (typeof dtLayer === 'undefined' || !dtLayer || !dtLayer.getLayers().length) {
            if (n < 240) setTimeout(() => attachDtPopups(n + 1), 250);
            return;
        }
        dtLayer.eachLayer(l => {
            const nm = l.feature && l.feature.properties && l.feature.properties.name;
            l.unbindPopup();
            l.off('click');
            l.on('click', e => dtClick(e, nm));
        });
    }

    // ---------- (18/11/2026) Thêm / sửa / xóa đối tượng (dùng cho ban_do_admin.js) ----------
    let roadOptGroup = null;
    function placeItem(f, id) {
        const layer = buildLayer(f);
        if (!layer) return null;
        layer._kchtId = id;
        const lop = f.properties.lop, gk = (lop === 'khac_diem' || lop === 'khac_duong') ? 'khac' : lop;
        if (lop === 'coc_km') cocAll.addLayer(layer);
        else if (groups[gk]) groups[gk].addLayer(layer);
        // do_thi, tuyen_moi: chỉ lưu vào roadIndex, hiện khi được chọn
        ITEMS[id] = { f: f, layer: layer };
        return ITEMS[id];
    }
    function addRoadOption(name) {
        const sel = document.getElementById('road-select');
        if (!sel || !roadOptGroup || [...sel.options].some(o => o.value === name)) return;
        const o = document.createElement('option'); o.value = name; o.textContent = name; roadOptGroup.appendChild(o);
    }
    function removeItem(id) {
        const it = ITEMS[id]; if (!it) return null;
        const layer = it.layer, p = it.f.properties;
        [cocAll, chosen, dtChosen, segHighlight].concat(Object.values(groups)).forEach(g => { if (g.hasLayer(layer)) g.removeLayer(layer); });
        if (map.hasLayer(layer)) map.removeLayer(layer);
        if (roadIndex[p.ten] === layer) delete roadIndex[p.ten];
        if (segByRoute[p.tuyen]) segByRoute[p.tuyen] = segByRoute[p.tuyen].filter(l => l !== layer);
        if (kchtHighlighted === layer) kchtHighlighted = null;
        delete ITEMS[id];
        return it;
    }
    function addItem(f, id) {
        id = id || fid(f);
        if (ITEMS[id]) removeItem(id);
        const it = placeItem(f, id);
        if (it && (f.properties.lop === 'do_thi' || f.properties.lop === 'tuyen_moi')) addRoadOption(f.properties.ten);
        return it;
    }
    function showItem(id, open) {
        const it = ITEMS[id]; if (!it) return;
        const p = it.f.properties, layer = it.layer;
        if (p.lop === 'do_thi' || p.lop === 'tuyen_moi') { focusRoad(p.ten); return; }
        const g = p.lop === 'coc_km' ? groups.coc_km : groups[(p.lop === 'khac_diem' || p.lop === 'khac_duong') ? 'khac' : p.lop];
        if (g && !map.hasLayer(g)) map.addLayer(g);
        if (layer.getLatLng) map.setView(layer.getLatLng(), Math.max(map.getZoom(), 16));
        else map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        if (open !== false) setTimeout(() => layer.openPopup(), 350);
    }
    // ---------- (18/11/2026) Chọn nhiều tuyến cùng lúc ----------
    const multi = L.layerGroup().addTo(map);
    const MCOL = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#00a3a3', '#f032e6', '#9a6324', '#800000', '#000075', '#808000', '#ff6f00', '#1b5e20', '#ad1457', '#283593'];
    let multiNames = [];
    const multiStyled = [];
    function clearMulti() {
        multiStyled.forEach(l => { delete l._multiStyle; if (l !== kchtHighlighted) l.setStyle(lineStyle(l._kchtProps)); });
        multiStyled.length = 0; multi.clearLayers();
    }
    function showMulti(names, fit) {
        clearMulti(); multiNames = names.slice();
        let bounds = null;
        const ext = b => { bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast()); };
        names.forEach((n, i) => {
            const col = MCOL[i % MCOL.length], st = { color: col, weight: 7, opacity: 1 };
            if (roadIndex[n]) {
                const l = roadIndex[n]; l._multiStyle = st; l.setStyle(st); multi.addLayer(l); multiStyled.push(l); ext(l.getBounds());
            } else if (typeof dtLayer !== 'undefined' && dtLayer) {
                dtLayer.eachLayer(l => {
                    if (!(l.feature && l.feature.properties.name === n)) return;
                    const c = L.geoJSON(l.feature, { pane: 'kchtLines', style: () => st });
                    c.on('click', e => dtClick(e, n)); c.bindTooltip(n, { sticky: true });
                    multi.addLayer(c); ext(c.getBounds());
                });
            }
        });
        if (fit !== false && bounds) map.fitBounds(bounds, { padding: [40, 40] });
        renderMultiLegend();
    }
    function multiLink() {
        return location.origin + location.pathname + '?nhieu=' + encodeURIComponent(multiNames.join('|'));
    }
    function renderMultiLegend() {
        let box = document.getElementById('multi-legend');
        if (!multiNames.length) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div'); box.id = 'multi-legend';
            document.body.appendChild(box);
            L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box);
            box.addEventListener('click', e => {
                const t = e.target.closest('[data-act]'); if (!t) return;
                const n = t.dataset.name, act = t.dataset.act;
                if (act === 'go') { window.zoomToRoad(n); }
                else if (act === 'del') { showMulti(multiNames.filter(x => x !== n), false); }
                else if (act === 'all') { showMulti(multiNames); }
                else if (act === 'clear') { multiNames = []; clearMulti(); renderMultiLegend(); }
                else if (act === 'edit') { openMultiPicker(); }
                else if (act === 'link') {
                    const u = multiLink();
                    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => t.textContent = '✔ Đã chép link', () => prompt('Chép đường link:', u));
                }
            });
        }
        box.innerHTML = `<div class="ml-head"><b>Đang hiện ${multiNames.length} tuyến</b><a href="#" data-act="clear" title="Tắt hết">✕</a></div>
            <div class="ml-list">${multiNames.map((n, i) => `<div class="ml-item"><span class="ml-sw" style="background:${MCOL[i % MCOL.length]}"></span>
                <a href="#" data-act="go" data-name="${esc(n)}" title="Phóng tới và xem thông tin">${esc(n)}</a><a href="#" class="ml-x" data-act="del" data-name="${esc(n)}" title="Bỏ tuyến này">✕</a></div>`).join('')}</div>
            <div class="ml-foot"><button data-act="all">🔍 Xem tất cả</button><button data-act="edit">☑ Sửa danh sách</button><button data-act="link">🔗 Chép link</button></div>`;
        box.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.preventDefault()));
    }
    function openMultiPicker() {
        const sel = document.getElementById('road-select'); if (!sel) return;
        const groups2 = [];
        [...sel.children].forEach(ch => {
            if (ch.tagName === 'OPTGROUP') groups2.push([ch.label, [...ch.children].map(o => o.value).filter(Boolean)]);
            else if (ch.value) { if (!groups2.length || groups2[0][0] !== 'Quốc lộ, đường tỉnh') groups2.unshift(['Quốc lộ, đường tỉnh', []]); groups2[0][1].push(ch.value); }
        });
        const chosenSet = new Set(multiNames);
        const old = document.getElementById('multi-modal'); if (old) old.remove();
        const bg = document.createElement('div'); bg.className = 'sc-modal-bg'; bg.id = 'multi-modal';
        bg.innerHTML = `<div class="sc-modal" role="dialog" style="max-width:520px;width:94vw"><header><span>☑ Chọn nhiều tuyến</span><button id="mm-x" aria-label="Đóng">×</button></header>
            <div class="content" style="max-height:62vh;overflow:auto">
              <input id="mm-q" placeholder="Gõ để lọc tên tuyến…" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid #bbb;border-radius:4px;font-size:14px;margin-bottom:6px">
              ${groups2.map(([lab, names]) => `<div class="mm-g"><div class="mm-gh"><b>${esc(lab)}</b> <a href="#" data-grp="${esc(lab)}">chọn cả nhóm</a></div>
                ${names.map(n => `<label class="mm-it" data-grpi="${esc(lab)}"><input type="checkbox" value="${esc(n)}"${chosenSet.has(n) ? ' checked' : ''}> ${esc(n)}</label>`).join('')}</div>`).join('')}
            </div>
            <footer><span id="mm-n" style="margin-right:auto;font-size:13px;color:#555"></span><button class="sc-btn" id="mm-none">Bỏ chọn hết</button><button class="sc-btn blue" id="mm-ok">Hiện các tuyến đã chọn</button></footer></div>`;
        document.body.appendChild(bg);
        L.DomEvent.disableClickPropagation(bg); L.DomEvent.disableScrollPropagation(bg);
        const boxes = () => [...bg.querySelectorAll('.mm-it input')];
        const count = () => { document.getElementById('mm-n').textContent = 'Đã chọn ' + boxes().filter(b => b.checked).length + ' tuyến'; };
        count();
        bg.addEventListener('change', count);
        document.getElementById('mm-q').oninput = function () {
            const q = this.value.trim().toLowerCase();
            bg.querySelectorAll('.mm-it').forEach(l => { l.style.display = !q || l.textContent.toLowerCase().includes(q) ? '' : 'none'; });
        };
        bg.querySelectorAll('[data-grp]').forEach(a => a.onclick = e => {
            e.preventDefault();
            bg.querySelectorAll(`.mm-it[data-grpi="${CSS.escape(a.dataset.grp)}"]`).forEach(l => { if (l.style.display !== 'none') l.querySelector('input').checked = true; });
            count();
        });
        const close = () => bg.remove();
        document.getElementById('mm-x').onclick = close;
        document.getElementById('mm-none').onclick = () => { boxes().forEach(b => b.checked = false); count(); };
        document.getElementById('mm-ok').onclick = () => {
            // giữ thứ tự đã chọn trước, thêm tuyến mới vào sau
            const picked = boxes().filter(b => b.checked).map(b => b.value);
            const names = multiNames.filter(n => picked.includes(n)).concat(picked.filter(n => !multiNames.includes(n)));
            close(); map.closePopup();
            if (names.length) showMulti(names); else { multiNames = []; clearMulti(); renderMultiLegend(); }
        };
    }
    function addMultiButton() {
        const box = document.querySelector('.selector-box');
        if (!box || document.getElementById('multi-btn')) return;
        const b = document.createElement('button');
        b.id = 'multi-btn'; b.type = 'button'; b.textContent = '☑ Chọn nhiều tuyến';
        b.onclick = openMultiPicker;
        box.appendChild(b);
    }

    window.KCHT = { ITEMS, fid, add: addItem, remove: removeItem, show: showItem, popupHtml, lineStyle, groups, GROUPS, roadIndex, ready: false };

    fetch('KCHT_TTQLHT.geojson?v=20261117')
        .then(res => res.json())
        .then(data => {
            data.features.forEach(f => { if (f.geometry) placeItem(f, fid(f)); });
            GROUPS.forEach(g => {
                if (g[2]) groups[g[0]].addTo(map);
                layerControl.addOverlay(groups[g[0]], g[1]);
            });
            updateCoc();
            attachDtPopups(0);

            // Bổ sung tên đường vào danh sách chọn
            const sel = document.getElementById('road-select');
            if (sel) {
                const og = document.createElement('optgroup');
                og.label = 'Đường đô thị & tuyến bổ sung (TTQLHT)'; roadOptGroup = og;
                Object.keys(roadIndex).sort((a, b) => a.localeCompare(b, 'vi')).forEach(n => {
                    const o = document.createElement('option'); o.value = n; o.textContent = n; og.appendChild(o);
                });
                sel.appendChild(og);
            }

            addMultiButton();
            window.KCHT.ready = true;
            document.dispatchEvent(new Event('kcht-ready'));
            const q = new URLSearchParams(location.search);
            if (q.get('nhieu')) {
                const want = q.get('nhieu').split('|').map(x => x.trim()).filter(Boolean);
                (function waitDt(n) {   // chờ DT.geojson (QL/ĐT) tải xong
                    if ((typeof dtLayer !== 'undefined' && dtLayer && dtLayer.getLayers().length) || n > 120) showMulti(want);
                    else setTimeout(() => waitDt(n + 1), 250);
                })(0);
            }
            if (q.get('duong') && roadIndex[q.get('duong')]) {
                if (sel) sel.value = q.get('duong');
                focusRoad(q.get('duong'));
            }
        })
        .catch(err => console.error('Không tải được KCHT_TTQLHT.geojson', err));

    // Tự nạp chức năng "📤 Gửi qua Zalo" (zalo_share.js) sau khi trang tải xong,
    // nên không cần sửa index.html. Nếu index.html đã có dòng nạp zalo_share.js thì bỏ qua.
    window.addEventListener('load', function () {
        if (window.__zaloShareLoaded || document.querySelector('script[src*="zalo_share.js"]')) return;
        window.__zaloShareLoaded = true;
        const s = document.createElement('script');
        s.src = 'zalo_share.js?v=20261112';
        document.body.appendChild(s);
    });
    // Tự nạp chức năng chỉnh sửa điểm nguy hiểm PCTT (pctt_admin.js)
    window.addEventListener('load', function () {
        if (window.__pcttAdminLoaded || document.querySelector('script[src*="pctt_admin.js"]')) return;
        window.__pcttAdminLoaded = true;
        const s = document.createElement('script');
        s.src = 'pctt_admin.js?v=20261118b';
        document.body.appendChild(s);
    });

    // (18/11/2026) Tự nạp chức năng chỉnh sửa bản đồ cho quản trị viên (ban_do_admin.js)
    window.addEventListener('load', function () {
        if (window.__banDoAdminLoaded || document.querySelector('script[src*="ban_do_admin.js"]')) return;
        window.__banDoAdminLoaded = true;
        const s = document.createElement('script');
        s.src = 'ban_do_admin.js?v=20261118';
        document.body.appendChild(s);
    });

    // (18/11/2026) Tự nạp lớp hồ sơ hoàn công (hoan_cong.js)
    window.addEventListener('load', function () {
        if (window.__hoanCongLoaded || document.querySelector('script[src*="hoan_cong.js"]')) return;
        window.__hoanCongLoaded = true;
        const s = document.createElement('script');
        s.src = 'hoan_cong.js?v=20261118';
        document.body.appendChild(s);
    });

    // CSS riêng cho lớp KCHT
    const css = document.createElement('style');
    css.textContent = `
        .kcht-km div { font-size: 10px; font-weight: bold; color: #fff; background: rgba(0,0,0,.65);
            padding: 0 3px; border-radius: 3px; white-space: nowrap; transform: translate(-50%, -50%); display: inline-block; }
        #multi-btn { display: block; width: 100%; margin-top: 6px; padding: 7px; border: 1px solid #1565c0; background: #e3f2fd; color: #0d47a1;
            border-radius: 5px; font-weight: bold; font-size: 13px; cursor: pointer; }
        #multi-legend { position: fixed; left: 10px; bottom: 80px; z-index: 1000; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.35);
            width: 250px; max-width: 70vw; font: 13px sans-serif; }
        #multi-legend .ml-head { display: flex; justify-content: space-between; padding: 7px 10px; border-bottom: 1px solid #eee; }
        #multi-legend .ml-head a { color: #c62828; text-decoration: none; font-weight: bold; }
        #multi-legend .ml-list { max-height: 34vh; overflow-y: auto; padding: 4px 6px; }
        #multi-legend .ml-item { display: flex; align-items: center; gap: 6px; padding: 3px 2px; }
        #multi-legend .ml-sw { flex: 0 0 22px; height: 6px; border-radius: 3px; }
        #multi-legend .ml-item a { flex: 1; color: #222; text-decoration: none; }
        #multi-legend .ml-item a:hover { text-decoration: underline; }
        #multi-legend .ml-item a.ml-x { flex: 0 0 auto; color: #999; }
        #multi-legend .ml-foot { display: flex; gap: 4px; padding: 6px; border-top: 1px solid #eee; }
        #multi-legend .ml-foot button { flex: 1; font-size: 11px; padding: 5px 2px; border: 1px solid #90a4ae; background: #fff; border-radius: 4px; cursor: pointer; }
        .mm-g { margin: 6px 0 10px; } .mm-gh { margin: 4px 0; font-size: 13px; } .mm-gh a { font-size: 12px; margin-left: 6px; }
        .mm-it { display: block; padding: 4px 2px; font-size: 13px; border-bottom: 1px solid #f2f2f2; cursor: pointer; }
        .kcht-cau span { font-size: 16px; text-shadow: 0 0 2px #fff, 0 0 2px #fff; line-height: 16px; }
        .kcht-popup table { max-width: 340px; }
        .kcht-popup td { vertical-align: top; }
        .kcht-popup td:last-child { padding-left: 8px; }
        .kcht-popup h4 { white-space: normal !important; max-width: 340px; }`;
    document.head.appendChild(css);
})();
