// =====================================================================
// RANH GIỚI, TÊN PHƯỜNG/XÃ THEO KIỂU bando.danang.gov.vn (bổ sung 18/11/2026)
// - Mỗi phường/xã một màu nhạt cố định (theo tên), viền cùng màu, giống bản đồ hành chính TP Đà Nẵng.
// - Tên phường/xã hiện ngay trên bản đồ (đặt ở chỗ rộng nhất của vùng), ẩn bớt khi thu nhỏ để khỏi chồng chữ.
// - Bấm vào vùng: tô vàng + bảng thông tin (dân số, diện tích, sáp nhập từ, trụ sở UBND,
//   Trung tâm phục vụ hành chính công, số điện thoại, nút chỉ đường).
// - Dữ liệu: map.geojson (94 phường, xã, đặc khu, lấy từ bando.danang.gov.vn – hiệu lực 01/07/2025).
// - Link mở sẵn một phường/xã: ?phuongxa=Hải Châu
// Được nạp tự động bởi kcht_layer.js (không cần sửa index.html).
// =====================================================================
(function () {
    'use strict';
    if (typeof map === 'undefined') return;
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const so = (v, d) => (v == null || v === '' || isNaN(+v)) ? '' : (+v).toLocaleString('vi-VN', { maximumFractionDigits: d || 0 });

    // Màu theo tên – cùng công thức với bando.danang.gov.vn
    function hash(s) { let d = 5381; for (let i = 0; i < s.length; i++) d = d * 33 ^ s.charCodeAt(i); return Math.abs(d >>> 0 ^ d >>> 16); }
    function colorOf(name) {
        const r = hash(String(name || 'default')), h = r % 360;
        const s = Math.max(.4, Math.min(1, .65 + ((r >> 8) % 20 - 10) / 100));
        const l = Math.max(.35, Math.min(.75, .55 + ((r >> 16) % 20 - 10) / 100));
        return `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }
    const tenOf = p => p.ten_xa || p['Tên phường/xã'] || p.name || '';
    const style = f => { const c = colorOf(tenOf(f.properties)); return { color: c, weight: 1.5, opacity: 0.9, fillColor: c, fillOpacity: 0.12 }; };
    const styleHover = f => { const c = colorOf(tenOf(f.properties)); return { color: c, weight: 3, opacity: 1, fillColor: c, fillOpacity: 0.22 }; };
    const styleSel = { color: '#f59e0b', weight: 3, opacity: 1, fillColor: '#ffd600', fillOpacity: 0.4 };

    map.createPane('pxLabel'); map.getPane('pxLabel').style.zIndex = 405; map.getPane('pxLabel').style.pointerEvents = 'none';
    const labels = L.layerGroup();
    let selected = null;

    function popupHtml(p) {
        const ten = tenOf(p), loai = p.loai || '';
        const stats = [['👥 Dân số', so(p.dan_so)], ['🌐 Diện tích', p.dtich_km2 ? so(p.dtich_km2, 2) + ' km²' : ''], ['▦ Mật độ', p.matdo_km2 ? so(p.matdo_km2) + ' người/km²' : '']]
            .filter(x => x[1]).map(x => `<div><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
        let dd = p.dia_diem;
        if (typeof dd === 'string') { try { dd = JSON.parse(dd); } catch (e) { dd = []; } }
        const loc = (dd || []).map(l => {
            const tel = String(l.dien_thoai || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
                .map(t => `<a href="tel:${esc(t.replace(/[^\d+]/g, ''))}">${esc(t)}</a>`).join(', ');
            const dir = l.lat && l.lng ? `<a class="px-dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}">➤ Chỉ đường</a>` : '';
            return `<div class="px-loc"><b>${esc(l.ten)}</b><div>${esc(l.dia_chi)}</div>${tel ? `<div>☎ ${tel}</div>` : ''}${dir}</div>`;
        }).join('');
        return `<div class="px-pop">
            <div class="px-h">${loai ? `<span class="px-loai">${esc(loai)}</span>` : ''}<b>${esc(ten)}</b></div>
            ${stats ? `<div class="px-stats">${stats}</div>` : ''}
            ${p.sap_nhap ? `<div class="px-row"><small>Sáp nhập từ</small>${esc(p.sap_nhap)}</div>` : ''}
            ${p.truoc_day ? `<div class="px-row"><small>Thuộc địa bàn cũ</small>${esc(p.truoc_day)}</div>` : ''}
            ${loc ? `<div class="px-sec">📍 Các địa điểm</div>${loc}` : ''}
            <div class="px-src">Nguồn: bando.danang.gov.vn · từ 01/07/2025</div></div>`;
    }

    // Ngưỡng diện tích (km²) để hiện tên theo mức phóng – tránh chồng chữ khi nhìn toàn thành phố
    function minArea(z) { return z >= 12 ? 0 : z >= 11 ? 6 : z >= 10 ? 25 : z >= 9 ? 80 : Infinity; }
    function updateLabels() {
        const z = map.getZoom(), lim = minArea(z), fs = z >= 14 ? 14 : z >= 12 ? 12.5 : 11;
        labels.eachLayer(m => {
            const el = m.getElement(); if (!el) return;
            el.style.display = (m.options.dt >= lim) ? '' : 'none';
            el.style.fontSize = fs + 'px';
        });
    }

    function upgrade(gl) {
        gl.options.style = style;            // để resetStyle() của index.html dùng màu mới
        labels.clearLayers();
        gl.eachLayer(layer => {
            const f = layer.feature; if (!f || !f.properties) return;
            const t = f.geometry && f.geometry.type; if (t !== 'Polygon' && t !== 'MultiPolygon') return;
            const p = f.properties;
            layer.setStyle(style(f));
            layer.off('mouseover').off('mouseout');   // bỏ kiểu tô đỏ dày cũ
            layer.on('mouseover', () => { if (layer !== selected) layer.setStyle(styleHover(f)); });
            layer.on('mouseout', () => { if (layer !== selected) layer.setStyle(style(f)); });
            layer.unbindPopup();
            layer.bindPopup(() => popupHtml(p), { maxWidth: 330, minWidth: 260, className: 'px-popup', autoPanPaddingTopLeft: [10, 60] });
            layer.on('popupopen', () => {
                if (selected && selected !== layer) selected.setStyle(style(selected.feature));
                selected = layer; layer.setStyle(styleSel);
            });
            layer.on('popupclose', () => { if (selected === layer) { selected = null; layer.setStyle(style(f)); } });
            // Vị trí đặt tên
            let ll;
            if (Array.isArray(p.nhan) && p.nhan.length === 2) ll = L.latLng(p.nhan[1], p.nhan[0]);
            else ll = layer.getBounds().getCenter();
            const dt = +p.dtich_km2 || (() => { const b = layer.getBounds(); return Math.abs((b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth())) * 11800 * 0.5; })();
            const m = L.marker(ll, {
                pane: 'pxLabel', interactive: false, keyboard: false, dt: dt,
                icon: L.divIcon({ className: 'px-lbl', html: `<span>${esc(tenOf(p))}</span>`, iconSize: [0, 0] })
            });
            labels.addLayer(m);
        });
        if (!map.hasLayer(labels)) labels.addTo(map);
        updateLabels();
        // Mở sẵn ?phuongxa=
        const q = new URLSearchParams(location.search).get('phuongxa');
        if (q) {
            const k = q.trim().toLowerCase();
            gl.eachLayer(l => { if (l.feature && tenOf(l.feature.properties).toLowerCase() === k) { map.fitBounds(l.getBounds()); setTimeout(() => l.openPopup(l.getBounds().getCenter()), 400); } });
        }
    }
    map.on('zoomend', updateLabels);
    labels.on('add', () => setTimeout(updateLabels, 0));

    // Chờ index.html tải xong map.geojson
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        let gl = null; try { gl = geoJsonLayer; } catch (e) { }
        if (gl && gl.getLayers && gl.getLayers().length) {
            clearInterval(timer); upgrade(gl);
            if (typeof layerControl !== 'undefined') layerControl.addOverlay(labels, '<b style="color:#374151">Aa</b> Tên phường, xã');
        } else if (tries > 200) clearInterval(timer);
    }, 300);

    const css = document.createElement('style');
    css.textContent = `
        .px-lbl span { display: inline-block; transform: translate(-50%, -50%); white-space: nowrap; font-family: 'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif;
            font-weight: 600; color: #374151; letter-spacing: .1px;
            text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff; }
        .px-popup .leaflet-popup-content { width: 300px !important; max-width: 78vw; margin: 10px 12px; font: 13px 'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif; }
        .px-pop { max-height: 55vh; overflow-y: auto; }
        .px-pop .px-h { display: flex; align-items: center; gap: 8px; font-size: 16px; margin-bottom: 8px; padding-right: 14px; }
        .px-pop .px-loai { font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
        .px-pop .px-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; margin-bottom: 8px; }
        .px-pop .px-stats div { background: #eff6ff; border-radius: 6px; padding: 5px 7px; }
        .px-pop .px-stats small { display: block; color: #64748b; font-size: 11px; }
        .px-pop .px-stats b { color: #1e3a8a; font-size: 13px; }
        .px-pop .px-row { margin: 5px 0; line-height: 1.35; } .px-pop .px-row small { display: block; color: #64748b; font-size: 11px; }
        .px-pop .px-sec { margin: 8px 0 4px; font-weight: 600; color: #334155; }
        .px-pop .px-loc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 5px; line-height: 1.35; }
        .px-pop .px-loc b { color: #1d4ed8; display: block; }
        .px-pop .px-dir { display: inline-block; margin-top: 3px; font-weight: 600; text-decoration: none; }
        .px-pop .px-src { margin-top: 6px; color: #94a3b8; font-size: 10.5px; }`;
    document.head.appendChild(css);
})();
