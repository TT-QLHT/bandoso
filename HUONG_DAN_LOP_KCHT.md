# Lớp KCHT TTQLHT trên bản đồ (cập nhật 17/11/2026 theo Danh mục chuẩn hóa v11)

## Tệp cần tải lên GitHub (ghi đè tệp cũ)
| Tệp | Nội dung |
|---|---|
| `KCHT_TTQLHT.geojson` | Dữ liệu lớp KCHT (≈1,9 MB), chuyển từ KMZ `KCHT_GT_TTQLHT_tong_hop_ra_soat_ban_do_v11.kmz` |
| `kcht_layer.js` | Thêm lớp phao báo hiệu đường thủy nội địa; nạp lại dữ liệu mới (không dùng bản lưu tạm của trình duyệt) |
| `HUONG_DAN_LOP_KCHT.md` | Tài liệu này |

`index.html` không phải sửa. Sau khi tải lên 1–2 phút, mở bản đồ và nhấn **Ctrl + F5**.

## Các lớp (bật/tắt ở nút "Chọn loại bản đồ")
| Lớp | Số đối tượng | Thay đổi so với bản 12/11 |
|---|---|---|
| Đường đô thị TTQLHT quản lý (theo tên) – xanh: khớp chiều dài danh mục, cam: dài hơn phạm vi quản lý, đỏ: ngắn hơn | 106 | Cập nhật số đoạn, tổng chiều dài, nhóm đường, năm đưa vào SD, mã CSDL theo v11 |
| ĐT.601, ĐT.602 (chưa có trong DT.geojson) | 2 | Giữ nguyên |
| Quốc lộ – đoạn theo danh mục | 340 | Giữ vị trí; bổ sung chiều dày KCMĐ (QL.40B) |
| Đường tỉnh – đoạn theo danh mục | 116 | Thêm 1 đoạn ĐT.607 (một phần); bổ sung thông tin DT 2027-2029 |
| Đường đô thị – đoạn cắt theo điểm đầu/cuối | 94 | Thêm 2 đoạn |
| Cọc Km tính toán (chỉ hiện khi phóng to ≥ 13) | 1.237 | Giữ nguyên |
| Cầu (QL đỏ, ĐT xanh, nội thị tím) | 308 | QL 130 (thêm 85), ĐT 147 (thêm 127), nội thị 31 |
| Cầu trên QL/ĐT có trên OSM, chưa có trong danh mục | 208 | Bớt 82 cầu đã khớp với cầu trong danh mục |
| Hầm đường bộ | 3 | Cập nhật thuộc tính |
| Kè, hào kỹ thuật, sàn – vị trí THAM CHIẾU | 18 | Thêm kè mố cầu Bãi Dài |
| Phao báo hiệu đường thủy nội địa (sông Hàn) | 3 | Mới – đổi từ VN-2000 sang WGS-84 |

## Lưu ý dữ liệu
- Cầu QL, ĐT mới đặt theo lý trình tim cầu trên đường tim. Nếu có cầu trên OpenStreetMap cùng tên (≤ 1,5 km) hoặc cách ≤ 150 m thì lấy vị trí cầu OSM. Popup ghi rõ cách định vị.
- Tuyến không có cọc Km thực tế (QL.14D, QL.14E, nhiều ĐT) có lý trình **ước tính**; vị trí cầu trên các tuyến này có thể lệch vài trăm mét.
- 205 đối tượng trong danh mục v11 chưa có hình học/tọa độ (110 đoạn đường đô thị, 29 tuyến đường thủy, 24 tuyến chỉ quản lý vỉa hè, 19 cầu nội thị, 2 bãi đỗ xe…): xem `Bao_cao_ra_soat_KMZ_v11.xlsx`, sheet `Chua_dinh_vi`.
