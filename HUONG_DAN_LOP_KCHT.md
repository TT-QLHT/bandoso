# Lớp KCHT TTQLHT trên bản đồ (bổ sung 11/2026)

## Tệp bổ sung
| Tệp | Nội dung |
|---|---|
| `KCHT_TTQLHT.geojson` | Dữ liệu lớp KCHT (≈1,3 MB), chuyển từ KMZ `KCHT_GT_TTQLHT_tong_hop_ra_soat_ban_do.kmz` |
| `kcht_layer.js` | Hiển thị lớp KCHT, popup thuộc tính, thêm tên đường vào ô "Chọn tên đường" |

## Sửa `index.html` (1 dòng)
Thêm dòng sau **ngay trước** dòng `<script src="su_co_config.js"></script>` ở cuối tệp:

```html
    <script src="kcht_layer.js"></script>
```

## Các lớp (bật/tắt ở nút "Chọn loại bản đồ")
| Lớp | Số đối tượng | Mặc định |
|---|---|---|
| Đường đô thị TTQLHT quản lý (theo tên) – xanh: khớp chiều dài danh mục, cam: dài hơn phạm vi quản lý, đỏ: ngắn hơn | 106 | Bật |
| ĐT.601, ĐT.602 (chưa có trong DT.geojson) | 2 | Bật |
| Quốc lộ – đoạn theo danh mục (đỏ: lý trình hiệu chỉnh theo cọc; cam: ước tính) | 340 | Tắt |
| Đường tỉnh – đoạn theo danh mục (xanh dương: hiệu chỉnh; tím: ước tính) | 115 | Tắt |
| Đường đô thị – đoạn cắt theo điểm đầu/cuối | 92 | Tắt |
| Cọc Km tính toán (chỉ hiện khi phóng to ≥ 13) | 1.237 | Tắt |
| Cầu (QL đỏ, ĐT xanh, nội thị tím) | 97 | Bật |
| Cầu trên QL/ĐT có trên OSM, chưa có trong danh mục | 290 | Tắt |
| Hầm đường bộ | 3 | Bật |
| Kè, hào kỹ thuật, sàn – vị trí THAM CHIẾU (chưa phải tọa độ công trình) | 17 | Tắt |

## Liên kết chia sẻ
`https://ttqlht-dn.github.io/bandocapnhat/?duong=Lê Thanh Nghị` – mở sẵn và tô vàng tuyến đường.

## Lưu ý dữ liệu
- Hình học đường đô thị, ĐT.601/602 lấy từ OpenStreetMap (10/11/2026); QL/ĐT lấy từ KMZ "Bão Lũ (03.09) Theo Tuyến".
- Lý trình 19 tuyến không có cọc Km thực tế là **ước tính** (ghi rõ trong popup).
- Khi cập nhật danh mục: chạy lại bộ chuyển đổi để tạo mới `KCHT_TTQLHT.geojson`, chỉ cần thay tệp này.
