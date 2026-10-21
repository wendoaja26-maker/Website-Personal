
const WHATSAPP_NUMBER = "6283170605935";

const STORE_ADDRESS =
    "Jl. Budi Utomo, Rejomulyo, Metro Selatan, Kota Metro, Lampung 34335";

const DELIVERY_RATE = 2000;

const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");
const orderForm = document.getElementById("orderForm");
const serviceSelect = document.getElementById("service");
const quantityInput = document.getElementById("quantity");
const deliveryType = document.getElementById("deliveryType");
const addressInput = document.getElementById("customerAddress");

let routeDistanceKm = null;
let routeDeliveryCost = null;
let checkedAddress = "";

function rupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(number);
}

function getService() {
    const option =
        serviceSelect.options[serviceSelect.selectedIndex];

    return {
        name: option.value,
        price: Number(option.dataset.price),
        unit: option.dataset.unit
    };
}

// Memperbarui harga secara otomatis.
function updateEstimate() {
    const service = getService();
    const quantity = Math.max(
        1,
        Number(quantityInput.value) || 1
    );

    const laundryCost = service.price * quantity;

    document.getElementById("unitLabel").textContent =
        service.unit;

    document.getElementById("laundryCost").textContent =
        rupiah(laundryCost);

    let deliveryCost = 0;
    let deliveryLabel = "Rp0 (antar sendiri)";

    if (deliveryType.value === "Antar-jemput") {
        if (
            routeDeliveryCost !== null &&
            checkedAddress === addressInput.value.trim()
        ) {
            deliveryCost = routeDeliveryCost;
            deliveryLabel = rupiah(deliveryCost);
        } else {
            deliveryLabel = "Belum dihitung";
        }
    }

    document.getElementById("deliveryCost").textContent =
        deliveryLabel;

    document.getElementById("totalCost").textContent =
        deliveryType.value === "Antar-jemput" &&
        routeDeliveryCost === null
            ? `${rupiah(laundryCost)} + ongkir`
            : rupiah(laundryCost + deliveryCost);
}

// Membuka dan menutup menu HP.
menuToggle.addEventListener("click", () => {
    const opened = navMenu.classList.toggle("open");

    menuToggle.setAttribute(
        "aria-expanded",
        String(opened)
    );

    menuToggle.textContent = opened ? "✕" : "☰";
});

navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        navMenu.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

// Menghitung ulang harga ketika pilihan berubah.
serviceSelect.addEventListener("change", updateEstimate);
quantityInput.addEventListener("input", updateEstimate);
deliveryType.addEventListener("change", updateEstimate);

// Jika alamat diubah, hasil rute lama harus dihitung ulang.
addressInput.addEventListener("input", () => {
    if (addressInput.value.trim() !== checkedAddress) {
        routeDistanceKm = null;
        routeDeliveryCost = null;
        checkedAddress = "";

        document.getElementById("routeResult").hidden = true;

        document.getElementById("routeStatus").textContent =
            "Alamat berubah. Silakan cek kembali jarak.";

        updateEstimate();
    }
});

// Mencari koordinat berdasarkan alamat.
async function findAddress(address) {
    const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=jsonv2&limit=1&q=" +
        encodeURIComponent(address);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Layanan pencarian alamat gagal.");
    }

    const results = await response.json();

    if (results.length === 0) {
        throw new Error(
            "Alamat tidak ditemukan. Periksa nama jalan dan kelurahan."
        );
    }

    return {
        lat: Number(results[0].lat),
        lon: Number(results[0].lon)
    };
}

