/*
 * mte-print-bt — kirim byte ESC/POS ke printer thermal BLE secara LANGSUNG
 * via L2CAP ATT (tanpa BlueZ D-Bus / tanpa Web Bluetooth).
 *
 * Kenapa ada alat ini: BlueZ & Chrome selalu mencoba transport BR/EDR untuk
 * perangkat dual-mode (Classic + BLE), padahal printer hanya menerima BLE.
 * Koneksi L2CAP LE mentah lewat kernel mem-bypass pilihan transport itu,
 * sehingga Bluetooth laptop bisa tetap dual-mode (headset musik tetap jalan).
 *
 * Pakai:  mte-print-bt [--addr AA:BB:CC:DD:EE:FF] [--type 1|2] [file.bin]
 *         (tanpa file -> baca byte dari stdin)
 *   --type 1 = LE public (default), 2 = LE random
 * Exit 0 = sukses tercetak, selain itu gagal (pesan di stderr).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/time.h>

#ifndef AF_BLUETOOTH
#define AF_BLUETOOTH 31
#endif
#ifndef BTPROTO_L2CAP
#define BTPROTO_L2CAP 0
#endif
#define BDADDR_LE_PUBLIC  0x01
#define BDADDR_LE_RANDOM  0x02
#define ATT_CID           4

/* Mirror struct sockaddr_l2 dari linux/bluetooth.h (header tidak selalu ada) */
struct sl2 {
    unsigned short l2_family;
    unsigned short l2_psm;
    unsigned char  l2_bdaddr[6];
    unsigned short l2_cid;
    unsigned char  l2_bdaddr_type;
};

#define MAX_SVC 32

typedef struct {
    unsigned short start, end;
    unsigned char uuid[16];
    int uuid_len; /* 2 atau 16 */
} svc_t;

static void die(const char *msg)
{
    fprintf(stderr, "%s: %s\n", msg, strerror(errno));
    exit(2);
}

