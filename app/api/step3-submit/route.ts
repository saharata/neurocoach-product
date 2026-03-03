import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { google } from "googleapis";

type Step3Body = {
  consultEmail: string;
  clinical: {
    problemRepresentation: string;
    history: any;
    exam: any;
  };
  ai: {
    discussion: any;
    coach: any;
    attending: any;
    ddxByCategory?: any;
  };
  ts: string;
};

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** รับค่า SHEET_ID ได้หลายรูปแบบ:
 * - "1abc..." (id ตรงๆ)
 * - "SHEET_ID=1abc..." (กันพลาด)
 * - มี quote ครอบ
 * - URL: https://docs.google.com/spreadsheets/d/1abc.../edit#gid=0
 */
function normalizeSheetId(input: string | undefined | null) {
  if (!input) return "";
  let s = String(input).trim();

  // กันคนเผลอใส่ "SHEET_ID=...."
  if (s.startsWith("SHEET_ID=")) s = s.slice("SHEET_ID=".length).trim();

  // ตัด quote ครอบทั้งก้อน
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    s = s.slice(1, -1).trim();
  }

  // ถ้าเป็น URL ดึง id ระหว่าง /d/ กับ /
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];

  return s;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Step3Body;

    const consultEmail = (body?.consultEmail || "").trim();
    if (!consultEmail) {
      return NextResponse.json(
        { error: "consultEmail is required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(consultEmail)) {
      return NextResponse.json(
        { error: "invalid consultEmail" },
        { status: 400 }
      );
    }

    const payload = {
      ts: body?.ts || new Date().toISOString(),
      consultEmail,
      clinical: body?.clinical || {
        problemRepresentation: "",
        history: {},
        exam: {},
      },
      ai: body?.ai || { discussion: null, coach: null, attending: null },
    };

    await sendEmail(payload);
    await appendToSheet(payload);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("STEP3 ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Step3 failed" },
      { status: 500 }
    );
  }
}

/* ================= EMAIL ================= */

async function sendEmail(payload: any) {
  const user = process.env.GMAIL_USER || "saharatau@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) throw new Error("Missing env: GMAIL_APP_PASSWORD");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const subjectTime = String(payload.ts).replace("T", " ").slice(0, 16);

  const html = `
    <h3>NIT Consult Summary</h3>
    <p><b>Timestamp:</b> ${escapeHtml(payload.ts)}</p>
    <p><b>Consultant email:</b> ${escapeHtml(payload.consultEmail)}</p>
    <hr/>
    <h4>Problem Representation</h4>
    <pre>${escapeHtml(payload.clinical?.problemRepresentation || "")}</pre>
    <h4>History (JSON)</h4>
    <pre>${escapeHtml(
      JSON.stringify(payload.clinical?.history ?? {}, null, 2)
    )}</pre>
    <h4>Exam (JSON)</h4>
    <pre>${escapeHtml(
      JSON.stringify(payload.clinical?.exam ?? {}, null, 2)
    )}</pre>
    <h4>AI Output (JSON)</h4>
    <pre>${escapeHtml(JSON.stringify(payload.ai ?? {}, null, 2))}</pre>
  `;

  await transporter.sendMail({
    from: `NIT OPD Coach <${user}>`,
    to: user,
    cc: payload.consultEmail,
    subject: `NIT Consult Summary (${subjectTime} UTC)`,
    html,
  });
}

/* ================= GOOGLE SHEET ================= */

async function appendToSheet(payload: any) {
  const sheetId = normalizeSheetId(process.env.SHEET_ID);
  if (!sheetId) throw new Error("Missing env: SHEET_ID");

  const credentials = getServiceAccountCredentials();

  // log แบบ safe
  console.log("Step3 using SHEET_ID:", sheetId);
  console.log("Step3 using SA client_email:", credentials.client_email);

  // ✅ ใส่ drive.readonly เพื่อ “เช็คว่า SA มองเห็นไฟล์จริงไหม”
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  // 1) เช็คผ่าน Drive API (ให้ผลชัดสุด)
  const drive = google.drive({ version: "v3", auth });
  try {
    const meta = await drive.files.get({
      fileId: sheetId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });
    console.log("Drive sees file:", meta.data?.name, meta.data?.mimeType);
  } catch (err: any) {
    const code = err?.code || err?.response?.status;
    const detail =
      err?.response?.data?.error?.message || err?.message || String(err);

    if (code === 404) {
      throw new Error(
        `Drive cannot see this fileId (404). This means the spreadsheet is NOT shared to ${credentials.client_email} OR you are using wrong SHEET_ID. Detail: ${detail}`
      );
    }
    if (code === 403) {
      throw new Error(
        `Drive permission denied (403). Share the spreadsheet to ${credentials.client_email} as Editor. Detail: ${detail}`
      );
    }
    throw new Error(`Drive check failed. Code=${code}. Detail: ${detail}`);
  }

  // 2) Append ผ่าน Sheets API
  const sheets = google.sheets({ version: "v4", auth });

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A1:G1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            payload.ts,
            payload.consultEmail,
            payload.clinical?.problemRepresentation || "",
            JSON.stringify(payload.clinical?.history ?? {}),
            JSON.stringify(payload.clinical?.exam ?? {}),
            JSON.stringify(payload.ai ?? {}),
            "Consulted",
          ],
        ],
      },
    });
  } catch (err: any) {
    const code = err?.code || err?.response?.status;
    const detail =
      err?.response?.data?.error?.message || err?.message || String(err);

    if (code === 404) {
      throw new Error(
        `Sheets API says 404. Usually wrong SHEET_ID or not a spreadsheet. Detail: ${detail}`
      );
    }
    if (code === 403) {
      throw new Error(
        `Sheets API says 403. SA lacks permission—share file to ${credentials.client_email} as Editor. Detail: ${detail}`
      );
    }
    throw new Error(`Append failed. Code=${code}. Detail: ${detail}`);
  }
}

/* ================= SAFE CREDENTIAL PARSER ================= */

function getServiceAccountCredentials() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let jsonString: string | null = null;

  if (b64 && b64.trim()) {
    const cleaned = b64.replace(/\s+/g, "").trim();
    jsonString = Buffer.from(cleaned, "base64").toString("utf8");
  } else if (raw && raw.trim()) {
    jsonString = raw.trim();
    if (
      (jsonString.startsWith("'") && jsonString.endsWith("'")) ||
      (jsonString.startsWith('"') && jsonString.endsWith('"'))
    ) {
      jsonString = jsonString.slice(1, -1);
    }
  } else {
    throw new Error("Missing env: GOOGLE_SERVICE_ACCOUNT_JSON(_B64)");
  }

  // debug safe
  console.log("SA ENV mode:", b64 && b64.trim() ? "B64" : "RAW");
  console.log("SA jsonString length:", jsonString.length);
  console.log("SA jsonString first 20:", jsonString.slice(0, 20));

  let credentials: any;
  try {
    credentials = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(
      `Service account env is not valid JSON. Best fix: use GOOGLE_SERVICE_ACCOUNT_JSON_B64. Original: ${
        err?.message || String(err)
      }`
    );
  }

  if (credentials?.private_key && typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  return credentials;
}