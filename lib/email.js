import "server-only";
import nodemailer from "nodemailer";
import { buildCsv, buildXlsx, exportFilename } from "./export";

// Sends the backup from an ordinary email account (SMTP) to the client's inbox.
// No custom address or domain — just a mailbox that already exists.
export async function sendBackupEmail(animals) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;
  const to = process.env.CLIENT_EMAIL;
  if (!host || !user || !pass || !to) {
    throw new Error("Brak konfiguracji e-mail (SMTP_HOST / SMTP_USER / SMTP_PASS / CLIENT_EMAIL).");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
  });

  const csv = buildCsv(animals);
  const xlsx = buildXlsx(animals);
  const count = animals.length;
  const today = new Date().toLocaleDateString("pl-PL");

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
      <div style="background:#0d9488;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
        <h1 style="margin:0;font-size:18px">Kopia zapasowa rejestru zwierząt</h1>
      </div>
      <div style="border:1px solid #e7e5e4;border-top:none;padding:24px;border-radius:0 0 14px 14px">
        <p style="margin:0 0 12px">Dzień dobry,</p>
        <p style="margin:0 0 12px">
          W załączniku znajdują się aktualne dane z rejestru zwierząt
          (<strong>${count}</strong> ${count === 1 ? "wpis" : "wpisów"}) na dzień <strong>${today}</strong>,
          w formacie <strong>CSV</strong> oraz <strong>Excel (XLSX)</strong>.
        </p>
        <p style="margin:0 0 12px">
          Prosimy zapisać te pliki w bezpiecznym miejscu. To Państwa kopia zapasowa —
          nawet w razie awarii nic nie przepadnie.
        </p>
        <p style="margin:0 0 4px">
          Po zapisaniu można zalogować się do aplikacji i potwierdzić kopię w Ustawieniach,
          aby wyłączyć przypomnienie.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#78716c">
          Wiadomość wygenerowana automatycznie co 5 dni.
        </p>
      </div>
    </div>`;

  return transporter.sendMail({
    from,
    to,
    subject: `Kopia zapasowa rejestru zwierząt – ${today}`,
    html,
    attachments: [
      { filename: exportFilename("csv"), content: Buffer.from(csv, "utf-8") },
      { filename: exportFilename("xlsx"), content: xlsx },
    ],
  });
}