static int hexval(char c)
{
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

static int parse_bdaddr(const char *s, unsigned char out[6])
{
    int v[6];
    if (sscanf(s, "%02x:%02x:%02x:%02x:%02x:%02x",
               &v[0], &v[1], &v[2], &v[3], &v[4], &v[5]) != 6)
        return -1;
    /* sockaddr_l2 menyimpan bdaddr terbalik (LSB pertama) */
    for (int i = 0; i < 6; i++)
        out[i] = (unsigned char)v[5 - i];
    return 0;
}

static int uuid_is(const unsigned char *uuid, int len,
                   const unsigned char *expected, int expected_len)
{
    if (len != expected_len) return 0;
    return memcmp(uuid, expected, len) == 0;
}

int main(int argc, char **argv)
{
    const char *addr_str = getenv("MTE_PRINTER_ADDR");
    if (!addr_str || !*addr_str) addr_str = "5A:4A:66:AC:33:62";
    unsigned char addr_type = BDADDR_LE_PUBLIC;
    unsigned char local_type = BDADDR_LE_PUBLIC; /* tipe alamat LE controller lokal */
    const char *path = NULL;
    int nobind = 0;

    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--addr") && i + 1 < argc) addr_str = argv[++i];
        else if (!strcmp(argv[i], "--type") && i + 1 < argc) addr_type = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--ltype") && i + 1 < argc) local_type = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--nobind")) nobind = 1;
        else path = argv[i];
    }

    unsigned char bdaddr[6];
    if (parse_bdaddr(addr_str, bdaddr) < 0) {
        fprintf(stderr, "Alamat printer tidak valid: %s\n", addr_str);
        return 2;
    }

    /* 1. Baca payload */
    unsigned char *data = NULL;
    size_t dlen = 0, cap = 0;
    if (path) {
        FILE *f = fopen(path, "rb");
        if (!f) die("buka file payload");
        unsigned char tmp[8192];
        size_t r;
        while ((r = fread(tmp, 1, sizeof(tmp), f)) > 0) {
            if (dlen + r > cap) { cap = (dlen + r) * 2 + 4096; data = realloc(data, cap); }
            memcpy(data + dlen, tmp, r);
            dlen += r;
        }
        fclose(f);
    } else {
        unsigned char tmp[8192];
        size_t r;
        while ((r = fread(tmp, 1, sizeof(tmp), stdin)) > 0) {
            if (dlen + r > cap) { cap = (dlen + r) * 2 + 4096; data = realloc(data, cap); }
            memcpy(data + dlen, tmp, r);
            dlen += r;
        }
    }
    if (!data || dlen == 0) { fprintf(stderr, "Payload kosong\n"); return 2; }

    /* 2. Koneksi L2CAP LE (ATT, cid 4) — non-blocking + poll timeout.
     * Printer ini mengiklankan diri sela-sela (hemat daya), jadi kalau
     * jendela iklannya terlewat, ulangi beberapa kali sebelum menyerah. */
    int fd = -1;
    for (int attempt = 1; attempt <= 4 && fd < 0; attempt++) {
        if (attempt > 1) {
            fprintf(stderr, "coba lagi (%d/4)...\n", attempt);
            sleep(3);
        }
        fd = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
        if (fd < 0) die("socket L2CAP");

        struct sl2 sa;
        memset(&sa, 0, sizeof(sa));
        sa.l2_family = AF_BLUETOOTH;
        sa.l2_psm = 0;
        sa.l2_cid = ATT_CID;
        memcpy(sa.l2_bdaddr, bdaddr, 6);
        sa.l2_bdaddr_type = addr_type;

        int fl = fcntl(fd, F_GETFL, 0);
        fcntl(fd, F_SETFL, fl | O_NONBLOCK);

        /* LE: bind HARUS memuat l2_cid=ATT supaya kernel menganggap channel
         * ini L2CAP_CHAN_FIXED (tanpa itu, connect CID=4 ditolak EINVAL) */
        struct sl2 src;
        memset(&src, 0, sizeof(src));
        src.l2_family = AF_BLUETOOTH;
        src.l2_cid = ATT_CID;
        src.l2_bdaddr_type = local_type;
        if (!nobind && bind(fd, (struct sockaddr *)&src, sizeof(src)) < 0)
            die("bind L2CAP LE");

        if (connect(fd, (struct sockaddr *)&sa, sizeof(sa)) < 0 && errno != EINPROGRESS) {
            fprintf(stderr, "connect L2CAP LE: %s\n", strerror(errno));
            close(fd);
            fd = -1;
            continue;
        }
        if (errno == EINPROGRESS) {
            struct pollfd p = { .fd = fd, .events = POLLOUT };
            int pr = poll(&p, 1, 8000);
            int soerr = 0;
            socklen_t slen = sizeof(soerr);
            getsockopt(fd, SOL_SOCKET, SO_ERROR, &soerr, &slen);
            if (pr == 0 || soerr) {
                fprintf(stderr, "konek ke %s belum berhasil (%s)\n", addr_str,
                        pr == 0 ? "timeout" : strerror(soerr));
                close(fd);
                fd = -1;
                continue;
            }
        }
        fcntl(fd, F_SETFL, fl);
        struct timeval tv = { .tv_sec = 3, .tv_usec = 0 };
        setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    }
    if (fd < 0) {
        fprintf(stderr, "Timeout konek ke %s — pastikan printer nyala, tidak dipegang HP, lalu coba lagi.\n", addr_str);
        return 3;
    }
    fprintf(stderr, "LE connect OK -> %s\n", addr_str);

    /* 3. Exchange MTU (minta 517; kalau tidak dijawab, pakai 23) */
    int mtu = 23;
    {
        unsigned char req[3] = { 0x02, 0x05, 0x02 }; /* MTU=0x0205 */
        unsigned char rsp[64];
        if (write(fd, req, 3) == 3) {
            int n = (int)read(fd, rsp, sizeof(rsp));
            if (n >= 3 && rsp[0] == 0x03)
                mtu = rsp[1] | (rsp[2] << 8);
        }
        if (mtu < 23) mtu = 23;
        fprintf(stderr, "ATT MTU: %d\n", mtu);
    }

    /* 4. Discovery service (Read By Group Type, 0x10) */
    svc_t svcs[MAX_SVC];
    int nsvc = 0;
    unsigned short start = 0x0001;
    while (start <= 0xFFFF && nsvc < MAX_SVC) {
        unsigned char req[5] = { 0x10, start & 0xFF, start >> 8, 0xFF, 0xFF };
        if (write(fd, req, 5) != 5) die("kirim ATT");
        unsigned char rsp[256];
        int n = (int)read(fd, rsp, sizeof(rsp));
        if (n <= 0) break;
        if (rsp[0] == 0x01) break;               /* error: selesai / tidak ada */
        if (rsp[0] != 0x11) break;               /* respons tak terduga */
        int ilen = rsp[1];
        if (ilen < 6) break;
        int count = (n - 2) / ilen;
        for (int i = 0; i < count && nsvc < MAX_SVC; i++) {
            const unsigned char *it = rsp + 2 + i * ilen;
            svcs[nsvc].start = it[0] | (it[1] << 8);
            svcs[nsvc].end   = it[2] | (it[3] << 8);
            svcs[nsvc].uuid_len = ilen - 4;
            memcpy(svcs[nsvc].uuid, it + 4, ilen - 4);
            start = svcs[nsvc].end + 1;
            nsvc++;
        }
        if (count <= 0) break;
    }
    fprintf(stderr, "Service ditemukan: %d\n", nsvc);

    /* Prioritas: service printer yang dikenal dulu */
    const unsigned char LE_E7810A71[16] = { 0xf2,0xc3,0xf0,0xae,0xa9,0xfa,0x15,0x8c,0x9d,0x49,0xae,0x73,0x71,0x0a,0x81,0xe7 };
    const unsigned char LE_49535343[16] = { 0x55,0xe4,0x05,0xd2,0xaf,0x9f,0xa9,0x8f,0xe5,0x4a,0x7d,0xfe,0x43,0x53,0x53,0x49 };
    static const unsigned short KNOWN16[] = { 0x18F0, 0xFF00, 0xFFE0, 0xFFF0, 0x1800 };

    /* 5. Cari karakteristik write (Read By Type 0x08, type 0x2803) */
    int wfd = -1;            /* value handle */
    unsigned char wprops = 0;
    unsigned short range_order[MAX_SVC + 1][2];
    int nranges = 0;
    /* urutan: service dikenal dulu, lalu sisanya, lalu full-range fallback */
    for (int pass = 0; pass < 3 && wfd < 0; pass++) {
        for (int s = 0; s < nsvc && wfd < 0; s++) {
            int known = 0;
            if (svcs[s].uuid_len == 2) {
                unsigned short v = svcs[s].uuid[0] | (svcs[s].uuid[1] << 8);
                for (unsigned long k = 0; k < sizeof(KNOWN16)/sizeof(KNOWN16[0]); k++)
                    if (v == KNOWN16[k]) known = 1;
            } else {
                if (uuid_is(svcs[s].uuid, 16, LE_E7810A71, 16) ||
                    uuid_is(svcs[s].uuid, 16, LE_49535343, 16)) known = 1;
            }
            if ((pass == 0 && !known) || (pass == 1 && known)) continue;
            if (pass == 2) break; /* full-range ditangani di bawah */
            range_order[nranges][0] = svcs[s].start;
            range_order[nranges][1] = svcs[s].end;
            nranges++;
        }
        if (pass == 1) {
            range_order[nranges][0] = 0x0001;
            range_order[nranges][1] = 0xFFFF;
            nranges++;
        }
        for (int r = 0; r < nranges && wfd < 0; r++) {
            unsigned short s = range_order[r][0], e = range_order[r][1];
            while (s <= e && wfd < 0) {
                unsigned char req[7] = { 0x08, s & 0xFF, s >> 8, e & 0xFF, e >> 8, 0x03, 0x28 };
                if (write(fd, req, 7) != 7) die("kirim ATT");
                unsigned char rsp[256];
                int n = (int)read(fd, rsp, sizeof(rsp));
                if (n <= 0) break;
                if (rsp[0] == 0x01) break; /* error / tidak ada lagi */
                if (rsp[0] != 0x09) break;
                int ilen = rsp[1];
                if (ilen < 7) break;
                int count = (n - 2) / ilen;
                for (int i = 0; i < count && wfd < 0; i++) {
                    const unsigned char *it = rsp + 2 + i * ilen;
                    unsigned char props = it[2];
                    unsigned short vh = it[3] | (it[4] << 8);
                    if (props & 0x08) { wfd = vh; wprops = props; }        /* write w/ rsp  */
                    else if (props & 0x04 && wfd < 0) { wfd = vh; wprops = props; } /* w/o rsp */
                    s = (it[0] | (it[1] << 8)) + 1;
                }
                if (count <= 0) break;
            }
        }
        if (pass == 0 && wfd < 0) nranges = 0; /* reset utk pass 1 */
    }

    if (wfd < 0) {
        fprintf(stderr, "Karakteristik write tidak ditemukan (printer tidak mode cetak?)\n");
        return 4;
    }
    fprintf(stderr, "Write char handle 0x%04x (props 0x%02x)\n", wfd, wprops);

    /* 6. Tulis data per chunk */
    int chunk = mtu - 3;
    if (chunk > 244) chunk = 244;
    if (chunk < 20) chunk = 20;
    int use_cmd = (wprops & 0x04) != 0; /* write tanpa respons bila tersedia */
    for (size_t off = 0; off < dlen; off += (size_t)chunk) {
        size_t clen = dlen - off;
        if (clen > (size_t)chunk) clen = (size_t)chunk;
        unsigned char pdu[3 + 512];
        size_t plen = 0;
        if (use_cmd) {
            pdu[0] = 0x52; /* Write Command */
            pdu[1] = wfd & 0xFF; pdu[2] = wfd >> 8;
            memcpy(pdu + 3, data + off, clen);
            plen = 3 + clen;
            if (write(fd, pdu, plen) != (ssize_t)plen) die("tulis ATT");
        } else {
            pdu[0] = 0x12; /* Write Request */
            pdu[1] = wfd & 0xFF; pdu[2] = wfd >> 8;
            memcpy(pdu + 3, data + off, clen);
            plen = 3 + clen;
            if (write(fd, pdu, plen) != (ssize_t)plen) die("tulis ATT");
            unsigned char rsp[64];
            int n = (int)read(fd, rsp, sizeof(rsp));
            if (n > 0 && rsp[0] == 0x01) {
                /* printer menolak write-request -> pakai write-command */
                use_cmd = 1;
                pdu[0] = 0x52;
                if (write(fd, pdu, plen) != (ssize_t)plen) die("tulis ATT");
            }
        }
        usleep(25000); /* jaga buffer printer 58mm */
    }

    close(fd);
    fprintf(stderr, "OK: %zu byte terkirim ke %s\n", dlen, addr_str);
    free(data);
    return 0;
}
