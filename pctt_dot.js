// =====================================================================
// ĐIỂM NGUY HIỂM MÙA MƯA BÃO – TÁCH THEO NĂM / ĐỢT BỔ SUNG (20/11/2026)
// - Trong bảng "⚠ Điểm nguy hiểm mùa mưa bão" có thêm hàng thẻ:
//     [Tất cả] [PA PCTT gốc] [🆕 Bổ sung 2026] (năm hiện tại luôn có sẵn, kể cả khi chưa có điểm)
// - Điểm được coi là "bổ sung" của một năm khi:
//     + nhập trên bản đồ (mã BSyyMMdd-…, do pctt_admin.js tạo) → năm 20yy;
//     + hoặc có thuộc tính "nam" (VD: "nam": 2026) trong file dữ liệu;
//     + hoặc nằm trong file PCTT_<năm>.geojson tải lên GitHub (VD: PCTT_2026.geojson).
//   Còn lại (PCTT_BaoLu.geojson) là "PA PCTT gốc".
// - Điểm bổ sung nằm ở lớp riêng "🆕 Điểm ngập/sạt lở bổ sung mới" trong "Chọn loại bản đồ",
//   viền vàng nét đứt để phân biệt với điểm gốc.
// - Link chia sẻ: ?dot=2026 (mở sẵn thẻ năm 2026), ?dot=goc.
// Được nạp tự động bởi kcht_layer.js (không cần sửa index.html).
// =====================================================================
(function () {
    'use strict';
    if (typeof map === 'undefined' || typeof pcttItems === 'undefined' || typeof pcttGroups === 'undefined') return;

    const NAM_NAY = new Date().getFullYear();
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isHazard = p => p && (p.nhom === 'nguy_hiem' || p.nhom === 'doan_nguy_hiem');

    // ---------- Xác định năm / đợt của một điểm ----------
    function dotOf(p) {
        if (!p) return 'goc';
        if (p.nam) return String(p.nam);
        const tt = p.thong_tin || {};
        if (tt['Năm'] || tt['Năm bổ sung']) return String(tt['Năm'] || tt['Năm bổ sung']).replace(/\D/g, '').slice(0, 4) || 'goc';
        const m = /^BS(\d{2})/.exec(p.ma || '');
        if (m) return '20' + m[1];
        if (p.nhom === 'doan_nguy_hiem' && p.ma_diem && pcttHazardByMa[p.ma_diem]) return dotOf(pcttHazardByMa[p.ma_diem].feature.properties);
        if (/Bổ sung/i.test(p.nguon || '')) return String(NAM_NAY);
        return 'goc';
    }
    const isNew = it => isHazard(it.feature.properties) && dotOf(it.feature.properties) !== 'goc';
    const dotLabel = d => d === 'goc' ? 'PA PCTT gốc' : (d ? '🆕 Bổ sung ' + d : 'Tất cả');

    // ---------- Lớp riêng cho điểm bổ sung ----------
    pcttGroups.moi = L.layerGroup();
    pcttFilter.dot = '';

    function styleNew(it) {
        const lay = it.layer, p = it.feature.properties;
        if (!lay.setStyle) return;
        const cao = p.danh_gia_nguy_co === 'Nguy cơ cao';
        if (lay.setLatLng) lay.setStyle({ color: cao ? '#d50000' : '#ffd600', weight: 3, dashArray: '4 3', fillColor: pcttColor(p) });
        else lay.setStyle({ dashArray: '10 6' });
        if (lay.getTooltip && lay.getTooltip() && !/^🆕/.test(lay.getTooltip().getContent() || ''))
            lay.setTooltipContent('🆕 ' + lay.getTooltip().getContent());
    }

    // ---------- Bộ lọc thêm điều kiện năm / đợt ----------
    const _match = window.pcttMatch;
    window.pcttMatch = function (it) {
        if (!_match(it)) return false;
        const d = pcttFilter.dot;
        if (!d) return true;
        const p = it.feature.properties;
        if (isHazard(p)) return dotOf(p) === d;
        return d === 'goc';      // tuyến tránh, điểm tập kết, cọc H thuộc phương án gốc
    };

    const _apply = window.pcttApplyFilter;
    window.pcttApplyFilter = function (fit) {
        let coMoi = false;
        pcttItems.forEach(it => { if (isNew(it)) { if (it.group !== 'moi') coMoi = true; it.group = 'moi'; styleNew(it); } });
        // điểm vừa nhập: nếu lớp ngập/sạt lở đang bật thì bật luôn lớp điểm bổ sung để thấy ngay
        if (coMoi && (map.hasLayer(pcttGroups.ngap) || map.hasLayer(pcttGroups.satlo))) map.addLayer(pcttGroups.moi);
        _apply(fit);
        renderTabs();
    };

    const _render = window.pcttRenderList;
    window.pcttRenderList = function () {
        _render();
        const d = pcttFilter.dot, ul = document.getElementById('pctt-list');
        if (d && d !== 'goc' && ul && ul.querySelector('li.empty')) {
            ul.innerHTML = `<li class="empty">Chưa có điểm nguy hiểm bổ sung năm ${esc(d)}.<br>
                Đăng nhập ở bảng "Sự cố hiện trường", rồi bấm <b>💧 Thêm điểm ngập</b> / <b>⛰️ Thêm điểm sạt lở</b>
                hoặc bấm chuột phải (điện thoại: nhấn giữ) lên bản đồ.<br>
                Nhập hàng loạt: tải file <b>PCTT_${esc(d)}.geojson</b> lên GitHub (cùng cấu trúc PCTT_BaoLu.geojson).</li>`;
        }
        // đánh dấu điểm mới trong danh sách
        if (ul) ul.querySelectorAll('li[data-ma]').forEach(li => {
            const it = pcttHazardByMa[li.getAttribute('data-ma')];
            if (it && isNew(it) && !li.querySelector('.pd-new')) li.insertAdjacentHTML('afterbegin', `<span class="pd-new">${esc(dotOf(it.feature.properties))}</span>`);
        });
    };

    // ---------- Hàng thẻ trong bảng "Điểm nguy hiểm mùa mưa bão" ----------
    function counts() {
        const c = { '': 0, goc: 0 };
        c[String(NAM_NAY)] = 0;
        pcttItems.forEach(it => {
            const p = it.feature.properties; if (p.nhom !== 'nguy_hiem') return;
            const d = dotOf(p); c[''] += 1; c[d] = (c[d] || 0) + 1;
        });
        return c;
    }
    function renderTabs() {
        const body = document.querySelector('#pctt-panel .pctt-body');
        if (!body) return;
        let box = document.getElementById('pctt-dot');
        if (!box) {
            box = document.createElement('div'); box.id = 'pctt-dot';
            const before = document.getElementById('pctt-tuyen');
            body.insertBefore(box, before || body.firstChild);
            box.addEventListener('click', e => {
                const b = e.target.closest('button[data-dot]'); if (!b) return;
                chooseDot(b.getAttribute('data-dot'));
            });
        }
        const c = counts();
        const years = Object.keys(c).filter(k => /^\d{4}$/.test(k)).sort((a, b) => b - a);
        const keys = [''].concat(['goc'], years);
        const d = pcttFilter.dot;
        box.innerHTML = `<div class="pd-tabs">${keys.map(k =>
            `<button type="button" data-dot="${esc(k)}" class="${k === d ? 'on' : ''}${/^\d{4}$/.test(k) ? ' nam' : ''}">${esc(dotLabel(k))} <i>${c[k] || 0}</i></button>`).join('')}</div>
            ${d && d !== 'goc' ? `<div class="pd-head">🆕 Điểm nguy hiểm mùa mưa bão bổ sung năm ${esc(d)}</div>` : ''}
            ${d === 'goc' ? `<div class="pd-head goc">Điểm theo phương án PCTT gốc (PCTT_BaoLu.geojson)</div>` : ''}`;
    }
    function chooseDot(d) {
        pcttFilter.dot = d || '';
        if (!d) ['ngap', 'satlo', 'moi'].forEach(k => map.addLayer(pcttGroups[k]));
        else if (d === 'goc') { map.addLayer(pcttGroups.ngap); map.addLayer(pcttGroups.satlo); map.removeLayer(pcttGroups.moi); }
        else { map.addLayer(pcttGroups.moi); }
        window.pcttApplyFilter(false);
        // phóng tới các điểm của thẻ vừa chọn
        const shown = pcttItems.filter(it => it.feature.properties.nhom === 'nguy_hiem' && window.pcttMatch(it)).map(it => it.layer);
        if (d && shown.length) map.fitBounds(L.featureGroup(shown).getBounds(), { padding: [40, 40], maxZoom: 16 });
    }

    // Chọn tuyến trong bảng PCTT: bật cả lớp điểm bổ sung
    const selT = document.getElementById('pctt-tuyen');
    if (selT) selT.addEventListener('change', function () { if (this.value) map.addLayer(pcttGroups.moi); });

    // ---------- Nạp file dữ liệu bổ sung theo năm: PCTT_<năm>.geojson (nếu có) ----------
    function loadYearFile(y) {
        return fetch('PCTT_' + y + '.geojson?v=' + Date.now(), { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data || !Array.isArray(data.features)) return 0;
                let n = 0;
                data.features.forEach(f => {
                    if (!f || !f.properties) return;
                    const p = f.properties;
                    if (!p.nhom) p.nhom = 'nguy_hiem';
                    if (!p.nam) p.nam = y;
                    if (!p.nguon) p.nguon = 'PCTT_' + y + '.geojson';
                    if (p.nhom === 'nguy_hiem' && p.ma && pcttHazardByMa[p.ma]) return;   // trùng mã: giữ điểm đang có
                    const it = pcttBuildLayer(f);
                    if (!it) return;
                    pcttItems.push(it); n++;
                    if (p.nhom === 'nguy_hiem' && p.ma) pcttHazardByMa[p.ma] = it;
                });
                return n;
            })
            .catch(() => 0);
    }

    // ---------- Khởi động: chờ dữ liệu gốc tải xong ----------
    let tries = 0;
    (function wait() {
        if (!pcttItems.length) { if (++tries < 120) setTimeout(wait, 500); return; }
        layerControl.addOverlay(pcttGroups.moi, '<span style="color:#f9a825">◌</span> 🆕 Điểm ngập/sạt lở bổ sung mới (theo năm)');
        const years = [NAM_NAY, NAM_NAY + 1];
        Promise.all(years.map(loadYearFile)).then(() => {
            const q = new URLSearchParams(location.search);
            const d0 = q.get('dot');
            if (d0) chooseDot(d0); else window.pcttApplyFilter(false);
            // cập nhật lại sau khi pctt_admin.js nạp xong các điểm nhập trên bản đồ (từ Google Sheet)
            setTimeout(() => window.pcttApplyFilter(false), 4000);
            setTimeout(() => window.pcttApplyFilter(false), 10000);
        });
    })();

    const css = document.createElement('style');
    css.textContent = `
        #pctt-dot { margin: 2px 0 6px; }
        #pctt-dot .pd-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
        #pctt-dot button { flex: 1 1 auto; border: 1px solid #90a4ae; background: #fff; border-radius: 14px; padding: 4px 8px;
            font-size: 11.5px; cursor: pointer; color: #263238; white-space: nowrap; }
        #pctt-dot button i { font-style: normal; font-weight: bold; color: #546e7a; margin-left: 2px; }
        #pctt-dot button.nam { border-color: #f9a825; background: #fffde7; }
        #pctt-dot button.on { background: #0026FF; border-color: #0026FF; color: #fff; }
        #pctt-dot button.on i { color: #fff; }
        #pctt-dot .pd-head { margin-top: 6px; padding: 4px 6px; border-radius: 4px; background: #fff8e1; color: #e65100; font-weight: bold; font-size: 12px; }
        #pctt-dot .pd-head.goc { background: #e3f2fd; color: #0d47a1; }
        .pctt-list .pd-new { float: right; margin-left: 4px; padding: 0 5px; border-radius: 8px; background: #ffd600; color: #333; font-size: 10px; font-weight: bold; }`;
    document.head.appendChild(css);
})();
