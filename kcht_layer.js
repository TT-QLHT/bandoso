// =====================================================================
// LỚP KCHT TTQLHT (bổ sung 11/2026)
// Dữ liệu: KCHT_TTQLHT.geojson – chuyển từ KMZ "KCHT_GT_TTQLHT_tong_hop_ra_soat_ban_do"
// (Danh mục chuẩn hóa KCHTGT TTQLHT v5; KMZ Bão Lũ 03.09; OpenStreetMap 10/11/2026)
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
        ['do_thi', '<span style="color:#00a000">━</span> Đường đô thị TTQLHT quản lý (theo tên)', true],
        ['tuyen_moi', '<span style="color:#000">━</span> ĐT.601, ĐT.602 (bổ sung)', true],
        ['ql_doan', '<span style="color:#e60000">━</span> Quốc lộ – đoạn theo danh mục', false],
        ['dt_doan', '<span style="color:#0050e6">━</span> Đường tỉnh – đoạn theo danh mục', false],
        ['do_thi_doan', '<span style="color:#00b8d4">┅</span> Đường đô thị – đoạn cắt theo điểm đầu/cuối', false],
        ['coc_km', '<span>◦</span> Cọc Km tính toán (QL/ĐT)', false],
        ['cau', '<span style="color:#6a1b9a">▲</span> Cầu (QL, ĐT, nội thị)', false],
        ['cau_osm', '<span style="color:#9e9e9e">■</span> Cầu trên QL/ĐT chưa có trong danh mục (OSM)', false],
        ['ham', '<span style="color:#0d47a1">▼</span> Hầm đường bộ', false],
        ['ke_hao', '<span style="color:#795548">ⓘ</span> Kè, hào kỹ thuật, sàn (vị trí tham chiếu)', false]
    ];
    const groups = {};
    GROUPS.forEach(g => { groups[g[0]] = L.layerGroup(); });

    const DT_COLOR = { ok: '#00a000', dai: '#ff8c00', ngan: '#e53935' };
    function lineStyle(p) {
        switch (p.lop) {
            case 'do_thi': return { color: DT_COLOR[p.st] || '#00a000', weight: 4, opacity: 0.9 };
            case 'tuyen_moi': return { color: '#000000', weight: 4, opacity: 1 };
            case 'ql_doan': return { color: p.hc ? '#e60000' : '#ff8c00', weight: 5, opacity: 0.85 };
            case 'dt_doan': return { color: p.hc ? '#0050e6' : '#b400b4', weight: 5, opacity: 0.85 };
            case 'do_thi_doan': return { color: '#00b8d4', weight: 3, opacity: 0.9, dashArray: '6 5' };
        }
        return { color: '#333', weight: 3 };
    }

    function popupHtml(p, latlng) {
        const rows = (p.tt || []).map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('');
        const gmap = latlng ? `<tr><td>Bản đồ</td><td><a href="https://www.google.com/maps?q=${latlng.lat},${latlng.lng}" target="_blank" rel="noopener">Mở Google Maps</a></td></tr>` : '';
        return `<div class="info-popup kcht-popup"><h4>${esc(p.ten)}</h4><table>${rows}${gmap}</table></div>`;
    }

    const roadIndex = {};      // tên đường -> layer (để chọn từ danh sách)
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
            } else {
                layer = L.circleMarker(ll, { pane: 'kchtPoints', radius: 6, fillColor: '#795548', fillOpacity: 0.9, color: '#fff', weight: 2 });
            }
            layer.bindPopup(() => popupHtml(p, ll), { maxWidth: 360 });
            layer.bindTooltip(p.ten, { direction: 'top' });
            return layer;
        }
        layer = L.geoJSON(f, { pane: 'kchtLines', style: () => lineStyle(p) });
        layer.bindPopup(() => popupHtml(p, null), { maxWidth: 360 });
        layer.bindTooltip(p.ten, { sticky: true });
        layer.on({
            mouseover: e => { if (layer !== kchtHighlighted) layer.setStyle({ weight: 7, color: '#FF0000' }); },
            mouseout: e => { if (layer !== kchtHighlighted) layer.setStyle(lineStyle(p)); }
        });
        layer._kchtProps = p;
        if (p.lop === 'do_thi' || p.lop === 'tuyen_moi') roadIndex[p.ten] = layer;
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

    function focusRoad(name) {
        const layer = roadIndex[name];
        if (!layer) return false;
        if (kchtHighlighted) kchtHighlighted.setStyle(lineStyle(kchtHighlighted._kchtProps));
        const grp = groups[layer._kchtProps.lop];
        if (!map.hasLayer(grp)) map.addLayer(grp);
        kchtHighlighted = layer;
        layer.setStyle({ color: '#FFD800', weight: 8, opacity: 1 });
        layer.bringToFront();
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        layer.openPopup(layer.getBounds().getCenter());
        return true;
    }

    // Mở rộng hàm chọn đường sẵn có: tên thuộc lớp KCHT thì xử lý tại đây
    const originalZoomToRoad = window.zoomToRoad;
    window.zoomToRoad = function (roadName) {
        if (roadName && roadIndex[roadName]) { focusRoad(roadName); return; }
        if (kchtHighlighted) { kchtHighlighted.setStyle(lineStyle(kchtHighlighted._kchtProps)); kchtHighlighted = null; }
        if (typeof originalZoomToRoad === 'function') originalZoomToRoad(roadName);
    };

    fetch('KCHT_TTQLHT.geojson')
        .then(res => res.json())
        .then(data => {
            data.features.forEach(f => {
                const layer = buildLayer(f);
                if (!layer) return;
                if (f.properties.lop === 'coc_km') cocAll.addLayer(layer);
                else if (groups[f.properties.lop]) groups[f.properties.lop].addLayer(layer);
            });
            GROUPS.forEach(g => {
                if (g[2]) groups[g[0]].addTo(map);
                layerControl.addOverlay(groups[g[0]], g[1]);
            });
            updateCoc();

            // Bổ sung tên đường vào danh sách chọn
            const sel = document.getElementById('road-select');
            if (sel) {
                const og = document.createElement('optgroup');
                og.label = 'Đường đô thị & tuyến bổ sung (TTQLHT)';
                Object.keys(roadIndex).sort((a, b) => a.localeCompare(b, 'vi')).forEach(n => {
                    const o = document.createElement('option'); o.value = n; o.textContent = n; og.appendChild(o);
                });
                sel.appendChild(og);
            }

            const q = new URLSearchParams(location.search);
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

    // CSS riêng cho lớp KCHT
    const css = document.createElement('style');
    css.textContent = `
        .kcht-km div { font-size: 10px; font-weight: bold; color: #fff; background: rgba(0,0,0,.65);
            padding: 0 3px; border-radius: 3px; white-space: nowrap; transform: translate(-50%, -50%); display: inline-block; }
        .kcht-cau span { font-size: 16px; text-shadow: 0 0 2px #fff, 0 0 2px #fff; line-height: 16px; }
        .kcht-popup table { max-width: 340px; }
        .kcht-popup td { vertical-align: top; }
        .kcht-popup td:last-child { padding-left: 8px; }
        .kcht-popup h4 { white-space: normal !important; max-width: 340px; }`;
    document.head.appendChild(css);
})();
