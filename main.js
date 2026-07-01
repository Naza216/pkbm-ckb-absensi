// =========================================================================
// !!! PENTING: GANTI ID DI BAWAH INI DENGAN ID GOOGLE SHEETS PKBM KAMU !!!
// =========================================================================
var SPREADSHEET_ID = "1OVKTjAyKCCTYxD_jxA9RUDyX_yIl6K36gieuqvS9_5E";

function doPost(e) {
  try {
    var jsonObject = {};
    
    // 🧠 KECERDASAN BUATAN BACKEND: Deteksi otomatis format pengiriman data dari HTML
    if (e.postData && e.postData.contents) {
      try {
        jsonObject = JSON.parse(e.postData.contents);
      } catch (err) {
        jsonObject = e.parameter;
      }
    } else {
      jsonObject = e.parameter;
    }

    var action = jsonObject.action || jsonObject.getParam; 
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // =========================================================================
    // 🔑 1. AKSI GLOBAL: LOGIN (Siswa, Guru, Admin)
    // =========================================================================
    if (action == "login") {
      var userSheet = sheet.getSheetByName("User");
      var data = userSheet.getDataRange().getValues();
      var usernameInput = jsonObject.username ? jsonObject.username.toString().trim().toLowerCase() : "";
      var passwordInput = jsonObject.password ? jsonObject.password.toString() : "";
      
      for (var i = 1; i < data.length; i++) {
        var dbUsername = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
        var dbPassword = data[i][2] ? data[i][2].toString() : "";
        
        if (dbUsername == usernameInput && dbPassword == passwordInput) {
          return balasJSON({
            status: "success",
            user: {
              id_user: data[i][0],
              nama_lengkap: data[i][3],
              role: data[i][4].toString().toLowerCase().trim(), 
              kelas: data[i][5] || "-" 
            }
          });
        }
      }
      return balasJSON({ status: "failed", message: "Username atau Password salah!" });
    }

    // =========================================================================
    // 📝 AKSI GLOBAL: REGISTRASI SISWA BARU
    // =========================================================================
    if (action == "registerSiswa") {
      var userSheet = sheet.getSheetByName("User");
      var data = userSheet.getDataRange().getValues();
      var usernameInput = jsonObject.username.toString().trim().toLowerCase();
      var passwordInput = jsonObject.password;
      var namaLengkapInput = jsonObject.nama_lengkap;
      var kelasInput = jsonObject.kelas || "-";
      
      if (usernameInput.includes("admin") || usernameInput.includes("guru") || usernameInput.includes("tutor")) {
        return balasJSON({ status: "failed", message: "Gagal! Username tidak boleh mengandung kata kunci staf internal." });
      }
      
      for (var i = 1; i < data.length; i++) {
        if (data[i][1].toString().trim().toLowerCase() == usernameInput) {
          return balasJSON({ status: "failed", message: "Username / NISN sudah terdaftar di sistem!" });
        }
      }
      
      var idSiswa = "SSW-" + new Date().getTime().toString().slice(-6);
      
      userSheet.appendRow([
        idSiswa,
        usernameInput,
        passwordInput,
        namaLengkapInput,
        "siswa", 
        kelasInput
      ]);
      
      return balasJSON({ status: "success", message: "Akun berhasil dibuat! Silakan masuk menggunakan Username Anda." });
    }
    
    // =========================================================================
    // 👨‍🏫 2. AKSI ROLE GURU: JADWAL, AGENDA, & MONITOR REAL-TIME
    // =========================================================================
    if (action == "bukaAgenda" || action == "bukaSesiMengajar") {
      var agendaSheet = sheet.getSheetByName("Agenda");
      var idAgenda = "AGD-" + new Date().getTime();
      var tanggal = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
      var waktuBuka = new Date();
      var waktuKunci = new Date(waktuBuka.getTime() + 30 * 60000); // Masa aktif QR: 30 Menit
      var tipeSesi = jsonObject.tipe_sesi || "KBM"; 
      
      agendaSheet.appendRow([
        idAgenda, 
        tanggal, 
        jsonObject.id_guru || "-", 
        jsonObject.kelas || "-", 
        jsonObject.mata_pelajaran || "-", 
        jsonObject.materi || "Materi Kelas", 
        jsonObject.keterangan || jsonObject.catatan || "-",
        Utilities.formatDate(waktuBuka, "Asia/Jakarta", "HH:mm"), 
        Utilities.formatDate(waktuKunci, "Asia/Jakarta", "HH:mm"),
        tipeSesi 
      ]);
      
      return balasJSON({ 
        status: "success", 
        id_agenda: idAgenda, 
        waktu_kunci: Utilities.formatDate(waktuKunci, "Asia/Jakarta", "HH:mm"),
        message: "Sesi presensi " + tipeSesi + " berhasil dibuka!"
      });
    }

    if (action == "getMonitorKehadiran" || action == "monitorKehadiran") {
      var idAgendaInput = jsonObject.id_agenda;
      var agendaData = sheet.getSheetByName("Agenda").getDataRange().getValues();
      var targetKelas = "";
      
      for (var i = 1; i < agendaData.length; i++) {
        if (agendaData[i][0] == idAgendaInput) {
          targetKelas = agendaData[i][3].toString().toLowerCase().trim();
          break;
        }
      }
      
      var absensiData = sheet.getSheetByName("Absensi").getDataRange().getValues();
      var userData = sheet.getSheetByName("User").getDataRange().getValues();
      
      var siswaSudahScan = [];
      for (var i = 1; i < absensiData.length; i++) {
        if (absensiData[i][1] == idAgendaInput && absensiData[i][4] == "Hadir") { 
          siswaSudahScan.push(absensiData[i][2]); 
        }
      }
      
      var semuaSiswa = [];
      for (var j = 1; j < userData.length; j++) {
        if (userData[j][4] == "siswa") {
          var kelasUser = userData[j][5].toString().toLowerCase().trim();
          if (kelasUser == targetKelas) {
            var statusPresensi = (siswaSudahScan.indexOf(userData[j][0]) !== -1) ? "HADIR" : "BELUM ABSEN";
            semuaSiswa.push({ 
              nama_lengkap: userData[j][3], 
              kelas: userData[j][5], 
              status: statusPresensi 
            });
          }
        }
      }
      return balasJSON({ status: "success", data: semuaSiswa });
    }

    if (action == "cekJadwalGuru") {
      var idGuru = jsonObject.id_guru;
      var dataJadwal = sheet.getSheetByName("Jadwal_Pelajaran").getDataRange().getValues();
      var sekarang = new Date();
      var hariIni = getHariIndonesia(sekarang);
      var jamSekarang = Utilities.formatDate(sekarang, "Asia/Jakarta", "HH:mm");
      
      var jadwalAktif = [];
      for (var i = 1; i < dataJadwal.length; i++) {
        if (dataJadwal[i][4] == idGuru && dataJadwal[i][1] == hariIni && jamSekarang >= dataJadwal[i][2] && jamSekarang <= dataJadwal[i][3]) {
          jadwalAktif.push({
            id_jadwal: dataJadwal[i][0], kelas: dataJadwal[i][5], mata_pelajaran: dataJadwal[i][6], jam_mulai: dataJadwal[i][2], jam_selesai: dataJadwal[i][3]
          });
        }
      }
      return balasJSON({ status: "success", data: jadwalAktif });
    }

    if (action == "tutupAbsen") {
      var idAgendaInput = jsonObject.id_agenda;
      var kelasInput = jsonObject.kelas.toString().toLowerCase().trim();
      
      var absensiSheet = sheet.getSheetByName("Absensi");
      var absensiData = absensiSheet.getDataRange().getValues();
      var userData = sheet.getSheetByName("User").getDataRange().getValues();
      
      var siswaSudahScan = [];
      for (var i = 1; i < absensiData.length; i++) {
        if (absensiData[i][1] == idAgendaInput) { siswaSudahScan.push(absensiData[i][2]); }
      }
      
      var sekarang = new Date();
      var tanggalStr = Utilities.formatDate(sekarang, "Asia/Jakarta", "yyyy-MM-dd HH:mm");
      var jumlahSiswaAlfa = 0;
      
      for (var j = 1; j < userData.length; j++) {
        if (userData[j][4] == "siswa") {
          var kelasUser = userData[j][5].toString().toLowerCase().trim();
          if (kelasUser == kelasInput && siswaSudahScan.indexOf(userData[j][0]) === -1) {
            var idAbsen = "ABS-" + (sekarang.getTime() + j);
            absensiSheet.appendRow([idAbsen, idAgendaInput, userData[j][0], tanggalStr, "Tidak Hadir", "Sistem", "Sesi Ditutup Guru"]);
            jumlahSiswaAlfa++;
          }
        }
      }
      return balasJSON({ status: "success", message: "Sesi ditutup! " + jumlahSiswaAlfa + " siswa otomatis diset Tidak Hadir (Alfa)." });
    }
    
    if (action == "getJadwalGuru") {
      var idGuruInput = jsonObject.id_guru.toString().trim();
      var jadwalSheet = sheet.getSheetByName("Jadwal_Pelajaran") || sheet.getSheetByName("Jadwal");
      
      if (!jadwalSheet) {
        return balasJSON({ status: "error", message: "Sheet 'Jadwal_Pelajaran' belum dibuat oleh Admin!" });
      }
      
      var dataJadwal = jadwalSheet.getDataRange().getValues();
      var listJadwal = [];
      
      for (var i = 1; i < dataJadwal.length; i++) {
        var idGuruSheet = dataJadwal[i][4] ? dataJadwal[i][4].toString().trim() : "";
        if (idGuruSheet == idGuruInput) {
          listJadwal.push({
            id_jadwal: dataJadwal[i][0],
            hari: dataJadwal[i][1],
            jam_mengajar: dataJadwal[i][2] + " - " + dataJadwal[i][3],
            kelas: dataJadwal[i][5],
            mata_pelajaran: dataJadwal[i][6]
          });
        }
      }
      return balasJSON({ status: "success", data: listJadwal });
    }

    // =========================================================================
    // 🧑‍🎓 3. AKSI ROLE SISWA: SCAN QR (SISTEM PROTEKSI LENGKAP)
    // =========================================================================
    if (action == "scanAbsen") {
      var idAgendaInput = jsonObject.id_agenda;
      var idSiswaInput = jsonObject.id_siswa;
      
      var agendaSheet = sheet.getSheetByName("Agenda");
      var dataAgenda = agendaSheet.getDataRange().getValues();
      
      var agendaDitemukan = false; 
      var jamKunciStr = ""; 
      var kelasAgenda = ""; 
      var tipeSesi = "KBM";
      
      for (var i = 1; i < dataAgenda.length; i++) {
        if (dataAgenda[i][0] == idAgendaInput) {
          agendaDitemukan = true; 
          kelasAgenda = dataAgenda[i][3].toString().toLowerCase().trim(); 
          jamKunciStr = dataAgenda[i][8]; 
          tipeSesi = dataAgenda[i][9] || "KBM"; 
          break;
        }
      }
      
      if (!agendaDitemukan) return balasJSON({ status: "failed", message: "QR Code tidak valid!" });
      
      // ⏱️ Proteksi Waktu Kunci
      var sekarang = new Date();
      var jamSekarangStr = Utilities.formatDate(sekarang, "Asia/Jakarta", "HH:mm");
      if (jamSekarangStr > jamKunciStr) return balasJSON({ status: "failed", message: "Gagal! Sesi absen sudah dikunci." });
      
      // 👤 Ambil Data Profil Kelas Siswa yang Sedang Scan
      var userSheet = sheet.getSheetByName("User");
      var dataUser = userSheet.getDataRange().getValues();
      var kelasSiswa = "";
      
      for (var j = 1; j < dataUser.length; j++) {
        if (dataUser[j][0] == idSiswaInput) {
          kelasSiswa = dataUser[j][5].toString().toLowerCase().trim(); 
          break;
        }
      }
      
      // 🛑 VALIDASI KELAS
      if (kelasSiswa !== kelasAgenda) {
        return balasJSON({ 
          status: "failed", 
          message: "Akses Ditolak! Anda terdaftar di kelas [" + kelasSiswa.toUpperCase() + "], tidak bisa mengisi absensi untuk kelas " + kelasAgenda.toUpperCase() + "." 
        });
      }
      
      // 🛑 PROTEKSI DOUBLE ABSENSI (Hanya Bisa Sekali Saja Per Sesi Pertemuan)
      var absensiSheet = sheet.getSheetByName("Absensi");
      var dataAbsen = absensiSheet.getDataRange().getValues();
      for (var k = 1; k < dataAbsen.length; k++) {
        if (dataAbsen[k][1] == idAgendaInput && dataAbsen[k][2] == idSiswaInput) {
          return balasJSON({ status: "failed", message: "Anda sudah melakukan presensi pada sesi kelas ini hari ini! Akses ditolak." });
        }
      }
      
      // 📉 HITUNG PERSENTASE KEHADIRAN UNTUK PROTEKSI UTS / UAS
      var totalSesiKBM = 0;
      var totalHadirSiswa = 0;
      
      for (var m = 1; m < dataAgenda.length; m++) {
        if (dataAgenda[m][3].toString().toLowerCase().trim() == kelasSiswa && (dataAgenda[m][9] == "KBM" || !dataAgenda[m][9])) {
          totalSesiKBM++;
        }
      }
      
      for (var n = 1; n < dataAbsen.length; n++) {
        if (dataAbsen[n][2] == idSiswaInput && dataAbsen[n][4] == "Hadir") {
          totalHadirSiswa++;
        }
      }
      
      var rasioKehadiran = totalSesiKBM > 0 ? (totalHadirSiswa / totalSesiKBM) * 100 : 100;
      
      // 🛑 VALIDASI UTAMA UTS/UAS: Minimal Kehadiran 80%
      if (tipeSesi === "UTS" || tipeSesi === "UAS") {
        if (rasioKehadiran < 80) {
          return balasJSON({
            status: "failed",
            message: "Akses Ujian Terkunci! Kehadiran KBM harian Anda baru mencapai " + rasioKehadiran.toFixed(1) + "%. Syarat mutlak mengikuti " + tipeSesi + " minimal harus 80%."
          });
        }
      }
      
      // 💾 JIKA LOLOS VALIDASI, SIMPAN KE SHEET ABSENSI
      var idAbsen = "ABS-" + sekarang.getTime();
      var tanggalStr = Utilities.formatDate(sekarang, "Asia/Jakarta", "yyyy-MM-dd HH:mm");
      absensiSheet.appendRow([idAbsen, idAgendaInput, idSiswaInput, tanggalStr, "Hadir", "-", "-"]);
      
      return balasJSON({ 
        status: "success", 
        message: "Absensi Berhasil! Anda tercatat HADIR pada sesi " + tipeSesi + ". (Akumulasi kehadiran Anda: " + rasioKehadiran.toFixed(1) + "%)" 
      });
    }

    // 🌟 PERBAIKAN TOTAL: VALIDASI AMBIL DATA DASHBOARD & RIWAYAT SEKALIGUS
    if (action == "getSiswaDashboard") {
      var kelasSiswa = jsonObject.kelas.toString().toLowerCase().trim();
      var idSiswaInput = jsonObject.id_siswa ? jsonObject.id_siswa.toString().trim() : "";
      
      var sheetUjian = sheet.getSheetByName("Ujian");
      var sheetAgenda = sheet.getSheetByName("Agenda");
      var sheetAbsensi = sheet.getSheetByName("Absensi");
      
      var listUjian = []; 
      var listAgenda = [];
      var riwayatAbsen = [];
      
      // --- Olah Array Info Ujian ---
      if (sheetUjian) {
        var dataUjian = sheetUjian.getDataRange().getValues();
        for (var i = 1; i < dataUjian.length; i++) {
          if (dataUjian[i][1].toString().toLowerCase().trim() == kelasSiswa) {
            listUjian.push({ id_ujian: dataUjian[i][0], jenis_ujian: dataUjian[i][2], mata_pelajaran: dataUjian[i][3], tanggal: dataUjian[i][4], jam: dataUjian[i][5] });
          }
        }
      }

      // Map Agenda untuk mempermudah pencarian info detail mata pelajaran pada Log Absensi
      var mapAgenda = {};
      if (sheetAgenda) {
        var dataAgenda = sheetAgenda.getDataRange().getValues();
        for (var j = 1; j < dataAgenda.length; j++) {
          var currentKelas = dataAgenda[j][3].toString().toLowerCase().trim();
          if (currentKelas == kelasSiswa) {
            listAgenda.push({ id_agenda: dataAgenda[j][0], tanggal: dataAgenda[j][1], mata_pelajaran: dataAgenda[j][4], materi: dataAgenda[j][5], keterangan: dataAgenda[j][6] });
          }
          // Simpan ke map referensi
          mapAgenda[dataAgenda[j][0]] = {
            mapel: dataAgenda[j][4],
            materi: dataAgenda[j][5]
          };
        }
      }

      // --- SINKRONISASI DATA RIWAYAT PRESENSI SISWA ---
      if (sheetAbsensi && idSiswaInput !== "") {
        var dataAbsen = sheetAbsensi.getDataRange().getValues();
        for (var k = 1; k < dataAbsen.length; k++) {
          var dbIdSiswa = dataAbsen[k][2] ? dataAbsen[k][2].toString().trim() : "";
          var dbIdAgenda = dataAbsen[k][1] ? dataAbsen[k][1].toString().trim() : "";
          var dbStatus = dataAbsen[k][4] ? dataAbsen[k][4].toString().trim() : "";

          // Filter log absensi khusus milik ID Siswa yang sedang login
          if (dbIdSiswa === idSiswaInput) {
            var infoMateri = mapAgenda[dbIdAgenda] || { mapel: "Mata Pelajaran", materi: "Sesi Pertemuan" };
            riwayatAbsen.push({
              mata_pelajaran: infoMateri.mapel,
              materi: infoMateri.materi,
              status: dbStatus.toUpperCase(),
              waktu_absen: dataAbsen[k][3] ? dataAbsen[k][3].toString() : "-"
            });
          }
        }
      }

      return balasJSON({ 
        status: "success", 
        ujian: listUjian, 
        agenda: listAgenda,
        riwayat_absen: riwayatAbsen // Berhasil dikirim ke komponen interface frontend siswa
      });
    }

    // Gantilah dengan ID Folder "BUKTI_IZIN_SISWA" yang ada di Google Drive Anda
      const FOLDER_BUKTI_ID = "1kaErrOFLICG58y6MjUsTk9wU15ee_Ra1"; 

      function doPost(e) {
        // Atur CORS agar Web App dapat diakses secara fleksibel oleh frontend
        const output = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
        
        try {
          const requestData = JSON.parse(e.postData.contents);
          const action = requestData.action;
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const sheetKeringanan = ss.getSheetByName("Keringanan");

          // ==========================================
          // A. LINGKUNGAN PENGGUNA: DASHBOARD SISWA
          // ==========================================
          
          // 1. Logika Dashboard Utama Siswa
          if (action === 'getSiswaDashboard') {
            return output.setContent(JSON.stringify(muatDataDashboard(requestData)));
          }

          // 2. Proses Simpan Pengajuan Keringanan + Upload File Otomatis ke Drive
          if (action === 'ajukanKeringanan') {
            const idSiswa = requestData.id_siswa;
            const alasan = requestData.alasan;
            const fileBase64 = requestData.bukti_foto; 
            const namaFileAsli = requestData.nama_file || "bukti.jpg";
            const idAgenda = requestData.id_agenda || "-"; 

            let urlFileDrive = "-";

            if (!sheetKeringanan) {
              return output.setContent(JSON.stringify({ 
                status: "error", 
                message: "Sheet dengan nama 'Keringanan' tidak ditemukan di database!" 
              }));
            }

            // Proses konversi dan unggah Base64 ke folder Google Drive
            if (fileBase64 && fileBase64.includes("base64,")) {
              const splitData = fileBase64.split("base64,");
              const contentType = splitData[0].split(":")[1].split(";")[0]; 
              const rincianByte = Utilities.base64Decode(splitData[1]);
              
              // Format Nama Berkas: KRN_[ID_SISWA]_[NAMA_ASLI]
              const blobBerkas = Utilities.newBlob(rincianByte, contentType, "KRN_" + idSiswa + "_" + namaFileAsli);
              
              const folder = DriveApp.getFolderById(FOLDER_BUKTI_ID);
              const fileTerupload = folder.createFile(blobBerkas);
              
              // Buka akses tautan gambar secara publik agar bisa dionton langsung dari spreadsheet
              fileTerupload.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              urlFileDrive = fileTerupload.getUrl();
            }

            // Membuat ID Keringanan Urik otomatis
            const lastRow = sheetKeringanan.getLastRow();
            const nextNumber = lastRow === 1 ? 1001 : lastRow + 1000;
            const idKeringanan = "KRN-" + nextNumber;
            const statusPengajuan = "Pending"; 

            // Susun baris baru (A: id_keringanan | B: id_agenda | C: id_siswa | D: alasan | E: bukti_foto | F: status_pengajuan)
            sheetKeringanan.appendRow([
              idKeringanan,    
              idAgenda,        
              idSiswa,          
              alasan,           
              urlFileDrive,     
              statusPengajuan   
            ]);

            return output.setContent(JSON.stringify({
              status: "success",
              message: "Sukses! Pengajuan keringanan absensi telah tercatat dengan ID: " + idKeringanan
            }));
          }

          // ==========================================
          // B. LINGKUNGAN PENGGUNA: DASHBOARD ADMIN
          // ==========================================

          // 3. Ambil Rekap Absensi Siswa
          if (action === "getRekapAdmin") {
            const sheetAbsen = ss.getSheetByName("Absensi"); // Sesuaikan nama sheet absensi Anda
            if (!sheetAbsen) return output.setContent(JSON.stringify({ status: "success", data: [] }));
            
            const data = sheetAbsen.getDataRange().getValues();
            const listRekap = [];
            for (let i = 1; i < data.length; i++) {
              listRekap.push({ id: data[i][0], nama: data[i][1], kelas: data[i][2], hadir: data[i][3], alfa: data[i][4], persen: data[i][5] });
            }
            return output.setContent(JSON.stringify({ status: "success", data: listRekap }));
          }

          // 4. Audit Catatan Jurnal Mengajar Guru
          if (action === "getJurnalGuruAdmin") {
            const sheetJurnal = ss.getSheetByName("jadwal"); // Sesuaikan nama sheet aktivitas guru Anda
            if (!sheetJurnal) return output.setContent(JSON.stringify({ status: "success", data: [] }));
            
            const data = sheetJurnal.getDataRange().getValues();
            const listJurnal = [];
            for (let i = 1; i < data.length; i++) {
              listJurnal.push({ tanggal: data[i][0], nama_guru: data[i][1], mata_pelajaran: data[i][2], kelas: data[i][3], materi: data[i][4], jam_buka: data[i][5], jam_kunci: data[i][6], keterangan: data[i][7] });
            }
            return output.setContent(JSON.stringify({ status: "success", data: listJurnal }));
          }

          // 5. Tambah Jadwal Pelajaran Baru
          if (action === "tambahJadwalPelajaran") {
            const sheetJadwal = ss.getSheetByName("Jadwal_Pelajaran");
            if (!sheetJadwal) return output.setContent(JSON.stringify({ status: "error", message: "Sheet Jadwal tidak ditemukan!" }));
            
            sheetJadwal.appendRow([requestData.hari, requestData.kelas, requestData.mata_pelajaran, requestData.id_guru, requestData.jam_mulai, requestData.jam_selesai]);
            return output.setContent(JSON.stringify({ status: "success", message: "Jadwal harian resmi berhasil didaftarkan!" }));
          }

          // 6. Terbitkan Jadwal Ujian Resmi
          if (action === "tambahJadwalUjian") {
            const sheetUjian = ss.getSheetByName("Ujian");
            if (!sheetUjian) return output.setContent(JSON.stringify({ status: "error", message: "Sheet Ujian tidak ditemukan!" }));
            
            sheetUjian.appendRow([requestData.kelas, requestData.jenis_ujian, requestData.mata_pelajaran, requestData.tanggal, requestData.jam]);
            return output.setContent(JSON.stringify({ status: "success", message: "Jadwal ujian berhasil dirilis secara resmi!" }));
          }

          // 7. Ambil Berkas Keringanan untuk Diverifikasi Admin
          if (action === "getKeringananAdmin") {
            if (!sheetKeringanan) return output.setContent(JSON.stringify({ status: "success", data: [] }));
            
            const data = sheetKeringanan.getDataRange().getValues();
            const listKeringanan = [];
            for (let i = 1; i < data.length; i++) {
              listKeringanan.push({ id: data[i][0], id_agenda: data[i][1], id_siswa: data[i][2], alasan: data[i][3], bukti: data[i][4], status: data[i][5] });
            }
            return output.setContent(JSON.stringify({ status: "success", data: listKeringanan }));
          }

          // 8. Otoritas Validasi Status Berkas (Terima / Tolak) oleh Admin
          if (action === "ubahStatusKeringanan") {
            if (!sheetKeringanan) return output.setContent(JSON.stringify({ status: "error", message: "Gagal memproses perubahan data." }));
            
            const idTarget = requestData.id_keringanan;
            const statusBaru = requestData.status_baru;
            const data = sheetKeringanan.getDataRange().getValues();
            let ditemukan = false;
            
            for (let i = 1; i < data.length; i++) {
              if (data[i][0] == idTarget) {
                sheetKeringanan.getRange(i + 1, 6).setValue(statusBaru); // Kolom F adalah ke-6
                ditemukan = true;
                break;
              }
            }
            
            if (ditemukan) {
              return output.setContent(JSON.stringify({ status: "success", message: "Verifikasi berhasil. Berkas " + idTarget + " sekarang bernilai: " + statusBaru }));
            } else {
              return output.setContent(JSON.stringify({ status: "error", message: "ID Berkas pengajuan tidak ditemukan." }));
            }
          }

          // Jika parameter aksi tidak memenuhi kondisi di atas
          return output.setContent(JSON.stringify({ status: "error", message: "Aksi '" + action + "' tidak dikenali oleh sistem backend!" }));

        } catch (error) {
          return output.setContent(JSON.stringify({ status: "error", message: error.toString() }));
        }
      }

      // Fungsi pembantu informasi dashboard siswa Anda
      function muatDataDashboard(data) {
        return { status: "success", ujian: [], agenda: [], riwayat_absen: [] };
      }
    // =========================================================================
    // 🛠️ 4. AKSI ROLE ADMIN
    // =========================================================================
    if (action == "tambahJadwalPelajaran") {
      var jadwalSheet = sheet.getSheetByName("Jadwal_Pelajaran");
      var idJadwal = "JDW-" + new Date().getTime();
      
      jadwalSheet.appendRow([
        idJadwal, jsonObject.hari, jsonObject.jam_mulai, jsonObject.jam_selesai, jsonObject.id_guru, jsonObject.kelas, jsonObject.mata_pelajaran
      ]);
      return balasJSON({ status: "success", message: "Jadwal Pelajaran baru berhasil diterbitkan oleh Admin!" });
    }

    if (action == "tambahJadwalUjian") {
      var ujianSheet = sheet.getSheetByName("Ujian");
      var idUjian = "UJN-" + new Date().getTime();
      
      ujianSheet.appendRow([
        idUjian, jsonObject.kelas, jsonObject.jenis_ujian, jsonObject.mata_pelajaran, jsonObject.tanggal, jsonObject.jam
      ]);
      return balasJSON({ status: "success", message: "Jadwal Ujian Berhasil Diterbitkan Admin!" });
    }

    if (action == "getJurnalGuruAdmin") {
      var agendaData = sheet.getSheetByName("Agenda").getDataRange().getValues();
      var userData = sheet.getSheetByName("User").getDataRange().getValues();
      
      var mapNamaGuru = {};
      for (var i = 1; i < userData.length; i++) {
        if (userData[i][4] == "guru") { mapNamaGuru[userData[i][0]] = userData[i][3]; }
      }
      
      var logJurnalGuru = [];
      for (var j = agendaData.length - 1; j >= 1; j--) {
        var idGuru = agendaData[j][2];
        var namaGuru = mapNamaGuru[idGuru] || "Guru ID: " + idGuru;
        
        logJurnalGuru.push({
          id_agenda: agendaData[j][0],
          tanggal: agendaData[j][1],
          nama_guru: namaGuru,
          kelas: agendaData[j][3],
          mata_pelajaran: agendaData[j][4],
          materi: agendaData[j][5],
          keterangan: agendaData[j][6],
          jam_buka: agendaData[j][7],
          jam_kunci: agendaData[j][8]
        });
      }
      return balasJSON({ status: "success", data: logJurnalGuru });
    }

    if (action == "getRekapAdmin") {
      var userData = sheet.getSheetByName("User").getDataRange().getValues();
      var absensiData = sheet.getSheetByName("Absensi").getDataRange().getValues();
      var rekapSiswa = [];

      for (var i = 1; i < userData.length; i++) {
        if (userData[i][4] == "siswa") {
          var idSiswa = userData[i][0];
          var namaSiswa = userData[i][3];
          var kelasSiswa = userData[i][5];
          
          var hadir = 0; var alfa = 0;
          for (var j = 1; j < absensiData.length; j++) {
            if (absensiData[j][2] == idSiswa) {
              if (absensiData[j][4] == "Hadir") hadir++;
              else if (absensiData[j][4] == "Tidak Hadir") alfa++;
            }
          }
          
          var totalPertemuan = hadir + alfa;
          var persentase = totalPertemuan > 0 ? Math.round((hadir / totalPertemuan) * 100) : 0;
          
          rekapSiswa.push({ id: idSiswa, nama: namaSiswa, kelas: kelasSiswa, hadir: hadir, alfa: alfa, persen: persentase + "%" });
        }
      }
      return balasJSON({ status: "success", data: rekapSiswa });
    }

    return balasJSON({ status: "failed", message: "Aksi '" + action + "' tidak dikenali oleh sistem backend!" });

  } catch (error) {
    return balasJSON({ status: "error", message: "Terjadi kesalahan internal: " + error.toString() });
  }
}

function balasJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getHariIndonesia(date) {
  var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[date.getDay()];
}