// Menghitung jarak berdasarkan rute jalan.
async function calculateRoute(start, end) {
    const coordinates =
        `${start.lon},${start.lat};${end.lon},${end.lat}`;

    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${coordinates}?overview=false`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Layanan perhitungan rute gagal.");
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes.length) {
        throw new Error("Rute jalan tidak ditemukan.");
    }

    return data.routes[0];
}

// Tombol cek jarak dan ongkir.
document.getElementById("checkRoute")
    .addEventListener("click", async () => {

        const address = addressInput.value.trim();
        const button = document.getElementById("checkRoute");
        const status = document.getElementById("routeStatus");
        const result = document.getElementById("routeResult");

        if (!address) {
            status.textContent =
                "Masukkan alamat pengambilan terlebih dahulu.";

            addressInput.focus();
            return;
        }

        button.disabled = true;
        button.textContent = "Menghitung...";
        status.textContent =
            "Sedang mencari alamat dan menghitung rute...";
        result.hidden = true;

        const googleMapsUrl =
            "https://www.google.com/maps/dir/?api=1" +
            "&origin=" + encodeURIComponent(STORE_ADDRESS) +
            "&destination=" +
            encodeURIComponent(
                address + ", Kota Metro, Lampung, Indonesia"
            ) +
            "&travelmode=driving";

        try {
            const [store, customer] = await Promise.all([
                findAddress(STORE_ADDRESS),
                findAddress(
                    address + ", Kota Metro, Lampung, Indonesia"
                )
            ]);

            const route = await calculateRoute(store, customer);

            const km = route.distance / 1000;

            // Pecahan kilometer dibulatkan ke atas.
            const cost = Math.ceil(km) * DELIVERY_RATE;

            routeDistanceKm = km;
            routeDeliveryCost = cost;
            checkedAddress = address;

            document.getElementById("distanceText").textContent =
                km.toLocaleString("id-ID", {
                    maximumFractionDigits: 1
                }) + " km";

            document.getElementById("deliveryCostText").textContent =
                rupiah(cost);

            document.getElementById("mapLink").href =
                googleMapsUrl;

            result.hidden = false;

            status.textContent =
                "Rute ditemukan. Jarak dan ongkir adalah estimasi.";

        } catch (error) {
            routeDistanceKm = null;
            routeDeliveryCost = null;
            checkedAddress = "";

            result.hidden = false;

            document.getElementById("distanceText").textContent =
                "Belum tersedia";

            document.getElementById("deliveryCostText").textContent =
                "Konfirmasi admin";

            document.getElementById("mapLink").href =
                googleMapsUrl;

            status.textContent =
                error.message +
                " Kamu bisa membuka Google Maps dan mengonfirmasi ongkir dengan admin.";
        }

        button.disabled = false;
        button.textContent = "⌖ Cek Jarak & Rute";

        updateEstimate();
    });

// Mengirim ringkasan pesanan ke WhatsApp.
orderForm.addEventListener("submit", event => {
    event.preventDefault();

    const name =
        document.getElementById("customerName").value.trim();

    const phone =
        document.getElementById("customerPhone").value.trim() || "-";

    const address = addressInput.value.trim();
    const service = getService();

    const quantity = Math.max(
        1,
        Number(quantityInput.value) || 1
    );

    const laundryCost = service.price * quantity;
    const isPickup = deliveryType.value === "Antar-jemput";

    const routeIsCurrent =
        checkedAddress === address &&
        routeDeliveryCost !== null;

    if (isPickup && !routeIsCurrent) {
        const proceed = confirm(
            "Jarak belum berhasil dihitung untuk alamat terbaru. " +
            "Ongkir perlu dikonfirmasi admin. Lanjutkan pesanan?"
        );

        if (!proceed) return;
    }

    const deliveryCost =
        isPickup && routeIsCurrent ? routeDeliveryCost : 0;

    const distanceInfo =
        isPickup && routeIsCurrent
            ? "Jarak rute: " +
              routeDistanceKm.toLocaleString("id-ID", {
                  maximumFractionDigits: 1
              }) + " km"
            : isPickup
                ? "Jarak rute: perlu dikonfirmasi admin"
                : "Pelanggan mengantar sendiri ke toko";

    const deliveryInfo =
        isPickup && routeIsCurrent
            ? rupiah(deliveryCost)
            : isPickup
                ? "Konfirmasi admin"
                : rupiah(0);

    const totalInfo =
        isPickup && !routeIsCurrent
            ? rupiah(laundryCost) + " + ongkir"
            : rupiah(laundryCost + deliveryCost);

    const message = [
        "Halo Q-Ta Laundry, saya ingin memesan laundry.",
        "",
        "Nama: " + name,
        "Nomor pemesan: " + phone,
        "Layanan: " + service.name,
        "Jumlah: " + quantity + " " + service.unit,
        "Biaya laundry: " + rupiah(laundryCost),
        "Jenis layanan: " + deliveryType.value,
        "Alamat: " + address,
        distanceInfo,
        "Biaya antar-jemput: " + deliveryInfo,
        "Estimasi total: " + totalInfo,
        "",
        "Mohon konfirmasi jadwal dan biaya akhir. Terima kasih."
    ].join("\n");

    const whatsappUrl =
        "https://wa.me/" + WHATSAPP_NUMBER +
        "?text=" + encodeURIComponent(message);

    window.open(whatsappUrl, "_blank");
});

// Menampilkan tahun saat ini di footer.
document.getElementById("year").textContent =
    new Date().getFullYear();

// Harga awal ketika halaman pertama kali dibuka.
updateEstimate();
